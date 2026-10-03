CREATE TABLE public.referral_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8,16}$'),
  payout_method text CHECK (payout_method IN ('bank', 'paypal', 'wallet')),
  payout_destination text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_accounts TO authenticated;
GRANT ALL ON public.referral_accounts TO service_role;
ALTER TABLE public.referral_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their referral account" ON public.referral_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.referral_accounts(code) ON DELETE CASCADE,
  visitor_hash text NOT NULL,
  landing_path text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.referral_clicks TO service_role;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
CREATE INDEX referral_clicks_code_created_idx ON public.referral_clicks(code, created_at DESC);

CREATE TABLE public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL REFERENCES public.referral_accounts(code) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'trial', 'active', 'cancelled', 'held')),
  attributed_at timestamptz NOT NULL DEFAULT now(),
  first_paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_user_id <> referred_user_id)
);
GRANT SELECT ON public.referral_attributions TO authenticated;
GRANT ALL ON public.referral_attributions TO service_role;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrers read their attributed customers" ON public.referral_attributions FOR SELECT TO authenticated USING (referrer_user_id = auth.uid());
CREATE INDEX referral_attributions_owner_status_idx ON public.referral_attributions(referrer_user_id, status);

CREATE TABLE public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attribution_id uuid NOT NULL REFERENCES public.referral_attributions(id) ON DELETE CASCADE,
  payment_reference text NOT NULL UNIQUE,
  gross_amount_cents bigint NOT NULL CHECK (gross_amount_cents > 0),
  commission_rate smallint NOT NULL CHECK (commission_rate IN (20, 30, 40, 50)),
  commission_amount_cents bigint NOT NULL CHECK (commission_amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reserved', 'paid', 'reversed', 'held')),
  held_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text
);
GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrers read their commissions" ON public.referral_commissions FOR SELECT TO authenticated USING (referrer_user_id = auth.uid());
CREATE INDEX referral_commissions_owner_status_idx ON public.referral_commissions(referrer_user_id, status, created_at DESC);

CREATE TABLE public.referral_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 5000),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  method text NOT NULL CHECK (method IN ('bank', 'paypal', 'wallet')),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'reviewing', 'paid', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  note text
);
GRANT SELECT ON public.referral_payout_requests TO authenticated;
GRANT ALL ON public.referral_payout_requests TO service_role;
ALTER TABLE public.referral_payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their payout requests" ON public.referral_payout_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX referral_payouts_user_created_idx ON public.referral_payout_requests(user_id, requested_at DESC);

CREATE OR REPLACE FUNCTION public.set_referral_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER referral_accounts_updated_at BEFORE UPDATE ON public.referral_accounts FOR EACH ROW EXECUTE FUNCTION public.set_referral_updated_at();
CREATE TRIGGER referral_attributions_updated_at BEFORE UPDATE ON public.referral_attributions FOR EACH ROW EXECUTE FUNCTION public.set_referral_updated_at();

CREATE OR REPLACE FUNCTION public.referral_rate_for_active_count(_active_count integer)
RETURNS smallint LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _active_count >= 25 THEN 50 WHEN _active_count >= 10 THEN 40 WHEN _active_count >= 5 THEN 30 ELSE 20 END::smallint
$$;
REVOKE ALL ON FUNCTION public.referral_rate_for_active_count(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_rate_for_active_count(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.credit_referral_payment(_referred_user_id uuid, _payment_reference text, _gross_amount_cents bigint, _currency text DEFAULT 'USD')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _attribution public.referral_attributions%ROWTYPE;
  _active_count integer;
  _rate smallint;
  _commission_id uuid;
BEGIN
  IF _gross_amount_cents <= 0 OR _payment_reference IS NULL OR length(trim(_payment_reference)) < 3 THEN RAISE EXCEPTION 'Invalid payment'; END IF;
  SELECT * INTO _attribution FROM public.referral_attributions WHERE referred_user_id = _referred_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.referral_attributions SET status = 'active', first_paid_at = COALESCE(first_paid_at, now()), updated_at = now() WHERE id = _attribution.id;
  SELECT count(*) INTO _active_count FROM public.referral_attributions WHERE referrer_user_id = _attribution.referrer_user_id AND status = 'active';
  _rate := public.referral_rate_for_active_count(_active_count);
  INSERT INTO public.referral_commissions (referrer_user_id, attribution_id, payment_reference, gross_amount_cents, commission_rate, commission_amount_cents, currency)
  VALUES (_attribution.referrer_user_id, _attribution.id, trim(_payment_reference), _gross_amount_cents, _rate, floor(_gross_amount_cents * _rate / 100.0), upper(_currency))
  ON CONFLICT (payment_reference) DO NOTHING RETURNING id INTO _commission_id;
  RETURN _commission_id;
END;
$$;
REVOKE ALL ON FUNCTION public.credit_referral_payment(uuid, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_payment(uuid, text, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reverse_referral_payment(_payment_reference text, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.referral_commissions SET status = 'reversed', reversed_at = now(), reversal_reason = left(coalesce(_reason, 'Payment reversed'), 500)
  WHERE payment_reference = _payment_reference AND status <> 'reversed';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.reverse_referral_payment(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_referral_payment(text, text) TO service_role;
CREATE OR REPLACE FUNCTION public.request_referral_payout(_user_id uuid, _method text, _destination text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _available bigint;
  _request_id uuid;
BEGIN
  IF _method NOT IN ('bank', 'paypal', 'wallet') OR length(trim(_destination)) < 5 THEN
    RAISE EXCEPTION 'Invalid payout details';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.referral_payout_requests WHERE user_id = _user_id AND status IN ('requested', 'reviewing')) THEN
    RAISE EXCEPTION 'Payout already pending';
  END IF;
  SELECT coalesce(sum(commission_amount_cents), 0) INTO _available
  FROM public.referral_commissions
  WHERE referrer_user_id = _user_id AND currency = 'USD' AND status = 'approved';
  IF _available < 5000 THEN RAISE EXCEPTION 'Minimum payout is 50 USD'; END IF;
  INSERT INTO public.referral_payout_requests(user_id, amount_cents, currency, method, destination)
  VALUES (_user_id, _available, 'USD', _method, trim(_destination)) RETURNING id INTO _request_id;
  UPDATE public.referral_commissions SET status = 'reserved'
  WHERE referrer_user_id = _user_id AND currency = 'USD' AND status = 'approved';
  INSERT INTO public.referral_accounts(user_id, code, payout_method, payout_destination)
  VALUES (_user_id, 'SAHL' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), _method, trim(_destination))
  ON CONFLICT (user_id) DO UPDATE SET payout_method = EXCLUDED.payout_method, payout_destination = EXCLUDED.payout_destination, updated_at = now();
  RETURN _request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_referral_payout(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_referral_payout(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_mature_referral_commissions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  UPDATE public.referral_commissions SET status = 'approved', approved_at = now()
  WHERE status = 'pending' AND held_until <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_mature_referral_commissions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mature_referral_commissions() TO service_role;
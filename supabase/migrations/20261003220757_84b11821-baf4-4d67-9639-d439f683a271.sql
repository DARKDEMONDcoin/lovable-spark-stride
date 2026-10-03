GRANT SELECT ON public.referral_clicks TO authenticated;
CREATE POLICY "Referrers read clicks for their codes"
ON public.referral_clicks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.referral_accounts account
  WHERE account.code = referral_clicks.code AND account.user_id = auth.uid()
));
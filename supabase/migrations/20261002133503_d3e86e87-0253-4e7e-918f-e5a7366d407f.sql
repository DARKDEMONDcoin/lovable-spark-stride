REVOKE ALL ON FUNCTION public.sync_employee_inbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_employee_inbox() TO service_role;
DELETE FROM public.messages;
DELETE FROM public.conversations;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS use_website_context boolean NOT NULL DEFAULT true;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_employee_message text,
  ADD COLUMN IF NOT EXISTS last_employee_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_one_per_employee UNIQUE (workspace_id, employee_id),
  ADD CONSTRAINT conversations_unread_nonnegative CHECK (unread_count >= 0);

CREATE OR REPLACE FUNCTION public.sync_employee_inbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL AND NEW.role <> 'user' THEN
    UPDATE public.conversations
    SET last_employee_message = left(NEW.body, 500),
        last_employee_message_at = NEW.created_at,
        unread_count = unread_count + 1,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_sync_employee_inbox ON public.messages;
CREATE TRIGGER messages_sync_employee_inbox
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_inbox();
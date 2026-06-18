-- Drop the old single-argument overload that still has the broken logic.
-- The edge function always calls delete_user_cascade(target_user_id, performing_admin_id)
-- so the two-argument version is the only one needed.
DROP FUNCTION IF EXISTS public.delete_user_cascade(uuid);

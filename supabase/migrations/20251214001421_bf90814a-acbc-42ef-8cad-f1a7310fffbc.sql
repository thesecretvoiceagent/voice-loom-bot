-- Create organization settings table for secure storage of API keys and webhook secrets
CREATE TABLE public.organization_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    api_key text,
    api_key_created_at timestamptz,
    webhook_url text,
    webhook_secret text,
    webhook_secret_created_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Users can only view their own settings
CREATE POLICY "Users can view own settings" ON public.organization_settings
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings" ON public.organization_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings" ON public.organization_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_organization_settings_updated_at
    BEFORE UPDATE ON public.organization_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Remove permissive audit log INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Create secure function for audit logging
CREATE OR REPLACE FUNCTION public.log_audit_event(
    _action text,
    _resource_type text,
    _resource_id text DEFAULT NULL,
    _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), _action, _resource_type, _resource_id, _details);
END;
$$;

-- Create policy for authenticated users to call the audit function (via RPC)
CREATE POLICY "Authenticated users can insert via function" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
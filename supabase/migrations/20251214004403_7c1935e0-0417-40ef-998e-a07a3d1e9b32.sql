
-- Create items table with soft delete support
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID REFERENCES auth.users(id),
  deleted_by_user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for items
-- Admins can do everything
CREATE POLICY "Admins can do everything with items"
ON public.items
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Editors can view, add, edit, soft delete
CREATE POLICY "Editors can view items"
ON public.items
FOR SELECT
USING (public.has_role(auth.uid(), 'editor') AND deleted_at IS NULL);

CREATE POLICY "Editors can insert items"
ON public.items
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update items"
ON public.items
FOR UPDATE
USING (public.has_role(auth.uid(), 'editor'));

-- Auditors can view everything including deleted (read-only)
CREATE POLICY "Auditors can view all items"
ON public.items
FOR SELECT
USING (public.has_role(auth.uid(), 'auditor'));

-- Users can view active items
CREATE POLICY "Users can view active items"
ON public.items
FOR SELECT
USING (public.has_role(auth.uid(), 'user') AND deleted_at IS NULL);

-- Users can insert items
CREATE POLICY "Users can insert items"
ON public.items
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'user'));

-- Users can update/delete their own items
CREATE POLICY "Users can update own items"
ON public.items
FOR UPDATE
USING (public.has_role(auth.uid(), 'user') AND created_by_user_id = auth.uid());

-- Viewers can only view active items
CREATE POLICY "Viewers can view active items"
ON public.items
FOR SELECT
USING (public.has_role(auth.uid(), 'viewer') AND deleted_at IS NULL);

-- Support can view all including deleted
CREATE POLICY "Support can view all items"
ON public.items
FOR SELECT
USING (public.has_role(auth.uid(), 'support'));

-- Support can update (for restore)
CREATE POLICY "Support can update items"
ON public.items
FOR UPDATE
USING (public.has_role(auth.uid(), 'support'));

-- Moderators (existing role) treated like editors
CREATE POLICY "Moderators can view items"
ON public.items
FOR SELECT
USING (public.has_role(auth.uid(), 'moderator') AND deleted_at IS NULL);

CREATE POLICY "Moderators can insert items"
ON public.items
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can update items"
ON public.items
FOR UPDATE
USING (public.has_role(auth.uid(), 'moderator'));

-- Create trigger for updated_at
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create item_audit_logs table for detailed item changes
CREATE TABLE public.item_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id),
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.item_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins and auditors can view audit logs
CREATE POLICY "Admins can view item audit logs"
ON public.item_audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auditors can view item audit logs"
ON public.item_audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'auditor'));

-- All authenticated users can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON public.item_audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Insert some seed items for testing
INSERT INTO public.items (title, description, category, status) VALUES
('Voice Agent Alpha', 'Primary inbound call handler for customer support', 'Voice Agents', 'active'),
('Campaign Q4 2024', 'End of year sales campaign', 'Campaigns', 'active'),
('Call Script Template', 'Standard greeting and qualification script', 'Scripts', 'active'),
('Integration Webhook', 'CRM sync webhook configuration', 'Integrations', 'archived'),
('Test Agent Beta', 'Development testing agent', 'Voice Agents', 'active');

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePOV } from '@/contexts/POVContext';
import { toast } from 'sonner';

export interface Item {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by_user_id: string | null;
  deleted_by_user_id: string | null;
}

export interface ItemAuditLog {
  id: string;
  item_id: string | null;
  action: string;
  actor_user_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [auditLogs, setAuditLogs] = useState<ItemAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { currentUser, permissions } = usePOV();

  const fetchItems = useCallback(async (showDeleted = false) => {
    setLoading(true);
    try {
      let query = supabase.from('items').select('*').order('created_at', { ascending: false });

      // If user can't view deleted, filter them out
      if (!showDeleted || !permissions.canViewDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setItems(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch items';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [permissions.canViewDeleted]);

  const fetchAuditLogs = useCallback(async () => {
    if (!permissions.canViewAuditLog) return;

    try {
      const { data, error } = await supabase
        .from('item_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAuditLogs((data || []) as ItemAuditLog[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch audit logs';
      toast.error(message);
    }
  }, [permissions.canViewAuditLog]);

  const logAudit = async (action: string, itemId: string, beforeData?: Item | null, afterData?: Item | null) => {
    try {
      await supabase.from('item_audit_logs').insert([{
        action,
        item_id: itemId,
        actor_user_id: null,
        before_data: beforeData ? JSON.parse(JSON.stringify(beforeData)) : null,
        after_data: afterData ? JSON.parse(JSON.stringify(afterData)) : null,
      }]);
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  };

  const addItem = async (item: Omit<Item, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by_user_id' | 'deleted_by_user_id'>) => {
    if (!permissions.canAdd) {
      toast.error('You do not have permission to add items');
      return false;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .insert({
          ...item,
          created_by_user_id: null, // In real app, this would be auth.uid()
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit('create', data.id, null, data);
      toast.success('Item saved successfully');
      await fetchItems();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save item';
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (id: string, updates: Partial<Item>) => {
    const item = items.find((i) => i.id === id);
    const canEdit = permissions.canEdit || (permissions.canEditOwn && item?.created_by_user_id === currentUser.id);

    if (!canEdit) {
      toast.error('You do not have permission to edit this item');
      return false;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await logAudit('update', id, item, data);
      toast.success('Item updated successfully');
      await fetchItems();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update item';
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const softDeleteItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    const canDelete = permissions.canSoftDelete || (permissions.canEditOwn && item?.created_by_user_id === currentUser.id);

    if (!canDelete) {
      toast.error('You do not have permission to delete this item');
      return false;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by_user_id: null, // In real app, this would be auth.uid()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await logAudit('soft_delete', id, item, data);
      toast.success('Item moved to trash');
      await fetchItems();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete item';
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const hardDeleteItem = async (id: string) => {
    if (!permissions.canHardDelete) {
      toast.error('You do not have permission to permanently delete items');
      return false;
    }

    const item = items.find((i) => i.id === id);
    setSaving(true);
    try {
      const { error } = await supabase.from('items').delete().eq('id', id);

      if (error) throw error;

      await logAudit('hard_delete', id, item, null);
      toast.success('Item permanently deleted');
      await fetchItems();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete item';
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const restoreItem = async (id: string) => {
    if (!permissions.canRestore) {
      toast.error('You do not have permission to restore items');
      return false;
    }

    const item = items.find((i) => i.id === id);
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .update({
          deleted_at: null,
          deleted_by_user_id: null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await logAudit('restore', id, item, data);
      toast.success('Item restored');
      await fetchItems(true);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore item';
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchAuditLogs();
  }, [fetchItems, fetchAuditLogs]);

  return {
    items,
    auditLogs,
    loading,
    saving,
    fetchItems,
    fetchAuditLogs,
    addItem,
    updateItem,
    softDeleteItem,
    hardDeleteItem,
    restoreItem,
  };
}

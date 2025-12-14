import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { usePOV } from '@/contexts/POVContext';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  onConfirm: (hardDelete: boolean) => void;
  saving: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemTitle,
  onConfirm,
  saving,
}: DeleteConfirmDialogProps) {
  const [hardDelete, setHardDelete] = useState(false);
  const { permissions } = usePOV();

  const handleConfirm = () => {
    onConfirm(hardDelete);
    setHardDelete(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{itemTitle}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {hardDelete
              ? 'This action cannot be undone. The item will be permanently deleted.'
              : 'This can be undone if you have permission. The item will be moved to trash.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {permissions.canHardDelete && (
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="hardDelete"
              checked={hardDelete}
              onCheckedChange={(checked) => setHardDelete(checked === true)}
            />
            <Label htmlFor="hardDelete" className="text-sm text-muted-foreground">
              Permanently delete (cannot be undone)
            </Label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={saving}
            className={hardDelete ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {saving ? 'Deleting...' : hardDelete ? 'Permanently Delete' : 'Move to Trash'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

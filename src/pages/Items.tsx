import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RotateCcw, Loader2, History } from 'lucide-react';
import { useItems, Item } from '@/hooks/useItems';
import { usePOV } from '@/contexts/POVContext';
import { ItemFormDialog } from '@/components/items/ItemFormDialog';
import { DeleteConfirmDialog } from '@/components/items/DeleteConfirmDialog';
import { format } from 'date-fns';

const CATEGORIES = ['All', 'Voice Agents', 'Campaigns', 'Scripts', 'Integrations', 'Other'];

export default function Items() {
  const {
    items,
    auditLogs,
    loading,
    saving,
    fetchItems,
    addItem,
    updateItem,
    softDeleteItem,
    hardDeleteItem,
    restoreItem,
  } = useItems();
  const { permissions } = usePOV();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showDeleted, setShowDeleted] = useState(false);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesDeleted = showDeleted || !item.deleted_at;
    return matchesSearch && matchesCategory && matchesDeleted;
  });

  const handleAddNew = () => {
    setEditingItem(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormDialogOpen(true);
  };

  const handleDelete = (item: Item) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleSave = async (data: { title: string; description: string; category: string; status: string }) => {
    if (editingItem) {
      return await updateItem(editingItem.id, data);
    } else {
      return await addItem(data);
    }
  };

  const handleConfirmDelete = async (hardDelete: boolean) => {
    if (!deletingItem) return;

    if (hardDelete) {
      await hardDeleteItem(deletingItem.id);
    } else {
      await softDeleteItem(deletingItem.id);
    }
    setDeleteDialogOpen(false);
    setDeletingItem(null);
  };

  const handleRestore = async (item: Item) => {
    await restoreItem(item.id);
  };

  const handleShowDeletedChange = (checked: boolean) => {
    setShowDeleted(checked);
    fetchItems(checked);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Items</h1>
          <p className="mt-1 text-muted-foreground">Manage your items with full CRUD operations</p>
        </div>
        {permissions.canAdd && (
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Item
          </Button>
        )}
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          {permissions.canViewAuditLog && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          {/* Filters */}
          <Card className="glass-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {permissions.canViewDeleted && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="showDeleted"
                      checked={showDeleted}
                      onCheckedChange={handleShowDeletedChange}
                    />
                    <Label htmlFor="showDeleted" className="text-sm">
                      Show deleted
                    </Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="glass-card border-border/50">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No items found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      {(permissions.canEdit || permissions.canSoftDelete) && (
                        <TableHead className="w-[70px]">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className={item.deleted_at ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.category && <Badge variant="outline">{item.category}</Badge>}
                        </TableCell>
                        <TableCell>
                          {item.deleted_at ? (
                            <Badge variant="destructive">Deleted</Badge>
                          ) : (
                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                              {item.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(item.updated_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        {(permissions.canEdit || permissions.canSoftDelete) && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {item.deleted_at ? (
                                  permissions.canRestore && (
                                    <DropdownMenuItem onClick={() => handleRestore(item)}>
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      Restore
                                    </DropdownMenuItem>
                                  )
                                ) : (
                                  <>
                                    {(permissions.canEdit || permissions.canEditOwn) && (
                                      <DropdownMenuItem onClick={() => handleEdit(item)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                    )}
                                    {(permissions.canSoftDelete || permissions.canHardDelete) && (
                                      <DropdownMenuItem
                                        onClick={() => handleDelete(item)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {permissions.canViewAuditLog && (
          <TabsContent value="audit" className="space-y-4">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No audit logs yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Before</TableHead>
                        <TableHead>After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge
                              variant={
                                log.action === 'create'
                                  ? 'default'
                                  : log.action.includes('delete')
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.item_id?.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs font-mono">
                            {log.before_data ? JSON.stringify(log.before_data).slice(0, 50) + '...' : '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs font-mono">
                            {log.after_data ? JSON.stringify(log.after_data).slice(0, 50) + '...' : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <ItemFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        item={editingItem}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemTitle={deletingItem?.title || ''}
        onConfirm={handleConfirmDelete}
        saving={saving}
      />
    </div>
  );
}

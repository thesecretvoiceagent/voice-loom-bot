import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Loader2, Search, Save, X, Pencil } from "lucide-react";
import { toast } from "sonner";

interface VehicleRow {
  id: string;
  reg_no: string;
  make: string | null;
  model: string | null;
  year_of_built: number | null;
  color: string | null;
  owner_name: string | null;
  phone_number: string | null;
  insurer: string | null;
  cover_type: string | null;
  cover_status: string | null;
}

type EditableFields = Omit<VehicleRow, "id">;

const EMPTY_ROW: EditableFields = {
  reg_no: "",
  make: "",
  model: "",
  year_of_built: null,
  color: "",
  owner_name: "",
  phone_number: "",
  insurer: "",
  cover_type: "",
  cover_status: "",
};

const COLUMNS: { key: keyof EditableFields; label: string; type?: "number" }[] = [
  { key: "reg_no", label: "Reg №" },
  { key: "owner_name", label: "Owner" },
  { key: "phone_number", label: "Phone" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "year_of_built", label: "Year", type: "number" },
  { key: "color", label: "Color" },
  { key: "insurer", label: "Insurer" },
  { key: "cover_type", label: "Cover" },
  { key: "cover_status", label: "Status" },
];

export function KnowledgeBaseTable() {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<EditableFields>(EMPTY_ROW);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditableFields>(EMPTY_ROW);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRows = async () => {
    const { data, error } = await supabase
      .from("crm_vehicles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error(`Failed to load: ${error.message}`);
    } else {
      setRows((data as VehicleRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.reg_no?.toLowerCase().includes(q) ||
      r.owner_name?.toLowerCase().includes(q) ||
      r.phone_number?.toLowerCase().includes(q) ||
      r.make?.toLowerCase().includes(q) ||
      r.model?.toLowerCase().includes(q)
    );
  });

  const handleAdd = async () => {
    if (!draft.reg_no.trim()) {
      toast.error("Reg № is required");
      return;
    }
    setSaving(true);
    const payload: any = { ...draft, reg_no: draft.reg_no.trim() };
    if (payload.year_of_built === "" || payload.year_of_built === null) {
      delete payload.year_of_built;
    } else {
      payload.year_of_built = Number(payload.year_of_built);
    }
    const { error } = await supabase.from("crm_vehicles").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client added");
    setDraft(EMPTY_ROW);
    setAdding(false);
    fetchRows();
  };

  const handleStartEdit = (row: VehicleRow) => {
    setEditingId(row.id);
    const { id, ...rest } = row;
    setEditDraft(rest);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const payload: any = { ...editDraft };
    if (payload.year_of_built === "" || payload.year_of_built === null) {
      payload.year_of_built = null;
    } else {
      payload.year_of_built = Number(payload.year_of_built);
    }
    const { error } = await supabase
      .from("crm_vehicles")
      .update(payload)
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Updated");
    setEditingId(null);
    fetchRows();
  };

  const handleDelete = async (row: VehicleRow) => {
    if (!confirm(`Delete ${row.reg_no}?`)) return;
    setDeletingId(row.id);
    const { error } = await supabase.from("crm_vehicles").delete().eq("id", row.id);
    setDeletingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reg №, owner, phone, make, model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {rows.length} clients
          </span>
          <Button
            type="button"
            variant="neon"
            size="sm"
            className="gap-2"
            onClick={() => {
              setAdding(true);
              setDraft(EMPTY_ROW);
            }}
            disabled={adding}
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                {COLUMNS.map((c) => (
                  <TableHead key={c.key} className="whitespace-nowrap text-xs">
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adding && (
                <TableRow className="bg-primary/5">
                  {COLUMNS.map((c) => (
                    <TableCell key={c.key} className="p-1.5">
                      <Input
                        type={c.type === "number" ? "number" : "text"}
                        placeholder={c.label}
                        value={(draft[c.key] ?? "") as string | number}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [c.key]:
                              c.type === "number"
                                ? e.target.value === ""
                                  ? null
                                  : Number(e.target.value)
                                : e.target.value,
                          }))
                        }
                        className="h-8 text-xs"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right p-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleAdd}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setAdding(false);
                          setDraft(EMPTY_ROW);
                        }}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((c) => (
                      <TableCell key={c.key} className="p-2">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMNS.length + 1}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    {rows.length === 0
                      ? "No clients yet. Add one to populate the knowledge base."
                      : "No clients match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <TableRow key={row.id} className="text-sm">
                      {COLUMNS.map((c) => (
                        <TableCell key={c.key} className="p-1.5 whitespace-nowrap">
                          {isEditing ? (
                            <Input
                              type={c.type === "number" ? "number" : "text"}
                              value={(editDraft[c.key] ?? "") as string | number}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  [c.key]:
                                    c.type === "number"
                                      ? e.target.value === ""
                                        ? null
                                        : Number(e.target.value)
                                      : e.target.value,
                                }))
                              }
                              className="h-8 text-xs"
                            />
                          ) : (
                            <span className="text-foreground">
                              {row[c.key] ?? <span className="text-muted-foreground">—</span>}
                            </span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right p-1.5">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={handleSaveEdit}
                                disabled={saving}
                              >
                                {saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 text-primary" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleStartEdit(row)}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(row)}
                                disabled={deletingId === row.id}
                              >
                                {deletingId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

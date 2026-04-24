import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, KeyRound, Trash2, Copy, Bot, ExternalLink, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  password_hash: string | null;
  created_at: string;
}

interface AgentLite {
  id: string;
  name: string;
  tenant_id: string | null;
}

interface PhoneNumberRow {
  id: string;
  phone_number: string;
  label: string | null;
  provider: string | null;
  country: string | null;
  tenant_id: string | null;
  agent_id: string | null;
  notes: string | null;
  is_active: boolean;
}

export default function TenantsAdmin() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add tenant dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // Delete confirm
  const [deleteTenant, setDeleteTenant] = useState<TenantRow | null>(null);

  // Password reveal dialog
  const [revealedPassword, setRevealedPassword] = useState<{
    tenantName: string;
    password: string;
  } | null>(null);

  // Set custom password dialog
  const [customPwTenant, setCustomPwTenant] = useState<TenantRow | null>(null);
  const [customPw, setCustomPw] = useState("");

  // Add phone number dialog
  const [addPhoneOpen, setAddPhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneLabel, setNewPhoneLabel] = useState("");
  const [newPhoneCountry, setNewPhoneCountry] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);

  // Delete phone confirm
  const [deletePhone, setDeletePhone] = useState<PhoneNumberRow | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: tData }, { data: aData }, { data: pData }] = await Promise.all([
      supabase.from("tenants").select("*").order("name"),
      supabase.from("agents").select("id, name, tenant_id").order("name"),
      supabase.from("phone_numbers" as any).select("*").order("phone_number"),
    ]);
    setTenants((tData as TenantRow[]) || []);
    setAgents((aData as AgentLite[]) || []);
    setPhoneNumbers((pData as PhoneNumberRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto mt-12">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You need admin role to manage tenants.
        </p>
        <Link
          to="/"
          className="inline-block mt-4 text-sm text-primary hover:underline"
        >
          ← Back to dashboard
        </Link>
      </Card>
    );
  }

  const handleAdd = async () => {
    const slug = newSlug.trim().toLowerCase();
    const name = newName.trim();
    if (!slug || !name) {
      toast.error("Slug and name are required");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      toast.error("Slug must be lowercase, alphanumeric and dashes only");
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from("tenants")
      .insert({ slug, name });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Tenant "${name}" created`);
    setAddOpen(false);
    setNewSlug("");
    setNewName("");
    await fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTenant) return;
    const { error } = await supabase
      .from("tenants")
      .delete()
      .eq("id", deleteTenant.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted ${deleteTenant.name}`);
    setDeleteTenant(null);
    await fetchAll();
  };

  const handleRotate = async (t: TenantRow) => {
    const { data, error } = await supabase.functions.invoke("tenant-auth", {
      body: { action: "rotate", tenant_id: t.id },
    });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Rotate failed");
      return;
    }
    setRevealedPassword({ tenantName: t.name, password: data.password });
    await fetchAll();
  };

  const handleSetCustom = async () => {
    if (!customPwTenant) return;
    if (customPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const { data, error } = await supabase.functions.invoke("tenant-auth", {
      body: {
        action: "set_password",
        tenant_id: customPwTenant.id,
        password: customPw,
      },
    });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Failed");
      return;
    }
    toast.success(`Password set for ${customPwTenant.name}`);
    setCustomPwTenant(null);
    setCustomPw("");
    await fetchAll();
  };

  const handleAssignAgent = async (agentId: string, tenantId: string | null) => {
    const { error } = await supabase
      .from("agents")
      .update({ tenant_id: tenantId } as any)
      .eq("id", agentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agent assignment updated");
    await fetchAll();
  };

  const copyPw = () => {
    if (!revealedPassword) return;
    navigator.clipboard.writeText(revealedPassword.password);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Admin · Tenants</h1>
          <p className="mt-1 text-muted-foreground">
            Manage client workspaces and passwords
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add tenant
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Workspaces</h2>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ul className="divide-y divide-border">
            {tenants.map((t) => (
              <li key={t.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      /{t.slug}
                    </Badge>
                    {t.password_hash ? (
                      <Badge variant="default" className="text-xs">Password set</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">No password</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {agents.filter((a) => a.tenant_id === t.id).length} agents assigned
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => window.open(`/${t.slug}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Access
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRotate(t)}
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    Generate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomPwTenant(t)}
                  >
                    Set custom
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTenant(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Agent → Tenant assignment
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Assign each agent to a workspace. Unassigned agents stay visible only on the main / dashboard.
        </p>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agents found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {agents.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-4">
                <span className="font-medium truncate">{a.name}</span>
                <select
                  value={a.tenant_id || ""}
                  onChange={(e) =>
                    handleAssignAgent(a.id, e.target.value || null)
                  }
                  className="bg-background border border-border rounded-md px-3 py-1.5 text-sm"
                >
                  <option value="">— Unassigned —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Add tenant */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="acme"
              />
              <p className="text-xs text-muted-foreground">
                Will be accessible at app.beyondcode.ai/{newSlug || "slug"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal generated password */}
      <Dialog
        open={!!revealedPassword}
        onOpenChange={(o) => !o && setRevealedPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password for {revealedPassword?.tenantName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Save this password now — it won't be shown again.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={revealedPassword?.password || ""}
                className="font-mono"
              />
              <Button onClick={copyPw} variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set custom password */}
      <Dialog
        open={!!customPwTenant}
        onOpenChange={(o) => {
          if (!o) {
            setCustomPwTenant(null);
            setCustomPw("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password for {customPwTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New password (min 8 chars)</Label>
            <Input
              type="text"
              value={customPw}
              onChange={(e) => setCustomPw(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCustomPwTenant(null);
                setCustomPw("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSetCustom}>Set password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTenant}
        onOpenChange={(o) => !o && setDeleteTenant(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTenant?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the workspace. Agents and calls assigned to it will
              be unassigned (set back to NULL) but not deleted. The voicebot
              pipeline is unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { useAgents, type AgentRow } from "@/hooks/useAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Phone,
  Copy,
  Trash2,
  Upload,
  Pencil,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TestCallDialog } from "@/components/agents/TestCallDialog";
import { BulkUploadDialog } from "@/components/agents/BulkUploadDialog";
import { toast } from "sonner";

export default function TenantAgents() {
  const { tenant } = useTenant();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { agents, loading, toggleAgent, deleteAgent } = useAgents({
    tenant_id: tenant?.id,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [testCallDialogOpen, setTestCallDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleTestCall = (agent: AgentRow) => {
    setSelectedAgent(agent);
    setTestCallDialogOpen(true);
  };

  const handleBulkUpload = (agent: AgentRow) => {
    setSelectedAgent(agent);
    setBulkUploadDialogOpen(true);
  };

  const handleDelete = async (agent: AgentRow) => {
    if (!confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    setDeletingId(agent.id);
    try {
      await deleteAgent(agent.id);
      toast.success(`"${agent.name}" deleted`);
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (agent: AgentRow) => {
    try {
      await toggleAgent(agent.id, !agent.is_active);
      toast.success(
        `${agent.name} ${agent.is_active ? "deactivated" : "activated"}`,
      );
    } catch {
      toast.error("Failed to update agent");
    }
  };

  const editLink = (agent: AgentRow) =>
    `/agents/create/${agent.type}?edit=${agent.id}&tenant=${tenant?.id}&tenantSlug=${tenantSlug}`;
  const createLink = (type: "inbound" | "outbound") =>
    `/agents/create/${type}?tenant=${tenant?.id}&tenantSlug=${tenantSlug}`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Voice Agents</h1>
          <p className="mt-1 text-muted-foreground">
            Agents for {tenant?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to={createLink("inbound")}>
            <Button variant="outline" className="gap-2">
              <PhoneIncoming className="h-4 w-4" />
              Create Inbound Agent
            </Button>
          </Link>
          <Link to={createLink("outbound")}>
            <Button className="gap-2">
              <PhoneOutgoing className="h-4 w-4" />
              Create Outbound Agent
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">
            {agents.length === 0
              ? "No agents in this workspace yet. Create one to get started."
              : "No agents match your search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="glass-card rounded-xl p-5 transition-all duration-300 hover:shadow-elevated"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground truncate">
                      {agent.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          agent.is_active
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {agent.is_active ? "ACTIVE" : "OFF"}
                      </span>
                      <Switch
                        checked={agent.is_active}
                        onCheckedChange={() => handleToggle(agent)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {agent.phone_number || "No phone"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                        agent.type === "outbound"
                          ? "bg-primary/10 text-primary"
                          : "bg-success/10 text-success",
                      )}
                    >
                      {agent.type === "outbound" ? (
                        <>
                          <PhoneOutgoing className="h-3 w-3" />
                          Outbound
                        </>
                      ) : (
                        <>
                          <PhoneIncoming className="h-3 w-3" />
                          Inbound
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <Link to={editLink(agent)}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-foreground">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Agent ID:</span>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <code className="text-xs bg-secondary px-2 py-1 rounded font-mono truncate">
                    {agent.id.substring(0, 24)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => copyToClipboard(agent.id)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Link to={`/${tenantSlug}/calls`} className="flex-1">
                  <Button variant="outline" className="w-full gap-2">
                    <FileText className="h-4 w-4" />
                    Call Logs
                  </Button>
                </Link>
                <Link to={editLink(agent)} className="flex-1">
                  <Button variant="neon" className="w-full gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit Agent
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => handleTestCall(agent)}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => handleBulkUpload(agent)}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(agent)}
                  disabled={deletingId === agent.id}
                >
                  {deletingId === agent.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAgent && (
        <>
          <TestCallDialog
            open={testCallDialogOpen}
            onOpenChange={setTestCallDialogOpen}
            agentName={selectedAgent.name}
            agentId={selectedAgent.id}
            agentType={selectedAgent.type}
            systemPrompt={selectedAgent.system_prompt || ""}
            greeting={selectedAgent.greeting || ""}
          />
          <BulkUploadDialog
            open={bulkUploadDialogOpen}
            onOpenChange={setBulkUploadDialogOpen}
            agentName={selectedAgent.name}
          />
        </>
      )}
    </div>
  );
}

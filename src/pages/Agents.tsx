import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Search,
  MoreVertical,
  Phone,
  Copy,
  Trash2,
  Upload,
  Pencil,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TestCallDialog } from "@/components/agents/TestCallDialog";
import { BulkUploadDialog } from "@/components/agents/BulkUploadDialog";
import { toast } from "sonner";

const agents = [
  {
    id: "1",
    name: "Edvini AI",
    type: "outbound",
    phoneLabel: "Mobile EST",
    isActive: true,
    createdAt: "12/3/2025",
    campaignId: "5006f92f-611f-45d7-9...",
  },
  {
    id: "2",
    name: "Carnosport",
    type: "inbound",
    phoneLabel: "Mobile EST",
    isActive: false,
    createdAt: "11/19/2025",
    deactivatedAt: "12/4/2025",
    campaignId: "706ea363-17d5-4c70-8...",
  },
  {
    id: "3",
    name: "Delfi Outbound",
    type: "outbound",
    phoneLabel: "Mobile EST",
    isActive: true,
    createdAt: "11/13/2025",
    campaignId: "9432cfa7-28f5-40d9-a...",
  },
  {
    id: "4",
    name: "BTA Kindlustus (DEMO)",
    type: "outbound",
    phoneLabel: "Mobile EST",
    isActive: false,
    createdAt: "10/22/2025",
    deactivatedAt: "10/27/2025",
    campaignId: "534fba7c-68c8-4691-8...",
  },
  {
    id: "5",
    name: "BeyondCode AI Häälerobot",
    type: "inbound",
    phoneLabel: "Mobile EST",
    isActive: false,
    createdAt: "10/21/2025",
    deactivatedAt: "11/11/2025",
    campaignId: "87ee2a50-0d7c-4ae9-8...",
  },
  {
    id: "6",
    name: "IIZI Kindlustu kahjujuhtum",
    type: "inbound",
    phoneLabel: "Mobile EST",
    isActive: false,
    createdAt: "10/16/2025",
    deactivatedAt: "10/27/2025",
    campaignId: "0d2ca9ca-1d34-4295-9...",
  },
];

export default function Agents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [testCallDialogOpen, setTestCallDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<typeof agents[0] | null>(null);

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleTestCall = (agent: typeof agents[0]) => {
    setSelectedAgent(agent);
    setTestCallDialogOpen(true);
  };

  const handleBulkUpload = (agent: typeof agents[0]) => {
    setSelectedAgent(agent);
    setBulkUploadDialogOpen(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Voice Agents</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your AI voice agents for phone calls
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/agents/create/inbound">
            <Button variant="outline" className="gap-2">
              <PhoneIncoming className="h-4 w-4" />
              Create Inbound Agent
            </Button>
          </Link>
          <Link to="/agents/create/outbound">
            <Button className="gap-2">
              <PhoneOutgoing className="h-4 w-4" />
              Create Outbound Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
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

      {/* Agents Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredAgents.map((agent) => (
          <div
            key={agent.id}
            className="glass-card rounded-xl p-5 transition-all duration-300 hover:shadow-elevated"
          >
            {/* Header */}
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
                        agent.isActive
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {agent.isActive ? "ACTIVE" : "OFF"}
                    </span>
                    <Switch checked={agent.isActive} />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">
                    {agent.phoneLabel}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                      agent.type === "outbound"
                        ? "bg-primary/10 text-primary"
                        : "bg-success/10 text-success"
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
              <Link to={`/agents/create/${agent.type}?edit=${agent.id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Dates */}
            <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground">{agent.createdAt}</span>
              </div>
              {agent.deactivatedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deactivated:</span>
                  <span className="text-foreground">{agent.deactivatedAt}</span>
                </div>
              )}
            </div>

            {/* Campaign ID */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Campaign ID:</span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <code className="text-xs bg-secondary px-2 py-1 rounded font-mono truncate">
                  {agent.campaignId}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyToClipboard(agent.campaignId)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <Link to={`/agents/${agent.id}/calls`} className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <FileText className="h-4 w-4" />
                  Call Logs
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
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialogs */}
      {selectedAgent && (
        <>
          <TestCallDialog
            open={testCallDialogOpen}
            onOpenChange={setTestCallDialogOpen}
            agentName={selectedAgent.name}
            agentType={selectedAgent.type}
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

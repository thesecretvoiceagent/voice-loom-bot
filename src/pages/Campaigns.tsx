import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone, Plus, Search, Play, Pause, MoreVertical,
  Users, Phone, CheckCircle2, Calendar, BarChart3,
  Upload, Trash2, Pencil, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Campaigns() {
  const { campaigns, loading, deleteCampaign, updateCampaign } = useCampaigns();
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleCampaignStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      await updateCampaign(id, { status: newStatus } as any);
      toast.success(`Campaign ${newStatus === "active" ? "started" : "paused"}`);
    } catch {
      toast.error("Failed to update campaign");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteCampaign(id);
      toast.success("Campaign deleted");
    } catch {
      toast.error("Failed to delete campaign");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Campaigns</h1>
          <p className="mt-1 text-muted-foreground">Manage outbound calling campaigns</p>
        </div>
        <Link to="/campaigns/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search campaigns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-6 space-y-4">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">
            {campaigns.length === 0
              ? "No campaigns yet. Create your first campaign to get started."
              : "No campaigns match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign, index) => (
            <div key={campaign.id} className="glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-elevated" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex items-start gap-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-primary">
                  <Megaphone className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-foreground">{campaign.name}</h3>
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          campaign.status === "active" && "bg-success/10 text-success",
                          campaign.status === "paused" && "bg-warning/10 text-warning",
                          campaign.status === "scheduled" && "bg-primary/10 text-primary",
                          campaign.status === "completed" && "bg-muted text-muted-foreground",
                        )}>
                          {campaign.status === "active" && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
                          {campaign.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant={campaign.status === "active" ? "outline" : "default"}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => toggleCampaignStatus(campaign.id, campaign.status)}
                      >
                        {campaign.status === "active" ? (<><Pause className="h-3.5 w-3.5" />Pause</>) : (<><Play className="h-3.5 w-3.5" />Start</>)}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/campaigns/${campaign.id}/analytics`)}>
                        <BarChart3 className="h-3.5 w-3.5" />Analytics
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/campaigns/create?edit=${campaign.id}`)}>
                            <Pencil className="h-4 w-4 mr-2" />Edit Campaign
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Bulk upload coming soon")}>
                            <Upload className="h-4 w-4 mr-2" />Upload Contacts
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(campaign.id, campaign.name)}
                            className="text-destructive focus:text-destructive"
                            disabled={deletingId === campaign.id}
                          >
                            {deletingId === campaign.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Delete Campaign
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {campaign.contacts > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-foreground">{campaign.completed} / {campaign.contacts} contacts</span>
                      </div>
                      <Progress value={(campaign.completed / campaign.contacts) * 100} className="h-2" />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{campaign.contacts.toLocaleString()} contacts</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{campaign.success_rate}% success rate</span>
                    </div>
                    {(campaign.start_date || campaign.end_date) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{campaign.start_date || "?"} - {campaign.end_date || "?"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

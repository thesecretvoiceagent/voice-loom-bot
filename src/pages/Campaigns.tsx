import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone,
  Plus,
  Search,
  Play,
  Pause,
  MoreVertical,
  Users,
  Phone,
  CheckCircle2,
  Clock,
  Calendar,
  BarChart3,
  Upload,
  Trash2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const campaigns = [
  {
    id: 1,
    name: "Q4 Sales Outreach",
    description: "End of year product promotion calls",
    status: "active",
    agent: "Sales Assistant",
    contacts: 1500,
    completed: 876,
    successRate: 72,
    startDate: "Dec 1, 2025",
    endDate: "Dec 31, 2025",
  },
  {
    id: 2,
    name: "Payment Reminders",
    description: "Monthly payment reminder campaign",
    status: "active",
    agent: "Reminder Bot",
    contacts: 2300,
    completed: 1890,
    successRate: 89,
    startDate: "Dec 10, 2025",
    endDate: "Dec 15, 2025",
  },
  {
    id: 3,
    name: "Customer Satisfaction Survey",
    description: "Post-service satisfaction survey",
    status: "paused",
    agent: "Survey Bot",
    contacts: 800,
    completed: 234,
    successRate: 65,
    startDate: "Nov 15, 2025",
    endDate: "Dec 20, 2025",
  },
  {
    id: 4,
    name: "Debt Collection Wave 3",
    description: "Third wave of collection calls for overdue accounts",
    status: "scheduled",
    agent: "Collection Agent",
    contacts: 450,
    completed: 0,
    successRate: 0,
    startDate: "Dec 18, 2025",
    endDate: "Dec 25, 2025",
  },
];

export default function Campaigns() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleCampaignStatus = (campaignId: number, currentStatus: string) => {
    if (currentStatus === "active") {
      toast.success("Campaign paused");
    } else {
      toast.success("Campaign started");
    }
  };

  const handleViewAnalytics = (campaignId: number) => {
    navigate(`/analytics?campaign=${campaignId}`);
  };

  const handleEditCampaign = (campaignId: number) => {
    navigate(`/campaigns/create?edit=${campaignId}`);
  };

  const handleUploadContacts = (campaignId: number) => {
    toast.info("Bulk upload dialog would open here");
  };

  const handleDeleteCampaign = (campaignId: number) => {
    toast.success("Campaign deleted");
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <p className="mt-1 text-muted-foreground">
            Manage outbound calling campaigns
          </p>
        </div>
        <Link to="/campaigns/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          All Status
        </Button>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {filteredCampaigns.map((campaign, index) => (
          <div
            key={campaign.id}
            className="glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-elevated"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start gap-6">
              {/* Icon */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-primary">
                <Megaphone className="h-7 w-7 text-primary-foreground" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">
                        {campaign.name}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          campaign.status === "active" &&
                            "bg-success/10 text-success",
                          campaign.status === "paused" &&
                            "bg-warning/10 text-warning",
                          campaign.status === "scheduled" &&
                            "bg-primary/10 text-primary"
                        )}
                      >
                        {campaign.status === "active" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        )}
                        {campaign.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {campaign.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={campaign.status === "active" ? "outline" : "default"}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => toggleCampaignStatus(campaign.id, campaign.status)}
                    >
                      {campaign.status === "active" ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Start
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => handleViewAnalytics(campaign.id)}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      Analytics
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCampaign(campaign.id)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUploadContacts(campaign.id)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Contacts
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Campaign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-foreground">
                      {campaign.completed} / {campaign.contacts} contacts
                    </span>
                  </div>
                  <Progress
                    value={(campaign.completed / campaign.contacts) * 100}
                    className="h-2"
                  />
                </div>

                {/* Stats */}
                <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{campaign.contacts.toLocaleString()} contacts</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{campaign.agent}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{campaign.successRate}% success rate</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {campaign.startDate} - {campaign.endDate}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

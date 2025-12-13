import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Users, Copy, Mail, Calendar, Clock, Shield, User } from "lucide-react";
import { toast } from "sonner";

const members = [
  {
    name: "Rando Tkatsenko",
    email: "rando.tkatsenko@gmail.com",
    role: "Admin",
    joined: "3.9.2025",
    lastLogin: "12.12.2025, 15:00:18",
  },
  {
    name: "Beyond Code",
    email: "admin@beyondcode.ee",
    role: "Member",
    joined: "10.9.2025",
    lastLogin: "13.12.2025, 03:00:06",
  },
  {
    name: "Georg-Marttin Toim",
    email: "mattingeorg@gmail.com",
    role: "Member",
    joined: "29.9.2025",
    lastLogin: "29.10.2025, 17:04:13",
  },
];

export default function OrganizationSettings() {
  const inviteCode = "dd5a6ba4";

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Organization Settings</h2>
          <p className="text-muted-foreground">Manage your organization and team settings</p>
        </div>
      </div>

      {/* Team Invite Code */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Team Invite Code</h3>
              <p className="text-sm text-muted-foreground">
                Share this code with team members to join BEYONDCODE AI VOICE PLATFORM organization
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold font-mono text-foreground">{inviteCode}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Organization: BEYONDCODE AI VOICE PLATFORM
                </p>
              </div>
              <Button onClick={copyCode} variant="outline" className="gap-2">
                <Copy className="h-4 w-4" />
                Copy Code
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                i
              </div>
              <div>
                <p className="font-medium text-primary text-sm">How to use the invite code:</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Team members can enter this code in organization settings by selecting "Join with organization code" to automatically join{" "}
                  <span className="font-medium text-primary">BEYONDCODE AI VOICE PLATFORM</span> organization and gain access to all shared campaigns and data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Organization Members */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Organization Members</h3>
              <p className="text-sm text-muted-foreground">View and manage team members</p>
            </div>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.email}
                className="flex items-center gap-4 rounded-xl border border-border/50 bg-secondary/20 p-4 hover:bg-secondary/30 transition-colors"
              >
                <Avatar className="h-10 w-10 border border-border/50">
                  <AvatarFallback className="bg-secondary text-foreground text-sm">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{member.name}</span>
                    <Badge
                      variant={member.role === "Admin" ? "default" : "secondary"}
                      className={member.role === "Admin" ? "bg-primary/20 text-primary border-primary/30" : ""}
                    >
                      {member.role === "Admin" ? (
                        <><Shield className="h-3 w-3 mr-1" /> Admin</>
                      ) : (
                        <><User className="h-3 w-3 mr-1" /> Member</>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Joined: {member.joined}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last login: {member.lastLogin}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

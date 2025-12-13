import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Calendar, Building2, Clock } from "lucide-react";

export default function UserSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">User Settings</h2>
          <p className="text-muted-foreground">View your profile information and reset password.</p>
        </div>
      </div>

      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Profile Information</h3>
              <p className="text-sm text-muted-foreground">Your account details are displayed below.</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/30 p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-16 w-16 border-2 border-primary/30">
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                  BC
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-40">Name</span>
                  <span className="font-medium text-foreground">Beyond Code</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-40">Email</span>
                  <span className="font-medium text-foreground">admin@beyondcode.ee</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-40">Registration Date</span>
                  <span className="font-medium text-foreground">10. September 2025, 13:19</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-40">Organization</span>
                  <span className="font-medium text-foreground">BEYONDCODE AI VOICE PLATFORM</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-40">Last Login</span>
                  <span className="font-medium text-foreground">13. December 2025, 03:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

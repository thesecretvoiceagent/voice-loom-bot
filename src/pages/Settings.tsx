import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { User, Building2, CreditCard, Key, Phone, Wrench, Code, MessageSquare } from "lucide-react";

const settingsNav = [
  { name: "User Settings", href: "/settings/user", icon: User },
  { name: "Organization", href: "/settings/organization", icon: Building2 },
  { name: "Plans", href: "/settings/plans", icon: CreditCard },
  { name: "API Keys", href: "/settings/api-keys", icon: Key },
  { name: "Phone Numbers", href: "/settings/twilio", icon: Phone },
  { name: "Tools", href: "/settings/tools", icon: Wrench },
  { name: "Call Widgets", href: "/settings/widgets", icon: MessageSquare },
  { name: "API Docs", href: "/settings/api-docs", icon: Code },
];

export default function Settings() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">Platform configuration and preferences</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <nav className="glass-card rounded-xl border-border/50 p-4 space-y-1">
            {settingsNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="lg:col-span-3">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

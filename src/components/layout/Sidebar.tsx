import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Bot, Phone, BarChart3, Settings, Megaphone, PhoneIncoming, PhoneOutgoing, Info, Shield, Package, Activity, Settings2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "./UserMenu";

const navigation = [
  { name: "About", href: "/about", icon: Info },
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "AI Voice Agents", href: "/agents", icon: Bot },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Call Logs", href: "/calls", icon: Phone },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "System Health", href: "/system-health", icon: Activity },
  { name: "Feature Flags", href: "/feature-flags", icon: Settings2 },
  { name: "Incidents", href: "/incidents", icon: AlertCircle },
  { name: "Items", href: "/items", icon: Package },
  { name: "Settings", href: "/settings/user", icon: Settings },
];

export function Sidebar() {
  const { profile, role, isAdmin } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-beyondcode shadow-neon">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              className="h-6 w-6"
              stroke="currentColor" 
              strokeWidth="2.5"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7" className="stroke-primary-foreground" />
              <path d="M7 7h10v10" className="stroke-primary-foreground" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">BeyondCode</h1>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">AI Voice Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-gradient-subtle text-foreground border border-primary/20 shadow-sm" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    className={cn(
                      "h-5 w-5 transition-colors", 
                      isActive 
                        ? "text-primary" 
                        : "text-muted-foreground group-hover:text-foreground"
                    )} 
                  />
                  {item.name}
                  {isActive && (
                    <div className="ml-auto h-2 w-2 rounded-full bg-gradient-beyondcode shadow-neon" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Stats */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-gradient-subtle border border-border/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <PhoneIncoming className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">124</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center gap-1">
                <PhoneOutgoing className="h-3.5 w-3.5 text-accent" />
                <span className="font-medium text-foreground">89</span>
              </div>
              <span className="ml-auto text-muted-foreground">Today</span>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <UserMenu />
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-foreground">
                {profile?.full_name || 'User'}
              </p>
              <div className="flex items-center gap-1">
                {role && (
                  <>
                    <Shield className="h-3 w-3 text-primary" />
                    <p className="text-xs text-muted-foreground capitalize">{role}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

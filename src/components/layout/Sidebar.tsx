import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Bot, Phone, BarChart3, Settings, Megaphone, PhoneIncoming, PhoneOutgoing, MessageSquare } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Voice Agents", href: "/agents", icon: Bot },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Call Logs", href: "/calls", icon: Phone },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Widgets", href: "/widgets", icon: MessageSquare },
  { name: "Settings", href: "/settings/user", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <Phone className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">VoiceAI</h1>
            <p className="text-xs text-muted-foreground">by BeyondCode</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive ? "bg-sidebar-accent text-primary shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {item.name}
                  {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent/50 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><PhoneIncoming className="h-3.5 w-3.5 text-success" /><span>124</span></div>
              <span>•</span>
              <div className="flex items-center gap-1"><PhoneOutgoing className="h-3.5 w-3.5 text-primary" /><span>89</span></div>
              <span className="ml-auto">Today</span>
            </div>
          </div>
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-medium text-foreground">BC</div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-foreground">BeyondCode</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

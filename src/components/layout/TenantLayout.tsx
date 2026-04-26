import { Outlet, NavLink, useParams, Link } from "react-router-dom";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { TenantGate } from "@/components/auth/TenantGate";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  Phone,
  BarChart3,
  Megaphone,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const tenantNav = [
  { name: "Dashboard", to: "", icon: LayoutDashboard, end: true },
  { name: "Agents", to: "agents", icon: Bot },
  { name: "Campaigns", to: "campaigns", icon: Megaphone },
  { name: "Call Logs", to: "calls", icon: Phone },
  { name: "Analytics", to: "analytics", icon: BarChart3 },
];

function TenantSidebar() {
  const { tenant, signOut } = useTenant();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!tenant) return null;

  // Hide "Campaigns" nav for the If Insurance tenant.
  const visibleNav = tenantNav.filter(
    (item) => !(tenantSlug === "if-insurance" && item.to === "campaigns")
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-beyondcode shadow-neon">
            <span className="text-sm font-bold text-primary-foreground">
              {tenant.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">{tenant.name}</h1>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              Workspace
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.to ? `/${tenantSlug}/${item.to}` : `/${tenantSlug}`}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-subtle text-foreground border border-primary/20 shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
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
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          <Link
            to="/"
            className="block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to main
          </Link>
          <Button
            onClick={signOut}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}

function TenantLayoutInner() {
  return (
    <TenantGate>
      <div className="min-h-screen bg-background">
        <TenantSidebar />
        <main className="pl-64">
          <div className="min-h-screen p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </TenantGate>
  );
}

export function TenantLayout() {
  return (
    <TenantProvider>
      <TenantLayoutInner />
    </TenantProvider>
  );
}

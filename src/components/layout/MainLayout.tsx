import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { POVSwitcher } from "./POVSwitcher";

export function MainLayout() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="pl-64">
          <POVSwitcher />
          <div className="min-h-screen p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

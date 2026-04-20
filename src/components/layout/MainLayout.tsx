import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PasswordGate } from "@/components/auth/PasswordGate";

export function MainLayout() {
  return (
    <PasswordGate>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="pl-64">
          <div className="min-h-screen p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </PasswordGate>
  );
}

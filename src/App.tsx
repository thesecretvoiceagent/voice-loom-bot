import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import CreateAgent from "./pages/CreateAgent";
import AgentCalls from "./pages/AgentCalls";
import Campaigns from "./pages/Campaigns";
import CreateCampaign from "./pages/CreateCampaign";
import CallLogs from "./pages/CallLogs";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import About from "./pages/About";
import Auth from "./pages/Auth";
import UserSettings from "./pages/settings/UserSettings";
import OrganizationSettings from "./pages/settings/OrganizationSettings";
import PlansSettings from "./pages/settings/PlansSettings";
import ApiKeysSettings from "./pages/settings/ApiKeysSettings";
import TwilioSettings from "./pages/settings/TwilioSettings";
import ToolsSettings from "./pages/settings/ToolsSettings";
import ApiDocsSettings from "./pages/settings/ApiDocsSettings";
import WidgetsSettings from "./pages/settings/WidgetsSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public auth route */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected routes */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/create/:type" element={<CreateAgent />} />
              <Route path="/agents/:id/calls" element={<AgentCalls />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/create" element={<CreateCampaign />} />
              <Route path="/calls" element={<CallLogs />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/about" element={<About />} />
              <Route path="/settings" element={<Settings />}>
                <Route index element={<Navigate to="/settings/user" replace />} />
                <Route path="user" element={<UserSettings />} />
                <Route path="organization" element={<OrganizationSettings />} />
                <Route path="plans" element={<PlansSettings />} />
                <Route path="api-keys" element={<ApiKeysSettings />} />
                <Route path="twilio" element={<TwilioSettings />} />
                <Route path="tools" element={<ToolsSettings />} />
                <Route path="widgets" element={<WidgetsSettings />} />
                <Route path="api-docs" element={<ApiDocsSettings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

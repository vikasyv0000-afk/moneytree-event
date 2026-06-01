import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import MisDashboard from "@/pages/MisDashboard";
import Events from "@/pages/Events";
import Users from "@/pages/Users";
import AuditLog from "@/pages/AuditLog";
import Masters from "@/pages/Masters";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

function RealtimeEventSync() {
  useEffect(() => {
    const channel = supabase
      .channel("events-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          const eventId = typeof payload.new === "object" && payload.new && "id" in payload.new ? String(payload.new.id) : typeof payload.old === "object" && payload.old && "id" in payload.old ? String(payload.old.id) : undefined;
          if (eventId) queryClient.invalidateQueries({ queryKey: ["event", eventId] });
          queryClient.invalidateQueries({ queryKey: ["events"] });
          queryClient.invalidateQueries({ queryKey: ["events-dashboard"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}

function ProtectedRoute({ children, requireAnyRole }: { children: React.ReactNode; requireAnyRole?: Array<"super_admin" | "finance_user" | "events_user"> }) {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (requireAnyRole && !requireAnyRole.some((r) => hasRole(r))) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">You don't have permission to view this page.</div></AppLayout>;
  }
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/mis" element={<ProtectedRoute requireAnyRole={["super_admin", "finance_user"]}><MisDashboard /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/masters" element={<ProtectedRoute><Masters /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RealtimeEventSync />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Events from "@/pages/Events";
import Users from "@/pages/Users";
import AuditLog from "@/pages/AuditLog";
import Masters from "@/pages/Masters";
import AppLayout from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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

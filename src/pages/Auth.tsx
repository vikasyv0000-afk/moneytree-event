import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import bwcLogo from "@/assets/bwc-logo.png";

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="flex min-h-screen items-center justify-center waffle-radial"><div className="animate-pulse text-muted-foreground font-semibold">Loading...</div></div>;
  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center waffle-radial waffle-pattern p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <img src={bwcLogo} alt="BWC Logo" className="h-24 w-24 object-contain drop-shadow-md" />
          <span className="text-2xl font-extrabold tracking-tight text-foreground">BWC Event Management</span>
          <p className="text-sm text-muted-foreground font-medium">Manage your events with ease</p>
        </div>

        <Card className="rounded-2xl border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-extrabold">Welcome back</CardTitle>
            <CardDescription className="font-medium">Sign in to manage your events</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="font-semibold">Email</Label>
                <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="font-semibold">Password</Label>
                <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl font-bold text-base h-11" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

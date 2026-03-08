import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  LogOut,
  ClipboardList,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import bwcLogo from "@/assets/bwc-logo.png";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/events", icon: CalendarDays, label: "Events" },
  { to: "/masters", icon: BookOpen, label: "Masters" },
  { to: "/audit", icon: ClipboardList, label: "Audit Log", roles: ["super_admin"] as const },
  { to: "/users", icon: Users, label: "Users", roles: ["super_admin"] as const },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut, roles, hasRole } = useAuth();
  const location = useLocation();

  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.some((r) => hasRole(r))
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <img src={bwcLogo} alt="BWC Logo" className="h-9 w-9 object-contain" />
          <span className="text-lg font-extrabold text-sidebar-primary">BWC Events</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {visibleNav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                  active
                    ? "bg-sidebar-primary/15 text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-2 truncate text-xs font-medium text-sidebar-foreground">{user?.email}</div>
          <div className="mb-3 flex flex-wrap gap-1">
            {roles.map((r) => (
              <span key={r} className="rounded-full bg-sidebar-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sidebar-primary">
                {r.replace("_", " ")}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <div className="flex items-center gap-2">
            <img src={bwcLogo} alt="BWC Logo" className="h-8 w-8 object-contain" />
            <span className="font-extrabold text-primary">BWC Events</span>
          </div>
          <div className="flex items-center gap-1">
            {visibleNav.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button variant={location.pathname === item.to ? "default" : "ghost"} size="icon" className="h-9 w-9 rounded-xl">
                  <item.icon className="h-4 w-4" />
                </Button>
              </Link>
            ))}
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

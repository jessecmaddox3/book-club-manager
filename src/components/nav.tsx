"use client";
import {useActorId} from "@/components/actor-context";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  BookOpen,
  Calendar,
  Users,
  Vote,
  Pencil,
  LayoutDashboard,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";

interface NavProps {
  clubName: string;
  user: {
    displayName: string;
    role: string;
  };
  surveyOpen?: boolean;
  hasVotedOpenBallot?: boolean;
}

export function Nav({ user, clubName, surveyOpen, hasVotedOpenBallot }: NavProps) {
  const pathname = usePathname();
  const actorId=useActorId();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Four permanent destinations; the Ballot appears only while a poll is open,
  // and reads "Edit ballot" once you've voted.
  const navItems = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    ...(surveyOpen
      ? [
          {
            href: "/survey",
            label: hasVotedOpenBallot ? "Edit ballot" : "Ballot",
            icon: hasVotedOpenBallot ? Pencil : Vote,
          },
        ]
      : []),
    { href: "/books", label: "Books", icon: BookOpen },
    { href: "/meetings", label: "History", icon: Calendar },
    { href: "/members", label: "Members", icon: Users },
  ];

  async function handleLogout() {
    const response=await fetch("/api/auth/logout", { method: "POST",headers:{"x-bookclub-actor":actorId} });
    if(!response.ok){router.refresh();return;}
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col w-64 min-h-screen border-r border-border bg-[#13110e] fixed left-0 top-0 z-40">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center">
            <Logo className="w-5 h-5 text-amber" />
          </div>
          <div>
            <div className="font-heading text-base font-semibold text-foreground leading-tight">
              {clubName}
            </div>
          </div>
        </Link>

        {/* Nav items */}
        <div className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                  isActive
                    ? "bg-amber/10 text-amber border border-amber/20"
                    : "text-secondary hover:text-foreground hover:bg-card"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          {user.role === "admin" && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                pathname.startsWith("/admin")
                  ? "bg-amber/10 text-amber border border-amber/20"
                  : "text-secondary hover:text-foreground hover:bg-card"
              )}
            >
              <Shield className="w-4 h-4" />
              Admin
            </Link>
          )}
        </div>

        {/* User section */}
        <div className="px-3 pb-4 border-t border-border pt-4">
          <div className="flex items-center justify-between px-3">
            <span className="text-sm text-foreground font-medium truncate">
              {user.displayName}
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#13110e] border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="w-5 h-5 text-amber" />
            <span className="font-heading text-sm font-semibold">{clubName}</span>
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-secondary hover:text-foreground cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border bg-[#13110e] px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
                    isActive
                      ? "bg-amber/10 text-amber"
                      : "text-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            {user.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-secondary hover:text-foreground"
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-error cursor-pointer w-full"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </header>
    </>
  );
}

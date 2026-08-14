"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Mail, 
  History, 
  Settings as SettingsIcon, 
  LogOut, 
  Sun, 
  Moon, 
  ShieldAlert,
  Loader2,
  Lock,
  Menu,
  X
} from "lucide-react";
import { api } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; gmail_connected: boolean; gmail_email: string | null } | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load User Session & Theme
  useEffect(() => {
    async function checkAuth() {
      try {
        // 1. Capture token from URL if redirected from Google login
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const urlToken = urlParams.get("token");
          if (urlToken) {
            window.localStorage.setItem("session_token", urlToken);
            // Clean up the token query parameter from URL bar to keep it clean
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }
        }

        const session = await api.checkSession();
        if (session.authenticated) {
          setUser({
            email: session.email,
            gmail_connected: session.gmail_connected,
            gmail_email: session.gmail_email
          });
        } else {
          router.push("/");
        }
      } catch (err) {
        console.error("Session check failed", err);
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    
    checkAuth();
    
    // Initialize dark mode from localStorage or system theme
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, [router]);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDarkMode(true);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Inbox", href: "/inbox", icon: Mail },
    { name: "Activity", href: "/activity", icon: History },
    { name: "Settings", href: "/settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 lg:translate-x-0 lg:static lg:flex
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-bold text-lg">
              R
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Reply<span className="text-emerald-500">Bridge</span>
            </span>
          </Link>
          
          <button 
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? "bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-emerald-500" : ""}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col truncate pr-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Session</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={user?.email}>
                {user?.email}
              </span>
            </div>
            
            <button
              onClick={toggleDarkMode}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center space-x-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-250"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 z-10">
          <div className="flex items-center space-x-4">
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
              {pathname.substring(1).split("/")[0] || "Dashboard"}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user?.gmail_connected ? (
              <div className="flex items-center space-x-2 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-250 dark:border-emerald-900/50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>AI First Responder Active</span>
              </div>
            ) : (
              <Link
                href="/settings"
                className="flex items-center space-x-2 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-250 dark:border-amber-900/50 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Connect Gmail to Start</span>
              </Link>
            )}
          </div>
        </header>

        {/* Sync Status Banner */}
        {user && !user.gmail_connected && (
          <div className="bg-amber-500 text-white px-6 py-2.5 text-sm font-medium flex items-center justify-between shrink-0 shadow-inner">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Gmail is disconnected. ReplyBridge cannot sync emails or send automatic acknowledgements.</span>
            </div>
            <Link 
              href="/settings" 
              className="bg-white text-amber-600 hover:bg-amber-50 px-3.5 py-1 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap ml-4"
            >
              Connect Gmail
            </Link>
          </div>
        )}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

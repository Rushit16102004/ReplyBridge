"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    async function executeDemoAutoLogin() {
      try {
        await api.mockLogin();
        // Replace current history entry with dashboard to prevent back-button loops
        router.replace("/dashboard");
      } catch (err) {
        console.error("Auto demo login failed", err);
        router.replace("/?error=auth_failed");
      }
    }
    executeDemoAutoLogin();
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium text-slate-550 dark:text-slate-450">Entering Sandbox Demo...</p>
      </div>
    </div>
  );
}

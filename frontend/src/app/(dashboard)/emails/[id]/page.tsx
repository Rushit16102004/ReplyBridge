"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ThreadRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/inbox?id=${id}`);
    } else {
      router.replace("/inbox");
    }
  }, [id, router]);

  return (
    <div className="flex h-64 items-center justify-center space-x-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">Redirecting to Inbox Triage...</span>
    </div>
  );
}

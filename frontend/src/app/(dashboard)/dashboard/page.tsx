"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Inbox, 
  ShieldAlert, 
  Send, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  ArrowUpRight,
  Loader2,
  MailWarning
} from "lucide-react";
import { api, Thread } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeEmail = searchParams.get("email") || (typeof window !== "undefined" ? localStorage.getItem("active_email") : null);
  
  const [threads, setThreads] = useState<Thread[]>([]);
  const [stats, setStats] = useState({
    total_emails: 0,
    important_emails: 0,
    sent_replies: 0,
    awaiting_reply: 0,
    blocked_sensitive: 0,
    requires_attention: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const response = await api.listThreads({ limit: 6, active_email: activeEmail || undefined });
        setThreads(response.threads);
        setStats(response.stats);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [activeEmail]);

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case "critical":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40";
      case "high":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-455 dark:border-amber-900/40";
      case "medium":
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
      case "low":
        return "bg-slate-50 text-slate-550 border-slate-100 dark:bg-slate-900/10 dark:text-slate-500 dark:border-slate-900/20";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/45";
      case "replied":
        return "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case "blocked":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40";
      case "needs_review":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-455 dark:border-amber-900/40";
      case "ignored":
        return "bg-slate-50 text-slate-550 border-slate-100 dark:bg-slate-900/10 dark:text-slate-500 dark:border-slate-900/25";
      default:
        return "bg-slate-50 text-slate-750 border-slate-150 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  const getCategoryColor = (cat: string) => {
    const list: Record<string, string> = {
      customer: "bg-emerald-50 text-emerald-755 border-emerald-200 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-900/30",
      support: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/15 dark:text-teal-400 dark:border-teal-905/30",
      sales: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/15 dark:text-cyan-400 dark:border-cyan-900/30",
      "company / hr": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/15 dark:text-blue-400 dark:border-blue-900/30",
      financial: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/15 dark:text-purple-400 dark:border-purple-900/30",
      security: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/15 dark:text-rose-400 dark:border-rose-900/30",
      otp: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/15 dark:text-red-400 dark:border-red-900/30",
      newsletter: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800",
      marketing: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800",
    };
    return list[cat.toLowerCase()] || "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const statCards = [
    { name: "Total Processed", value: stats.total_emails, icon: Inbox, color: "text-slate-500 dark:text-slate-400" },
    { name: "Important Emails", value: stats.important_emails, icon: ArrowUpRight, color: "text-amber-500" },
    { name: "Auto Replies Sent", value: stats.sent_replies, icon: Send, color: "text-emerald-500" },
    { name: "Awaiting Reply", value: stats.awaiting_reply, icon: Clock, color: "text-indigo-500" },
    { name: "Blocked Sensitive", value: stats.blocked_sensitive, icon: ShieldAlert, color: "text-rose-500" },
    { name: "Needs Human Review", value: stats.requires_attention, icon: AlertTriangle, color: "text-amber-550" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Workspace Overview</h2>
        <p className="text-sm text-slate-550 dark:text-slate-400 mt-1">Real-time status of your email responder and safety filters.</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-450 dark:text-slate-550 uppercase tracking-wider">{card.name}</span>
                <Icon className={`h-5 w-5 ${card.color} shrink-0`} />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{card.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content splits */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Activity Emails */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Activity</h3>
              <p className="text-xs text-slate-450 dark:text-slate-500 mt-0.5">Most recent email threads triaged by AI.</p>
            </div>
            <Link 
              href="/inbox" 
              className="text-xs font-bold text-emerald-500 hover:text-emerald-600 flex items-center space-x-1 transition-all"
            >
              <span>View All Inbox</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-850 flex items-center justify-center text-slate-400">
                <MailWarning className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No emails found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">No incoming emails have been synced or generated yet. Send an email to your address or trigger a sandbox account!</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold text-xs">
                    <th className="pb-3 font-semibold">Sender</th>
                    <th className="pb-3 font-semibold">Subject</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Importance</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {threads.map((thread) => (
                    <tr 
                      key={thread.thread_id} 
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-850/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/emails/${thread.thread_id}`)}
                    >
                      <td className="py-4 pr-3 max-w-[200px] truncate">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 transition-colors">
                            {thread.sender.split("<")[0].trim() || thread.sender}
                          </span>
                          <span className="text-xs text-slate-400 truncate">
                            {thread.sender.includes("<") ? thread.sender.split("<")[1].replace(">", "") : ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-3 max-w-[300px]">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {thread.subject}
                          </span>
                          <span className="text-xs text-slate-400 truncate mt-0.5">
                            {thread.snippet}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getCategoryColor(thread.category)}`}>
                          {thread.category}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getImportanceBadge(thread.importance)}`}>
                            {thread.importance}
                          </span>
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-550">
                            {thread.importance_score}/100
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(thread.status)}`}>
                          {thread.status === "waiting" ? "Waiting (Scheduled)" : thread.status}
                        </span>
                      </td>
                      <td className="py-4 pl-3 text-right text-slate-400 dark:text-slate-500 text-xs font-semibold whitespace-nowrap">
                        {new Date(thread.last_message_received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="block text-[10px] text-slate-350 mt-0.5">
                          {new Date(thread.last_message_received_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  History, 
  RefreshCw, 
  Loader2, 
  ArrowUpRight, 
  Inbox, 
  ShieldCheck, 
  Clock, 
  Trash2, 
  ToggleLeft,
  XOctagon,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { api, AuditLog } from "@/lib/api";

export default function ActivityPage() {
  const searchParams = useSearchParams();
  const activeEmail = searchParams.get("email") || (typeof window !== "undefined" ? localStorage.getItem("active_email") : null);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 25;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const response = await api.listLogs(activeEmail || undefined, limit, offset);
      setLogs(response.logs);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLoading(false);
    }
  }, [page, activeEmail]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case "received":
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-750";
      case "analyzed":
        return "bg-indigo-50 text-indigo-700 border-indigo-150 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40";
      case "scheduled":
        return "bg-amber-50 text-amber-705 border-amber-200 dark:bg-amber-955/20 dark:text-amber-455 dark:border-amber-900/40";
      case "sent":
        return "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-150 dark:bg-red-955/20 dark:text-red-400 dark:border-red-900/40";
      case "blocked":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-955/20 dark:text-rose-400 dark:border-rose-900/40";
      case "login":
        return "bg-blue-50 text-blue-700 border-blue-150 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900/40";
      case "disconnect":
        return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-850 dark:text-slate-400";
      case "settings_update":
        return "bg-cyan-50 text-cyan-700 border-cyan-150 dark:bg-cyan-955/20 dark:text-cyan-400 dark:border-cyan-900/40";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "received":
        return Inbox;
      case "analyzed":
        return History;
      case "scheduled":
        return Clock;
      case "sent":
        return ArrowUpRight;
      case "cancelled":
        return XOctagon;
      case "blocked":
        return ShieldCheck;
      default:
        return FileSpreadsheet;
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Activity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Audit & Activity Log</h2>
          <p className="text-sm text-slate-500 dark:text-slate-450 mt-1">A transparent history of all actions performed by your AI email agent.</p>
        </div>
        
        <button 
          onClick={loadLogs}
          disabled={loading}
          className="self-start sm:self-center inline-flex items-center space-x-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Activity Timeline Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-xs text-slate-400">Loading audit history...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-850 flex items-center justify-center text-slate-400">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No activity logged yet</h3>
              <p className="text-xs text-slate-450 mt-1">Actions will appear here as the AI triage agent processes incoming messages.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-semibold">
                  <th className="py-4 px-6 font-semibold">Event</th>
                  <th className="py-4 px-3 font-semibold">Action Description</th>
                  <th className="py-4 px-3 font-semibold">Related Conversation</th>
                  <th className="py-4 pr-6 pl-3 text-right font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {logs.map((log) => {
                  const EventIcon = getEventIcon(log.event_type);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-850/10 transition-colors">
                      {/* Event Type Badge */}
                      <td className="py-4.5 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${getEventBadge(log.event_type)}`}>
                          <EventIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="capitalize">{log.event_type.replace("_", " ")}</span>
                        </span>
                      </td>
                      
                      {/* Description column */}
                      <td className="py-4.5 px-3 max-w-[400px]">
                        <p className="text-slate-800 dark:text-slate-200 text-sm font-semibold leading-relaxed">
                          {log.description}
                        </p>
                      </td>

                      {/* Related Thread Link */}
                      <td className="py-4.5 px-3">
                        {log.thread_id ? (
                          <Link 
                            href={`/emails/${log.thread_id}`}
                            className="text-xs font-bold text-emerald-500 hover:text-emerald-600 hover:underline inline-flex items-center space-x-0.5"
                          >
                            <span>Inspect Thread</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-4.5 pr-6 pl-3 text-right text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{" "}
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500">
            <span>Showing Page {page} of {totalPages} ({total} audit actions)</span>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1 || loading}
                className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-55 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4 text-slate-500" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages || loading}
                className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-55 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

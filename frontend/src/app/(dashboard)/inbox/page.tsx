"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Loader2, 
  Mail, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { api, Thread } from "@/lib/api";

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeEmail = searchParams.get("email") || (typeof window !== "undefined" ? localStorage.getItem("active_email") : null);
  
  // Data State
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [importance, setImportance] = useState("");
  const [status, setStatus] = useState("");
  const [sensitive, setSensitive] = useState<boolean | undefined>(undefined);
  
  // Pagination
  const [page, setPage] = useState(1);
  const limit = 15;

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const response = await api.listThreads({
        search: search || undefined,
        category: category || undefined,
        importance: importance || undefined,
        status: status || undefined,
        sensitive: sensitive,
        active_email: activeEmail || undefined,
        limit,
        offset
      });
      setThreads(response.threads);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load inbox threads", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, importance, status, sensitive, activeEmail]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadInbox();
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setImportance("");
    setStatus("");
    setSensitive(undefined);
    setPage(1);
  };

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
        return "bg-indigo-50 text-indigo-705 border-indigo-200 dark:bg-indigo-950/25 dark:text-indigo-400 dark:border-indigo-900/45";
      case "replied":
        return "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case "blocked":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40";
      case "needs_review":
        return "bg-amber-50 text-amber-705 border-amber-200 dark:bg-amber-950/25 dark:text-amber-455 dark:border-amber-900/40";
      case "ignored":
        return "bg-slate-50 text-slate-550 border-slate-100 dark:bg-slate-900/10 dark:text-slate-505 dark:border-slate-900/25";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-450 dark:border-slate-800";
    }
  };

  const categories = [
    "Customer", "Business", "Support", "Sales", "Company / HR", 
    "Job Opportunity", "Financial", "Security", "OTP", 
    "Newsletter", "Marketing", "Personal", "Other"
  ];

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-305">
      {/* Inbox Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Inbox Triage</h2>
          <p className="text-sm text-slate-500 dark:text-slate-450 mt-1">Review the AI responder decisions and safety classifications.</p>
        </div>
        
        <button 
          onClick={() => loadInbox()}
          disabled={loading}
          className="self-start sm:self-center inline-flex items-center space-x-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Sync</span>
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search sender, subject, keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
            />
          </div>
          <button 
            type="submit"
            className="bg-emerald-500 text-white hover:bg-emerald-600 px-5 py-3 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/10 transition-all flex items-center space-x-2 active:scale-95"
          >
            <span>Search</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3.5 pt-2 text-xs font-semibold text-slate-650 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer"
          >
            <option value="">Category: All</option>
            {categories.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>{cat}</option>
            ))}
          </select>

          {/* Importance Filter */}
          <select
            value={importance}
            onChange={(e) => { setImportance(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer"
          >
            <option value="">Importance: All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer"
          >
            <option value="">Decision Status: All</option>
            <option value="waiting">Waiting (Scheduled)</option>
            <option value="replied">Replied</option>
            <option value="blocked">Blocked (Sensitive)</option>
            <option value="needs_review">Needs Review</option>
            <option value="ignored">No Auto Reply</option>
          </select>

          {/* Sensitive Filter */}
          <select
            value={sensitive === undefined ? "" : String(sensitive)}
            onChange={(e) => {
              const val = e.target.value;
              setSensitive(val === "" ? undefined : val === "true");
              setPage(1);
            }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer"
          >
            <option value="">Safety Check: All</option>
            <option value="false">Safe Emails Only</option>
            <option value="true">🔒 Sensitive Blocked</option>
          </select>

          {/* Clear Filters Button */}
          {(search || category || importance || status || sensitive !== undefined) && (
            <button
              onClick={clearFilters}
              className="text-red-500 hover:text-red-600 hover:underline transition-all text-xs font-bold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Inbox Thread List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-xs text-slate-400">Loading inbox threads...</p>
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-850 flex items-center justify-center text-slate-400">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No matching threads found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Try clearing search filters or checking if Gmail is connected.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-semibold">
                  <th className="py-4 px-6 font-semibold">Sender</th>
                  <th className="py-4 px-3 font-semibold">Conversation Subject</th>
                  <th className="py-4 px-3 font-semibold">AI Analysis Details</th>
                  <th className="py-4 px-3 font-semibold">Triage Action</th>
                  <th className="py-4 pr-6 pl-3 text-right font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {threads.map((thread) => (
                  <tr
                    key={thread.thread_id}
                    className="group hover:bg-slate-50/40 dark:hover:bg-slate-850/20 cursor-pointer transition-colors"
                    onClick={() => router.push(`/emails/${thread.thread_id}`)}
                  >
                    {/* Sender column */}
                    <td className="py-4.5 px-6 max-w-[200px] truncate">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 transition-colors">
                          {thread.sender.split("<")[0].trim() || thread.sender}
                        </span>
                        <span className="text-xs text-slate-400 truncate">
                          {thread.sender.includes("<") ? thread.sender.split("<")[1].replace(">", "") : ""}
                        </span>
                      </div>
                    </td>
                    
                    {/* Subject column */}
                    <td className="py-4.5 px-3 max-w-[300px]">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {thread.subject}
                        </span>
                        <span className="text-xs text-slate-400 truncate mt-0.5">
                          {thread.snippet}
                        </span>
                      </div>
                    </td>

                    {/* AI details column */}
                    <td className="py-4.5 px-3">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 px-2 py-0.5 rounded text-slate-600 dark:text-slate-350 capitalize">
                          {thread.category}
                        </span>
                        <span className={`text-[10px] font-bold border px-2 py-0.5 rounded ${getImportanceBadge(thread.importance)}`}>
                          {thread.importance} ({thread.importance_score})
                        </span>
                        {thread.sensitive && (
                          <span className="text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40 px-2 py-0.5 rounded flex items-center space-x-1 shrink-0">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>Sensitive blocked</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status column */}
                    <td className="py-4.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(thread.status)}`}>
                        {thread.status === "waiting" ? "Waiting (Scheduled)" : thread.status}
                      </span>
                    </td>

                    {/* Time column */}
                    <td className="py-4.5 pr-6 pl-3 text-right text-slate-400 dark:text-slate-500 text-xs font-semibold whitespace-nowrap">
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500">
            <span>Showing Page {page} of {totalPages} ({total} total threads)</span>
            
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

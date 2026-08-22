"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Search, 
  Filter, 
  RotateCw, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  Calendar,
  Lock,
  ShieldAlert,
  CheckCircle,
  Send,
  RefreshCw,
  XOctagon,
  ArrowLeft,
  AlertCircle,
  User,
  Sparkles,
  MailOpen
} from "lucide-react";
import { api, Thread, EmailMessage, ScheduledReply } from "@/lib/api";

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const activeEmail = searchParams.get("email") || (typeof window !== "undefined" ? localStorage.getItem("active_email") : null);
  const urlThreadId = searchParams.get("id");

  // Listing Data States
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

  // Selected Thread Detail States
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeThreadMessages, setActiveThreadMessages] = useState<EmailMessage[]>([]);
  const [activeThreadScheduledReply, setActiveThreadScheduledReply] = useState<ScheduledReply | null>(null);
  const [activeThreadStatus, setActiveThreadStatus] = useState<string>("");
  const [activeThreadSubject, setActiveThreadSubject] = useState<string>("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync route selection
  useEffect(() => {
    if (urlThreadId) {
      setSelectedThreadId(urlThreadId);
    } else {
      setSelectedThreadId(null);
    }
  }, [urlThreadId]);

  // Load list of threads
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

  // Load single thread details when selected
  useEffect(() => {
    const threadId = selectedThreadId;
    if (!threadId) {
      setActiveThreadMessages([]);
      setActiveThreadScheduledReply(null);
      setReplyBody("");
      setActiveThreadSubject("");
      setActiveThreadStatus("");
      return;
    }

    async function loadThreadDetails() {
      setDetailsLoading(true);
      setStatusMsg(null);
      try {
        const res = await api.getThread(threadId as string);
        setActiveThreadMessages(res.messages);
        setActiveThreadScheduledReply(res.scheduled_reply);
        setActiveThreadSubject(res.subject);
        setActiveThreadStatus(res.status);
        if (res.scheduled_reply) {
          setReplyBody(res.scheduled_reply.reply_body);
        } else {
          setReplyBody("");
        }
      } catch (err: any) {
        console.error("Failed to load thread details", err);
        setStatusMsg({ type: "error", text: "Failed to retrieve conversation details." });
      } finally {
        setDetailsLoading(false);
      }
    }
    loadThreadDetails();
  }, [selectedThreadId]);

  // Handle Thread selection
  const selectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    router.push(`/inbox?email=${activeEmail || ""}&id=${threadId}`);
  };

  const clearSelection = () => {
    setSelectedThreadId(null);
    router.push(`/inbox?email=${activeEmail || ""}`);
  };

  // Action Console Handlers
  const handleSendReply = async () => {
    const threadId = selectedThreadId;
    if (!threadId || !replyBody.trim()) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      await api.sendReply(threadId, replyBody);
      setStatusMsg({ type: "success", text: "Acknowledgement reply sent successfully!" });
      // Reload details & refresh list count
      const updated = await api.getThread(threadId);
      setActiveThreadScheduledReply(updated.scheduled_reply);
      setActiveThreadStatus(updated.status);
      loadInbox();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to send acknowledgement." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelReply = async () => {
    const threadId = selectedThreadId;
    if (!threadId) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      await api.cancelReply(threadId);
      setStatusMsg({ type: "success", text: "Draft cancelled/discarded successfully." });
      const updated = await api.getThread(threadId);
      setActiveThreadScheduledReply(updated.scheduled_reply);
      setActiveThreadStatus(updated.status);
      loadInbox();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to cancel/discard draft." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateReply = async () => {
    const threadId = selectedThreadId;
    if (!threadId) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const response = await api.regenerateReply(threadId);
      setReplyBody(response.reply_body);
      setStatusMsg({ type: "success", text: "New draft regenerated successfully using current settings." });
      const updated = await api.getThread(threadId);
      setActiveThreadScheduledReply(updated.scheduled_reply);
      setActiveThreadStatus(updated.status);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to regenerate reply draft." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusOverride = async (newStatus: string) => {
    const threadId = selectedThreadId;
    if (!threadId) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      await api.updateThreadStatus(threadId, newStatus);
      setStatusMsg({ type: "success", text: `Thread status updated to ${newStatus}.` });
      const updated = await api.getThread(threadId);
      setActiveThreadStatus(updated.status);
      loadInbox();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to update thread status." });
    } finally {
      setActionLoading(false);
    }
  };

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

  // UI Helpers
  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-955/20 dark:text-red-400 dark:border-red-900/40";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-955/20 dark:text-amber-455 dark:border-amber-900/40";
      case "low":
        return "bg-slate-50 text-slate-550 border-slate-100 dark:bg-slate-900/10 dark:text-slate-500 dark:border-slate-900/20";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-indigo-50 text-indigo-755 border-indigo-200 dark:bg-indigo-950/25 dark:text-indigo-400 dark:border-indigo-900/45";
      case "replied":
        return "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case "blocked":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-955/20 dark:text-red-400 dark:border-red-900/40";
      case "needs_review":
        return "bg-amber-50 text-amber-755 border-amber-200 dark:bg-amber-950/25 dark:text-amber-455 dark:border-amber-900/40";
      case "ignored":
        return "bg-slate-50 text-slate-550 border-slate-100 dark:bg-slate-900/10 dark:text-slate-505 dark:border-slate-900/25";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-450 dark:border-slate-800";
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "waiting":
        return { text: "Waiting (Scheduled Delay)", color: "text-indigo-655 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/45" };
      case "replied":
        return { text: "Replied", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/50" };
      case "blocked":
        return { text: "Blocked (Sensitive Email)", color: "text-red-650 dark:text-red-405 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40" };
      case "needs_review":
        return { text: "Requires Human Review", color: "text-amber-600 dark:text-amber-455 bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/40" };
      case "ignored":
        return { text: "Ignored (No Reply)", color: "text-slate-500 dark:text-slate-400 bg-slate-105 dark:bg-slate-800 border-slate-200 dark:border-slate-700" };
      default:
        return { text: status || "Unknown", color: "text-slate-700 bg-slate-50 border-slate-200" };
    }
  };

  const categories = [
    "Customer", "Business", "Support", "Sales", "Company / HR", 
    "Job Opportunity", "Financial", "Security", "OTP", 
    "Newsletter", "Marketing", "Personal", "Other"
  ];

  const totalPages = Math.ceil(total / limit) || 1;
  const latestMessage = activeThreadMessages[activeThreadMessages.length - 1];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Inbox Triage</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Triaging connected accounts and reviews side-by-side.</p>
        </div>
        
        <button 
          onClick={() => loadInbox()}
          disabled={loading}
          className="inline-flex items-center space-x-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-850 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <RotateCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Split Columns */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-170px)] gap-6 overflow-hidden items-start">
        
        {/* MIDDLE COLUMN: Threads List */}
        <div className={`
          ${selectedThreadId ? "hidden lg:flex" : "flex"} 
          flex-col w-full lg:w-[380px] xl:w-[420px] shrink-0 h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden
        `}>
          {/* Filters Area */}
          <div className="p-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search keywords..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
                />
              </div>
              <button type="submit" className="bg-emerald-500 text-white hover:bg-emerald-600 px-3.5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                Find
              </button>
            </form>

            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              {/* Category filter */}
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 px-2 py-1.5 rounded-lg outline-none cursor-pointer text-slate-600 dark:text-slate-355"
              >
                <option value="">Category: All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                ))}
              </select>

              {/* Importance filter */}
              <select
                value={importance}
                onChange={(e) => { setImportance(e.target.value); setPage(1); }}
                className="bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 px-2 py-1.5 rounded-lg outline-none cursor-pointer text-slate-600 dark:text-slate-355"
              >
                <option value="">Importance: All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Status filter */}
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="bg-white dark:bg-slate-955 border border-slate-205 px-2 py-1.5 rounded-lg outline-none cursor-pointer text-slate-600 dark:text-slate-355"
              >
                <option value="">Status: All</option>
                <option value="needs_review">Needs Review</option>
                <option value="replied">Replied</option>
                <option value="waiting">Waiting (Scheduled)</option>
              </select>

              {/* Reset filter */}
              {(search || category || importance || status || sensitive !== undefined) && (
                <button onClick={clearFilters} className="text-red-500 hover:text-red-655 transition-colors self-center ml-auto">
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-105 dark:divide-slate-800/40">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span className="text-[10px] text-slate-400 font-semibold">Loading feeds...</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MailOpen className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Clean Inbox!</h4>
                <p className="text-[10px] text-slate-400">No matching threads found.</p>
              </div>
            ) : (
              threads.map((t) => {
                const isSelected = t.thread_id === selectedThreadId;
                const initials = (t.sender.split("<")[0].trim() || t.sender).substring(0, 1).toUpperCase();
                
                return (
                  <div
                    key={t.thread_id}
                    onClick={() => selectThread(t.thread_id)}
                    className={`p-4 flex gap-3 text-left cursor-pointer transition-all hover:bg-slate-50/50 dark:hover:bg-slate-850/10
                      ${isSelected 
                        ? "bg-emerald-50/15 dark:bg-emerald-955/10 border-l-4 border-emerald-500 pl-3" 
                        : "border-l-4 border-transparent"
                      }
                    `}
                  >
                    {/* User Avatar */}
                    <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-305 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                      {initials}
                    </div>

                    {/* Meta info */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black truncate block ${isSelected ? 'text-emerald-555' : 'text-slate-805 dark:text-slate-205'}`}>
                          {t.sender.split("<")[0].trim() || t.sender}
                        </span>
                        <span className="text-[9px] text-slate-400 whitespace-nowrap ml-2">
                          {new Date(t.last_message_received_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {t.subject}
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-505 truncate">
                        {t.snippet}
                      </p>

                      <div className="flex flex-wrap gap-1 items-center pt-1.5">
                        <span className="text-[9px] font-bold border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-800/30 px-1.5 py-0.5 rounded text-slate-505 dark:text-slate-400 capitalize">
                          {t.category}
                        </span>
                        <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded ${getImportanceBadge(t.importance)}`}>
                          {t.importance}
                        </span>
                        {t.status && (
                          <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${getStatusBadge(t.status)}`}>
                            {t.status === "waiting" ? "waiting" : t.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-[10px] font-bold text-slate-400 shrink-0">
              <span>{page}/{totalPages} pages</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1 || loading}
                  className="p-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905 rounded-md hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages || loading}
                  className="p-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905 rounded-md hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-50"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Conversation Stream & AI Console */}
        <div className={`
          ${selectedThreadId ? "flex" : "hidden lg:flex"} 
          flex-col flex-1 h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden
        `}>
          {detailsLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-xs text-slate-405">Loading conversation streams...</p>
            </div>
          ) : !selectedThreadId ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center space-y-4">
              <div className="h-16 w-16 bg-slate-50 dark:bg-slate-850/50 border border-slate-150 dark:border-slate-805 rounded-3xl flex items-center justify-center text-slate-350">
                <MailOpen className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No conversation selected</h3>
                <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto leading-relaxed">
                  Select an email thread from the inbox listing to view messages, check safety classifications, and review AI generated acknowledgement drafts.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 h-full overflow-hidden">
              
              {/* Thread detail Header */}
              <div className="p-4.5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 bg-slate-50/30 dark:bg-slate-900/30">
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Back button on mobile */}
                  <button onClick={clearSelection} className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                    <ArrowLeft className="h-4.5 w-4.5 text-slate-500" />
                  </button>
                  
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-905 dark:text-white truncate">
                      {activeThreadSubject || "(No Subject)"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className={`text-[9px] font-semibold border px-2 py-0.5 rounded ${getStatusDisplay(activeThreadStatus).color}`}>
                        {getStatusDisplay(activeThreadStatus).text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header dropdown options */}
                <div className="flex items-center space-x-2 shrink-0">
                  <select
                    value={activeThreadStatus}
                    onChange={(e) => handleStatusOverride(e.target.value)}
                    disabled={actionLoading}
                    className="bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-xl outline-none cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-355 disabled:opacity-50"
                  >
                    <option value="" disabled>Override Status</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="replied">Mark Replied</option>
                    <option value="ignored">Ignore (No Reply)</option>
                  </select>
                </div>
              </div>

              {/* Message Feed Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/15 dark:bg-slate-955/5">
                
                {/* Phishing Warning Banner */}
                {latestMessage?.is_phishing && (
                  <div className="bg-red-50 dark:bg-red-955/20 border-2 border-red-500 dark:border-red-900/50 rounded-2xl p-5 shadow-md flex items-start space-x-3.5 animate-pulse">
                    <ShieldAlert className="h-6 w-6 text-red-505 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-black text-red-700 dark:text-red-400">🚨 Warning: The AI thinks this email is a Phishing Attempt!</h4>
                      <p className="text-xs text-red-655 dark:text-red-455 leading-relaxed">
                        This message shows clear signs of spoofing, financial fraud, or social engineering. Do NOT click any links, open attachments, or input passwords.
                      </p>
                      {latestMessage.phishing_reasons && latestMessage.phishing_reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {latestMessage.phishing_reasons.map((reason) => (
                            <span key={reason} className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-md text-[10px] font-bold border border-red-200 dark:border-red-900/50 uppercase tracking-wider">
                              {reason.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mapping Messages in Chain */}
                {activeThreadMessages.map((msg, index) => {
                  const isUserSender = msg.sender.toLowerCase().includes("demo@replybridge.com") || 
                                       (activeThreadMessages[0]?.recipient.toLowerCase().includes(msg.sender.split("<")[0].trim().toLowerCase()));
                  
                  return (
                    <div 
                      key={msg.message_id} 
                      className={`border rounded-2xl p-4 md:p-5 shadow-sm bg-white dark:bg-slate-905 transition-all
                        ${isUserSender 
                          ? "border-emerald-105 dark:border-emerald-955 bg-emerald-50/10 dark:bg-emerald-950/5 ml-4 sm:ml-12" 
                          : "border-slate-205 dark:border-slate-800"
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0
                            ${isUserSender 
                              ? "bg-emerald-100 dark:bg-emerald-955 text-emerald-500" 
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }
                          `}>
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-850 dark:text-slate-205 truncate">
                              {msg.sender}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              to {msg.recipient}
                            </p>
                          </div>
                        </div>
                        
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {new Date(msg.received_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      
                      {/* Email Body */}
                      <div className="mt-4 text-xs md:text-sm text-slate-700 dark:text-slate-305 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-4">
                        {msg.body_html ? (
                          <div className="w-full overflow-hidden rounded-xl border border-slate-205 dark:border-slate-805 bg-white">
                            <iframe
                              srcDoc={`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <base target="_blank">
                                  <style>
                                    body {
                                      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                      margin: 16px;
                                      color: #1e293b;
                                      background-color: #ffffff;
                                      font-size: 13px;
                                      line-height: 1.5;
                                    }
                                    a { color: #10b981; text-decoration: underline; }
                                  </style>
                                </head>
                                <body>
                                  ${msg.body_html}
                                </body>
                                </html>
                              `}
                              title={`Email message ${msg.message_id}`}
                              sandbox="allow-popups allow-same-origin"
                              className="w-full border-0 min-h-[250px]"
                              onLoad={(e) => {
                                const iframe = e.currentTarget;
                                setTimeout(() => {
                                  if (iframe.contentWindow?.document.documentElement) {
                                    iframe.style.height = 'auto';
                                    iframe.style.height = (iframe.contentWindow.document.documentElement.scrollHeight + 20) + 'px';
                                  }
                                }, 150);
                              }}
                            />
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap font-sans break-words text-slate-700 dark:text-slate-350">
                            {msg.body_text}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Draft Console Footer Area */}
              {latestMessage && (
                <div className="p-4 md:p-6 border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shrink-0 shadow-inner">
                  
                  {/* Draft Console Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center space-x-1.5 uppercase tracking-wider">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        <span>AI Responder Console</span>
                      </h3>
                    </div>
                    
                    {activeThreadScheduledReply && activeThreadScheduledReply.status === "pending" && (
                      activeThreadStatus === "needs_review" ? (
                        <div className="bg-amber-50 border border-amber-250 dark:bg-amber-955/20 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-505" />
                          <span>Draft: Needs Review (Will not auto-send)</span>
                        </div>
                      ) : (
                        <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50 text-indigo-650 dark:text-indigo-400 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>Auto-sends at: {new Date(activeThreadScheduledReply.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )
                    )}
                  </div>

                  {statusMsg && (
                    <div className={`p-3 rounded-xl text-xs font-semibold flex items-start space-x-2 border
                      ${statusMsg.type === "success"
                        ? "bg-emerald-50/50 text-emerald-600 border-emerald-200 dark:bg-emerald-955/15 dark:text-emerald-400 dark:border-emerald-900/50"
                        : "bg-red-50/50 text-red-655 border-red-200 dark:bg-red-955/15 dark:text-red-400 dark:border-red-900/50"
                      }
                    `}>
                      {statusMsg.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <span>{statusMsg.text}</span>
                    </div>
                  )}

                  {/* Input form or safety blockers */}
                  {latestMessage.is_phishing ? (
                    <div className="bg-red-50 dark:bg-red-955/10 border border-red-250 dark:border-red-900/40 rounded-xl p-4 text-center space-y-2">
                      <div className="mx-auto h-10 w-10 rounded-2xl bg-red-100 dark:bg-red-950 text-red-505 flex items-center justify-center">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-red-700 dark:text-red-400">🚨 Phishing Attack Blocked</h4>
                        <p className="text-[11px] text-red-655 dark:text-red-455 mt-1 max-w-md mx-auto leading-relaxed">
                          Auto-reply is permanently disabled for this email. The AI identified this message as a security threat. For your safety, do not engage with this sender.
                        </p>
                      </div>
                    </div>
                  ) : latestMessage.sensitive ? (
                    <div className="bg-rose-50 dark:bg-rose-955/10 border border-rose-250 dark:border-rose-900/40 rounded-xl p-4 text-center space-y-2">
                      <div className="mx-auto h-10 w-10 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-505 flex items-center justify-center">
                        <Lock className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-rose-700 dark:text-rose-455">🔒 Sensitive Information Protected</h4>
                        <p className="text-[11px] text-rose-655 dark:text-rose-450 mt-1 max-w-md mx-auto leading-relaxed">
                          AI auto-reply has been permanently blocked for this thread. The email contains credentials, financial transactions, or security key codes.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        disabled={actionLoading || activeThreadStatus === "replied"}
                        placeholder="Write your email response acknowledgement..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-emerald-500 transition-all text-slate-850 dark:text-slate-105 leading-relaxed disabled:opacity-60 min-h-[90px]"
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleSendReply}
                          disabled={actionLoading || !replyBody.trim() || activeThreadStatus === "replied"}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 transition-all flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          <span>{actionLoading ? "Sending..." : (activeThreadStatus === "needs_review" ? "Approve and Send" : "Send Acknowledgement")}</span>
                        </button>
                        
                        <button
                          onClick={handleRegenerateReply}
                          disabled={actionLoading || latestMessage.sensitive || activeThreadStatus === "replied"}
                          className="border border-slate-250 dark:border-slate-805 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 text-slate-500 ${actionLoading ? 'animate-spin' : ''}`} />
                          <span>Regenerate Draft</span>
                        </button>

                        {activeThreadScheduledReply && activeThreadScheduledReply.status === "pending" && (
                          <button
                            onClick={handleCancelReply}
                            disabled={actionLoading}
                            className="border border-red-200 dark:border-red-955/40 text-red-655 hover:bg-red-50/50 dark:hover:bg-red-955/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ml-auto"
                          >
                            <XOctagon className="h-4 w-4 text-red-500" />
                            <span>{activeThreadStatus === "needs_review" ? "Discard Draft" : "Cancel Auto-Send"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
}

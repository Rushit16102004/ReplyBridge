"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Loader2, 
  Send, 
  RefreshCw, 
  XOctagon, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Inbox,
  User as UserIcon,
  Trash2,
  Calendar,
  Lock
} from "lucide-react";
import { api, ThreadDetails } from "@/lib/api";

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: threadId } = use(params);
  
  // Data State
  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Draft State
  const [replyBody, setReplyBody] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadThreadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getThread(threadId);
      setThread(data);
      if (data.scheduled_reply) {
        setReplyBody(data.scheduled_reply.reply_body);
      } else {
        setReplyBody("");
      }
    } catch (err) {
      console.error("Failed to load thread details", err);
      setStatusMsg({ type: "error", text: "Failed to retrieve email thread details." });
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadThreadDetails();
  }, [loadThreadDetails]);

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      await api.sendReply(threadId, replyBody);
      setStatusMsg({ type: "success", text: "Acknowledgement reply sent successfully!" });
      // Reload details to reflect updated statuses
      const updated = await api.getThread(threadId);
      setThread(updated);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to send acknowledgement." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelReply = async () => {
    setActionLoading(true);
    setStatusMsg(null);
    try {
      await api.cancelReply(threadId);
      setStatusMsg({ type: "success", text: "Scheduled auto-reply cancelled successfully." });
      const updated = await api.getThread(threadId);
      setThread(updated);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to cancel scheduled auto-reply." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateReply = async () => {
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const response = await api.regenerateReply(threadId);
      setReplyBody(response.reply_body);
      setStatusMsg({ type: "success", text: "New draft regenerated successfully using current settings." });
      const updated = await api.getThread(threadId);
      setThread(updated);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to regenerate reply draft." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusOverride = async (newStatus: string) => {
    setActionLoading(true);
    setStatusMsg(null);
    try {
      await api.updateThreadStatus(threadId, newStatus);
      setStatusMsg({ type: "success", text: `Thread status updated to ${newStatus}.` });
      const updated = await api.getThread(threadId);
      setThread(updated);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to update thread status." });
    } finally {
      setActionLoading(false);
    }
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case "high":
        return "bg-red-50 text-red-750 border-red-200 dark:bg-red-955/20 dark:text-red-400 dark:border-red-900/40";
      case "medium":
        return "bg-amber-50 text-amber-755 border-amber-200 dark:bg-amber-955/20 dark:text-amber-455 dark:border-amber-900/40";
      case "low":
        return "bg-slate-50 text-slate-550 border-slate-100 dark:bg-slate-900/10 dark:text-slate-500 dark:border-slate-900/20";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "waiting":
        return { text: "Waiting (Scheduled Delay)", color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/45" };
      case "replied":
        return { text: "Replied", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/50" };
      case "blocked":
        return { text: "Blocked (Sensitive Email)", color: "text-red-600 dark:text-red-405 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40" };
      case "needs_review":
        return { text: "Requires Human Review", color: "text-amber-600 dark:text-amber-455 bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/40" };
      case "ignored":
        return { text: "Ignored (No Reply)", color: "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700" };
      default:
        return { text: status, color: "text-slate-700 bg-slate-50 border-slate-200" };
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <div>
          <h3 className="text-base font-bold text-slate-850 dark:text-slate-200">Failed to load thread</h3>
          <p className="text-sm text-slate-500 mt-1">This thread could not be found or you do not have permission to view it.</p>
        </div>
        <Link 
          href="/inbox" 
          className="inline-flex items-center space-x-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Inbox</span>
        </Link>
      </div>
    );
  }

  // Get classifications from the last message in the thread
  const latestMessage = thread.messages[thread.messages.length - 1];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Back Button & Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link 
          href="/inbox" 
          className="inline-flex items-center space-x-2 text-sm font-semibold text-slate-600 hover:text-emerald-500 dark:text-slate-400 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Inbox</span>
        </Link>
        
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button
            onClick={() => handleStatusOverride("needs_review")}
            disabled={actionLoading || thread.status === "needs_review"}
            className="px-3.5 py-2 border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-50 transition-colors"
          >
            Mark for Review
          </button>
          <button
            onClick={() => handleStatusOverride("ignored")}
            disabled={actionLoading || thread.status === "ignored"}
            className="px-3.5 py-2 border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-50 transition-colors"
          >
            Don't Reply
          </button>
          <button
            onClick={() => handleStatusOverride("replied")}
            disabled={actionLoading || thread.status === "replied"}
            className="px-3.5 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            Mark as Replied
          </button>
        </div>
      </div>

      {/* Grid: Email Conversation (Left) and AI Panel (Right) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Email Stream Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Phishing Threat Warning Banner */}
          {latestMessage?.is_phishing && (
            <div className="bg-red-50 dark:bg-red-955/20 border-2 border-red-500 dark:border-red-900/50 rounded-2xl p-5 shadow-md flex items-start space-x-3.5 animate-pulse">
              <ShieldAlert className="h-6 w-6 text-red-505 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-sm font-black text-red-700 dark:text-red-400">🚨 Warning: The AI thinks this email is a Phishing Attempt!</h4>
                <p className="text-xs text-red-650 dark:text-red-450 leading-relaxed">
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
          {/* Email Conversation Chain */}
          <div className="space-y-4">
            {thread.messages.map((msg, index) => {
              const isUserSender = msg.sender.toLowerCase().includes("demo@replybridge.com") || 
                                   (thread.messages[0].recipient.toLowerCase().includes(msg.sender.split("<")[0].trim().toLowerCase()));
                                   
              return (
                <div 
                  key={msg.message_id} 
                  className={`border rounded-2xl p-5 shadow-sm bg-white dark:bg-slate-900 transition-all
                    ${isUserSender 
                      ? "border-emerald-100 dark:border-emerald-950 bg-emerald-50/15 dark:bg-emerald-950/5 ml-4 sm:ml-12" 
                      : "border-slate-200 dark:border-slate-800"
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0
                        ${isUserSender 
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-500" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }
                      `}>
                        <UserIcon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                          {msg.sender}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          to {msg.recipient}
                        </p>
                      </div>
                    </div>
                    
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {new Date(msg.received_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  
                  {/* Email Body */}
                  <div className="mt-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-4">
                    {msg.body_html ? (
                      <div className="w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white">
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
                                  font-size: 14px;
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
                          className="w-full border-0 min-h-[300px]"
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
                      <div className="whitespace-pre-wrap font-sans break-words text-slate-700 dark:text-slate-300">
                        {msg.body_text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI REPLY DRAFT BOX */}
          {latestMessage && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Responder Console</h3>
                  <p className="text-xs text-slate-450 dark:text-slate-500 mt-0.5">Draft acknowledgement scheduled for delay execution.</p>
                </div>
                
                {thread.scheduled_reply && thread.scheduled_reply.status === "pending" && (
                  thread.status === "needs_review" ? (
                    <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>Draft: Needs Review (Will not auto-send)</span>
                    </div>
                  ) : (
                    <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50 text-indigo-650 dark:text-indigo-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Auto-sends: {new Date(thread.scheduled_reply.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(thread.scheduled_reply.scheduled_at).toLocaleDateString()})</span>
                    </div>
                  )
                )}
              </div>

              {statusMsg && (
                <div className={`p-4 rounded-xl text-xs font-semibold flex items-start space-x-2 border
                  ${statusMsg.type === "success"
                    ? "bg-emerald-50/50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-900/50"
                    : "bg-red-50/50 text-red-600 border-red-200 dark:bg-red-950/15 dark:text-red-400 dark:border-red-900/50"
                  }
                `}>
                  {statusMsg.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              {latestMessage.is_phishing ? (
                <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/40 rounded-xl p-5 text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-955 text-red-500 flex items-center justify-center shadow-inner">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-red-700 dark:text-red-400">🚨 Phishing Attack Blocked</h4>
                    <p className="text-xs text-red-650 dark:text-red-450 mt-1.5 max-w-md mx-auto leading-relaxed">
                      Auto-reply is permanently disabled for this email. The AI identified this message as a security threat. For your safety, do not engage with this sender.
                    </p>
                  </div>
                </div>
              ) : latestMessage.sensitive ? (
                <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/40 rounded-xl p-5 text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-500 flex items-center justify-center shadow-inner">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">🔒 Sensitive Information Protected</h4>
                    <p className="text-xs text-rose-600 dark:text-rose-450 mt-1.5 max-w-md mx-auto leading-relaxed">
                      AI auto-reply has been permanently blocked for this thread. The email contains code credentials, financial logs, or security OTP keys. Human override required.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Textarea for edit */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Acknowledgement Draft</label>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      disabled={actionLoading || thread.status === "replied"}
                      placeholder="Write your email response acknowledgement..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm font-sans outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-800 dark:text-slate-100 leading-relaxed disabled:opacity-60 min-h-[140px]"
                    />
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSendReply}
                      disabled={actionLoading || !replyBody.trim() || thread.status === "replied"}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/10 transition-all flex items-center space-x-2 active:scale-95 disabled:opacity-50"
                    >
                      <Send className="h-4.5 w-4.5" />
                      <span>{actionLoading ? "Processing..." : (thread.status === "needs_review" ? "Approve and Send" : "Send Acknowledgement")}</span>
                    </button>
                    
                    <button
                      onClick={handleRegenerateReply}
                      disabled={actionLoading || latestMessage.sensitive || thread.status === "replied"}
                      className="border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 px-4.5 py-3 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4.5 w-4.5 text-slate-500 ${actionLoading ? 'animate-spin' : ''}`} />
                      <span>Regenerate Reply</span>
                    </button>

                    {thread.scheduled_reply && thread.scheduled_reply.status === "pending" && (
                      <button
                        onClick={handleCancelReply}
                        disabled={actionLoading}
                        className="border border-red-200 dark:border-red-950/40 text-red-650 hover:bg-red-50/50 dark:hover:bg-red-950/10 px-4.5 py-3 rounded-xl text-sm font-semibold transition-all flex items-center space-x-2 ml-auto"
                      >
                        <XOctagon className="h-4.5 w-4.5 text-red-500" />
                        <span>{thread.status === "needs_review" ? "Discard Draft" : "Cancel Auto-Send"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar Column: AI Pipeline Metrics */}
        <div className="lg:col-span-4 space-y-6">
          {/* AI Metrics Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3">AI Pipeline Metrics</h3>
            
            {/* Status Info */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Responder State</span>
              <div className={`border rounded-lg px-3 py-2 text-xs font-bold flex items-center space-x-2 ${getStatusDisplay(thread.status).color}`}>
                <div className="h-1.5 w-1.5 rounded-full bg-current"></div>
                <span>{getStatusDisplay(thread.status).text}</span>
              </div>
            </div>

            {/* Importance Gauge */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-400 uppercase tracking-wider text-[10px]">Importance Rating</span>
                <span className="text-slate-900 dark:text-white capitalize">{latestMessage.importance}</span>
              </div>
              <div className="flex items-center space-x-3.5">
                <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500
                      ${latestMessage.importance === "high" ? "bg-red-500" : ""}
                      ${latestMessage.importance === "medium" ? "bg-amber-500" : ""}
                      ${latestMessage.importance === "low" ? "bg-slate-400" : ""}
                    `}
                    style={{ width: `${latestMessage.importance_score}%` }}
                  />
                </div>
                <span className="text-xs font-black text-slate-700 dark:text-slate-350">{latestMessage.importance_score}/100</span>
              </div>
            </div>

            {/* Key Grid Parameters */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Category</span>
                <span className="block text-sm font-bold text-slate-805 dark:text-slate-200 mt-0.5 capitalize">{latestMessage.category}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Urgency</span>
                <span className={`block text-sm font-bold mt-0.5 capitalize
                  ${latestMessage.urgency === 'high' ? 'text-red-550' : ''}
                  ${latestMessage.urgency === 'medium' ? 'text-amber-550' : ''}
                  ${latestMessage.urgency === 'low' ? 'text-slate-500' : ''}
                `}>{latestMessage.urgency}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sentiment</span>
                <span className="block text-sm font-bold text-slate-805 dark:text-slate-200 mt-0.5 capitalize">{latestMessage.sentiment}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">AI Confidence</span>
                <span className="block text-sm font-bold text-slate-805 dark:text-slate-200 mt-0.5">{Math.round(latestMessage.ai_confidence * 100)}%</span>
              </div>
            </div>

            {/* Pipeline Safety Summary */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-2.5">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pipeline Safety Summary</span>
              
              <div className="flex items-center space-x-2 text-xs font-semibold">
                {latestMessage.sensitive ? (
                  <>
                    <Lock className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-red-650 dark:text-red-400">Blocked: Sensitive Records Found</span>
                  </>
                ) : latestMessage.requires_human ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-amber-600 dark:text-amber-450">Human Triage Action Required</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-emerald-600 dark:text-emerald-400">Eligible for Auto acknowledgement</span>
                  </>
                )}
              </div>
              
              <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-900">
                <span className="font-bold block text-slate-600 dark:text-slate-400 mb-1">Reason:</span>
                {latestMessage.reason}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

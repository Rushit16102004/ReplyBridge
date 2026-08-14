"use client";

import { useEffect, useState } from "react";
import { 
  Settings as SettingsIcon, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Trash2, 
  Plus, 
  X, 
  Lock,
  ExternalLink,
  Save,
  Check
} from "lucide-react";
import { api, UserSettings } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Tag Input States
  const [newSender, setNewSender] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newBlocked, setNewBlocked] = useState("");
  
  // Status Alert
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const session = await api.checkSession();
        setGmailConnected(session.gmail_connected);
        setGmailEmail(session.gmail_email);
        
        const config = await api.getSettings();
        setSettings(config);
      } catch (err) {
        console.error("Failed to load settings data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaveLoading(true);
    setAlert(null);
    
    try {
      await api.updateSettings(settings);
      setAlert({ type: "success", text: "Settings saved successfully!" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Failed to update configurations." });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm("Are you sure you want to disconnect Gmail? This will halt all email syncing and scheduled auto-replies.")) {
      return;
    }
    setSaveLoading(true);
    setAlert(null);
    try {
      await api.disconnectGmail();
      setGmailConnected(false);
      setGmailEmail(null);
      setAlert({ type: "success", text: "Gmail account successfully disconnected." });
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Failed to disconnect Gmail." });
    } finally {
      setSaveLoading(false);
    }
  };

  const [resetLoading, setResetLoading] = useState(false);
  const handleResetEmails = async () => {
    if (!confirm("Are you sure you want to reset your email cache? This will clear all local records of your email threads and logs, and perform a fresh download from your Gmail account. No emails on your actual Gmail account will be deleted.")) {
      return;
    }
    setResetLoading(true);
    setAlert(null);
    try {
      await api.resetEmails();
      setAlert({ type: "success", text: "Email cache reset successfully! Fresh sync has started." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Failed to reset email cache." });
    } finally {
      setResetLoading(false);
    }
  };

  const handleConnectGmail = () => {
    // Redirect to backend OAuth login
    window.location.href = api.getGoogleLoginUrl();
  };

  // Add Item Helpers
  const addSender = () => {
    if (!newSender.trim() || !settings) return;
    if (!settings.excluded_senders.includes(newSender.trim().toLowerCase())) {
      setSettings({
        ...settings,
        excluded_senders: [...settings.excluded_senders, newSender.trim().toLowerCase()]
      });
    }
    setNewSender("");
  };

  const removeSender = (email: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      excluded_senders: settings.excluded_senders.filter(e => e !== email)
    });
  };

  const addDomain = () => {
    if (!newDomain.trim() || !settings) return;
    const cleanDomain = newDomain.trim().replace("@", "").toLowerCase();
    if (!settings.excluded_domains.includes(cleanDomain)) {
      setSettings({
        ...settings,
        excluded_domains: [...settings.excluded_domains, cleanDomain]
      });
    }
    setNewDomain("");
  };

  const removeDomain = (domain: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      excluded_domains: settings.excluded_domains.filter(d => d !== domain)
    });
  };

  const addBlockedCategory = () => {
    if (!newBlocked.trim() || !settings) return;
    if (!settings.blocked_categories.includes(newBlocked.trim().toLowerCase())) {
      setSettings({
        ...settings,
        blocked_categories: [...settings.blocked_categories, newBlocked.trim().toLowerCase()]
      });
    }
    setNewBlocked("");
  };

  const removeBlockedCategory = (cat: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      blocked_categories: settings.blocked_categories.filter(c => c !== cat)
    });
  };

  const handleCategoryCheckboxChange = (cat: string) => {
    if (!settings) return;
    const exists = settings.reply_categories.includes(cat);
    let updated: string[];
    if (exists) {
      updated = settings.reply_categories.filter(c => c !== cat);
    } else {
      updated = [...settings.reply_categories, cat];
    }
    setSettings({ ...settings, reply_categories: updated });
  };

  if (loading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const allAvailableCategories = [
    { key: "customer", label: "Customer Queries" },
    { key: "support", label: "Support Requests" },
    { key: "sales", label: "Sales & Inquiries" },
    { key: "business", label: "General Business" },
    { key: "job_opportunity", label: "Recruiting & Job Opportunities" },
    { key: "personal", label: "Personal Emails" },
  ];

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Settings</h2>
        <p className="text-sm text-slate-550 dark:text-slate-400 mt-1">Configure Gmail OAuth, AI response behavior, and safety rules.</p>
      </div>

      {alert && (
        <div className={`p-4.5 rounded-xl text-sm font-semibold flex items-start space-x-2 border
          ${alert.type === "success"
            ? "bg-emerald-50/50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-900/50"
            : "bg-red-50/50 text-red-655 border-red-200 dark:bg-red-955/15 dark:text-red-400 dark:border-red-900/50"
          }
        `}>
          {alert.type === "success" ? <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />}
          <span>{alert.text}</span>
        </div>
      )}

      {/* 1. GMAIL OAUTH CONNECTION STATUS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">Gmail Integration</h3>
        
        {gmailConnected ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                <Check className="h-4 w-4 shrink-0" />
                <span>✓ Connected to Google Cloud</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI responder is actively monitoring Gmail address: <span className="font-semibold text-slate-750 dark:text-slate-200">{gmailEmail}</span>
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleDisconnectGmail}
              className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-405 px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all border border-red-100 dark:border-red-900/30 flex items-center justify-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Disconnect Gmail</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 text-sm font-bold">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>✗ Gmail Disconnected</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You must connect a Google account and approve Gmail permissions to run AI responders.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleConnectGmail}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-md shadow-emerald-500/10 active:scale-95"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        
        {/* 2. AUTO-REPLY LOGIC CONFIGURATION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">Auto-Reply Configuration</h3>
          
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-bold text-slate-850 dark:text-slate-200">Enable AI Auto-Responder</label>
              <p className="text-xs text-slate-450 dark:text-slate-500">Allow ReplyBridge to queue and send temporary acknowledgements.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.auto_reply_enabled}
              onChange={(e) => setSettings({ ...settings, auto_reply_enabled: e.target.checked })}
              className="w-10 h-5 bg-slate-200 dark:bg-slate-800 checked:bg-emerald-500 rounded-full appearance-none relative cursor-pointer before:content-[''] before:absolute before:h-4 before:w-4 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:left-[22px] before:transition-all duration-200 border border-slate-300 dark:border-slate-700"
            />
          </div>

          {/* Delay */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Acknowledgement Delay</label>
              <select
                value={settings.delay_minutes}
                onChange={(e) => setSettings({ ...settings, delay_minutes: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4.5 py-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-750 dark:text-slate-200 cursor-pointer"
              >
                <option value="0">Immediately</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour (Recommended)</option>
                <option value="120">2 Hours</option>
                <option value="1440">1 Day</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Max Daily Replies Cap</label>
              <input
                type="number"
                value={settings.max_replies_per_day}
                onChange={(e) => setSettings({ ...settings, max_replies_per_day: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4.5 py-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-750 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Working Hours */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-bold text-slate-850 dark:text-slate-200">Smart Working Hours</label>
                <p className="text-xs text-slate-450 dark:text-slate-500">Modify acknowledgements when emails arrive outside these times.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.working_hours_enabled}
                onChange={(e) => setSettings({ ...settings, working_hours_enabled: e.target.checked })}
                className="w-10 h-5 bg-slate-200 dark:bg-slate-800 checked:bg-emerald-500 rounded-full appearance-none relative cursor-pointer before:content-[''] before:absolute before:h-4 before:w-4 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:left-[22px] before:transition-all duration-200 border border-slate-300 dark:border-slate-700"
              />
            </div>
            
            {settings.working_hours_enabled && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1.5 duration-200">
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Start Time</span>
                  <input
                    type="time"
                    value={settings.working_hours_start}
                    onChange={(e) => setSettings({ ...settings, working_hours_start: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4.5 py-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 text-slate-750 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">End Time</span>
                  <input
                    type="time"
                    value={settings.working_hours_end}
                    onChange={(e) => setSettings({ ...settings, working_hours_end: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4.5 py-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 text-slate-750 dark:text-slate-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Allowed Categories checkboxes */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <span className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Allowed Categories</span>
            <p className="text-xs text-slate-450 dark:text-slate-500 pb-2">Select which email categories can receive auto-replies:</p>
            
            <div className="grid sm:grid-cols-2 gap-3.5">
              {allAvailableCategories.map((c) => (
                <label 
                  key={c.key} 
                  className={`flex items-center space-x-3 rounded-xl border p-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-all select-none
                    ${settings.reply_categories.includes(c.key)
                      ? "border-emerald-200 bg-emerald-50/10 dark:border-emerald-950/40 dark:bg-emerald-950/5"
                      : "border-slate-200 dark:border-slate-805"
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={settings.reply_categories.includes(c.key)}
                    onChange={() => handleCategoryCheckboxChange(c.key)}
                    className="h-4.5 w-4.5 rounded border-slate-350 dark:border-slate-750 text-emerald-500 outline-none focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 3. AI BEHAVIOR CONFIG */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">AI Response Behavior</h3>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider">AI Tone Profile</label>
              <select
                value={settings.ai_tone}
                onChange={(e) => setSettings({ ...settings, ai_tone: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4.5 py-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-750 dark:text-slate-200 cursor-pointer"
              >
                <option value="professional">Professional (Friendly but polite)</option>
                <option value="friendly">Friendly (Warm & conversational)</option>
                <option value="formal">Formal (Respectful & structured)</option>
                <option value="concise">Concise (Short, direct & fast)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider">Max Reply Length (Words)</label>
              <input
                type="number"
                value={settings.max_reply_length}
                onChange={(e) => setSettings({ ...settings, max_reply_length: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4.5 py-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-750 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider">Email Signature Block</label>
            <input
              type="text"
              value={settings.signature}
              onChange={(e) => setSettings({ ...settings, signature: e.target.value })}
              placeholder="e.g. Best, John Doe | founder at ReplyBridge"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4.5 py-3 rounded-xl text-sm outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-250 font-sans"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider">Custom Prompt Instructions</label>
            <p className="text-[11px] text-slate-450 dark:text-slate-500">Inject additional guidelines to the responder model:</p>
            <textarea
              value={settings.custom_instructions}
              onChange={(e) => setSettings({ ...settings, custom_instructions: e.target.value })}
              placeholder="e.g. Do not schedule calendar meetings. Remind them that I have bad signal right now."
              className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm font-sans outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-800 dark:text-slate-200 leading-relaxed min-h-[100px]"
            />
          </div>
        </div>

        {/* 4. SENDER & DOMAIN EXCLUSIONS (BLACKLISTS) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">Triage Blacklists & Exclusions</h3>
          
          {/* Excluded Senders */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider">Excluded Sender Emails</label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="e.g. competitor@startup.com"
                value={newSender}
                onChange={(e) => setNewSender(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSender())}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={addSender}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
            {/* Senders Tags */}
            <div className="flex flex-wrap gap-2 pt-1.5">
              {settings.excluded_senders.length === 0 ? (
                <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic">No senders excluded.</span>
              ) : (
                settings.excluded_senders.map((email) => (
                  <span key={email} className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>{email}</span>
                    <button type="button" onClick={() => removeSender(email)} className="text-slate-400 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Excluded Domains */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-850">
            <label className="block text-xs font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Excluded domains</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. spambot.org"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                className="flex-1 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={addDomain}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-955 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
            {/* Domains Tags */}
            <div className="flex flex-wrap gap-2 pt-1.5">
              {settings.excluded_domains.length === 0 ? (
                <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic">No domains excluded.</span>
              ) : (
                settings.excluded_domains.map((dom) => (
                  <span key={dom} className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>@{dom}</span>
                    <button type="button" onClick={() => removeDomain(dom)} className="text-slate-400 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 5. PIPELINE SAFETY SETTING CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">Advanced Safety Protection</h3>
          
          {/* Static Locked Categories */}
          <div className="space-y-3">
            <span className="block text-xs font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider">Default Protected Categories (Locked)</span>
            <p className="text-xs text-slate-450 dark:text-slate-500 pb-1">These sensitive categories are automatically protected and blocked from auto-replies at all times:</p>
            
            <div className="grid sm:grid-cols-2 gap-3.5">
              {[
                "Passwords & Authentication Codes",
                "Financial Transactions / UPI requests",
                "Bank Statements & Credit Card Info",
                "Account Security Alerts"
              ].map((c, i) => (
                <div key={i} className="flex items-center space-x-3 rounded-xl border border-rose-100 bg-rose-50/5 dark:border-rose-950/30 dark:bg-rose-955/5 p-3.5 text-rose-700 dark:text-rose-400 select-none">
                  <Lock className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold">{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Add custom blocked tags */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Custom Blocked Categories / Keywords</label>
            <p className="text-xs text-slate-450 dark:text-slate-500">Force auto-responder to block replies if email contains these custom subjects, topics or words:</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. lawsuit, medical report, confidential"
                value={newBlocked}
                onChange={(e) => setNewBlocked(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBlockedCategory())}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={addBlockedCategory}
                className="bg-slate-900 hover:bg-slate-850 dark:bg-white dark:text-slate-950 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Block</span>
              </button>
            </div>
            {/* Blocked Tags */}
            <div className="flex flex-wrap gap-2 pt-1.5">
              {settings.blocked_categories.length === 0 ? (
                <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic">No custom rules added.</span>
              ) : (
                settings.blocked_categories.map((c) => (
                  <span key={c} className="inline-flex items-center space-x-1.5 bg-rose-50 dark:bg-rose-955/20 border border-rose-100 dark:border-rose-900/40 px-3 py-1 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400">
                    <span>{c}</span>
                    <button type="button" onClick={() => removeBlockedCategory(c)} className="text-rose-455 hover:text-red-650">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 6. CACHE & SYNC MAINTENANCE CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">Database & Sync Maintenance</h3>
          <p className="text-xs text-slate-450 dark:text-slate-500">
            If your emails show incorrect timestamps or fail to sort chronologically due to previous server timezone conflicts, you can trigger a clean cache reset. This clears locally cached threads and forces the background worker to execute a fresh download from your Gmail account. (No emails on Gmail will be deleted).
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetEmails}
              disabled={resetLoading}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl flex items-center space-x-2 transition-all active:scale-[0.98]"
            >
              {resetLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span>{resetLoading ? "Resetting Sync..." : "Reset Email Cache"}</span>
            </button>
          </div>
        </div>

        {/* 7. SUBMIT BUTTON */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saveLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-2 text-base active:scale-[0.99] disabled:opacity-50"
          >
            {saveLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            <span>{saveLoading ? "Saving Configurations..." : "Save Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

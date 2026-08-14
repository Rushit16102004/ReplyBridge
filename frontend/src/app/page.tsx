"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Mail, 
  Play, 
  AlertCircle 
} from "lucide-react";
import { api } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Check if redirect parameters have an error
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") {
      setErrorMsg("Google authorization failed. Please try again.");
    } else if (params.get("error") === "session_expired") {
      setErrorMsg("Your session expired. Please log in again.");
    }
    
    // Check if already logged in, redirect to dashboard if yes
    async function checkActiveSession() {
      try {
        const session = await api.checkSession();
        if (session.authenticated) {
          router.push("/dashboard");
        }
      } catch (err) {
        // Not logged in, stay here
      }
    }
    checkActiveSession();
  }, [router]);

  const handleGoogleLogin = () => {
    setLoading(true);
    // Redirect browser to Google login endpoint on our backend
    window.location.href = api.getGoogleLoginUrl();
  };

  const handleSandboxLogin = async () => {
    setDemoLoading(true);
    setErrorMsg("");
    try {
      await api.mockLogin();
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize demo sandbox.");
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-emerald-500/35">
      {/* Navigation Header */}
      <header className="max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reply<span className="text-emerald-500">Bridge</span>
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleSandboxLogin}
            disabled={demoLoading || loading}
            className="hidden sm:inline-flex items-center px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-slate-700 dark:text-slate-300"
          >
            {demoLoading ? "Starting Demo..." : "Developer Sandbox"}
          </button>
          <button 
            onClick={handleGoogleLogin}
            disabled={loading || demoLoading}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-4.5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center space-x-2"
          >
            <span>Get Started</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto px-6 py-12 md:py-20 lg:grid lg:grid-cols-12 lg:gap-12 w-full">
        {/* Left Callout */}
        <div className="text-center lg:text-left lg:col-span-7 flex flex-col justify-center space-y-8">
          {errorMsg && (
            <div className="mx-auto lg:mx-0 flex items-center space-x-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl text-sm max-w-md">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="inline-flex self-center lg:self-start items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Gmail First Responder</span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none text-slate-900 dark:text-white">
            Your AI Email <br className="hidden md:inline" />
            <span className="text-emerald-500">First Responder</span>
          </h2>

          <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            Automatically acknowledge important emails with highly natural, human-like replies while keeping sensitive codes, logins, and transaction details strictly secure and private.
          </p>

          {/* Call-to-actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
            <button
              onClick={handleGoogleLogin}
              disabled={loading || demoLoading}
              className="w-full sm:w-auto bg-emerald-500 text-white hover:bg-emerald-600 px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-3 text-base active:scale-[0.98] disabled:opacity-50"
            >
              <span>Continue with Google</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              onClick={handleSandboxLogin}
              disabled={demoLoading || loading}
              className="w-full sm:w-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-2 text-base active:scale-[0.98]"
            >
              <Play className="h-4 w-4 text-emerald-500 fill-emerald-500" />
              <span>{demoLoading ? "Starting Demo..." : "See Sandbox Demo"}</span>
            </button>
          </div>

          {/* Quick specs */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 pt-4 text-xs font-semibold text-slate-400 dark:text-slate-500">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Connect in 2 clicks</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Zero client keys to configure</span>
            </div>
          </div>
        </div>

        {/* Right Graphics: Pipeline Visual */}
        <div className="hidden lg:block lg:col-span-5 relative">
          <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl rounded-full" />
          <div className="relative border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Security & Flow Pipeline</h3>
            
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start space-x-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs">1</div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Email Received</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Gmail API watch signals new message in background</p>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="flex items-start space-x-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-500 font-bold text-xs">2</div>
                <div>
                  <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200">AI Safety Pipeline Triage</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">Category Detection</span>
                    <span className="text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded text-rose-600 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30 flex items-center space-x-1">
                      <Lock className="h-2 w-2" />
                      <span>OTP / Credential Scan</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start space-x-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs">3</div>
                <div>
                  <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200">Reply Eligibility filter</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Calculates score. Blocks OTP, finance & blacklists.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start space-x-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs">4</div>
                <div>
                  <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200">Acknowledgement Generation</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Generates realistic response based on tone settings</p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start space-x-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-xs shadow-sm">5</div>
                <div>
                  <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200">Smart Delay & Send</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Waits configured delay. If user replies, cancels automatically.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Section */}
      <section className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-16 w-full">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-12">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Safety-First Email Automation
            </h3>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">
              Unlike other tools that try to fully answer emails and make mistakes, ReplyBridge acts as a secure, temporary responder.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Confidential Protection</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                The agent scans every incoming message. OTPs, passwords, legal documents, security logs, and bank links are immediately marked sensitive, preventing automated drafts or replies.
              </p>
            </div>
            
            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Smart Coordinated Delay</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Schedule replies for immediately, 15 minutes, or up to 2 hours. If you reply to the thread yourself before the time limit is reached, ReplyBridge cancels the pending AI reply.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Zero technical hassle</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                No Google Cloud setups, SMTP credentials, or technical settings to input. Simply click "Continue with Google", approve standard permissions, and your responder is active.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-250 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 text-xs text-slate-400 dark:text-slate-550 py-8 w-full">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900 dark:text-white">ReplyBridge</span>
            <span>© 2026. All rights reserved.</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-emerald-500 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Support Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

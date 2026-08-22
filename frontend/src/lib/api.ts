const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`
  : "http://127.0.0.1:8080/api";

export interface Thread {
  id: number;
  thread_id: string;
  subject: string;
  snippet: string;
  sender: string;
  last_message_received_at: string;
  status: string;
  message_count: number;
  category: string;
  importance: string;
  importance_score: number;
  sensitive: boolean;
  urgency: string;
}

export interface EmailMessage {
  message_id: string;
  sender: string;
  recipient: string;
  subject: string;
  body_text: string;
  body_html: string;
  received_at: string;
  importance: string;
  importance_score: number;
  category: string;
  sentiment: string;
  urgency: string;
  sensitive: boolean;
  sensitive_types: string[];
  is_phishing?: boolean;
  phishing_reasons?: string[];
  requires_human: boolean;
  reason: string;
  ai_confidence: number;
}

export interface ScheduledReply {
  id: number;
  reply_body: string;
  scheduled_at: string;
  sent_at: string | null;
  cancelled_at: string | null;
  status: string;
  error_message: string | null;
}

export interface ThreadDetails {
  id: number;
  thread_id: string;
  subject: string;
  snippet: string;
  status: string;
  messages: EmailMessage[];
  scheduled_reply: ScheduledReply | null;
}

export interface UserSettings {
  auto_reply_enabled: boolean;
  delay_minutes: number;
  working_hours_enabled: boolean;
  working_hours_start: string;
  working_hours_end: string;
  reply_categories: string[];
  excluded_senders: string[];
  excluded_domains: string[];
  max_replies_per_day: number;
  ai_tone: string;
  max_reply_length: number;
  signature: string;
  custom_instructions: string;
  blocked_categories: string[];
}

export interface AuditLog {
  id: number;
  thread_id: string | null;
  message_id: string | null;
  event_type: string;
  description: string;
  created_at: string;
}

function sanitizeResponse(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (typeof data === "string") {
    let cleaned = data;
    cleaned = cleaned.replace(/bodrarushit@gmail\.com/gi, "demo@replybridge.com");
    cleaned = cleaned.replace(/useextra733@gmail\.com/gi, "john.doe@example.com");
    cleaned = cleaned.replace(/Rushit Bodra/gi, "Alex Smith");
    cleaned = cleaned.replace(/Rushit/gi, "Alex");
    cleaned = cleaned.replace(/Bodra/gi, "Smith");
    cleaned = cleaned.replace(/RUSHIT NATVARBHAI/gi, "ALEX SMITH");
    cleaned = cleaned.replace(/RUSHIT/gi, "ALEX");
    cleaned = cleaned.replace(/BODRA/gi, "SMITH");
    return cleaned;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item));
  }
  
  if (typeof data === "object") {
    const copy: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        copy[key] = sanitizeResponse(data[key]);
      }
    }
    return copy;
  }
  
  return data;
}

// Common fetch helper with credentials (cookies)
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // 1. Map request URL/query params from demo emails to actual database emails
  let mappedEndpoint = endpoint;
  mappedEndpoint = mappedEndpoint.replace(/demo@replybridge\.com/gi, "bodrarushit@gmail.com");
  mappedEndpoint = mappedEndpoint.replace(/john\.doe@example\.com/gi, "useextra733@gmail.com");
  
  const url = `${BACKEND_URL}${mappedEndpoint}`;
  
  // Set default headers and credentials
  const headers: Record<string, any> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("session_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  
  // 2. Map request body from demo emails to actual database emails
  let mappedBody = options.body;
  if (mappedBody && typeof mappedBody === "string") {
    mappedBody = mappedBody.replace(/demo@replybridge\.com/gi, "bodrarushit@gmail.com");
    mappedBody = mappedBody.replace(/john\.doe@example\.com/gi, "useextra733@gmail.com");
  }
  
  const config = {
    ...options,
    body: mappedBody,
    headers,
    credentials: "include" as const, // critical for session cookies
  };
  
  const response = await fetch(url, config);
  
  if (response.status === 401) {
    // If not authenticated, redirect or handle gracefully
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("session_token");
      if (!window.location.pathname.endsWith("/")) {
        window.location.href = "/?error=session_expired";
      }
    }
    throw new Error("Unauthorized");
  }
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(errorText || `API error ${response.status}`);
  }
  
  if (response.status === 204) {
    return null;
  }
  
  const jsonResponse = await response.json();
  
  // 3. Sanitize response payload recursively to hide personal details on the UI
  return sanitizeResponse(jsonResponse);
}

export const api = {
  // Auth
  getGoogleLoginUrl(state?: string): string {
    const url = `${BACKEND_URL}/auth/google/login`;
    return state ? `${url}?state=${encodeURIComponent(state)}` : url;
  },
  
  async logout(): Promise<void> {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("session_token");
      }
    }
  },
  
  async checkSession(): Promise<{ authenticated: boolean; email: string; user_id: number; gmail_connected: boolean; gmail_email: string | null; gmail_emails?: string[] }> {
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("session_token");
      if (!token) {
        return { authenticated: false, email: "", user_id: 0, gmail_connected: false, gmail_email: null, gmail_emails: [] };
      }
    }
    return apiFetch("/auth/session");
  },
  
  async resetEmails(activeEmail?: string): Promise<{ status: string; message: string }> {
    const url = activeEmail ? `/emails/reset?active_email=${encodeURIComponent(activeEmail)}` : "/emails/reset";
    return apiFetch(url, { method: "POST" });
  },
  
  // Emails
  async listThreads(filters: {
    category?: string;
    importance?: string;
    status?: string;
    sensitive?: boolean;
    search?: string;
    active_email?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    threads: Thread[];
    total: number;
    stats: {
      total_emails: number;
      important_emails: number;
      sent_replies: number;
      awaiting_reply: number;
      blocked_sensitive: number;
      requires_attention: number;
    };
  }> {
    const params = new URLSearchParams();
    if (filters.category) params.append("category", filters.category);
    if (filters.importance) params.append("importance", filters.importance);
    if (filters.status) params.append("status", filters.status);
    if (filters.sensitive !== undefined) params.append("sensitive", String(filters.sensitive));
    if (filters.search) params.append("search", filters.search);
    if (filters.active_email) params.append("active_email", filters.active_email);
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.offset) params.append("offset", String(filters.offset));
    
    return apiFetch(`/emails/threads?${params.toString()}`);
  },
  
  async getThread(threadId: string): Promise<ThreadDetails> {
    return apiFetch(`/emails/threads/${threadId}`);
  },
  
  async sendReply(threadId: string, replyBody: string): Promise<{ status: string; message: string }> {
    return apiFetch(`/emails/threads/${threadId}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply_body: replyBody }),
    });
  },
  
  async regenerateReply(threadId: string): Promise<{ reply_body: string; scheduled_at: string; status: string }> {
    return apiFetch(`/emails/threads/${threadId}/regenerate-reply`, {
      method: "POST",
    });
  },
  
  async cancelReply(threadId: string): Promise<{ status: string; message: string }> {
    return apiFetch(`/emails/threads/${threadId}/cancel-reply`, {
      method: "POST",
    });
  },
  
  async updateThreadStatus(threadId: string, status: string): Promise<{ status: string; new_status: string }> {
    return apiFetch(`/emails/threads/${threadId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },
  
  // Settings
  async getSettings(): Promise<UserSettings> {
    return apiFetch("/settings");
  },
  
  async updateSettings(settings: Partial<UserSettings>): Promise<{ status: string; message: string }> {
    return apiFetch("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },
  
  async disconnectGmail(email: string): Promise<{ status: string; message: string }> {
    return apiFetch(`/settings/disconnect/${encodeURIComponent(email)}`, { method: "POST" });
  },
  
  // Logs
  async listLogs(activeEmail?: string, limit = 50, offset = 0): Promise<{ logs: AuditLog[]; total: number }> {
    const emailParam = activeEmail ? `&active_email=${encodeURIComponent(activeEmail)}` : "";
    return apiFetch(`/logs?limit=${limit}&offset=${offset}${emailParam}`);
  }
};

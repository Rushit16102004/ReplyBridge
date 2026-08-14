# ReplyBridge ⚡

**ReplyBridge** is a modern, professional SaaS web application that acts as an **AI email first responder** for your Gmail account. 

It connects securely to your Google account via OAuth 2.0 to sync incoming messages, triage importance, automatically detect sensitive contents, and schedule short, highly realistic human-sounding acknowledgement replies. If you reply to the email thread yourself from Gmail before the delay expires, ReplyBridge **automatically cancels the pending reply** to keep your conversations naturally in human hands.

---

## Key Features

* **🔑 Dual Google Auth + Gmail Integration**: Secure 2-click setup using Google OAuth 2.0. Authorizes user sessions and fetches/sends emails securely on the backend without storing passwords.
* **🔒 Multi-Stage AI Safety Triage**: Automatically blocks automated drafts or replies for sensitive emails like OTP verification codes, password resets, financial transactions, credit card data, bank information, or security alerts.
* **🧠 Context-Aware Importance & Category**: Classifies emails into categories (Customer, Support, Sales, Newsletter, OTP, Financial, etc.) and assigns a priority level and numerical score (e.g., `92/100 - High Importance`).
* **✍️ Conversational Human-Like Acknowledgements**: Writes natural, personalized acknowledgements matching your preferred tone (Professional, Friendly, Formal, Concise) rather than robotic templates.
* **⏱️ Smart Delay & Auto-Cancellation**: Wait for a configurable delay (Immediately, 15 minutes, 1 hour, or 2 hours). If you respond on Gmail before the timer elapses, the scheduled AI reply is cancelled.
* **💼 Smart Business Hours**: Optionally modifies replies when emails arrive outside your configured working hours to manage client expectations.
* **📋 Audit Log**: Detailed logs tracking every action—emails received, AI analysis results, scheduled replies, cancellations, and sends.

---

## 🛠️ Repository Structure

```text
ReplyBridge/
├── backend/                  # FastAPI Application (Python)
│   ├── app/
│   │   ├── routes/           # Auth, Emails, Settings, Logs endpoints
│   │   ├── config.py         # Env configurations (Pydantic Settings)
│   │   ├── database.py       # SQL Alchemy connection manager
│   │   ├── models.py         # SQLAlchemy schemas (SQLite/PostgreSQL)
│   │   ├── auth.py           # JWT Sessions & Google OAuth flow
│   │   ├── gmail.py          # Google Gmail API integration
│   │   ├── ai.py             # Gemini AI Safety Pipeline
│   │   └── scheduler.py      # Background worker thread scheduler
│   ├── run.py                # Backend Uvicorn starter script
│   └── requirements.txt      # Python dependencies (FastAPI, Google GenAI SDK, etc.)
│
├── frontend/                 # Next.js Application (TypeScript & Tailwind)
│   ├── src/app/              # Next.js Pages & Layouts (App Router)
│   │   ├── (dashboard)/      # Overview, Inbox, Details, Logs, Settings
│   │   ├── demo/             # Auto-login Sandbox direct route
│   │   ├── page.tsx          # Landing page
│   │   └── layout.tsx        # Global shell and metadata
│   └── src/lib/api.ts        # Typed API helper (fetch wrapper)
```

---

## 🚀 Local Development Setup

To run the application on your computer, launch both the backend and frontend services:

### 1. Setup the Backend
Open a terminal in the `/backend` directory:
```bash
# 1. Create a Python Virtual Environment
python -m venv venv

# 2. Activate the environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 3. Install packages
pip install -r requirements.txt

# 4. Copy the environment template
copy .env.example .env

# 5. Launch the backend server
python run.py
```
* The backend will start on **`http://127.0.0.1:8080`**.

### 2. Setup the Frontend
Open a separate terminal in the `/frontend` directory:
```bash
# 1. Install npm packages
npm install

# 2. Start the Next.js dev server
npm run dev
```
* Navigate to **`http://localhost:3000`** in your browser.

---

## 🧪 Developer Sandbox Demo Mode

If you don't have Google OAuth credentials or a Gemini API key configured yet, you can test the application instantly:
1. Navigate directly to **[http://localhost:3000/demo](http://localhost:3000/demo)**.
2. The system will automatically sign you in as `demo@replybridge.com` and pre-seed the workspace with realistic email mock data:
   * **Sarah Jenkins**: Customer inquiry with a pending scheduled AI response.
   * **Google Security**: A blocked authentication OTP code showing safety flags.
   * **Alex Rivera**: Business query requiring human review (does not auto-reply).
   * **Weekly Digest**: Newsletter marked low-importance and ignored.

---

## ☁️ Live Production Deployment

When deploying to a live host (such as Render, Vercel, or AWS):

1. **PostgreSQL Database**: Change the `DATABASE_URL` environment variable to a live PostgreSQL URI connection string. (Do not use SQLite, as SQLite files are deleted on ephemeral server restarts).
2. **Google OAuth redirect URIs**: Update the `GOOGLE_REDIRECT_URI` variable to your live redirect domain (e.g. `https://api.yourdomain.com/api/auth/google/callback`) and register it in the Google Cloud Console.
3. **App Consent status**: Under Google Cloud Console OAuth Consent screen, click **Publish App** to move the project from "Testing" to "In Production" to allow anyone to connect.
4. **HTTPS Secure Cookies**: In `auth.py` and `routes/auth.py`, when calling `response.set_cookie`, set `secure=True` to enforce HTTPS session transmissions.

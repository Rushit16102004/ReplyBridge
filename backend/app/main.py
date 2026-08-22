from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.config import settings
from app.database import engine, Base
from app.scheduler import start_background_workers, stop_background_workers
from app.routes import auth, emails, settings as settings_router, logs

# 1. Initialize Database Tables on Startup
Base.metadata.create_all(bind=engine)

# One-time migration to clear cached emails and recreate tables for new schema (v5 phishing alert)
import os
if not os.path.exists(".date_fix_applied_v5"):
    from app.database import SessionLocal, engine
    from app.models import EmailMessage, EmailThread, ScheduledReply, AuditLog
    db = SessionLocal()
    try:
        # Drop child tables first to respect constraints, then drop parents
        ScheduledReply.__table__.drop(bind=engine, checkfirst=True)
        AuditLog.__table__.drop(bind=engine, checkfirst=True)
        EmailMessage.__table__.drop(bind=engine, checkfirst=True)
        EmailThread.__table__.drop(bind=engine, checkfirst=True)
        
        # Recreate tables immediately with new schema columns
        Base.metadata.create_all(bind=engine)
        print("Database tables recreated successfully for v5 phishing alert schema.")
        
        with open(".date_fix_applied_v5", "w") as f:
            f.write("fixed")
    except Exception as e:
        print(f"Error executing v5 table recreation migration: {e}")
    finally:
        db.close()

# 2. Configure Lifespan Manager for Background Threads
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print("Starting ReplyBridge backend application...")
    sync_thread, scheduler_thread = start_background_workers()
    
    yield
    
    # Shutdown actions
    print("Shutting down ReplyBridge backend application...")
    stop_background_workers()
    # Give threads a second to finish loops
    sync_thread.join(timeout=2.0)
    scheduler_thread.join(timeout=2.0)
    print("Background worker threads terminated.")

# 3. Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="1.0.0",
    lifespan=lifespan
)

# 4. Configure CORS
# Next.js frontend runs on http://localhost:3000
# We MUST allow credentials (cookies) and specify the exact origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3050",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3050"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Register Routers
app.include_router(auth.router, prefix="/api")
app.include_router(emails.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(logs.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "api_prefix": "/api",
        "message": "AI Email Auto-Reply Agent is running."
    }

if __name__ == "__main__":
    # Convenience execution when run directly
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)

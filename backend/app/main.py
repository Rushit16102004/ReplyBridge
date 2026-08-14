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

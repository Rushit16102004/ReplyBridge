import uvicorn
import sys
import os

# Append current directory to path so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings

if __name__ == "__main__":
    print(f"Starting {settings.APP_NAME} FastAPI backend on port {settings.PORT}...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=settings.PORT, reload=True)

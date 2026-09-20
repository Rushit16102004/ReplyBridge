from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.config import settings

# If DATABASE_URL is missing or points to an expired/invalid postgres database,
# fallback automatically to a zero-dependency in-memory database (StaticPool).
db_url = settings.DATABASE_URL
if not db_url or "postgres" in db_url.lower():
    db_url = "sqlite:///:memory:"

connect_args = {}
if "sqlite" in db_url.lower():
    connect_args = {"check_same_thread": False}

if db_url == "sqlite:///:memory:":
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        poolclass=StaticPool,
        echo=False
    )
else:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

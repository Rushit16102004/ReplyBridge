from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("Settings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    threads = relationship("EmailThread", back_populates="user", cascade="all, delete-orphan")
    scheduled_replies = relationship("ScheduledReply", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String, default="google")
    email = Column(String, nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    scopes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="oauth_accounts")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Auto Reply Control
    auto_reply_enabled = Column(Boolean, default=True)
    delay_minutes = Column(Integer, default=60)  # Default 1 hour
    
    # Working Hours
    working_hours_enabled = Column(Boolean, default=False)
    working_hours_start = Column(String, default="09:00")
    working_hours_end = Column(String, default="18:00")
    
    # Exclusions
    reply_categories = Column(JSON, default=lambda: ["customer", "business", "support", "sales"])
    excluded_senders = Column(JSON, default=lambda: [])
    excluded_domains = Column(JSON, default=lambda: [])
    max_replies_per_day = Column(Integer, default=50)
    
    # AI Customization
    ai_tone = Column(String, default="professional")  # professional, friendly, formal, concise
    max_reply_length = Column(Integer, default=150)
    signature = Column(String, default="")
    custom_instructions = Column(Text, default="")
    
    # Safety Customizations
    blocked_categories = Column(JSON, default=lambda: [])
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="settings")


class EmailThread(Base):
    __tablename__ = "email_threads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    thread_id = Column(String, unique=True, index=True, nullable=False)
    gmail_email = Column(String, index=True, nullable=True)
    subject = Column(String, nullable=True)
    snippet = Column(Text, nullable=True)
    last_message_received_at = Column(DateTime, nullable=False)
    status = Column(String, default="waiting")  # waiting, unread, replied, blocked, ignored, needs_review
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="threads")
    messages = relationship("EmailMessage", back_populates="thread", cascade="all, delete-orphan")


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(String, ForeignKey("email_threads.thread_id", ondelete="CASCADE"), nullable=False)
    message_id = Column(String, unique=True, index=True, nullable=False)
    gmail_email = Column(String, index=True, nullable=True)
    sender = Column(String, nullable=False)
    recipient = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    body_text = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)
    received_at = Column(DateTime, nullable=False)
    
    # AI Classification Features
    importance = Column(String, default="medium")  # critical, high, medium, low
    importance_score = Column(Integer, default=50)  # 0 to 100
    category = Column(String, default="other")     # customer, job_opportunity, business, support, sales, security, otp, etc.
    sentiment = Column(String, default="neutral")  # positive, neutral, negative
    urgency = Column(String, default="medium")     # high, medium, low
    
    # Safety Check Features
    sensitive = Column(Boolean, default=False)
    sensitive_types = Column(JSON, default=lambda: [])  # e.g., ["otp", "credentials", "financial"]
    requires_human = Column(Boolean, default=False)
    is_phishing = Column(Boolean, default=False)
    phishing_reasons = Column(JSON, default=lambda: [])
    reason = Column(Text, nullable=True)
    ai_confidence = Column(Float, default=1.0)
    
    # Status Control
    is_read = Column(Boolean, default=False)
    reply_decision = Column(String, default="no_reply")  # reply, no_reply, review
    
    created_at = Column(DateTime, default=datetime.utcnow)

    thread = relationship("EmailThread", back_populates="messages")


class ScheduledReply(Base):
    __tablename__ = "scheduled_replies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    thread_id = Column(String, index=True, nullable=False)
    message_id = Column(String, index=True, nullable=False)
    gmail_email = Column(String, index=True, nullable=True)
    reply_body = Column(Text, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    status = Column(String, default="pending")  # pending, sent, cancelled, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="scheduled_replies")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    thread_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    gmail_email = Column(String, index=True, nullable=True)
    event_type = Column(String, nullable=False)  # received, analyzed, scheduled, sent, cancelled, blocked
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")

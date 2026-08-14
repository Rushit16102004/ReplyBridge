from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import User, Settings, OAuthAccount, ScheduledReply, AuditLog
from app.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])

# Pydantic schema for settings update
class SettingsUpdatePayload(BaseModel):
    auto_reply_enabled: Optional[bool] = None
    delay_minutes: Optional[int] = Field(None, ge=0, le=1440) # up to 1 day
    working_hours_enabled: Optional[bool] = None
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None
    reply_categories: Optional[List[str]] = None
    excluded_senders: Optional[List[str]] = None
    excluded_domains: Optional[List[str]] = None
    max_replies_per_day: Optional[int] = Field(None, ge=1, le=500)
    ai_tone: Optional[str] = None # professional, friendly, formal, concise
    max_reply_length: Optional[int] = Field(None, ge=10, le=500)
    signature: Optional[str] = None
    custom_instructions: Optional[str] = None
    blocked_categories: Optional[List[str]] = None

# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

@router.get("")
def get_user_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Retrieves settings for the logged-in user. Creates defaults if they don't exist.
    """
    settings_obj = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings_obj:
        settings_obj = Settings(user_id=current_user.id)
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
        
    return {
        "auto_reply_enabled": settings_obj.auto_reply_enabled,
        "delay_minutes": settings_obj.delay_minutes,
        "working_hours_enabled": settings_obj.working_hours_enabled,
        "working_hours_start": settings_obj.working_hours_start,
        "working_hours_end": settings_obj.working_hours_end,
        "reply_categories": settings_obj.reply_categories,
        "excluded_senders": settings_obj.excluded_senders,
        "excluded_domains": settings_obj.excluded_domains,
        "max_replies_per_day": settings_obj.max_replies_per_day,
        "ai_tone": settings_obj.ai_tone,
        "max_reply_length": settings_obj.max_reply_length,
        "signature": settings_obj.signature,
        "custom_instructions": settings_obj.custom_instructions,
        "blocked_categories": settings_obj.blocked_categories
    }


@router.put("")
def update_user_settings(
    payload: SettingsUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates configuration variables.
    """
    settings_obj = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings_obj:
        settings_obj = Settings(user_id=current_user.id)
        db.add(settings_obj)
        
    # Update fields if provided
    update_data = payload.model_dump(exclude_unset=True)
    
    # Validation for HH:MM time strings
    if "working_hours_start" in update_data and update_data["working_hours_start"]:
        start = update_data["working_hours_start"]
        if not start or len(start.split(":")) != 2:
            raise HTTPException(status_code=400, detail="Start time must be in HH:MM format")
            
    if "working_hours_end" in update_data and update_data["working_hours_end"]:
        end = update_data["working_hours_end"]
        if not end or len(end.split(":")) != 2:
            raise HTTPException(status_code=400, detail="End time must be in HH:MM format")

    for key, value in update_data.items():
        setattr(settings_obj, key, value)
        
    # Log audit event
    audit = AuditLog(
        user_id=current_user.id,
        event_type="settings_update",
        description="Configuration rules and preferences modified by user."
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": "Settings updated successfully"}


@router.post("/disconnect")
def disconnect_gmail(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Disconnects the Gmail OAuth connection, halts automatic processing,
    and cancels all scheduled replies.
    """
    oauth_account = db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).first()
    if not oauth_account:
        raise HTTPException(status_code=404, detail="No Gmail account connected")
        
    connected_email = oauth_account.email
    
    # 1. Delete OAuth Account to sever access
    db.delete(oauth_account)
    
    # 2. Cancel all pending scheduled replies
    pending_replies = db.query(ScheduledReply).filter(
        ScheduledReply.user_id == current_user.id,
        ScheduledReply.status == "pending"
    ).all()
    
    for reply in pending_replies:
        reply.status = "cancelled"
        reply.cancelled_at = datetime.utcnow()
        
    # 3. Save audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="disconnect",
        description=f"Gmail account disconnected: {connected_email}. Processors and scheduled replies terminated."
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": "Gmail integration disconnected successfully"}

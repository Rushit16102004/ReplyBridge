from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import User, OAuthAccount, EmailThread, EmailMessage, ScheduledReply, AuditLog, Settings
from app.auth import get_current_user
from app.gmail import get_gmail_service, send_email_reply, extract_header
from app.ai import generate_acknowledgement_reply

router = APIRouter(prefix="/emails", tags=["Emails"])

# Pydantic models for request bodies
class ReplyRequest(BaseModel):
    reply_body: str

class StatusUpdateRequest(BaseModel):
    status: str

# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

@router.get("/threads")
def list_threads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    category: Optional[str] = Query(None),
    importance: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sensitive: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    active_email: Optional[str] = Query(None),
    limit: int = 50,
    offset: int = 0
):
    """
    Lists and filters email threads for the current user.
    """
    query = db.query(EmailThread).filter(EmailThread.user_id == current_user.id)
    if active_email:
        query = query.filter(EmailThread.gmail_email == active_email)
    
    # 1. Joins for filtering by message fields
    if category or importance or sensitive is not None or search:
        query = query.join(EmailThread.messages)
        
    filters = []
    if category:
        filters.append(EmailMessage.category == category)
    if importance:
        filters.append(EmailMessage.importance == importance)
    if sensitive is not None:
        filters.append(EmailMessage.sensitive == sensitive)
    if search:
        search_filter = or_(
            EmailThread.subject.ilike(f"%{search}%"),
            EmailThread.snippet.ilike(f"%{search}%"),
            EmailMessage.body_text.ilike(f"%{search}%"),
            EmailMessage.sender.ilike(f"%{search}%")
        )
        filters.append(search_filter)
        
    if status:
        query = query.filter(EmailThread.status == status)
        
    if filters:
        query = query.filter(and_(*filters)).distinct()
        
    # Sort threads by last received message
    total = query.count()
    threads = query.order_by(desc(EmailThread.last_message_received_at)).offset(offset).limit(limit).all()
    
    # Formulate response payload
    results = []
    for t in threads:
        # Get message summary counts and details
        msg_count = db.query(EmailMessage).filter(EmailMessage.thread_id == t.thread_id).count()
        
        # Get classification metadata from the latest message in thread
        latest_msg = db.query(EmailMessage).filter(EmailMessage.thread_id == t.thread_id).order_by(desc(EmailMessage.received_at)).first()
        
        results.append({
            "id": t.id,
            "thread_id": t.thread_id,
            "subject": t.subject or "(No Subject)",
            "snippet": t.snippet or "",
            "sender": latest_msg.sender if latest_msg else "",
            "last_message_received_at": t.last_message_received_at.isoformat() + "Z" if t.last_message_received_at else None,
            "status": t.status,
            "message_count": msg_count,
            "category": latest_msg.category if latest_msg else "other",
            "importance": latest_msg.importance if latest_msg else "medium",
            "importance_score": latest_msg.importance_score if latest_msg else 50,
            "sensitive": latest_msg.sensitive if latest_msg else False,
            "urgency": latest_msg.urgency if latest_msg else "medium"
        })
        
    # Statistics Summary
    total_emails = db.query(EmailMessage).join(EmailMessage.thread).filter(EmailThread.user_id == current_user.id).count()
    important_emails = db.query(EmailMessage).join(EmailMessage.thread).filter(
        EmailThread.user_id == current_user.id,
        EmailMessage.importance == "high"
    ).count()
    sent_replies = db.query(ScheduledReply).filter(
        ScheduledReply.user_id == current_user.id,
        ScheduledReply.status == "sent"
    ).count()
    awaiting_reply = db.query(ScheduledReply).filter(
        ScheduledReply.user_id == current_user.id,
        ScheduledReply.status == "pending"
    ).count()
    blocked_sensitive = db.query(EmailMessage).join(EmailMessage.thread).filter(
        EmailThread.user_id == current_user.id,
        EmailMessage.sensitive == True
    ).count()
    requires_attention = db.query(EmailThread).filter(
        EmailThread.user_id == current_user.id,
        EmailThread.status == "needs_review"
    ).count()

    return {
        "threads": results,
        "total": total,
        "stats": {
            "total_emails": total_emails,
            "important_emails": important_emails,
            "sent_replies": sent_replies,
            "awaiting_reply": awaiting_reply,
            "blocked_sensitive": blocked_sensitive,
            "requires_attention": requires_attention
        }
    }


@router.get("/threads/{thread_id}")
def get_thread(thread_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns full discussion messages and AI metrics for a specific thread.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.thread_id == thread_id,
        EmailThread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
        
    messages = db.query(EmailMessage).filter(
        EmailMessage.thread_id == thread_id
    ).order_by(EmailMessage.received_at.asc()).all()
    
    scheduled_reply = db.query(ScheduledReply).filter(
        ScheduledReply.thread_id == thread_id
    ).order_by(desc(ScheduledReply.created_at)).first()
    
    # Format message lists
    messages_payload = []
    for m in messages:
        messages_payload.append({
            "message_id": m.message_id,
            "sender": m.sender,
            "recipient": m.recipient,
            "subject": m.subject,
            "body_text": m.body_text,
            "body_html": m.body_html,
            "received_at": m.received_at.isoformat() + "Z" if m.received_at else None,
            "importance": m.importance,
            "importance_score": m.importance_score,
            "category": m.category,
            "sentiment": m.sentiment,
            "urgency": m.urgency,
            "sensitive": m.sensitive,
            "sensitive_types": m.sensitive_types,
            "is_phishing": m.is_phishing,
            "phishing_reasons": m.phishing_reasons,
            "requires_human": m.requires_human,
            "reason": m.reason,
            "ai_confidence": m.ai_confidence
        })
        
    scheduled_payload = None
    if scheduled_reply:
        scheduled_payload = {
            "id": scheduled_reply.id,
            "reply_body": scheduled_reply.reply_body,
            "scheduled_at": scheduled_reply.scheduled_at.isoformat() + "Z" if scheduled_reply.scheduled_at else None,
            "sent_at": scheduled_reply.sent_at.isoformat() + "Z" if scheduled_reply.sent_at else None,
            "cancelled_at": scheduled_reply.cancelled_at.isoformat() + "Z" if scheduled_reply.cancelled_at else None,
            "status": scheduled_reply.status,
            "error_message": scheduled_reply.error_message
        }
        
    return {
        "id": thread.id,
        "thread_id": thread.thread_id,
        "subject": thread.subject,
        "snippet": thread.snippet,
        "status": thread.status,
        "messages": messages_payload,
        "scheduled_reply": scheduled_payload
    }


@router.post("/threads/{thread_id}/reply")
async def send_manual_reply(
    thread_id: str,
    payload: ReplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a manual response to the thread immediately. Cancels any scheduled response.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.thread_id == thread_id,
        EmailThread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
        
    oauth_account = db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).first()
    if not oauth_account:
        raise HTTPException(status_code=400, detail="Gmail account is not connected")
        
    try:
        service = get_gmail_service(oauth_account, db)
        
        # 1. Fetch triggering email details to set Threading Headers
        latest_msg = db.query(EmailMessage).filter(EmailMessage.thread_id == thread_id).order_by(desc(EmailMessage.received_at)).first()
        if not latest_msg:
            raise HTTPException(status_code=404, detail="No messages in thread found")
            
        # Get headers directly from Gmail thread to make sure we reply correctly
        thread_details = service.users().threads().get(userId="me", id=thread_id).execute()
        gmail_messages = thread_details.get("messages", [])
        
        orig_msg_id_header = ""
        orig_sender = latest_msg.sender
        orig_subject = latest_msg.subject
        
        # Find trigger message header in gmail
        for msg in gmail_messages:
            if msg["id"] == latest_msg.message_id:
                headers = msg.get("payload", {}).get("headers", [])
                orig_msg_id_header = extract_header(headers, "message-id")
                orig_sender = extract_header(headers, "from")
                orig_subject = extract_header(headers, "subject")
                break
                
        # Send reply
        send_email_reply(
            service=service,
            user_email=oauth_account.email,
            thread_id=thread_id,
            original_message_id_header=orig_msg_id_header,
            to_email=orig_sender,
            subject=orig_subject,
            reply_body=payload.reply_body
        )
        
        # 2. Cancel any pending scheduled replies on this thread
        pending_replies = db.query(ScheduledReply).filter(
            ScheduledReply.thread_id == thread_id,
            ScheduledReply.status == "pending"
        ).all()
        
        for reply in pending_replies:
            reply.status = "cancelled"
            reply.cancelled_at = datetime.utcnow()
            
        # 3. Create a logged ScheduledReply row for the sent message
        sent_reply = ScheduledReply(
            user_id=current_user.id,
            thread_id=thread_id,
            message_id=latest_msg.message_id,
            reply_body=payload.reply_body,
            scheduled_at=datetime.utcnow(),
            sent_at=datetime.utcnow(),
            status="sent"
        )
        db.add(sent_reply)
        
        # 4. Update thread status
        thread.status = "replied"
        
        # Audit Log
        audit = AuditLog(
            user_id=current_user.id,
            thread_id=thread_id,
            message_id=latest_msg.message_id,
            event_type="sent",
            description=f"Manual email response sent to {orig_sender} directly from dashboard."
        )
        db.add(audit)
        
        db.commit()
        return {"status": "success", "message": "Manual reply successfully sent"}
        
    except Exception as e:
        print(f"Error sending manual reply: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/threads/{thread_id}/regenerate-reply")
async def regenerate_reply_draft(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerates the AI email draft using the user's latest settings.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.thread_id == thread_id,
        EmailThread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
        
    # Get latest message
    latest_msg = db.query(EmailMessage).filter(EmailMessage.thread_id == thread_id).order_by(desc(EmailMessage.received_at)).first()
    if not latest_msg:
        raise HTTPException(status_code=400, detail="Thread is empty")
        
    user_settings = current_user.settings
    if not user_settings:
        user_settings = Settings(user_id=current_user.id)
        db.add(user_settings)
        db.commit()
        db.refresh(user_settings)
        
    # Fetch thread history
    thread_history_str = ""
    thread_messages = db.query(EmailMessage).filter(
        EmailMessage.thread_id == thread_id,
        EmailMessage.message_id != latest_msg.message_id
    ).order_by(EmailMessage.received_at.asc()).all()
    
    if thread_messages:
        thread_history_str = "\n".join([f"From {m.sender}: {m.body_text[:200]}" for m in thread_messages])
        
    # Generate new response body
    new_reply = await generate_acknowledgement_reply(
        sender=latest_msg.sender,
        subject=latest_msg.subject,
        email_body=latest_msg.body_text,
        tone=user_settings.ai_tone,
        max_length=user_settings.max_reply_length,
        signature=user_settings.signature,
        custom_instructions=user_settings.custom_instructions,
        thread_history=thread_history_str
    )
    
    # If scheduled reply exists, update it, else create new pending row
    db_scheduled = db.query(ScheduledReply).filter(
        ScheduledReply.thread_id == thread_id,
        ScheduledReply.status == "pending"
    ).first()
    
    if db_scheduled:
        db_scheduled.reply_body = new_reply
    else:
        db_scheduled = ScheduledReply(
            user_id=current_user.id,
            thread_id=thread_id,
            message_id=latest_msg.message_id,
            reply_body=new_reply,
            scheduled_at=datetime.utcnow() + timedelta(minutes=user_settings.delay_minutes),
            status="pending"
        )
        db.add(db_scheduled)
        
    # Log Audit
    audit = AuditLog(
        user_id=current_user.id,
        thread_id=thread_id,
        message_id=latest_msg.message_id,
        event_type="regenerated",
        description="Regenerated draft response using modified settings."
    )
    db.add(audit)
    db.commit()
    
    return {
        "reply_body": new_reply,
        "scheduled_at": db_scheduled.scheduled_at.isoformat() + "Z" if db_scheduled.scheduled_at else None,
        "status": db_scheduled.status
    }


@router.post("/threads/{thread_id}/cancel-reply")
def cancel_reply(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancels a pending auto-reply.
    """
    reply = db.query(ScheduledReply).filter(
        ScheduledReply.thread_id == thread_id,
        ScheduledReply.status == "pending",
        ScheduledReply.user_id == current_user.id
    ).first()
    
    if not reply:
        raise HTTPException(status_code=404, detail="No pending auto-reply found for this thread.")
        
    reply.status = "cancelled"
    reply.cancelled_at = datetime.utcnow()
    
    thread = db.query(EmailThread).filter(EmailThread.thread_id == thread_id).first()
    if thread:
        thread.status = "ignored" # Change to ignored so we don't alert the user
        
    audit = AuditLog(
        user_id=current_user.id,
        thread_id=thread_id,
        message_id=reply.message_id,
        event_type="cancelled",
        description="Pending automatic acknowledgement cancelled manually by user."
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "message": "Scheduled auto-reply successfully cancelled"}


@router.put("/threads/{thread_id}/status")
def update_thread_status(
    thread_id: str,
    payload: StatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the status badge (e.g. manual override to needs_review, replied, etc.)
    """
    thread = db.query(EmailThread).filter(
        EmailThread.thread_id == thread_id,
        EmailThread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
        
    old_status = thread.status
    thread.status = payload.status
    
    audit = AuditLog(
        user_id=current_user.id,
        thread_id=thread_id,
        event_type="status_change",
        description=f"Thread status changed manually from '{old_status}' to '{payload.status}'"
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "new_status": thread.status}


@router.post("/reset")
def reset_emails(
    active_email: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clears cached email data and logs for the current user's specific email to trigger a clean sync.
    """
    reply_query = db.query(ScheduledReply).filter(ScheduledReply.user_id == current_user.id)
    audit_query = db.query(AuditLog).filter(AuditLog.user_id == current_user.id)
    thread_query = db.query(EmailThread).filter(EmailThread.user_id == current_user.id)
    
    if active_email:
        reply_query = reply_query.filter(ScheduledReply.gmail_email == active_email)
        audit_query = audit_query.filter(AuditLog.gmail_email == active_email)
        thread_query = thread_query.filter(EmailThread.gmail_email == active_email)
        
    reply_query.delete(synchronize_session=False)
    audit_query.delete(synchronize_session=False)
    
    threads = thread_query.all()
    thread_ids = [t.thread_id for t in threads]
    if thread_ids:
        db.query(EmailMessage).filter(EmailMessage.thread_id.in_(thread_ids)).delete(synchronize_session=False)
        
    thread_query.delete(synchronize_session=False)
    db.commit()
    
    return {"status": "success", "message": "Email cache cleared. Fresh sync triggered."}

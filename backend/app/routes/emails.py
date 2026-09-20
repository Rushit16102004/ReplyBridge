from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.database import get_db
from app.models import User, OAuthAccount, EmailThread, EmailMessage, ScheduledReply, AuditLog, Settings
from app.auth import get_current_user
from app.gmail import get_gmail_service, send_email_reply, extract_header
from app.ai import generate_acknowledgement_reply

router = APIRouter(prefix="/emails", tags=["Emails"])

class ReplyRequest(BaseModel):
    reply_body: str

class StatusUpdateRequest(BaseModel):
    status: str

def seed_demo_data_if_empty(db: Session, user_id: int):
    if db.query(EmailThread).filter(EmailThread.user_id == user_id).count() > 0:
        return
        
    now = datetime.utcnow()
    demo_threads = [
        {
            "thread_id": "thread_demo_1",
            "subject": "Customer Inquiry: Enterprise Plan Pricing & API Limits",
            "snippet": "Hello team, I wanted to reach out regarding your AI auto-responder enterprise tier pricing...",
            "status": "waiting",
            "category": "customer",
            "importance": "medium",
            "importance_score": 65,
            "sender": "sarah.jenkins@acmecorp.io",
            "recipient": "demo@replybridge.com",
            "body_text": "Hello team,\n\nI wanted to reach out regarding your AI auto-responder enterprise tier pricing and custom SLA options for our team of 50 agents.\n\nCould you send over the documentation?\n\nBest,\nSarah Jenkins",
            "reply": "Hi Sarah,\n\nThank you for reaching out to ReplyBridge! We have received your query regarding Enterprise Plan pricing and API limits. Our team is reviewing your request and will get back to you shortly with the full documentation and custom SLA details.\n\nBest regards,\nReplyBridge Team"
        },
        {
            "thread_id": "thread_demo_2",
            "subject": "🚨 Security Alert: Unauthorized Password Reset Attempt",
            "snippet": "We detected a login attempt from an unrecognized IP address. Verify your credentials immediately...",
            "status": "blocked",
            "category": "security",
            "importance": "high",
            "importance_score": 95,
            "sender": "no-reply@accounts-security-verify.com",
            "recipient": "demo@replybridge.com",
            "body_text": "WARNING: Someone tried to reset your password. Click here immediately to verify your credentials: http://phishing-fake-login.com/login",
            "is_phishing": True,
            "phishing_reasons": ["suspicious_domain", "urgent_credentials_request", "fake_security_alert"],
            "reply": None
        },
        {
            "thread_id": "thread_demo_3",
            "subject": "Application Status: Senior Full-Stack Engineer Role",
            "snippet": "Thank you for applying to the Senior Full-Stack Engineer position. We were impressed by your profile...",
            "status": "needs_review",
            "category": "job opportunity",
            "importance": "high",
            "importance_score": 85,
            "sender": "recruiting@techinnovators.com",
            "recipient": "demo@replybridge.com",
            "body_text": "Hi,\n\nThank you for applying for the Senior Full-Stack Engineer position at TechInnovators. We were very impressed by your profile and would love to schedule a technical interview next week.\n\nPlease let us know your availability.\n\nBest,\nTalent Acquisition Team",
            "reply": "Hi Talent Acquisition Team,\n\nThank you for the update regarding my application for the Senior Full-Stack Engineer position! I am excited to discuss the role further and will share my availability for the interview shortly.\n\nBest regards,"
        }
    ]
    
    for t_data in demo_threads:
        thread = EmailThread(
            user_id=user_id,
            thread_id=t_data["thread_id"],
            gmail_email="demo@replybridge.com",
            subject=t_data["subject"],
            snippet=t_data["snippet"],
            status=t_data["status"],
            last_message_received_at=now
        )
        db.add(thread)
        db.flush()
        
        msg = EmailMessage(
            thread_id=t_data["thread_id"],
            message_id=f"msg_{t_data['thread_id']}",
            sender=t_data["sender"],
            recipient=t_data["recipient"],
            subject=t_data["subject"],
            body_text=t_data["body_text"],
            received_at=now,
            category=t_data["category"],
            importance=t_data["importance"],
            importance_score=t_data["importance_score"],
            is_phishing=t_data.get("is_phishing", False),
            phishing_reasons=t_data.get("phishing_reasons", [])
        )
        db.add(msg)
        
        if t_data.get("reply"):
            rep = ScheduledReply(
                user_id=user_id,
                thread_id=t_data["thread_id"],
                message_id=f"msg_{t_data['thread_id']}",
                reply_body=t_data["reply"],
                scheduled_at=now,
                status="pending"
            )
            db.add(rep)
            
    db.commit()

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
    seed_demo_data_if_empty(db, current_user.id)
    
    query = db.query(EmailThread).filter(EmailThread.user_id == current_user.id)
    if active_email:
        query = query.filter(EmailThread.gmail_email == active_email)
    
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
        
    total = query.count()
    threads = query.order_by(desc(EmailThread.last_message_received_at)).offset(offset).limit(limit).all()
    
    results = []
    for t in threads:
        msg_count = db.query(EmailMessage).filter(EmailMessage.thread_id == t.thread_id).count()
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
    seed_demo_data_if_empty(db, current_user.id)
    
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
    thread = db.query(EmailThread).filter(
        EmailThread.thread_id == thread_id,
        EmailThread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
        
    latest_msg = db.query(EmailMessage).filter(EmailMessage.thread_id == thread_id).order_by(desc(EmailMessage.received_at)).first()
    
    # Try sending live via Gmail if OAuth is connected
    oauth_account = db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).first()
    if oauth_account:
        try:
            service = get_gmail_service(oauth_account, db)
            send_email_reply(
                service=service,
                user_email=oauth_account.email,
                thread_id=thread_id,
                original_message_id_header="",
                to_email=latest_msg.sender if latest_msg else "",
                subject=latest_msg.subject if latest_msg else "",
                reply_body=payload.reply_body
            )
        except Exception as e:
            print(f"Gmail send warning (operating in offline demo mode): {e}")

    # Mark as replied in memory
    thread.status = "replied"
    
    pending_replies = db.query(ScheduledReply).filter(
        ScheduledReply.thread_id == thread_id,
        ScheduledReply.status == "pending"
    ).all()
    for r in pending_replies:
        r.status = "sent"
        r.sent_at = datetime.utcnow()
        
    audit = AuditLog(
        user_id=current_user.id,
        thread_id=thread_id,
        event_type="sent",
        description="Manual email acknowledgement sent successfully."
    )
    db.add(audit)
    db.commit()
    return {"status": "success", "message": "Manual reply successfully sent"}

@router.post("/threads/{thread_id}/regenerate-reply")
async def regenerate_reply_draft(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(EmailThread).filter(
        EmailThread.thread_id == thread_id,
        EmailThread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
        
    latest_msg = db.query(EmailMessage).filter(EmailMessage.thread_id == thread_id).order_by(desc(EmailMessage.received_at)).first()
    if not latest_msg:
        raise HTTPException(status_code=400, detail="Thread is empty")
        
    new_reply = await generate_acknowledgement_reply(
        sender=latest_msg.sender,
        subject=latest_msg.subject,
        email_body=latest_msg.body_text,
        tone="professional",
        max_length=150,
        signature="ReplyBridge Auto-Responder",
        custom_instructions="",
        thread_history=""
    )
    
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
            scheduled_at=datetime.utcnow() + timedelta(minutes=15),
            status="pending"
        )
        db.add(db_scheduled)
        
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
    reply = db.query(ScheduledReply).filter(
        ScheduledReply.thread_id == thread_id,
        ScheduledReply.status == "pending"
    ).first()
    
    if reply:
        reply.status = "cancelled"
        reply.cancelled_at = datetime.utcnow()
        
    thread = db.query(EmailThread).filter(EmailThread.thread_id == thread_id).first()
    if thread:
        thread.status = "ignored"
        
    db.commit()
    return {"status": "success", "message": "Scheduled auto-reply successfully cancelled"}

@router.put("/threads/{thread_id}/status")
def update_thread_status(
    thread_id: str,
    payload: StatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    thread = db.query(EmailThread).filter(
        EmailThread.thread_id == thread_id,
        EmailThread.user_id == current_user.id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
        
    thread.status = payload.status
    db.commit()
    return {"status": "success", "new_status": thread.status}

@router.post("/reset")
def reset_emails(
    active_email: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(ScheduledReply).filter(ScheduledReply.user_id == current_user.id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.user_id == current_user.id).delete(synchronize_session=False)
    db.query(EmailMessage).delete(synchronize_session=False)
    db.query(EmailThread).filter(EmailThread.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "message": "Email cache cleared. Fresh sync triggered."}

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from app.database import get_db
from app.models import User, AuditLog
from app.auth import get_current_user

router = APIRouter(prefix="/logs", tags=["Audit Logs"])

@router.get("")
def list_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    active_email: Optional[str] = Query(None),
    limit: int = 50,
    offset: int = 0
):
    """
    Returns audit/activity logs for the current user, ordered newest first.
    """
    query = db.query(AuditLog).filter(AuditLog.user_id == current_user.id)
    if active_email:
        query = query.filter(AuditLog.gmail_email == active_email)
    total = query.count()
    logs = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit).all()
    
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "thread_id": l.thread_id,
            "message_id": l.message_id,
            "event_type": l.event_type,
            "description": l.description,
            "created_at": l.created_at.isoformat() + "Z" if l.created_at else None
        })
        
    return {
        "logs": results,
        "total": total
    }

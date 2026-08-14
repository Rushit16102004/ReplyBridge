from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.config import settings
from app.database import get_db
from app.models import User, OAuthAccount, Settings, EmailThread, EmailMessage, ScheduledReply, AuditLog
from app.auth import get_google_auth_url, exchange_google_code, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/google/login")
def google_login():
    """
    Redirects the user to the Google OAuth Consent screen.
    """
    try:
        auth_url = get_google_auth_url()
        return RedirectResponse(url=auth_url)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/google/callback")
async def google_callback(code: str, response: Response, db: Session = Depends(get_db)):
    """
    OAuth Callback URL. Exchanges the auth code for tokens, logs the user in,
    saves tokens, initializes settings, and sets a secure JWT cookie.
    """
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code from Google.")

    try:
        result = await exchange_google_code(code)
        user_info = result["user_info"]
        tokens = result["tokens"]
        
        email = user_info.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google account has no associated email address.")
            
        # 1. Find or create user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email, is_active=True)
            db.add(user)
            db.commit()
            db.refresh(user)
            
        # 2. Find or create OAuth Account
        oauth_account = db.query(OAuthAccount).filter(
            OAuthAccount.user_id == user.id,
            OAuthAccount.provider == "google"
        ).first()
        
        token_expiry = None
        if "expires_in" in tokens:
            token_expiry = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
            
        if not oauth_account:
            oauth_account = OAuthAccount(
                user_id=user.id,
                provider="google",
                email=email,
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                token_expiry=token_expiry,
                scopes=tokens.get("scope")
            )
            db.add(oauth_account)
        else:
            oauth_account.access_token = tokens["access_token"]
            if tokens.get("refresh_token"):
                oauth_account.refresh_token = tokens["refresh_token"]
            oauth_account.token_expiry = token_expiry
            oauth_account.scopes = tokens.get("scope")
            db.add(oauth_account)
            
        # 3. Create settings if they do not exist
        user_settings = db.query(Settings).filter(Settings.user_id == user.id).first()
        if not user_settings:
            user_settings = Settings(user_id=user.id)
            db.add(user_settings)
            
        # 4. Save login audit log
        audit = AuditLog(
            user_id=user.id,
            event_type="login",
            description=f"User logged in via Google OAuth. Gmail account connected: {email}"
        )
        db.add(audit)
        
        db.commit()
        
        # 5. Generate application JWT session token
        jwt_token = create_access_token(data={"sub": user.email})
        
        # 6. Set HTTP-only Cookie
        response = RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard")
        response.set_cookie(
            key="session_token",
            value=jwt_token,
            httponly=True,
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite="lax",
            secure=False
        )
        return response
        
    except Exception as e:
        print(f"Error in OAuth callback: {e}")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/?error=auth_failed")


@router.post("/mock-login")
def mock_login(response: Response, db: Session = Depends(get_db)):
    """
    Developer sandbox login. Generates a demo session with pre-populated,
    realistic email threads showcasing the AI classification and safety states.
    """
    demo_email = "demo@replybridge.com"
    
    # 1. Create or find User
    user = db.query(User).filter(User.email == demo_email).first()
    if not user:
        user = User(email=demo_email, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # 2. Setup Settings
    user_settings = db.query(Settings).filter(Settings.user_id == user.id).first()
    if not user_settings:
        user_settings = Settings(
            user_id=user.id,
            signature="Demo User | ReplyBridge Support",
            custom_instructions="Politely handle general product inquiries."
        )
        db.add(user_settings)
        
    # 3. Setup Mock OAuth Account
    oauth_account = db.query(OAuthAccount).filter(OAuthAccount.user_id == user.id).first()
    if not oauth_account:
        oauth_account = OAuthAccount(
            user_id=user.id,
            provider="google",
            email=demo_email,
            access_token="mock_access_token_123456",
            refresh_token="mock_refresh_token_123456",
            token_expiry=datetime.utcnow() + timedelta(days=365),
            scopes="openid email https://www.googleapis.com/auth/gmail.modify"
        )
        db.add(oauth_account)
    # 4. Clear old emails to avoid duplicates on multiple mock logins
    mock_ids = ["thread_mock_01", "thread_mock_02", "thread_mock_03", "thread_mock_04"]
    db.query(EmailMessage).filter(EmailMessage.thread_id.in_(mock_ids)).delete(synchronize_session=False)
    db.query(EmailThread).filter(EmailThread.thread_id.in_(mock_ids)).delete(synchronize_session=False)
    db.query(ScheduledReply).filter(ScheduledReply.thread_id.in_(mock_ids)).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.thread_id.in_(mock_ids)).delete(synchronize_session=False)
    db.commit()

    # 5. Populate Sample Thread 1: Urgent Order Status (Auto-reply Candidate)
    t1 = EmailThread(
        user_id=user.id,
        thread_id="thread_mock_01",
        subject="Urgent Order Status Inquiry",
        snippet="Hi, I wanted to know the status of my order #10243. We need it by Monday...",
        last_message_received_at=datetime.utcnow() - timedelta(minutes=20),
        status="waiting"
    )
    db.add(t1)
    db.commit()
    
    m1 = EmailMessage(
        thread_id="thread_mock_01",
        message_id="msg_mock_01",
        sender="Sarah Jenkins <sarah.jenkins@enterprise.com>",
        recipient=demo_email,
        subject="Urgent Order Status Inquiry",
        body_text="Hi, I wanted to know the status of my order #10243. We need it by Monday. Can you confirm if it has shipped? Thanks!",
        received_at=datetime.utcnow() - timedelta(minutes=20),
        importance="high",
        importance_score=92,
        category="customer",
        sentiment="neutral",
        urgency="high",
        sensitive=False,
        sensitive_types=["none"],
        requires_human=False,
        reason="Direct customer request regarding shipping status. Safe for auto-acknowledgement.",
        ai_confidence=0.98,
        reply_decision="reply"
    )
    db.add(m1)
    
    # Schedule an AI response draft
    reply_body = (
        "Hello Sarah,\n\n"
        "Thank you for reaching out. I have received your message regarding the order status of #10243. "
        "I am currently reviewing this details and will get back to you with a confirmation shortly.\n\n"
        "Best regards,\n"
        "Demo User"
    )
    r1 = ScheduledReply(
        user_id=user.id,
        thread_id="thread_mock_01",
        message_id="msg_mock_01",
        reply_body=reply_body,
        scheduled_at=datetime.utcnow() + timedelta(minutes=40), # 1 hour total delay, 40m left
        status="pending"
    )
    db.add(r1)
    
    # Sample Thread 2: Verification Code OTP (Blocked for Safety)
    t2 = EmailThread(
        user_id=user.id,
        thread_id="thread_mock_02",
        subject="Your Security Verification Code",
        snippet="Use security code 492043 to complete your login. This code expires in 10 minutes...",
        last_message_received_at=datetime.utcnow() - timedelta(minutes=15),
        status="blocked"
    )
    db.add(t2)
    db.commit()
    
    m2 = EmailMessage(
        thread_id="thread_mock_02",
        message_id="msg_mock_02",
        sender="Google Security Team <no-reply@accounts.google.com>",
        recipient=demo_email,
        subject="Your Security Verification Code",
        body_text="Use security code 492043 to complete your login. This code expires in 10 minutes. If you did not request this, please log in immediately to change your password.",
        received_at=datetime.utcnow() - timedelta(minutes=15),
        importance="critical",
        importance_score=99,
        category="otp",
        sentiment="neutral",
        urgency="high",
        sensitive=True,
        sensitive_types=["otp"],
        requires_human=True,
        reason="Security alert containing authentication OTP codes. Automatically blocked to ensure account safety.",
        ai_confidence=1.0,
        reply_decision="no_reply"
    )
    db.add(m2)
    
    # Sample Thread 3: Business Pitch (Human Review Required)
    t3 = EmailThread(
        user_id=user.id,
        thread_id="thread_mock_03",
        subject="Partnership Discussion for ReplyBridge",
        snippet="Hey there, I saw your product launch and would love to discuss a co-marketing campaign...",
        last_message_received_at=datetime.utcnow() - timedelta(hours=2),
        status="needs_review"
    )
    db.add(t3)
    db.commit()
    
    m3 = EmailMessage(
        thread_id="thread_mock_03",
        message_id="msg_mock_03",
        sender="Alex Rivera <alex@saasgrowth.io>",
        recipient=demo_email,
        subject="Partnership Discussion for ReplyBridge",
        body_text="Hey there, I saw your product launch and would love to discuss a co-marketing campaign. We have over 50k subscribers in the same productivity niche. Let me know if you have 15 minutes next Tuesday.",
        received_at=datetime.utcnow() - timedelta(hours=2),
        importance="medium",
        importance_score=68,
        category="business",
        sentiment="positive",
        urgency="medium",
        sensitive=False,
        sensitive_types=["none"],
        requires_human=True,
        reason="Business partnership opportunity requires custom negotiations and cannot be handled automatically.",
        ai_confidence=0.91,
        reply_decision="review"
    )
    db.add(m3)
    
    # Draft created for manual view, but status is review
    reply_body_3 = (
        "Hi Alex,\n\n"
        "Thanks for the note! I've received your partnership suggestion and am reviewing it. "
        "I'll look into our marketing roadmap and get back to you shortly.\n\n"
        "Best regards,\n"
        "Demo User"
    )
    r3 = ScheduledReply(
        user_id=user.id,
        thread_id="thread_mock_03",
        message_id="msg_mock_03",
        reply_body=reply_body_3,
        scheduled_at=datetime.utcnow() + timedelta(hours=1),
        status="pending" # Visible as pending in review state
    )
    db.add(r3)
    
    # Sample Thread 4: Low-Importance Newsletter (Ignored)
    t4 = EmailThread(
        user_id=user.id,
        thread_id="thread_mock_04",
        subject="Weekly Developer digest: Next.js 17 updates",
        snippet="Welcome to your weekly digest! This week we cover Next.js 17, Tailwind CSS styling, and...",
        last_message_received_at=datetime.utcnow() - timedelta(hours=5),
        status="ignored"
    )
    db.add(t4)
    db.commit()
    
    m4 = EmailMessage(
        thread_id="thread_mock_04",
        message_id="msg_mock_04",
        sender="Weekly Digest <newsletters@devnews.org>",
        recipient=demo_email,
        subject="Weekly Developer digest: Next.js 17 updates",
        body_text="Welcome to your weekly digest! This week we cover Next.js 17, Tailwind CSS styling, database indexing strategies, and other developer tools. If you no longer wish to receive this email, unsubscribe here.",
        received_at=datetime.utcnow() - timedelta(hours=5),
        importance="low",
        importance_score=8,
        category="newsletter",
        sentiment="neutral",
        urgency="low",
        sensitive=False,
        sensitive_types=["none"],
        requires_human=False,
        reason="Low-importance automated newsletter digest. Filtered out from replying.",
        ai_confidence=0.97,
        reply_decision="no_reply"
    )
    db.add(m4)
    
    # Audit Logs for Mock
    db.add(AuditLog(user_id=user.id, event_type="login", description="Demo account initialized."))
    db.add(AuditLog(user_id=user.id, thread_id="thread_mock_01", message_id="msg_mock_01", event_type="received", description="Received email from Sarah Jenkins <sarah.jenkins@enterprise.com>."))
    db.add(AuditLog(user_id=user.id, thread_id="thread_mock_01", message_id="msg_mock_01", event_type="analyzed", description="AI Analysis: Importance=high (92/100), Category=customer, Sensitive=False. Reply eligibility=True."))
    db.add(AuditLog(user_id=user.id, thread_id="thread_mock_01", message_id="msg_mock_01", event_type="scheduled", description="Auto reply scheduled for execution."))
    db.add(AuditLog(user_id=user.id, thread_id="thread_mock_02", message_id="msg_mock_02", event_type="received", description="Received email from Google Security Team <no-reply@accounts.google.com>."))
    db.add(AuditLog(user_id=user.id, thread_id="thread_mock_02", message_id="msg_mock_02", event_type="blocked", description="Blocked sensitive OTP email code '492043' from auto-reply."))
    
    db.commit()

    # Create session cookie
    jwt_token = create_access_token(data={"sub": user.email})
    response.set_cookie(
        key="session_token",
        value=jwt_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False
    )
    return {"status": "success", "message": "Demo session started successfully"}


@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user)):
    """
    Clears the session token cookie and logs the user out.
    """
    response = Response(status_code=status.HTTP_200_OK)
    response.delete_cookie(key="session_token")
    return {"message": "Successfully logged out"}


@router.get("/session")
def get_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Checks the active JWT session and returns basic user info and Gmail link status.
    """
    oauth_account = db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).first()
    return {
        "authenticated": True,
        "email": current_user.email,
        "user_id": current_user.id,
        "gmail_connected": oauth_account is not None,
        "gmail_email": oauth_account.email if oauth_account else None
    }

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
def google_login(state: Optional[str] = None):
    """
    Redirects the user to the Google OAuth Consent screen.
    """
    try:
        auth_url = get_google_auth_url(state=state)
        return RedirectResponse(url=auth_url)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: Optional[str] = None,
    response: Response = None,
    db: Session = Depends(get_db)
):
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
            
        # 1. Resolve user
        user = None
        is_add_account = False
        
        # If state is present, this is an existing session linking a secondary account
        if state:
            try:
                from app.auth import decode_access_token
                payload = decode_access_token(state)
                if payload and "sub" in payload:
                    existing_email = payload["sub"]
                    user = db.query(User).filter(User.email == existing_email).first()
                    if user:
                        is_add_account = True
            except Exception as state_err:
                print(f"Error resolving OAuth state session: {state_err}")
                
        if not user:
            # Standard sign-in / signup flow
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(email=email, is_active=True)
                db.add(user)
                db.commit()
                db.refresh(user)
            
        # 2. Find or create OAuth Account (scoped to both user.id and the specific email)
        oauth_account = db.query(OAuthAccount).filter(
            OAuthAccount.user_id == user.id,
            OAuthAccount.provider == "google",
            OAuthAccount.email == email
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
            gmail_email=email,
            event_type="login",
            description=f"User connected Google OAuth account: {email}"
        )
        db.add(audit)
        
        db.commit()
        
        # 5. Generate application JWT session token
        jwt_token = create_access_token(data={"sub": user.email})
        
        # 6. Set HTTP-only Cookie
        is_secure = settings.FRONTEND_URL.startswith("https")
        samesite_val = "none" if is_secure else "lax"
        
        if is_add_account:
            # Secondary account added, redirect straight back to Settings dashboard
            response = RedirectResponse(url=f"{settings.FRONTEND_URL}/settings?added=true")
        else:
            response = RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?token={jwt_token}")
            response.set_cookie(
                key="session_token",
                value=jwt_token,
                httponly=True,
                max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                samesite=samesite_val,
                secure=is_secure
            )
        return response
        
    except Exception as e:
        print(f"Error in OAuth callback: {e}")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/?error=auth_failed")


@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user)):
    """
    Clears the session token cookie and logs the user out.
    """
    is_secure = settings.FRONTEND_URL.startswith("https")
    samesite_val = "none" if is_secure else "lax"
    
    response.delete_cookie(
        key="session_token",
        samesite=samesite_val,
        secure=is_secure
    )
    return {"message": "Successfully logged out"}


@router.get("/session")
def get_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Checks the active JWT session and returns basic user info and Gmail link status.
    """
    oauth_accounts = db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).all()
    connected_emails = [acc.email for acc in oauth_accounts]
    return {
        "authenticated": True,
        "email": current_user.email,
        "user_id": current_user.id,
        "gmail_connected": len(connected_emails) > 0,
        "gmail_emails": connected_emails,
        "gmail_email": connected_emails[0] if connected_emails else None
    }

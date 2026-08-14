import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
import httpx
from fastapi import Depends, HTTPException, status, Cookie, Request
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User

# JWT Utilities
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# Dependency to get current user from token in Cookie or Authorization Header
async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    # 1. Try to get token from Cookie
    token = request.cookies.get("session_token")
    
    # 2. Try to get token from Auth Header fallback
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session or token expired",
        )
        
    user_email = payload["sub"]
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user

# Google OAuth Constants
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
OAUTH_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send"
]

def get_google_auth_url() -> str:
    """
    Constructs the Google OAuth authorization URL.
    Crucial options:
    - access_type=offline: requests a refresh token
    - prompt=consent: forces consent screen display to ensure we receive the refresh token
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID is not configured in environment variables.")
        
    scopes_str = " ".join(OAUTH_SCOPES)
    url = (
        f"{GOOGLE_AUTH_URL}?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={settings.GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope={scopes_str}&"
        f"access_type=offline&"
        f"prompt=consent"
    )
    return url

async def exchange_google_code(code: str) -> Dict:
    """
    Exchanges authorization code for access and refresh tokens,
    then fetches the user's profile info.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise ValueError("Google OAuth credentials are not fully configured.")
        
    token_data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Exchange auth code for tokens
        token_response = await client.post(GOOGLE_TOKEN_URL, data=token_data)
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to exchange Google authorization code: {token_response.text}"
            )
            
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        # 2. Retrieve user profile
        headers = {"Authorization": f"Bearer {access_token}"}
        userinfo_response = await client.get(GOOGLE_USERINFO_URL, headers=headers)
        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch Google user info: {userinfo_response.text}"
            )
            
        user_info = userinfo_response.json()
        
        return {
            "user_info": user_info,
            "tokens": tokens
        }

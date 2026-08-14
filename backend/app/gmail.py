import base64
from datetime import datetime, timedelta
import email
import email.utils
from email.mime.text import MIMEText
from typing import Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.config import settings
from app.models import OAuthAccount

def refresh_oauth_token(oauth_account: OAuthAccount, db: Session) -> str:
    """
    Manually refreshes the Google OAuth token if it is expired or expiring soon.
    Saves the refreshed token details back to the database.
    """
    # If the token is still valid for the next 2 minutes, return it
    if oauth_account.token_expiry and oauth_account.token_expiry > datetime.utcnow() + timedelta(minutes=2):
        return oauth_account.access_token

    if not oauth_account.refresh_token:
        raise ValueError("No refresh token available. User must re-authenticate with Google.")

    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": oauth_account.refresh_token,
        "grant_type": "refresh_token",
    }

    response = httpx.post(token_url, data=token_data)
    if response.status_code != 200:
        raise Exception(f"Failed to refresh Google OAuth token: {response.text}")

    tokens = response.json()
    new_access_token = tokens["access_token"]
    expires_in = tokens.get("expires_in", 3600)

    # Update database
    oauth_account.access_token = new_access_token
    oauth_account.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
    
    # Google sometimes returns a new refresh token, update if present
    if "refresh_token" in tokens:
        oauth_account.refresh_token = tokens["refresh_token"]

    db.add(oauth_account)
    db.commit()
    db.refresh(oauth_account)
    
    return new_access_token


def get_gmail_service(oauth_account: OAuthAccount, db: Session):
    """
    Creates and returns a Gmail API client service after ensuring the token is refreshed.
    """
    access_token = refresh_oauth_token(oauth_account, db)
    
    creds = Credentials(
        token=access_token,
        refresh_token=oauth_account.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=oauth_account.scopes.split(" ") if oauth_account.scopes else []
    )
    
    return build("gmail", "v1", credentials=creds)


def parse_gmail_message_payload(payload: dict) -> Tuple[str, str]:
    """
    Recursively extracts plain text and HTML bodies from a Gmail message payload.
    """
    body_text = ""
    body_html = ""
    
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")
    
    if body_data:
        decoded_bytes = base64.urlsafe_b64decode(body_data.encode("ASCII"))
        decoded_text = decoded_bytes.decode("utf-8", errors="replace")
        if mime_type == "text/plain":
            body_text = decoded_text
        elif mime_type == "text/html":
            body_html = decoded_text
            
    if "parts" in payload:
        for part in payload["parts"]:
            part_text, part_html = parse_gmail_message_payload(part)
            if part_text:
                body_text += "\n" + part_text
            if part_html:
                body_html += "\n" + part_html
                
    return body_text.strip(), body_html.strip()


def extract_header(headers: List[Dict[str, str]], name: str) -> str:
    """
    Helper to extract a header value by name (case-insensitive).
    """
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


def get_message_details(service, user_id: str, msg_id: str) -> Optional[dict]:
    """
    Retrieves full details for a message, parsing headers and extracting text.
    """
    try:
        msg = service.users().messages().get(userId=user_id, id=msg_id, format="full").execute()
        payload = msg.get("payload", {})
        headers = payload.get("headers", [])
        
        subject = extract_header(headers, "subject")
        sender = extract_header(headers, "from")
        recipient = extract_header(headers, "to")
        date_str = extract_header(headers, "date")
        message_id_header = extract_header(headers, "message-id")
        references_header = extract_header(headers, "references")
        in_reply_to_header = extract_header(headers, "in-reply-to")
        
        # Parse date
        received_at = datetime.utcnow()
        if date_str:
            try:
                # Use email.utils.parsedate_to_datetime to parse RFC 2822 dates properly
                parsed_date = email.utils.parsedate_to_datetime(date_str)
                # Convert to naive UTC datetime
                received_at = parsed_date.astimezone(timedelta(0)).replace(tzinfo=None)
            except Exception:
                pass
                
        body_text, body_html = parse_gmail_message_payload(payload)
        
        # If no body text but body_html exists, clean HTML to text or fallback
        if not body_text and body_html:
            # simple text extractor for display
            import re
            body_text = re.sub('<[^<]+?>', '', body_html)
            
        return {
            "message_id": msg_id,
            "thread_id": msg.get("threadId"),
            "sender": sender,
            "recipient": recipient,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "received_at": received_at,
            "message_id_header": message_id_header,
            "references_header": references_header,
            "in_reply_to_header": in_reply_to_header,
            "snippet": msg.get("snippet", "")
        }
    except Exception as e:
        print(f"Error fetching message details for {msg_id}: {e}")
        return None


def send_email_reply(
    service, 
    user_email: str,
    thread_id: str, 
    original_message_id_header: str, 
    to_email: str, 
    subject: str, 
    reply_body: str
) -> dict:
    """
    Sends a reply to a thread with correct threading headers.
    """
    # Format Subject: ensure it starts with "Re:"
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"
        
    mime_message = MIMEText(reply_body)
    mime_message["to"] = to_email
    mime_message["from"] = user_email
    mime_message["subject"] = subject
    
    # Threading Headers
    if original_message_id_header:
        mime_message["In-Reply-To"] = original_message_id_header
        mime_message["References"] = original_message_id_header
        
    raw_message = base64.urlsafe_b64encode(mime_message.as_bytes()).decode("utf-8")
    
    body = {
        "raw": raw_message,
        "threadId": thread_id
    }
    
    sent_msg = service.users().messages().send(userId="me", body=body).execute()
    return sent_msg


def setup_gmail_watch(service, topic_name: str) -> dict:
    """
    Sets up a Gmail watch webhook for push notifications.
    topic_name: Full Google Cloud Pub/Sub topic name e.g. "projects/my-project/topics/my-topic"
    """
    request_body = {
        "topicName": topic_name,
        "labelIds": ["INBOX"]
    }
    return service.users().watch(userId="me", body=request_body).execute()


def stop_gmail_watch(service) -> dict:
    """
    Stops a Gmail watch.
    """
    return service.users().stop(userId="me").execute()

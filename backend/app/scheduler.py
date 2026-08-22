import asyncio
import threading
import time
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import User, OAuthAccount, Settings, EmailThread, EmailMessage, ScheduledReply, AuditLog
from app.gmail import get_gmail_service, get_message_details, send_email_reply, extract_header
from app.ai import analyze_incoming_email, generate_acknowledgement_reply

# Thread control event
stop_event = threading.Event()

def is_within_working_hours(settings_obj: Settings, email_time: datetime) -> bool:
    """
    Checks if a given datetime is within the configured working hours.
    settings_obj.working_hours_start/end are strings in HH:MM format.
    """
    if not settings_obj.working_hours_enabled:
        return True
        
    try:
        start_time = datetime.strptime(settings_obj.working_hours_start, "%H:%M").time()
        end_time = datetime.strptime(settings_obj.working_hours_end, "%H:%M").time()
        current_time = email_time.time()
        
        if start_time <= end_time:
            return start_time <= current_time <= end_time
        else:
            # Over-night shift (e.g. 22:00 to 06:00)
            return current_time >= start_time or current_time <= end_time
    except Exception as e:
        print(f"Error checking working hours: {e}")
        return True


def sync_user_inbox(user: User, oauth_account: OAuthAccount, db: Session):
    """
    Syncs the recent Gmail messages for a single user's specific OAuth account,
    performs AI analysis, and schedules replies if eligible.
    """
    try:
        service = get_gmail_service(oauth_account, db)
    except Exception as e:
        print(f"Failed to get Gmail service for user {user.email} account {oauth_account.email}: {e}")
        return

    try:
        user_email = oauth_account.email
        
        # 1. Fetch recent messages in inbox (limit to last 15 to stay light)
        results = service.users().messages().list(userId="me", maxResults=15, q="is:inbox").execute()
        messages = results.get("messages", [])
        
        for msg in messages:
            msg_id = msg["id"]
            thread_id = msg["threadId"]
            
            # Check if this message already exists in database
            db_message = db.query(EmailMessage).filter(EmailMessage.message_id == msg_id).first()
            if db_message:
                continue # Already processed
                
            # Fetch full details of the message
            details = get_message_details(service, "me", msg_id)
            if not details:
                continue
                
            # Safety: Ensure the sender is NOT the user themselves
            sender_email = details["sender"]
            if user_email.lower() in sender_email.lower():
                # This is an email sent by the user, do not auto-reply to oneself
                continue

            # Ensure EmailThread exists in DB
            db_thread = db.query(EmailThread).filter(
                EmailThread.thread_id == thread_id,
                EmailThread.user_id == user.id
            ).first()
            if not db_thread:
                db_thread = EmailThread(
                    user_id=user.id,
                    thread_id=thread_id,
                    gmail_email=oauth_account.email,
                    subject=details["subject"],
                    snippet=details["snippet"],
                    last_message_received_at=details["received_at"],
                    status="unread"
                )
                db.add(db_thread)
                db.commit()
                db.refresh(db_thread)
            else:
                db_thread.last_message_received_at = details["received_at"]
                db_thread.snippet = details["snippet"]
                db.add(db_thread)
                db.commit()
                
            # Perform AI Analysis (Stages 1-4)
            # Fetch previous thread history if available
            thread_history_str = ""
            thread_messages = db.query(EmailMessage).filter(EmailMessage.thread_id == thread_id).order_by(EmailMessage.received_at.asc()).all()
            if thread_messages:
                thread_history_str = "\n".join([f"From {m.sender}: {m.body_text[:205]}" for m in thread_messages])
                
            print(f"Running AI analysis for message: {details['subject']} from {details['sender']}")
            
            # Introduce a 4.5s delay to remain safely below the Gemini free-tier 15 RPM limit
            import time
            time.sleep(4.5)
            
            analysis = asyncio.run(analyze_incoming_email(
                sender=details["sender"],
                recipient=details["recipient"],
                subject=details["subject"],
                body_text=details["body_text"],
                thread_history=thread_history_str
            ))
            
            # Save message in DB
            new_msg = EmailMessage(
                thread_id=thread_id,
                message_id=msg_id,
                gmail_email=oauth_account.email,
                sender=details["sender"],
                recipient=details["recipient"],
                subject=details["subject"],
                body_text=details["body_text"],
                body_html=details["body_html"],
                received_at=details["received_at"],
                importance=analysis.importance,
                importance_score=analysis.importance_score,
                category=analysis.category,
                sentiment=analysis.sentiment,
                urgency=analysis.urgency,
                sensitive=analysis.sensitive,
                sensitive_types=analysis.sensitive_types,
                requires_human=analysis.requires_human,
                is_phishing=analysis.is_phishing,
                phishing_reasons=analysis.phishing_reasons,
                reason=analysis.reason,
                ai_confidence=analysis.confidence,
                is_read=False,
                reply_decision="reply" if analysis.should_auto_reply else ("review" if analysis.requires_human or analysis.sensitive or analysis.is_phishing else "no_reply")
            )
            
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)
            
            # Create audit log for received email
            audit_recv = AuditLog(
                user_id=user.id,
                thread_id=thread_id,
                message_id=msg_id,
                gmail_email=oauth_account.email,
                event_type="received",
                description=f"Received email from {details['sender']}. Subject: '{details['subject']}'"
            )
            db.add(audit_recv)
            
            audit_ai = AuditLog(
                user_id=user.id,
                thread_id=thread_id,
                message_id=msg_id,
                gmail_email=oauth_account.email,
                event_type="analyzed",
                description=f"AI Analysis: Importance={analysis.importance} ({analysis.importance_score}/100), Category={analysis.category}, Sensitive={analysis.sensitive}"
            )
            db.add(audit_ai)
            db.commit()
            
            # Update thread status based on analysis
            if analysis.is_phishing:
                db_thread.status = "blocked"
                audit_block = AuditLog(
                    user_id=user.id,
                    thread_id=thread_id,
                    message_id=msg_id,
                    gmail_email=oauth_account.email,
                    event_type="blocked",
                    description=f"Warning: Phishing threat detected! Reasons: {', '.join(analysis.phishing_reasons)}. Auto-reply permanently blocked."
                )
                db.add(audit_block)
                db.commit()
            elif analysis.sensitive:
                db_thread.status = "blocked"
                audit_block = AuditLog(
                    user_id=user.id,
                    thread_id=thread_id,
                    message_id=msg_id,
                    gmail_email=oauth_account.email,
                    event_type="blocked",
                    description=f"Sensitive information detected. Category types: {', '.join(analysis.sensitive_types)}. Automatic reply blocked."
                )
                db.add(audit_block)
                db.commit()
            elif analysis.requires_human:
                db_thread.status = "needs_review"
                db.commit()
                
            # Schedule Auto-reply if eligible
            user_settings = user.settings
            if not user_settings:
                # Initialize settings if missing
                user_settings = Settings(user_id=user.id)
                db.add(user_settings)
                db.commit()
                db.refresh(user_settings)
                
            is_excluded_sender = any(ex.lower() in details["sender"].lower() for ex in user_settings.excluded_senders)
            is_excluded_domain = any(dom.lower() in details["sender"].lower() for dom in user_settings.excluded_domains)
            
            category_allowed = analysis.category in user_settings.reply_categories
            
            # Thread-level check: have we already sent an auto reply or pending one?
            thread_replies_count = db.query(ScheduledReply).filter(
                ScheduledReply.thread_id == thread_id,
                ScheduledReply.status.in_(["sent", "pending"])
            ).count()
            
            # Determine if we should auto-send or hold for human review
            eligible_for_auto_send = (
                analysis.should_auto_reply and
                not analysis.sensitive and
                not analysis.is_phishing and
                user_settings.auto_reply_enabled and
                category_allowed and
                not is_excluded_sender and
                not is_excluded_domain and
                not analysis.requires_human and
                thread_replies_count == 0
            )
            
            # Generate a draft reply for any non-sensitive and non-phishing email that hasn't been replied to yet
            should_generate_draft = (
                not analysis.sensitive and
                not analysis.is_phishing and
                thread_replies_count == 0
            )
            
            if should_generate_draft:
                # Calculate scheduled time based on delay
                delay = user_settings.delay_minutes
                scheduled_time = datetime.utcnow() + timedelta(minutes=delay)
                
                # Check working hours and modify instruction if outside hours
                within_hours = is_within_working_hours(user_settings, datetime.utcnow())
                custom_instructions = user_settings.custom_instructions
                
                if not within_hours:
                    custom_instructions = (
                        f"NOTE: The email arrived outside my working hours ({user_settings.working_hours_start} to {user_settings.working_hours_end}). "
                        "Politely mention that I have received it and will follow up when I return to office during working hours. "
                        f"{custom_instructions}"
                    )
                
                # Generate draft right away so user can preview it in Approval/Manual Mode
                reply_body = asyncio.run(generate_acknowledgement_reply(
                    sender=details["sender"],
                    subject=details["subject"],
                    email_body=details["body_text"],
                    reply_style=analysis.reply_style,
                    tone=user_settings.ai_tone,
                    max_length=user_settings.max_reply_length,
                    signature=user_settings.signature,
                    custom_instructions=custom_instructions,
                    thread_history=thread_history_str
                ))
                
                new_reply = ScheduledReply(
                    user_id=user.id,
                    thread_id=thread_id,
                    message_id=msg_id,
                    gmail_email=oauth_account.email,
                    reply_body=reply_body,
                    scheduled_at=scheduled_time,
                    status="pending"
                )
                
                db.add(new_reply)
                
                if eligible_for_auto_send:
                    db_thread.status = "waiting" # Waiting to be auto-sent
                    description_log = f"Auto reply scheduled for {scheduled_time.strftime('%Y-%m-%d %H:%M:%S')} UTC. Delay={delay}m."
                else:
                    db_thread.status = "needs_review" # Needs human approval
                    description_log = "Draft reply generated. Placed in 'Needs Review' status."
                    
                db.commit()
                
                audit_sched = AuditLog(
                    user_id=user.id,
                    thread_id=thread_id,
                    message_id=msg_id,
                    gmail_email=oauth_account.email,
                    event_type="scheduled",
                    description=description_log
                )
                db.add(audit_sched)
                db.commit()
                print(f"Scheduled/Draft reply for {msg_id} at {scheduled_time} (status={db_thread.status})")
            else:
                # Not replying/drafting (e.g. sensitive), update thread status
                if db_thread.status == "unread" or db_thread.status == "waiting":
                    db_thread.status = "ignored"
                    db.commit()
                    
    except Exception as e:
        print(f"Error syncing inbox for user {user.email}: {e}")


def process_scheduled_replies(db: Session):
    """
    Scans the database for scheduled replies that are ready to send,
    verifies if the human has already replied on Gmail, and sends the AI reply if not.
    """
    now = datetime.utcnow()
    pending_replies = db.query(ScheduledReply).filter(
        ScheduledReply.status == "pending",
        ScheduledReply.scheduled_at <= now
    ).all()
    
    for reply in pending_replies:
        user = db.query(User).filter(User.id == reply.user_id).first()
        oauth_account = db.query(OAuthAccount).filter(
            OAuthAccount.user_id == reply.user_id,
            OAuthAccount.email == reply.gmail_email
        ).first()
        
        if not user or not oauth_account:
            reply.status = "failed"
            reply.error_message = "User or OAuth connection missing."
            db.commit()
            continue
            
        user_settings = user.settings
        
        # Guard: Check if the thread is in "needs_review" status (needs manual human click)
        db_thread = db.query(EmailThread).filter(
            EmailThread.thread_id == reply.thread_id,
            EmailThread.user_id == user.id
        ).first()
        if db_thread and db_thread.status == "needs_review":
            continue

        # Guard: Check if the user has disabled auto replies since scheduling
        if not user_settings or not user_settings.auto_reply_enabled:
            reply.status = "cancelled"
            reply.cancelled_at = datetime.utcnow()
            
            audit = AuditLog(
                user_id=user.id,
                thread_id=reply.thread_id,
                message_id=reply.message_id,
                gmail_email=reply.gmail_email,
                event_type="cancelled",
                description="Auto-reply cancelled because auto-reply settings were disabled."
            )
            db.add(audit)
            db.commit()
            continue

        try:
            service = get_gmail_service(oauth_account, db)
            
            # Fetch user email profile
            profile = service.users().getProfile(userId="me").execute()
            user_email = profile.get("emailAddress", user.email)
            
            # 1. Fetch the thread from Gmail to inspect ALL messages
            thread_data = service.users().threads().get(userId="me", id=reply.thread_id).execute()
            messages = thread_data.get("messages", [])
            
            # 2. Check if the human has replied
            # Find the message that triggered this reply
            trigger_msg_idx = -1
            for idx, msg in enumerate(messages):
                if msg["id"] == reply.message_id:
                    trigger_msg_idx = idx
                    break
                    
            human_replied = False
            if trigger_msg_idx != -1:
                # Scan all messages in the thread received after the trigger message
                for msg in messages[trigger_msg_idx + 1:]:
                    headers = msg.get("payload", {}).get("headers", [])
                    sender = extract_header(headers, "from")
                    if user_email.lower() in sender.lower():
                        human_replied = True
                        break
            
            # 3. If human replied, CANCEL the scheduled reply
            if human_replied:
                reply.status = "cancelled"
                reply.cancelled_at = datetime.utcnow()
                
                db_thread = db.query(EmailThread).filter(EmailThread.thread_id == reply.thread_id).first()
                if db_thread:
                    db_thread.status = "replied"
                    
                audit = AuditLog(
                    user_id=user.id,
                    thread_id=reply.thread_id,
                    message_id=reply.message_id,
                    event_type="cancelled",
                    description="Auto-reply cancelled: human response detected in email thread."
                )
                db.add(audit)
                db.commit()
                print(f"Cancelled scheduled reply for thread {reply.thread_id} because human replied.")
                continue
                
            # 4. Generate final body (safety check already done at scheduling, but can do a quick check here too)
            # If reply body is empty for some reason, re-generate it
            if not reply.reply_body:
                trigger_msg = db.query(EmailMessage).filter(EmailMessage.message_id == reply.message_id).first()
                if trigger_msg:
                    reply.reply_body = asyncio.run(generate_acknowledgement_reply(
                        sender=trigger_msg.sender,
                        subject=trigger_msg.subject,
                        email_body=trigger_msg.body_text,
                        tone=user_settings.ai_tone,
                        max_length=user_settings.max_reply_length,
                        signature=user_settings.signature,
                        custom_instructions=user_settings.custom_instructions
                    ))
                    db.commit()
            
            # Fetch triggering message to extract correct Message-ID header for threading
            trigger_db_msg = db.query(EmailMessage).filter(EmailMessage.message_id == reply.message_id).first()
            orig_msg_id_header = ""
            orig_subject = "No Subject"
            orig_sender = ""
            if trigger_db_msg:
                # We need details again or we parse from Gmail
                # Find Message-ID header from Gmail thread payload
                for msg in messages:
                    if msg["id"] == reply.message_id:
                        headers = msg.get("payload", {}).get("headers", [])
                        orig_msg_id_header = extract_header(headers, "message-id")
                        orig_subject = extract_header(headers, "subject")
                        orig_sender = extract_header(headers, "from")
                        break
            
            # Send the email response
            print(f"Sending auto-reply to thread {reply.thread_id} / sender {orig_sender}")
            send_email_reply(
                service=service,
                user_email=user_email,
                thread_id=reply.thread_id,
                original_message_id_header=orig_msg_id_header,
                to_email=orig_sender or trigger_db_msg.sender,
                subject=orig_subject or trigger_db_msg.subject,
                reply_body=reply.reply_body
            )
            
            # Update status
            reply.status = "sent"
            reply.sent_at = datetime.utcnow()
            
            db_thread = db.query(EmailThread).filter(EmailThread.thread_id == reply.thread_id).first()
            if db_thread:
                db_thread.status = "replied"
                
            audit = AuditLog(
                user_id=user.id,
                thread_id=reply.thread_id,
                message_id=reply.message_id,
                gmail_email=reply.gmail_email,
                event_type="sent",
                description=f"Auto acknowledgement sent to {orig_sender or trigger_db_msg.sender}."
            )
            db.add(audit)
            db.commit()
            print(f"Successfully sent auto reply to {reply.message_id}")
            
        except Exception as e:
            reply.status = "failed"
            reply.error_message = str(e)
            
            audit = AuditLog(
                user_id=user.id,
                thread_id=reply.thread_id,
                message_id=reply.message_id,
                gmail_email=reply.gmail_email,
                event_type="failed",
                description=f"Failed to send auto-reply: {e}"
            )
            db.add(audit)
            db.commit()
            print(f"Failed to process scheduled reply {reply.id}: {e}")


# ---------------------------------------------------------
# Worker Loops & Lifespan Thread Management
# ---------------------------------------------------------

def sync_inboxes_thread_loop():
    """
    Background thread loop to run inbox synchronization for all active users.
    """
    print("Starting inbox sync worker thread...")
    while not stop_event.is_set():
        db = SessionLocal()
        try:
            users = db.query(User).filter(User.is_active == True).all()
            for user in users:
                if stop_event.is_set():
                    break
                # Sync each connected OAuth account for the user sequentially
                oauth_accounts = db.query(OAuthAccount).filter(OAuthAccount.user_id == user.id).all()
                for oauth in oauth_accounts:
                    if stop_event.is_set():
                        break
                    sync_user_inbox(user, oauth, db)
        except Exception as e:
            print(f"Error in inbox sync loop: {e}")
        finally:
            db.close()
            
        # Wait for 60 seconds or until stopped
        for _ in range(60):
            if stop_event.is_set():
                break
            time.sleep(1)


def scheduled_replies_thread_loop():
    """
    Background thread loop to process and send scheduled replies.
    """
    print("Starting scheduled replies worker thread...")
    while not stop_event.is_set():
        db = SessionLocal()
        try:
            process_scheduled_replies(db)
        except Exception as e:
            print(f"Error in scheduled replies loop: {e}")
        finally:
            db.close()
            
        # Wait for 15 seconds or until stopped
        for _ in range(15):
            if stop_event.is_set():
                break
            time.sleep(1)


def start_background_workers():
    """
    Starts daemon background threads for inbox syncing and reply processing.
    """
    stop_event.clear()
    
    sync_thread = threading.Thread(target=sync_inboxes_thread_loop, daemon=True, name="InboxSyncWorker")
    scheduler_thread = threading.Thread(target=scheduled_replies_thread_loop, daemon=True, name="ReplySchedulerWorker")
    
    sync_thread.start()
    scheduler_thread.start()
    
    return sync_thread, scheduler_thread


def stop_background_workers():
    """
    Signals background threads to stop execution.
    """
    stop_event.set()
    print("Signalled worker threads to stop.")

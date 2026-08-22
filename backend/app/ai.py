import json
import re
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.config import settings

# ---------------------------------------------------------
# Pydantic Schemas for Structured Output
# ---------------------------------------------------------

class EmailAnalysisSchema(BaseModel):
    category: str = Field(description="One of: customer, company/HR, job_opportunity, business, sales, support, personal, newsletter, marketing, notification, financial, security, otp, other")
    sensitive: bool = Field(description="True if the email contains passwords, OTPs, login verification, bank transactions, tax details, UPI requests, credit card data, legal documents, API keys, credentials, or highly confidential data.")
    sensitive_types: List[str] = Field(description="List of reasons why it is sensitive, e.g. ['otp', 'credentials', 'bank_info', 'legal', 'none']")
    importance: str = Field(description="Importance category: high, medium, low")
    importance_score: int = Field(description="Numerical importance score from 0 to 100 based on sender, context, urgency, deadlines, and relationship")
    urgency: str = Field(description="Urgency level: high, medium, low")
    sentiment: str = Field(description="Sentiment: positive, neutral, negative")
    requires_human: bool = Field(description="True if the email contains a complex query or request that absolutely demands manual human attention.")
    should_auto_reply: bool = Field(description="True if a short acknowledgement auto-reply should be sent. False if it is sensitive, spam, marketing, newsletter, or doesn't warrant an acknowledgement.")
    reply_style: str = Field(description="Style of reply: formal, informal")
    is_phishing: bool = Field(description="True if the email has signs of phishing, spoofing, fraud, or deceptive social engineering.")
    phishing_reasons: List[str] = Field(description="List of reasons for phishing suspicion, e.g. ['suspicious_sender', 'urgent_threat', 'data_request', 'none']")
    reason: str = Field(description="Brief reason explaining the classification and decision.")
    confidence: float = Field(description="Confidence rating of the model from 0.0 to 1.0")


class GeneratedReplySchema(BaseModel):
    reply_body: str = Field(description="The short email acknowledgement response.")
    is_safe: bool = Field(description="True if the reply contains NO placeholders (like [Name]), NO false claims, NO commitments/promises, and NO credentials.")
    safety_issue: Optional[str] = Field(description="Reason if the final safety check fails.")


# ---------------------------------------------------------
# Pipeline Core Implementation
# ---------------------------------------------------------

def get_gemini_client() -> Optional[genai.Client]:
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.strip() == "":
        return None
    try:
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")
        return None


def run_rule_based_mock_analysis(sender: str, subject: str, body: str) -> EmailAnalysisSchema:
    """
    Fallback rule-based analyzer when Gemini API is not configured.
    """
    subject_lower = subject.lower()
    body_lower = body.lower()
    sender_lower = sender.lower()
    
    # 1. Sensitive Detection
    sensitive = False
    sensitive_types = []
    
    otp_match = re.search(r'\b(otp|one time password|verification code|pin code|auth code|verification link|2fa|mfa)\b', body_lower)
    pwd_match = re.search(r'\b(password reset|reset your password|forgot password|confirm account|activate account)\b', body_lower)
    bank_match = re.search(r'\b(bank statement|transaction status|credit card|debit card|upi request|payment request|account number|routing number|invoice due)\b', body_lower)
    secret_match = re.search(r'\b(api key|client secret|token|password is|credentials)\b', body_lower)
    
    if otp_match:
        sensitive = True
        sensitive_types.append("otp")
    if pwd_match:
        sensitive = True
        sensitive_types.append("credentials")
    if bank_match:
        sensitive = True
        sensitive_types.append("bank_info")
    if secret_match:
        sensitive = True
        sensitive_types.append("credentials")
        
    # 2. Category & Importance
    category = "other"
    importance = "medium"
    importance_score = 50
    urgency = "medium"
    sentiment = "neutral"
    requires_human = False
    should_auto_reply = True
    reply_style = "informal"
    reason = "Regular email classified via rules."
    
    if "newsletter" in body_lower or "unsubscribe" in body_lower or "mailing list" in body_lower:
        category = "newsletter"
        importance = "low"
        importance_score = 15
        urgency = "low"
        should_auto_reply = False
        reply_style = "formal"
        reason = "Newsletter detected. Auto-replies are disabled for newsletters."
    elif "marketing" in body_lower or "promo" in body_lower or "sale is on" in body_lower:
        category = "marketing"
        importance = "low"
        importance_score = 10
        urgency = "low"
        should_auto_reply = False
        reply_style = "formal"
        reason = "Marketing email. Auto-replies are disabled."
    elif "security alert" in subject_lower or "sign-in" in body_lower:
        category = "security"
        importance = "high"
        importance_score = 85
        urgency = "high"
        should_auto_reply = False
        sensitive = True
        reply_style = "formal"
        sensitive_types.append("security")
        reason = "Security alert detected. Automatically blocked for safety."
    elif sensitive:
        category = "security"
        importance = "high"
        importance_score = 90
        urgency = "high"
        should_auto_reply = False
        reply_style = "formal"
        reason = f"Blocked sensitive information ({', '.join(sensitive_types)})."
    elif "invoice" in subject_lower or "payment" in subject_lower:
        category = "financial"
        importance = "high"
        importance_score = 80
        urgency = "high"
        should_auto_reply = False
        reply_style = "formal"
        reason = "Financial email. Auto-reply disabled to prevent transaction issues."
    elif "urgent" in subject_lower or "asap" in body_lower or "deadline" in body_lower:
        category = "customer"
        importance = "high"
        importance_score = 90
        urgency = "high"
        sentiment = "neutral"
        reply_style = "informal"
        reason = "Urgent customer enquiry. Auto-reply scheduled."
    elif "job" in subject_lower or "resume" in body_lower or "interview" in body_lower:
        category = "job_opportunity"
        importance = "high"
        importance_score = 75
        urgency = "medium"
        reply_style = "formal"
        reason = "Job opportunity email. Auto-reply scheduled."
    else:
        category = "customer"
        importance = "medium"
        importance_score = 60
        urgency = "medium"
        reply_style = "informal"
        reason = "Standard message. Auto-reply scheduled."
        
    # 3. Phishing Check Fallback
    is_phishing = False
    phishing_reasons = ["none"]
    
    if "suspend" in body_lower or "unauthorized" in body_lower or "verify account" in body_lower:
        is_phishing = True
        phishing_reasons = ["urgent_threat"]
        requires_human = True
        should_auto_reply = False
    elif "password" in body_lower and "reset" in body_lower:
        is_phishing = True
        phishing_reasons = ["data_request"]
        requires_human = True
        should_auto_reply = False
        
    return EmailAnalysisSchema(
        category=category,
        sensitive=sensitive,
        sensitive_types=sensitive_types if sensitive_types else ["none"],
        importance=importance,
        importance_score=importance_score,
        urgency=urgency,
        sentiment=sentiment,
        requires_human=requires_human or sensitive or is_phishing,
        should_auto_reply=should_auto_reply and not sensitive and not is_phishing,
        reply_style=reply_style,
        is_phishing=is_phishing,
        phishing_reasons=phishing_reasons,
        reason=reason,
        confidence=0.85
    )


def run_rule_based_mock_reply(sender: str, subject: str, tone: str, signature: str) -> str:
    """
    Fallback rule-based email reply generator.
    """
    # Try to extract sender name
    sender_name = "there"
    match = re.match(r'^([^<]+)', sender)
    if match:
        sender_name = match.group(1).strip().strip('"')
        
    sig_block = f"\n\n{signature}" if signature else ""
    
    if tone == "friendly":
        return f"Hi {sender_name},\n\nThanks for reaching out! Just wanted to let you know that I've received your email and will read through it as soon as I can. I'll get back to you shortly.\n\nHope you have a great day!{sig_block}"
    elif tone == "formal":
        return f"Dear {sender_name},\n\nThank you for your correspondence. This message is to acknowledge that I have received your email. I will review the contents and provide a response in due course.\n\nSincerely,{sig_block}"
    elif tone == "concise":
        return f"Hi,\n\nGot your email. Reviewing it now and will get back to you shortly.\n\nThanks!{sig_block}"
    else:  # professional default
        return f"Hello {sender_name},\n\nThank you for reaching out. I wanted to let you know that I have received your message regarding '{subject}' and will review it shortly. I will get back to you with a detailed response soon.\n\nBest regards,{sig_block}"


# ---------------------------------------------------------
# Public API Methods
# ---------------------------------------------------------

async def analyze_incoming_email(
    sender: str,
    recipient: str,
    subject: str,
    body_text: str,
    thread_history: str = ""
) -> EmailAnalysisSchema:
    """
    Runs Stage 1 to 4 of the AI Pipeline: Category, Sensitivity, Importance, and Auto-reply Eligibility.
    Uses Gemini API if key is available, falls back to rule-based analysis otherwise.
    """
    client = get_gemini_client()
    if not client:
        # Mock mode
        return run_rule_based_mock_analysis(sender, subject, body_text)
        
    # Build Prompt
    prompt = f"""
    You are an AI Email triage assistant. Analyze the following incoming email details and classify it:
    
    Sender: {sender}
    Recipient: {recipient}
    Subject: {subject}
    Email Body:
    ---
    {body_text}
    ---
    Previous Thread History (if any):
    ---
    {thread_history}
    ---
    
    Perform the following analysis:
    1. CATEGORY: Classify the email into one of these: customer, company/HR, job_opportunity, business, sales, support, personal, newsletter, marketing, notification, financial, security, otp, other.
    2. SENSITIVE: Scan if the email contains highly sensitive tokens, transactional requests, financial details, passwords, OTP code, security authorization, API keys, or legal disputes. Return true if yes.
    3. IMPORTANCE & SCORE: Rate importance (high, medium, low) and assign a score (0 to 100). High importance goes to direct business queries, customers, real opportunities, and actual human needs. Low importance goes to newsletters, automated notifications, or marketing spam.
    4. URGENCY: Set urgency (high, medium, low).
    5. REPLY STYLE: Classify if the email tone and style warrants a 'formal' (business, respectful, structured) or 'informal' (casual, personal, conversational, human-writing) reply.
    6. PHISHING DETECTION: Identify if the email exhibits signs of phishing, spoofing, credentials request, fake support warning, domain mismatches, or urgent account suspension alerts. Set is_phishing = true if yes, and set phishing_reasons (e.g. ['suspicious_sender', 'urgent_threat', 'data_request']). If not, set is_phishing = false, and phishing_reasons = ['none'].
    7. AUTO REPLY ELIGIBILITY: Decide should_auto_reply = true if it's safe (sensitive=false and is_phishing=false), is not newsletter/marketing/financial/security/otp, and is a message that warrants a polite human acknowledgement (e.g. customer asking a question, client checking status).
    """

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=EmailAnalysisSchema,
                temperature=0.1
            ),
        )
        data = json.loads(response.text)
        return EmailAnalysisSchema(**data)
    except Exception as e:
        print(f"Error calling Gemini API for analysis: {e}. Falling back to rules.")
        return run_rule_based_mock_analysis(sender, subject, body_text)


async def generate_acknowledgement_reply(
    sender: str,
    subject: str,
    email_body: str,
    reply_style: str = "formal",
    tone: str = "professional",
    max_length: int = 150,
    signature: str = "",
    custom_instructions: str = "",
    thread_history: str = ""
) -> str:
    """
    Runs Stage 5 & 6 of the AI pipeline: Reply generation & safety verification.
    Generates a natural, realistic human-sounding reply.
    """
    client = get_gemini_client()
    if not client:
        return run_rule_based_mock_reply(sender, subject, tone, signature)
        
    tone_instruction = {
        "professional": "professional, polite, helpful, and natural",
        "friendly": "warm, conversational, casual, and friendly",
        "formal": "highly formal, respectful, and structured",
        "concise": "extremely direct, brief, and to-the-point"
    }.get(tone, "professional and natural")

    # Combine dynamic style (formal vs. informal/human-writing) with user settings tone
    style_guidance = (
        "Write in a highly natural, warm, conversational, casual, and informal human-writing style. Avoid business jargon, and write like a real person typing a quick personal message."
        if reply_style == "informal" else
        "Write in a polite, respectful, professional, and formal business style."
    )

    prompt = f"""
    You are writing a short email acknowledgement reply on behalf of a human user.
    The goal is to write a response that sounds exactly like a REAL human wrote it. It must be highly realistic, conversational, and natural. Do NOT use templates, do not say "This is an automated response", and do not use robotic phrases.
    
    Incoming Email Details:
    Sender: {sender}
    Subject: {subject}
    Body: {email_body}
    Previous Thread History (if any): {thread_history}
    
    Rules for the Response:
    1. Tone & Style: {style_guidance} The overall tone should also align with being {tone_instruction}.
    2. Purpose: Acknowledge receipt of the email and state that you have received it and will look into it/get back soon. Do NOT answer the question fully. Do NOT make promises or schedule specific times unless required.
    3. Realism: Write naturally. Avoid stiff greetings. Keep it looking like a real human typed it.
    4. Constraints: Maximum length is {max_length} words.
    5. Signature: Add this exact signature at the end if provided: "{signature}" (if empty, do not add a signature block).
    6. Custom User Instructions: {custom_instructions}
    
    Provide the response using the following JSON schema:
    """
    
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeneratedReplySchema,
                temperature=0.7  # Slightly higher for more natural, human variation
            ),
        )
        result = json.loads(response.text)
        schema_result = GeneratedReplySchema(**result)
        
        # Stage 6: Verify and clean
        if schema_result.is_safe and schema_result.reply_body:
            reply = schema_result.reply_body
            # Run heuristic cleaning: check for brackets or placeholders
            if "[" in reply or "]" in reply or "INSERT" in reply:
                # If it leaked placeholders, fall back to a safe generation
                print("Generated reply contained placeholders, falling back to rule-based reply.")
                return run_rule_based_mock_reply(sender, subject, tone, signature)
            return reply
        else:
            print(f"Safety check failed for generated reply: {schema_result.safety_issue}. Falling back.")
            return run_rule_based_mock_reply(sender, subject, tone, signature)
            
    except Exception as e:
        print(f"Error calling Gemini API for reply: {e}. Falling back to rules.")
        return run_rule_based_mock_reply(sender, subject, tone, signature)

"""Real email delivery and notification tracking service for ANIVERA.

Handles SMTP communication with full fallback tracking, delivery logging,
audit recording, and retry capabilities. Never falsely reports delivery success
if SMTP is not configured or transmission fails.
"""
import asyncio
import smtplib
import uuid
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.logging import logger
from app.modules.notifications.models import EmailLog


@dataclass
class EmailDeliveryResult:
    """Standardized result of an email delivery attempt."""
    success: bool
    status: str  # 'SENT', 'FAILED'
    provider: str  # 'SMTP', 'CONFIG_MISSING', 'SIMULATED'
    error_message: Optional[str] = None
    log_id: Optional[str] = None


def _sync_send_smtp(
    host: str,
    port: int,
    user: Optional[str],
    password: Optional[str],
    from_addr: str,
    from_name: str,
    to_addr: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    use_tls: bool = True,
    use_ssl: bool = False,
    timeout: int = 15
) -> None:
    """Synchronous SMTP sender designed to run in asyncio threadpool executor."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_addr}>" if from_name else from_addr
    msg["To"] = to_addr

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    if use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=timeout)
    else:
        server = smtplib.SMTP(host, port, timeout=timeout)

    try:
        if use_tls and not use_ssl:
            server.starttls()
        if user and password:
            server.login(user, password)
        server.sendmail(from_addr, [to_addr], msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass


async def send_email_async(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    recipient_user_id: Optional[uuid.UUID] = None,
    db: Optional[AsyncSession] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
) -> EmailDeliveryResult:
    """Send real email via configured SMTP with database logging and error capturing."""
    if not to_email or "@" not in to_email:
        err = "Invalid or missing recipient email address"
        logger.warning("Email delivery aborted: %s", err)
        log_entry = await _record_email_log(
            db=db,
            recipient_email=to_email or "UNKNOWN",
            recipient_user_id=recipient_user_id,
            subject=subject,
            body_preview=body_text[:200],
            status="FAILED",
            provider="VALIDATION_FAILED",
            error_message=err,
            metadata_json=metadata_json,
        )
        return EmailDeliveryResult(
            success=False,
            status="FAILED",
            provider="VALIDATION_FAILED",
            error_message=err,
            log_id=str(log_entry.id) if log_entry else None,
        )

    # Check if SMTP provider is configured
    if not settings.SMTP_HOST:
        err = "SMTP provider is not configured (SMTP_HOST is not set in environment)"
        logger.warning("Email delivery failure: %s for recipient %s", err, to_email)
        log_entry = await _record_email_log(
            db=db,
            recipient_email=to_email,
            recipient_user_id=recipient_user_id,
            subject=subject,
            body_preview=body_text[:200],
            status="FAILED",
            provider="CONFIG_MISSING",
            error_message=err,
            metadata_json=metadata_json,
        )
        return EmailDeliveryResult(
            success=False,
            status="FAILED",
            provider="CONFIG_MISSING",
            error_message=err,
            log_id=str(log_entry.id) if log_entry else None,
        )

    # Attempt real SMTP transmission
    try:
        await asyncio.to_thread(
            _sync_send_smtp,
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            user=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            from_addr=settings.SMTP_FROM_EMAIL,
            from_name=settings.SMTP_FROM_NAME,
            to_addr=to_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            use_tls=settings.SMTP_TLS,
            use_ssl=settings.SMTP_SSL,
        )
        logger.info("Real email successfully transmitted to %s via %s:%s", to_email, settings.SMTP_HOST, settings.SMTP_PORT)
        log_entry = await _record_email_log(
            db=db,
            recipient_email=to_email,
            recipient_user_id=recipient_user_id,
            subject=subject,
            body_preview=body_text[:200],
            status="SENT",
            provider=f"SMTP:{settings.SMTP_HOST}",
            error_message=None,
            metadata_json=metadata_json,
        )
        return EmailDeliveryResult(
            success=True,
            status="SENT",
            provider=f"SMTP:{settings.SMTP_HOST}",
            log_id=str(log_entry.id) if log_entry else None,
        )
    except Exception as exc:
        err_msg = f"{type(exc).__name__}: {str(exc)}"
        logger.error("Failed to transmit email to %s: %s", to_email, err_msg)
        log_entry = await _record_email_log(
            db=db,
            recipient_email=to_email,
            recipient_user_id=recipient_user_id,
            subject=subject,
            body_preview=body_text[:200],
            status="FAILED",
            provider=f"SMTP:{settings.SMTP_HOST}",
            error_message=err_msg,
            metadata_json=metadata_json,
        )
        return EmailDeliveryResult(
            success=False,
            status="FAILED",
            provider=f"SMTP:{settings.SMTP_HOST}",
            error_message=err_msg,
            log_id=str(log_entry.id) if log_entry else None,
        )


async def _record_email_log(
    db: Optional[AsyncSession],
    recipient_email: str,
    recipient_user_id: Optional[uuid.UUID],
    subject: str,
    body_preview: str,
    status: str,
    provider: str,
    error_message: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
) -> Optional[EmailLog]:
    """Persist an audit log entry for the email attempt."""
    if db is None:
        return None
    try:
        log_entry = EmailLog(
            id=uuid.uuid4(),
            recipient_email=recipient_email,
            recipient_user_id=recipient_user_id,
            subject=subject,
            body_preview=body_preview,
            status=status,
            provider=provider,
            error_message=error_message,
            retry_count=0,
            metadata_json=metadata_json or {},
        )
        db.add(log_entry)
        await db.flush()
        return log_entry
    except Exception as e:
        logger.warning("Could not persist EmailLog: %s", e)
        return None


async def send_daho_activation_email(
    daho_name: str,
    to_email: str,
    username: str,
    district_names: List[str],
    temp_password: Optional[str],
    db: Optional[AsyncSession] = None,
    recipient_user_id: Optional[uuid.UUID] = None,
) -> EmailDeliveryResult:
    """Format and send official DAHO registration and district assignment email."""
    subject = "ANIVERA — District Assignment and Account Activation"
    login_url = f"{settings.FRONTEND_APP_URL}/login"
    districts_formatted = "\n".join(f"- {d}" for d in district_names) if district_names else "- General State Jurisdiction"

    body_text = f"""Dear {daho_name},

You have been officially registered on the ANIVERA livestock monitoring and vaccination management platform as a District Animal Husbandry Officer (DAHO).

Your assigned District(s):
{districts_formatted}

Your account login details:
Email: {to_email}
Username: {username}
Password: {temp_password or "[Managed via Single Sign-On / Password Reset Link]"}
Login URL: {login_url}

After logging in, you will be able to access the administrative dashboard, GIS map, District information, Taluka and Village hierarchy, vaccination monitoring, disease surveillance and other functions available within your assigned jurisdiction.

Please change your temporary password after your first login, if temporary credentials are used.

Regards,
ANIVERA Administrative Team
Government of Gujarat
"""

    districts_html = "".join(f"<li><strong>{d}</strong></li>" for d in district_names) if district_names else "<li>General State Jurisdiction</li>"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; line-height: 1.6; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px;">
        <div style="border-bottom: 2px solid #135D43; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #135D43; margin: 0;">ANIVERA — PashuRakshak Gujarat</h2>
            <p style="color: #64748B; margin: 4px 0 0; font-size: 13px;">Livestock Health, Surveillance & District Governance Platform</p>
        </div>
        <p>Dear <strong>{daho_name}</strong>,</p>
        <p>You have been officially registered on the ANIVERA livestock monitoring and vaccination management platform as a <strong>District Animal Husbandry Officer (DAHO)</strong>.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #0F172A;">Your Assigned District(s):</h4>
            <ul style="margin: 0; padding-left: 20px;">
                {districts_html}
            </ul>
        </div>

        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #166534;">Your Account Login Credentials:</h4>
            <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 4px 0;"><strong>Username:</strong> {username}</p>
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #DCFCE7; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{temp_password or "Managed via secure setup"}</code></p>
            <p style="margin: 12px 0 4px;"><a href="{login_url}" style="background-color: #135D43; color: #FFFFFF; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Log In to ANIVERA Portal</a></p>
        </div>

        <p style="font-size: 13px; color: #475569;">After logging in, you will be able to access the administrative dashboard, GIS map, District information, Taluka and Village hierarchy, vaccination monitoring, disease surveillance, and other functions available within your assigned jurisdiction.</p>
        <p style="font-size: 12px; color: #DC2626; font-weight: bold;">Please change your temporary password immediately upon your first login.</p>

        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94A3B8; margin: 0;">ANIVERA Administrative Team • Department of Animal Husbandry, Government of Gujarat</p>
    </div>
    """

    return await send_email_async(
        to_email=to_email,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        recipient_user_id=recipient_user_id,
        db=db,
        metadata_json={
            "type": "DAHO_REGISTRATION",
            "districts": district_names,
            "username": username,
        },
    )


async def send_taho_activation_email(
    taho_name: str,
    to_email: str,
    username: str,
    taluka_name: Optional[str],
    district_name: Optional[str],
    temp_password: Optional[str],
    db: Optional[AsyncSession] = None,
    recipient_user_id: Optional[uuid.UUID] = None,
) -> EmailDeliveryResult:
    """Format and send official TAHO registration and taluka assignment email."""
    subject = "ANIVERA — TAHO Account Registration"
    login_url = f"{settings.FRONTEND_APP_URL}/login"
    jurisdiction_str = f"{taluka_name} ({district_name})" if taluka_name and district_name else (taluka_name or "Pending Assignment")

    body_text = f"""Dear {taho_name},

You have been registered on the ANIVERA platform as a Taluka Animal Husbandry Officer (TAHO).

Your account information:
Email: {to_email}
Username: {username}
Password: {temp_password or "[Managed via Activation Link]"}
Login URL: {login_url}

Your jurisdiction and Taluka assignment ({jurisdiction_str}) will be visible in your dashboard once your assignment is completed.
You will be able to access information related to your assigned Taluka and the Villages under your jurisdiction.

Please change your temporary password after your first login, if temporary credentials are used.

Regards,
ANIVERA Administrative Team
Government of Gujarat
"""

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; line-height: 1.6; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px;">
        <div style="border-bottom: 2px solid #0284C7; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #0284C7; margin: 0;">ANIVERA — PashuRakshak Gujarat</h2>
            <p style="color: #64748B; margin: 4px 0 0; font-size: 13px;">Taluka Animal Husbandry Administration</p>
        </div>
        <p>Dear <strong>{taho_name}</strong>,</p>
        <p>You have been registered on the ANIVERA platform as a <strong>Taluka Animal Husbandry Officer (TAHO)</strong>.</p>
        
        <div style="background-color: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #0369A1;">Your Account Login Credentials:</h4>
            <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 4px 0;"><strong>Username:</strong> {username}</p>
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #E0F2FE; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{temp_password or "Managed securely"}</code></p>
            <p style="margin: 12px 0 4px;"><a href="{login_url}" style="background-color: #0284C7; color: #FFFFFF; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Log In to ANIVERA Portal</a></p>
        </div>

        <p style="font-size: 13px; color: #475569;">Your jurisdiction and Taluka assignment (<strong>{jurisdiction_str}</strong>) will be accessible in your dashboard. You will be able to monitor subordinate veterinary officers, field workers, vaccination progress, and village livestock statistics.</p>
        <p style="font-size: 12px; color: #DC2626; font-weight: bold;">Please change your temporary password immediately upon your first login.</p>

        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94A3B8; margin: 0;">ANIVERA Administrative Team • Department of Animal Husbandry, Government of Gujarat</p>
    </div>
    """

    return await send_email_async(
        to_email=to_email,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        recipient_user_id=recipient_user_id,
        db=db,
        metadata_json={
            "type": "TAHO_REGISTRATION",
            "taluka": taluka_name,
            "district": district_name,
            "username": username,
        },
    )


async def retry_email_delivery(
    log_id: uuid.UUID,
    db: AsyncSession
) -> EmailDeliveryResult:
    """Retry sending a previously failed email from email_logs."""
    stmt = select(EmailLog).where(EmailLog.id == log_id)
    log_entry = (await db.execute(stmt)).scalar_one_or_none()
    if not log_entry:
        return EmailDeliveryResult(
            success=False,
            status="FAILED",
            provider="NOT_FOUND",
            error_message="Email log entry not found",
        )

    log_entry.retry_count += 1
    result = await send_email_async(
        to_email=log_entry.recipient_email,
        subject=log_entry.subject,
        body_text=log_entry.body_preview or log_entry.subject,
        recipient_user_id=log_entry.recipient_user_id,
        db=None,  # We update existing log_entry directly
    )

    log_entry.status = result.status
    log_entry.provider = result.provider
    log_entry.error_message = result.error_message
    await db.commit()
    return result


async def send_vo_activation_email(
    vo_name: str,
    to_email: str,
    username: str,
    taluka_name: Optional[str],
    district_name: Optional[str],
    assigned_villages: Optional[List[str]],
    temp_password: Optional[str],
    db: Optional[AsyncSession] = None,
    recipient_user_id: Optional[uuid.UUID] = None,
) -> EmailDeliveryResult:
    """Format and send official Veterinary Officer (VO) onboarding and activation email."""
    subject = "ANIVERA — Veterinary Officer (VO) Account Onboarding"
    login_url = f"{settings.FRONTEND_APP_URL}/login"
    jurisdiction_str = f"{taluka_name} ({district_name})" if taluka_name and district_name else (taluka_name or "Pending Assignment")
    villages_str = ", ".join(assigned_villages) if assigned_villages else "All Taluka Jurisdictional Villages"

    body_text = f"""Dear Dr. {vo_name},

You have been officially registered on the ANIVERA livestock health and vaccination platform as a Veterinary Officer (VO).

Your Account Details:
Email: {to_email}
Username: {username}
Temporary Password: {temp_password or "[Managed via Single Sign-On / Reset Link]"}
Login URL: {login_url}

Assigned Taluka: {jurisdiction_str}
Assigned Villages: {villages_str}

As a Veterinary Officer, you will oversee field vaccination campaigns, review disease surveillance reports, verify clinical investigations, and manage field worker activities.

Security Notice: Please log in and change your temporary password immediately.

Regards,
ANIVERA Administrative Team
Department of Animal Husbandry, Government of Gujarat
"""

    villages_html = "".join(f"<li>{v}</li>" for v in assigned_villages) if assigned_villages else "<li>All assigned taluka villages</li>"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; line-height: 1.6; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px;">
        <div style="border-bottom: 2px solid #135D43; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #135D43; margin: 0;">ANIVERA — PashuRakshak Gujarat</h2>
            <p style="color: #64748B; margin: 4px 0 0; font-size: 13px;">Veterinary Health & Clinical Disease Surveillance Platform</p>
        </div>
        <p>Dear <strong>Dr. {vo_name}</strong>,</p>
        <p>You have been officially registered as a <strong>Veterinary Officer (VO)</strong> under <strong>{jurisdiction_str}</strong>.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #0F172A;">Your Assigned Jurisdiction:</h4>
            <p style="margin: 4px 0;"><strong>Taluka:</strong> {jurisdiction_str}</p>
            <p style="margin: 4px 0;"><strong>Assigned Villages:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
                {villages_html}
            </ul>
        </div>

        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #166534;">Your Account Login Credentials:</h4>
            <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 4px 0;"><strong>Username:</strong> {username}</p>
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #DCFCE7; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{temp_password or "Managed via secure setup"}</code></p>
            <p style="margin: 12px 0 4px;"><a href="{login_url}" style="background-color: #135D43; color: #FFFFFF; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Log In to VO Portal</a></p>
        </div>

        <p style="font-size: 13px; color: #475569;">You will be able to oversee vaccination campaigns, verify animal health events, investigate disease surveillance alerts, and monitor field worker activities.</p>
        <p style="font-size: 12px; color: #DC2626; font-weight: bold;">Please change your temporary password immediately upon your first login.</p>

        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94A3B8; margin: 0;">ANIVERA Administrative Team • Department of Animal Husbandry, Government of Gujarat</p>
    </div>
    """

    return await send_email_async(
        to_email=to_email,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        recipient_user_id=recipient_user_id,
        db=db,
        metadata_json={
            "type": "VO_REGISTRATION",
            "taluka": taluka_name,
            "district": district_name,
            "username": username,
            "assigned_villages": assigned_villages or [],
        },
    )


async def send_fw_activation_email(
    fw_name: str,
    to_email: str,
    username: str,
    taluka_name: Optional[str],
    district_name: Optional[str],
    assigned_villages: Optional[List[str]],
    temp_password: Optional[str],
    db: Optional[AsyncSession] = None,
    recipient_user_id: Optional[uuid.UUID] = None,
) -> EmailDeliveryResult:
    """Format and send official Field Worker (FW) onboarding and activation email."""
    subject = "ANIVERA — Field Worker (FW) Account Onboarding"
    login_url = f"{settings.FRONTEND_APP_URL}/login"
    jurisdiction_str = f"{taluka_name} ({district_name})" if taluka_name and district_name else (taluka_name or "Pending Assignment")
    villages_str = ", ".join(assigned_villages) if assigned_villages else "All Assigned Villages"

    body_text = f"""Dear {fw_name},

You have been officially registered on the ANIVERA platform as a Field Worker (FW).

Your Account Details:
Email: {to_email}
Username: {username}
Temporary Password: {temp_password or "[Managed via Single Sign-On / Reset Link]"}
Login URL: {login_url}

Assigned Taluka: {jurisdiction_str}
Assigned Villages: {villages_str}

As a Field Worker, you will record animal vaccinations, register farmers and animals, submit field disease reports, and sync data offline via the PWA mobile application.

Security Notice: Please log in and change your temporary password immediately.

Regards,
ANIVERA Administrative Team
Department of Animal Husbandry, Government of Gujarat
"""

    villages_html = "".join(f"<li>{v}</li>" for v in assigned_villages) if assigned_villages else "<li>All assigned villages</li>"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; line-height: 1.6; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px;">
        <div style="border-bottom: 2px solid #135D43; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #135D43; margin: 0;">ANIVERA — PashuRakshak Gujarat</h2>
            <p style="color: #64748B; margin: 4px 0 0; font-size: 13px;">Field Livestock Registration & Mobile Vaccination Platform</p>
        </div>
        <p>Dear <strong>{fw_name}</strong>,</p>
        <p>You have been officially registered as a <strong>Field Worker (FW)</strong> under <strong>{jurisdiction_str}</strong>.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #0F172A;">Your Assigned Field Villages:</h4>
            <p style="margin: 4px 0;"><strong>Taluka:</strong> {jurisdiction_str}</p>
            <ul style="margin: 0; padding-left: 20px;">
                {villages_html}
            </ul>
        </div>

        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #166534;">Your Account Login Credentials:</h4>
            <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 4px 0;"><strong>Username:</strong> {username}</p>
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #DCFCE7; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{temp_password or "Managed via secure setup"}</code></p>
            <p style="margin: 12px 0 4px;"><a href="{login_url}" style="background-color: #135D43; color: #FFFFFF; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Log In to FW Portal</a></p>
        </div>

        <p style="font-size: 13px; color: #475569;">You can use the ANIVERA mobile app offline to tag animals, record vaccination doses, register farmers, and report illness symptoms.</p>
        <p style="font-size: 12px; color: #DC2626; font-weight: bold;">Please change your temporary password immediately upon your first login.</p>

        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94A3B8; margin: 0;">ANIVERA Administrative Team • Department of Animal Husbandry, Government of Gujarat</p>
    </div>
    """

    return await send_email_async(
        to_email=to_email,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        recipient_user_id=recipient_user_id,
        db=db,
        metadata_json={
            "type": "FW_REGISTRATION",
            "taluka": taluka_name,
            "district": district_name,
            "username": username,
            "assigned_villages": assigned_villages or [],
        },
    )


async def send_cooperative_activation_email(
    coop_name: str,
    contact_name: str,
    to_email: str,
    username: str,
    district_name: str,
    taluka_name: str,
    village_name: str,
    temp_password: Optional[str],
    db: Optional[AsyncSession] = None,
    recipient_user_id: Optional[uuid.UUID] = None,
) -> EmailDeliveryResult:
    """Format and send official Dairy Cooperative registration and portal onboarding email."""
    subject = "ANIVERA — Dairy Cooperative Registration and Portal Activation"
    login_url = f"{settings.FRONTEND_APP_URL}/login"

    body_text = f"""Dear {contact_name},

Your organization "{coop_name}" has been officially registered on the ANIVERA livestock health and vaccination management platform under the Dairy Cooperative framework.

Jurisdiction and Location:
- District: {district_name}
- Taluka: {taluka_name}
- Village: {village_name}

Your portal login credentials:
Email: {to_email}
Username: {username}
Temporary Password: {temp_password or "[Managed via Single Sign-On / Password Reset Link]"}
Login URL: {login_url}

As an authorized Dairy Cooperative, you will have access to:
1. Member Farmers directory and livestock registry
2. Vaccination telemetry and coverage tracking
3. Vaccination camp proposal and coordination
4. Read-only disease surveillance monitoring in your village
5. Cooperative livestock health and coverage reports

Please change your temporary password immediately upon your first login.

Regards,
ANIVERA Administrative Team
Department of Animal Husbandry, Government of Gujarat
"""

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; line-height: 1.6; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px;">
        <div style="border-bottom: 2px solid #135D43; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #135D43; margin: 0;">ANIVERA — PashuRakshak Gujarat</h2>
            <p style="color: #64748B; margin: 4px 0 0; font-size: 13px;">Dairy Cooperative Livestock Governance & Vaccination Monitoring</p>
        </div>
        <p>Dear <strong>{contact_name}</strong>,</p>
        <p>Your cooperative organization <strong>{coop_name}</strong> has been officially registered on the ANIVERA platform under the Department of Animal Husbandry.</p>
        
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #0F172A;">Assigned Geographic Jurisdiction:</h4>
            <p style="margin: 4px 0;"><strong>District:</strong> {district_name}</p>
            <p style="margin: 4px 0;"><strong>Taluka:</strong> {taluka_name}</p>
            <p style="margin: 4px 0;"><strong>Primary Village:</strong> {village_name}</p>
        </div>

        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #166534;">Your Portal Login Credentials:</h4>
            <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 4px 0;"><strong>Username:</strong> {username}</p>
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #DCFCE7; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{temp_password or "Managed via secure setup"}</code></p>
            <p style="margin: 12px 0 4px;"><a href="{login_url}" style="background-color: #135D43; color: #FFFFFF; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Log In to Dairy Cooperative Portal</a></p>
        </div>

        <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 8px; color: #1E40AF;">Authorized Portal Capabilities:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1E3A8A;">
                <li>Live Member Farmers Directory & Livestock Registration</li>
                <li>Real-time Vaccination Coverage & Telemetry for Linked Animals</li>
                <li>Vaccination Camp Proposal & Coordination with Veterinary Officers</li>
                <li>Read-Only Village Disease Surveillance Monitoring</li>
                <li>Exportable Coverage & Member Reports (CSV, JSON, Print)</li>
            </ul>
        </div>

        <p style="font-size: 12px; color: #DC2626; font-weight: bold;">Security Notice: Please change your temporary password immediately upon your first login.</p>

        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94A3B8; margin: 0;">ANIVERA Administrative Team • Department of Animal Husbandry, Government of Gujarat</p>
    </div>
    """

    return await send_email_async(
        to_email=to_email,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        recipient_user_id=recipient_user_id,
        db=db,
        metadata_json={
            "type": "COOPERATIVE_REGISTRATION",
            "coop_name": coop_name,
            "district": district_name,
            "taluka": taluka_name,
            "village": village_name,
            "username": username,
        },
    )


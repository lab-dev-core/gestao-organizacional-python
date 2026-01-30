import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, FRONTEND_URL

logger = logging.getLogger(__name__)


async def send_password_reset_email(email: str, token: str, user_name: str) -> bool:
    """Send password reset email"""
    if not SMTP_HOST:
        logger.warning("SMTP not configured. Password reset email not sent.")
        return False

    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background-color: #f9f9f9; }}
            .button {{
                display: inline-block;
                padding: 12px 24px;
                background-color: #4F46E5;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
            }}
            .footer {{ padding: 20px; text-align: center; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Recuperação de Senha</h1>
            </div>
            <div class="content">
                <p>Olá, <strong>{user_name}</strong>!</p>
                <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
                <p>Clique no botão abaixo para criar uma nova senha:</p>
                <p style="text-align: center;">
                    <a href="{reset_link}" class="button">Redefinir Senha</a>
                </p>
                <p>Se você não solicitou a redefinição de senha, ignore este email.</p>
                <p>Este link expira em <strong>1 hora</strong>.</p>
            </div>
            <div class="footer">
                <p>Sistema de Gestão Organizacional</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Olá, {user_name}!

    Recebemos uma solicitação para redefinir a senha da sua conta.

    Clique no link abaixo para criar uma nova senha:
    {reset_link}

    Se você não solicitou a redefinição de senha, ignore este email.

    Este link expira em 1 hora.

    Sistema de Gestão Organizacional
    """

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Recuperação de Senha - Sistema de Gestão'
        msg['From'] = SMTP_FROM
        msg['To'] = email

        msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, email, msg.as_string())

        logger.info(f"Password reset email sent to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
        return False

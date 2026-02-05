"""
Servicio de Email para envío de notificaciones.
En modo desarrollo, los emails se muestran en los logs.
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Servicio para envío de emails."""
    
    def __init__(self):
        self.smtp_host = getattr(settings, 'SMTP_HOST', None)
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_user = getattr(settings, 'SMTP_USER', None)
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', None)
        self.from_email = getattr(settings, 'FROM_EMAIL', 'noreply@condominio.app')
        self.from_name = getattr(settings, 'FROM_NAME', 'Parques Santa Cruz 9')
    
    def _is_configured(self) -> bool:
        """Verifica si el SMTP está configurado."""
        return all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_password
        ])
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Envía un email.
        Si SMTP no está configurado, muestra el contenido en los logs.
        """
        if not self._is_configured():
            # Modo desarrollo: mostrar en logs
            logger.info("=" * 60)
            logger.info("📧 EMAIL (Modo Desarrollo - No enviado)")
            logger.info("=" * 60)
            logger.info(f"Para: {to_email}")
            logger.info(f"Asunto: {subject}")
            logger.info("-" * 60)
            logger.info(text_content or html_content)
            logger.info("=" * 60)
            return True
        
        try:
            # Crear mensaje
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Agregar contenido
            if text_content:
                msg.attach(MIMEText(text_content, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))
            
            # Enviar
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Email enviado a {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error enviando email a {to_email}: {str(e)}")
            return False
    
    async def send_password_reset_code(
        self,
        to_email: str,
        user_name: str,
        code: str
    ) -> bool:
        """Envía el código de recuperación de contraseña."""
        
        subject = f"🔐 Código de recuperación: {code}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                .code {{ font-size: 32px; font-weight: bold; color: #4F46E5; text-align: center; 
                         padding: 20px; background: white; border-radius: 8px; margin: 20px 0;
                         letter-spacing: 8px; }}
                .warning {{ background: #FEF3C7; padding: 15px; border-radius: 8px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #6B7280; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏠 Parques Santa Cruz 9</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>{user_name}</strong>,</p>
                    <p>Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
                    
                    <div class="code">{code}</div>
                    
                    <p>Este código expira en <strong>15 minutos</strong>.</p>
                    
                    <div class="warning">
                        ⚠️ Si no solicitaste este cambio, ignora este mensaje. Tu contraseña permanecerá igual.
                    </div>
                </div>
                <div class="footer">
                    <p>Este es un mensaje automático, por favor no respondas.</p>
                    <p>© 2026 Parques Santa Cruz 9</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
Hola {user_name},

Recibimos una solicitud para restablecer tu contraseña.

Tu código de recuperación es: {code}

Este código expira en 15 minutos.

Si no solicitaste este cambio, ignora este mensaje.

--
Parques Santa Cruz 9
        """
        
        return await self.send_email(to_email, subject, html_content, text_content)


# Singleton
email_service = EmailService()


def get_email_service() -> EmailService:
    """Obtiene la instancia del servicio de email."""
    return email_service

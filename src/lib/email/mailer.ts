import nodemailer from 'nodemailer';

export interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
  fullName?: string;
}

export interface SendGroupInvitationEmailParams {
  to: string;
  groupName: string;
  groupEmoji?: string;
  inviterName?: string;
  inviteUrl: string;
  customMessage?: string;
}

export interface SendEmailResult {
  success: boolean;
  provider: 'smtp' | 'resend' | 'sendgrid' | 'simulation';
  messageId?: string;
  error?: string;
}

/**
 * Returns formatted HTML template for password reset email
 */
export function getPasswordResetEmailHtml(params: {
  to: string;
  resetUrl: string;
  fullName?: string;
}): { html: string; text: string } {
  const { to, resetUrl, fullName } = params;
  const name = fullName || to.split('@')[0];

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recupera tu contraseña en Pachas</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 540px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 14px; background-color: rgba(255, 255, 255, 0.2); font-size: 24px; margin-bottom: 12px; }
    .title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .text { font-size: 14px; color: #475569; margin-bottom: 24px; }
    .button-container { text-align: center; margin: 28px 0; }
    .button { display: inline-block; background-color: #059669; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25); }
    .link-box { background-color: #f1f5f9; border-radius: 10px; padding: 12px; font-size: 11px; word-break: break-all; color: #64748b; margin-top: 20px; }
    .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">💸</div>
      <h1 class="title">Pachas</h1>
    </div>
    <div class="content">
      <div class="greeting">¡Hola, ${name}! 👋</div>
      <p class="text">
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Pachas</strong> asociada a <strong>${to}</strong>.
      </p>
      <p class="text">
        Haz clic en el siguiente botón para elegir una nueva contraseña:
      </p>
      <div class="button-container">
        <a href="${resetUrl}" target="_blank" class="button">Restablecer mi Contraseña</a>
      </div>
      <p class="text" style="font-size: 12px; color: #64748b;">
        ⏳ Este enlace es válido durante <strong>1 hora</strong> y solo se puede utilizar una vez. Si no solicitaste este cambio, puedes ignorar este correo con total seguridad.
      </p>
      <div class="link-box">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <a href="${resetUrl}" style="color: #059669;">${resetUrl}</a>
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Pachas • Reparto de gastos de viaje y vacaciones entre amigos
    </div>
  </div>
</body>
</html>
  `;

  const text = `
¡Hola, ${name}!

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Pachas (${to}).

Para continuar, abre el siguiente enlace en tu navegador:
${resetUrl}

Este enlace caduca en 1 hora. Si no has solicitado restablecer tu contraseña, puedes ignorar este mensaje.

© ${new Date().getFullYear()} Pachas
  `.trim();

  return { html, text };
}

/**
 * Dispatches a password reset email using the best available configured provider:
 * 1. Resend API (if RESEND_API_KEY is defined)
 * 2. SendGrid API (if SENDGRID_API_KEY is defined)
 * 3. SMTP Transport (if SMTP_HOST is defined)
 * 4. Simulation fallback (logs to console for development/standalone)
 */
export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams
): Promise<SendEmailResult> {
  const { to, resetUrl, fullName } = params;
  const { html, text } = getPasswordResetEmailHtml({ to, resetUrl, fullName });
  const subject = '🔐 Restablece tu contraseña de Pachas';

  // 1. Check Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Pachas <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.id) {
        console.log(`[Pachas Mailer] Reset email sent via Resend to ${to} (ID: ${resData.id})`);
        return { success: true, provider: 'resend', messageId: resData.id };
      } else {
        console.error('[Pachas Mailer] Resend API error:', resData);
      }
    } catch (err: any) {
      console.error('[Pachas Mailer] Failed sending via Resend:', err);
    }
  }

  // 2. Check SendGrid API
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey) {
    try {
      const from = process.env.EMAIL_FROM || process.env.SENDGRID_FROM || 'notificaciones@pachas.local';
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        }),
      });

      if (res.ok || res.status === 202) {
        console.log(`[Pachas Mailer] Reset email sent via SendGrid to ${to}`);
        return { success: true, provider: 'sendgrid' };
      } else {
        const errText = await res.text();
        console.error('[Pachas Mailer] SendGrid API error:', errText);
      }
    } catch (err: any) {
      console.error('[Pachas Mailer] Failed sending via SendGrid:', err);
    }
  }

  // 3. Check SMTP Configuration
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
      const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user ? `"Pachas" <${user}>` : '"Pachas" <no-reply@pachas.local>');

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      console.log(`[Pachas Mailer] Reset email sent via SMTP (${smtpHost}) to ${to} (MessageId: ${info.messageId})`);
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (err: any) {
      console.error('[Pachas Mailer] Failed sending via SMTP:', err);
      return { success: false, provider: 'smtp', error: err.message };
    }
  }

  // 4. Standalone / Development Simulation fallback
  console.log('================================================================');
  console.log('[Pachas Mailer] No external email provider configured (SMTP/Resend/SendGrid).');
  console.log(`[Pachas Mailer] Password reset link for ${to}:`);
  console.log(resetUrl);
  console.log('================================================================');

  return {
    success: true,
    provider: 'simulation',
  };
}

/**
 * Returns formatted HTML template for group invitation email
 */
export function getGroupInvitationEmailHtml(params: {
  to: string;
  groupName: string;
  groupEmoji?: string;
  inviterName?: string;
  inviteUrl: string;
  customMessage?: string;
}): { html: string; text: string; subject: string } {
  const { to, groupName, groupEmoji, inviterName, inviteUrl, customMessage } = params;
  const inviter = inviterName ? inviterName.trim() : 'Un amigo';
  const emoji = groupEmoji || '✈️';
  const subject = `✈️ ${inviter} te ha invitado a "${groupName}" en Pachas`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${inviter} te ha invitado a ${groupName} en Pachas</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 540px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 14px; background-color: rgba(255, 255, 255, 0.2); font-size: 26px; margin-bottom: 12px; }
    .title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .subtitle { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 14px; }
    .text { font-size: 14px; color: #475569; margin-bottom: 20px; }
    .group-card { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #a7f3d0; border-radius: 16px; padding: 20px; text-align: center; margin: 20px 0; }
    .group-emoji { font-size: 36px; line-height: 1; margin-bottom: 8px; }
    .group-name { font-size: 18px; font-weight: 800; color: #065f46; margin: 0; }
    .custom-message-box { background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #334155; font-style: italic; margin: 20px 0; }
    .features { margin: 24px 0; padding: 0; list-style: none; }
    .features li { font-size: 13px; color: #64748b; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .button-container { text-align: center; margin: 30px 0; }
    .button { display: inline-block; background-color: #059669; color: #ffffff !important; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25); }
    .link-box { background-color: #f1f5f9; border-radius: 10px; padding: 12px; font-size: 11px; word-break: break-all; color: #64748b; margin-top: 20px; }
    .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">${emoji}</div>
      <h1 class="title">Pachas</h1>
      <p class="subtitle">Reparto de gastos y cuentas claras entre amigos</p>
    </div>
    <div class="content">
      <div class="greeting">¡Hola! 👋</div>
      <p class="text">
        <strong>${inviter}</strong> te ha invitado a unirte a su grupo en <strong>Pachas</strong> para llevar las cuentas y repartir gastos fácilmente:
      </p>

      <div class="group-card">
        <div class="group-emoji">${emoji}</div>
        <h2 class="group-name">${groupName}</h2>
      </div>

      ${
        customMessage
          ? `
      <div class="custom-message-box">
        "${customMessage}"
      </div>
      `
          : ''
      }

      <ul class="features">
        <li>✓ Registra gastos y añade recibos en cualquier moneda.</li>
        <li>✓ Simplifica deudas automáticamente al mínimo de transferencias.</li>
        <li>✓ Salda tus cuentas al instante por Bizum o transferencia.</li>
      </ul>

      <div class="button-container">
        <a href="${inviteUrl}" target="_blank" class="button">Unirme al Grupo</a>
      </div>

      <div class="link-box">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <a href="${inviteUrl}" style="color: #059669;">${inviteUrl}</a>
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Pachas • Cuentas claras, amistades largas
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
¡Hola!

${inviter} te ha invitado a unirte al grupo "${groupName}" en Pachas para compartir gastos fácilmente.
${customMessage ? `\nMensaje de ${inviter}:\n"${customMessage}"\n` : ''}
Para unirte al grupo, abre el siguiente enlace:
${inviteUrl}

En Pachas podrás registrar gastos, ver quién debe a quién y saldar cuentas fácilmente.

© ${new Date().getFullYear()} Pachas
  `.trim();

  return { html, text, subject };
}

/**
 * Dispatches a group invitation email using the configured provider:
 * 1. Resend API (if RESEND_API_KEY is defined)
 * 2. SendGrid API (if SENDGRID_API_KEY is defined)
 * 3. SMTP Transport (if SMTP_HOST is defined)
 * 4. Simulation fallback (logs to console for development/standalone)
 */
export async function sendGroupInvitationEmail(
  params: SendGroupInvitationEmailParams
): Promise<SendEmailResult> {
  const { to, groupName, groupEmoji, inviterName, inviteUrl, customMessage } = params;
  const { html, text, subject } = getGroupInvitationEmailHtml({
    to,
    groupName,
    groupEmoji,
    inviterName,
    inviteUrl,
    customMessage,
  });

  // 1. Check Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Pachas <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.id) {
        console.log(`[Pachas Mailer] Group invite email sent via Resend to ${to} (ID: ${resData.id})`);
        return { success: true, provider: 'resend', messageId: resData.id };
      } else {
        console.error('[Pachas Mailer] Resend API error:', resData);
      }
    } catch (err: any) {
      console.error('[Pachas Mailer] Failed sending group invite via Resend:', err);
    }
  }

  // 2. Check SendGrid API
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey) {
    try {
      const from = process.env.EMAIL_FROM || process.env.SENDGRID_FROM || 'notificaciones@pachas.local';
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        }),
      });

      if (res.ok || res.status === 202) {
        console.log(`[Pachas Mailer] Group invite email sent via SendGrid to ${to}`);
        return { success: true, provider: 'sendgrid' };
      } else {
        const errText = await res.text();
        console.error('[Pachas Mailer] SendGrid API error:', errText);
      }
    } catch (err: any) {
      console.error('[Pachas Mailer] Failed sending group invite via SendGrid:', err);
    }
  }

  // 3. Check SMTP Configuration
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
      const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user ? `"Pachas" <${user}>` : '"Pachas" <no-reply@pachas.local>');

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      console.log(`[Pachas Mailer] Group invite sent via SMTP (${smtpHost}) to ${to} (MessageId: ${info.messageId})`);
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (err: any) {
      console.error('[Pachas Mailer] Failed sending group invite via SMTP:', err);
      return { success: false, provider: 'smtp', error: err.message };
    }
  }

  // 4. Standalone / Development Simulation fallback
  console.log('================================================================');
  console.log('[Pachas Mailer] No external email provider configured (SMTP/Resend/SendGrid).');
  console.log(`[Pachas Mailer] Group invitation simulated for ${to}:`);
  console.log(`[Pachas Mailer] Group: "${groupName}" | Inviter: "${inviterName || 'Amigo'}"`);
  console.log(`[Pachas Mailer] Link: ${inviteUrl}`);
  console.log('================================================================');

  return {
    success: true,
    provider: 'simulation',
  };
}

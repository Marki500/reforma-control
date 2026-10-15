function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function renderProjectInvitation({ projectName, inviterEmail, inviteUrl }) {
  const safeProject = escapeHtml(projectName)
  const safeInviter = escapeHtml(inviterEmail)
  const safeUrl = escapeHtml(inviteUrl)
  return {
    subject: `Te han invitado a ${projectName} en NIVEL`,
    text: `${inviterEmail} te ha invitado a colaborar en “${projectName}” desde NIVEL. Abre la invitación: ${inviteUrl}\n\nEl enlace caduca en 7 días.`,
    html: `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f0ede5;color:#30352d;font-family:Arial,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeInviter} quiere compartir contigo la reforma ${safeProject}.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0ede5;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
      <tr><td style="padding:0 0 18px 4px;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="width:38px;height:38px;border-radius:11px;background:#252a23;color:#f7f5ef;text-align:center;font-size:19px;font-weight:800;">N</td>
          <td style="padding-left:11px;color:#252a23;font-size:18px;font-weight:800;letter-spacing:2px;">NIVEL</td>
        </tr></table>
      </td></tr>
      <tr><td style="overflow:hidden;border-radius:24px;background:#ffffff;box-shadow:0 14px 44px rgba(66,72,62,.10);">
        <div style="height:7px;background:#d86d4d;"></div>
        <div style="padding:42px 40px 44px;">
          <p style="margin:0 0 14px;color:#777568;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Reforma compartida</p>
          <h1 style="margin:0;color:#252a23;font-family:Georgia,'Times New Roman',serif;font-size:35px;font-weight:400;line-height:1.12;letter-spacing:-.7px;">Hay sitio para ti en<br><em>${safeProject}</em></h1>
          <p style="margin:24px 0 0;color:#5d6155;font-size:16px;line-height:1.65;"><strong style="color:#30352d;">${safeInviter}</strong> te ha invitado a organizar esta reforma en NIVEL: tareas, presupuestos, proveedores y documentos, todo en el mismo lugar.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:30px;"><tr><td style="border-radius:12px;background:#42483e;">
            <a href="${safeUrl}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Ver la invitación&nbsp;&nbsp;→</a>
          </td></tr></table>
          <p style="margin:26px 0 0;color:#a8a193;font-size:12px;line-height:1.6;">Este enlace caduca en 7 días. Si no esperabas esta invitación, puedes ignorar el mensaje.</p>
        </div>
      </td></tr>
      <tr><td style="padding:20px 4px 0;color:#a8a193;font-size:11px;line-height:1.5;">NIVEL · Tu reforma, clara de principio a fin.</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  }
}

export async function sendMailjetEmail({ apiKey, secretKey, fromEmail, fromName, toEmail, subject, text, html, requestId }) {
  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [{
        From: { Email: fromEmail, Name: fromName },
        To: [{ Email: toEmail }],
        Subject: subject,
        TextPart: text,
        HTMLPart: html,
        CustomID: `nivel-project-invite-${requestId}`,
      }],
    }),
    signal: AbortSignal.timeout(15000),
  })
  const payload = await response.json().catch(() => ({}))
  const status = payload?.Messages?.[0]?.Status
  if (!response.ok || status === 'error') {
    const providerMessage = payload?.Messages?.[0]?.Errors?.[0]?.ErrorMessage
    const error = new Error(providerMessage || `Mailjet respondió con HTTP ${response.status}.`)
    error.status = response.status
    throw error
  }
  return payload
}

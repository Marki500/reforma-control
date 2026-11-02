const messages = {
  invalid_credentials: 'El email o la contraseña no son correctos.',
  email_not_confirmed: 'Confirma tu correo antes de entrar. Revisa también la carpeta de spam.',
  user_already_exists: 'Ya existe una cuenta con este email. Inicia sesión o recupera tu contraseña.',
  email_exists: 'Ya existe una cuenta con este email.',
  signup_disabled: 'El registro no está disponible en este momento.',
  email_provider_disabled: 'El acceso con email no está disponible en este momento.',
  weak_password: 'La contraseña no cumple los requisitos de seguridad. Utiliza una más larga y difícil de adivinar.',
  same_password: 'Elige una contraseña diferente de la actual.',
  validation_failed: 'Revisa los datos introducidos e inténtalo de nuevo.',
  email_address_invalid: 'Introduce una dirección de email válida.',
  email_address_not_authorized: 'No se puede enviar correo a esta dirección en este momento.',
  over_email_send_rate_limit: 'Has solicitado demasiados correos. Espera unos minutos antes de volver a intentarlo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  captcha_failed: 'La verificación de seguridad ha fallado. Complétala de nuevo.',
  session_expired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  session_not_found: 'Tu sesión ya no está disponible. Vuelve a iniciar sesión.',
  refresh_token_not_found: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  otp_expired: 'El enlace ha caducado o ya se ha utilizado. Solicita uno nuevo.',
  reauthentication_needed: 'Vuelve a iniciar sesión para realizar este cambio.',
}

// Only our own validation messages may be displayed verbatim.
const localMessages = new Set([
  'Introduce tu nombre de usuario.',
  'La contraseña debe tener al menos 8 caracteres.',
  'Las contraseñas no coinciden.',
  'Completa la verificación de seguridad.',
])

export function authErrorMessage(error) {
  if (Object.hasOwn(messages, error?.code)) return messages[error.code]
  if (localMessages.has(error?.message)) return error.message
  if (error?.status === 429) return messages.over_request_rate_limit
  if (/failed to fetch|network|fetch failed|load failed/i.test(error?.message || '')) {
    return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.'
  }
  if (/invalid login credentials/i.test(error?.message || '')) return messages.invalid_credentials
  if (error?.status >= 500) return 'El servicio no está disponible en este momento. Inténtalo más tarde.'
  return 'No se pudo completar la operación. Inténtalo de nuevo; si el problema continúa, contacta con soporte.'
}

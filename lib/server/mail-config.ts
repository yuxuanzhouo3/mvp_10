import nodemailer from 'nodemailer'

export interface MailDeliveryConfig {
  host: string
  connectHost: string | null
  port: number
  secure: boolean
  requireTls: boolean
  user: string | null
  pass: string | null
  from: string
  replyTo: string
  tlsRejectUnauthorized: boolean
  tlsServerName: string | null
  connectionTimeout: number
  greetingTimeout: number
  socketTimeout: number
}

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function pickEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = trimEnvValue(process.env[key])

    if (value) {
      return value
    }
  }

  return null
}

function normalizePort(value: string | null, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeBoolean(value: string | null, fallback: boolean) {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizeTimeout(value: string | null, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : fallback
}

function createMailConfig(input: {
  host: string | null
  connectHost: string | null
  port: string | null
  secure: string | null
  requireTls: string | null
  user: string | null
  pass: string | null
  from: string | null
  replyTo: string | null
  tlsRejectUnauthorized: string | null
  tlsServerName: string | null
  connectionTimeout: string | null
  greetingTimeout: string | null
  socketTimeout: string | null
}) {
  if (!input.host || !input.from) {
    return null
  }

  const port = normalizePort(input.port, 465)
  const secure = normalizeBoolean(input.secure, port === 465)
  const requireTls = normalizeBoolean(input.requireTls, !secure)

  return {
    host: input.host,
    connectHost: input.connectHost,
    port,
    secure,
    requireTls,
    user: input.user,
    pass: input.pass,
    from: input.from,
    replyTo: input.replyTo || input.from,
    tlsRejectUnauthorized: normalizeBoolean(input.tlsRejectUnauthorized, true),
    tlsServerName: input.tlsServerName || input.host,
    connectionTimeout: normalizeTimeout(input.connectionTimeout, 10000),
    greetingTimeout: normalizeTimeout(input.greetingTimeout, 10000),
    socketTimeout: normalizeTimeout(input.socketTimeout, 20000),
  } satisfies MailDeliveryConfig
}

export function getAuthMailDeliveryConfig() {
  return createMailConfig({
    host: pickEnvValue('AUTH_EMAIL_SMTP_HOST'),
    connectHost: pickEnvValue('AUTH_EMAIL_SMTP_CONNECT_HOST'),
    port: pickEnvValue('AUTH_EMAIL_SMTP_PORT'),
    secure: pickEnvValue('AUTH_EMAIL_SMTP_SECURE'),
    requireTls: pickEnvValue('AUTH_EMAIL_SMTP_REQUIRE_TLS'),
    user: pickEnvValue('AUTH_EMAIL_SMTP_USER'),
    pass: pickEnvValue('AUTH_EMAIL_SMTP_PASS'),
    from: pickEnvValue('AUTH_EMAIL_FROM'),
    replyTo: pickEnvValue('AUTH_EMAIL_REPLY_TO'),
    tlsRejectUnauthorized: pickEnvValue('AUTH_EMAIL_SMTP_TLS_REJECT_UNAUTHORIZED'),
    tlsServerName: pickEnvValue('AUTH_EMAIL_SMTP_TLS_SERVERNAME'),
    connectionTimeout: pickEnvValue('AUTH_EMAIL_SMTP_CONNECTION_TIMEOUT'),
    greetingTimeout: pickEnvValue('AUTH_EMAIL_SMTP_GREETING_TIMEOUT'),
    socketTimeout: pickEnvValue('AUTH_EMAIL_SMTP_SOCKET_TIMEOUT'),
  })
}

export function getDefaultMailDeliveryConfig() {
  return createMailConfig({
    host: pickEnvValue('SMTP_HOST', 'AUTH_EMAIL_SMTP_HOST'),
    connectHost: pickEnvValue('SMTP_CONNECT_HOST', 'AUTH_EMAIL_SMTP_CONNECT_HOST'),
    port: pickEnvValue('SMTP_PORT', 'AUTH_EMAIL_SMTP_PORT'),
    secure: pickEnvValue('SMTP_SECURE', 'AUTH_EMAIL_SMTP_SECURE'),
    requireTls: pickEnvValue('SMTP_REQUIRE_TLS', 'AUTH_EMAIL_SMTP_REQUIRE_TLS'),
    user: pickEnvValue('SMTP_USER', 'AUTH_EMAIL_SMTP_USER'),
    pass: pickEnvValue('SMTP_PASS', 'AUTH_EMAIL_SMTP_PASS'),
    from: pickEnvValue('SMTP_FROM', 'AUTH_EMAIL_FROM'),
    replyTo: pickEnvValue('SMTP_REPLY_TO', 'AUTH_EMAIL_REPLY_TO', 'AUTH_EMAIL_FROM'),
    tlsRejectUnauthorized: pickEnvValue(
      'SMTP_TLS_REJECT_UNAUTHORIZED',
      'AUTH_EMAIL_SMTP_TLS_REJECT_UNAUTHORIZED'
    ),
    tlsServerName: pickEnvValue('SMTP_TLS_SERVERNAME', 'AUTH_EMAIL_SMTP_TLS_SERVERNAME'),
    connectionTimeout: pickEnvValue(
      'SMTP_CONNECTION_TIMEOUT',
      'AUTH_EMAIL_SMTP_CONNECTION_TIMEOUT'
    ),
    greetingTimeout: pickEnvValue(
      'SMTP_GREETING_TIMEOUT',
      'AUTH_EMAIL_SMTP_GREETING_TIMEOUT'
    ),
    socketTimeout: pickEnvValue('SMTP_SOCKET_TIMEOUT', 'AUTH_EMAIL_SMTP_SOCKET_TIMEOUT'),
  })
}

export function getDefaultSupportEmail() {
  return (
    pickEnvValue('RECRUITING_SUPPORT_EMAIL', 'SMTP_FROM', 'AUTH_EMAIL_FROM') ||
    'recruiting@example.com'
  )
}

export function createMailTransport(config: MailDeliveryConfig) {
  return nodemailer.createTransport({
    host: config.connectHost || config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    tls: {
      rejectUnauthorized: config.tlsRejectUnauthorized,
      servername: config.tlsServerName || config.host,
    },
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
  })
}

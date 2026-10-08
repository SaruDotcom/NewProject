const env = require('./env');

const parseOrigin = (str) => {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed === '*') return '*';
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch (e) {
    return trimmed.replace(/\/+$/, '');
  }
};

const allowedOrigins = env.CLIENT_URL.split(',')
  .map((origin) => parseOrigin(origin))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const normalizedOrigin = parseOrigin(origin);

    if (
      env.NODE_ENV === 'development' ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(normalizedOrigin) ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Idempotency-Key',
    'X-Wholesaler-Id',
  ],
  exposedHeaders: ['Idempotency-Key'],
  maxAge: 86400,
};

module.exports = corsOptions;

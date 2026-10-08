const winston = require('winston');
const env = require('./env');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  env.NODE_ENV === 'production'
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf((info) => {
          const { timestamp, level, message, stack, ...meta } = info;
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] [${level}]: ${stack || message}${metaStr}`;
        })
      )
);

const transports = [
  new winston.transports.Console({
    silent: env.NODE_ENV === 'test' && !process.env.DEBUG_TESTS,
  }),
];

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels,
  format,
  transports,
});

module.exports = logger;

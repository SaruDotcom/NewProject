const { AuditLog } = require('../models');
const logger = require('../config/logger');

class AuditService {
  /**
   * Create an append-only audit trail entry
   */
  static async log({
    actorId = null,
    actorRole = 'SYSTEM',
    actorEmail = '',
    action,
    entityType,
    entityId,
    before = null,
    after = null,
    metadata = {},
    req = null,
  }) {
    try {
      let ipAddress = '';
      let userAgent = '';

      if (req) {
        ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
        userAgent = req.headers['user-agent'] || '';
        if (!actorId && req.user) {
          actorId = req.user._id;
          actorRole = req.user.role;
          actorEmail = req.user.email;
        }
      }

      const logEntry = await AuditLog.create({
        actorId,
        actorRole,
        actorEmail,
        action,
        entityType,
        entityId: String(entityId),
        before,
        after,
        metadata,
        ipAddress,
        userAgent,
      });

      return logEntry;
    } catch (error) {
      logger.error(`Audit logging failed: ${error.message}`, { action, entityType, entityId });
      // Never throw an error from audit service that would break business logic
      return null;
    }
  }
}

module.exports = AuditService;

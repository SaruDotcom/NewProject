const { Notification } = require('../models');
const { NOTIFICATION_TYPE, NOTIFICATION_CHANNEL } = require('../config/constants');
const logger = require('../config/logger');

class NotificationService {
  /**
   * Send an in-app and/or channel notification to a user
   */
  static async notify({
    recipientId,
    title,
    message,
    type = NOTIFICATION_TYPE.SYSTEM_ALERT,
    channel = NOTIFICATION_CHANNEL.IN_APP,
    data = {},
  }) {
    try {
      const notification = await Notification.create({
        recipientId,
        title,
        message,
        type,
        channel,
        data,
      });

      logger.info(`Notification sent [${type}] to user ${recipientId}: ${title}`);
      return notification;
    } catch (error) {
      logger.error(`Notification failed to send: ${error.message}`);
      return null;
    }
  }

  /**
   * Broadcast notification to all Super Admins and Admins
   */
  static async notifyAdmins({ title, message, type = NOTIFICATION_TYPE.SYSTEM_ALERT, data = {} }) {
    try {
      const { User } = require('../models');
      const { ROLES } = require('../config/constants');

      const admins = await User.find({ role: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] }, isDeleted: { $ne: true } });
      let notifications = [];
      if (admins.length > 0) {
        notifications = admins.map((admin) => ({
          recipientId: admin._id,
          title,
          message,
          type,
          channel: NOTIFICATION_CHANNEL.IN_APP,
          data,
        }));
      } else {
        // Global system admin notification fallback
        notifications = [{
          recipientId: null,
          title,
          message,
          type,
          channel: NOTIFICATION_CHANNEL.IN_APP,
          data,
        }];
      }

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (error) {
      logger.error(`Admin broadcast notification failed: ${error.message}`);
    }
  }
}

module.exports = NotificationService;

const { Notification } = require('../../models');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { parsePagination } = require('../../utils/pagination');

class NotificationController {
  // Get user notifications
  listNotifications = asyncHandler(async (req, res) => {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = { recipientId: req.user._id };

    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: req.user._id, isRead: false }),
    ]);

    return ApiResponse.paginated(
      res,
      notifications,
      { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount },
      'Notifications retrieved successfully'
    );
  });

  // Mark all notifications as read
  markAllRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return ApiResponse.success(res, {}, 'All notifications marked as read');
  });

  // Mark single notification as read
  markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    return ApiResponse.success(res, notification, 'Notification marked as read');
  });
}

module.exports = new NotificationController();

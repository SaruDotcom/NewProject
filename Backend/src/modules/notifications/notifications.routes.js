const express = require('express');
const router = express.Router();
const notificationController = require('./notifications.controller');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

router.get('/', notificationController.listNotifications);
router.patch('/read', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;

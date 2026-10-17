const express = require('express');
const rateLimit = require('express-rate-limit');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { productImageUpload } = require('../../middleware/upload');
const { ROLES } = require('../../config/constants');
const SupportController = require('./support.controller');
const {
  createTicketSchema,
  replySchema,
  updateTicketSchema,
} = require('./support.validation');

const router = express.Router();
const createTicketLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.use(authenticate, authorize(ROLES.WHOLESALER, ROLES.RETAILER));
router.post('/tickets/attachments', productImageUpload.array('images', 3), SupportController.uploadAttachments);
router.post('/tickets', createTicketLimit, validate(createTicketSchema), SupportController.create);
router.get('/tickets/mine', SupportController.listMine);
router.get('/tickets/:id', SupportController.getMine);
router.patch('/tickets/:id/read', SupportController.markMineRead);
router.post('/tickets/:id/reply', validate(replySchema), SupportController.replyAsOwner);

const adminRouter = express.Router();
adminRouter.use(authenticate, authorize(ROLES.SUPER_ADMIN));
adminRouter.get('/tickets', SupportController.adminList);
adminRouter.get('/tickets/:id', SupportController.getAdminTicket);
adminRouter.patch('/tickets/:id', validate(updateTicketSchema), SupportController.updateAsAdmin);
adminRouter.post('/tickets/:id/reply', validate(replySchema), SupportController.replyAsAdmin);

module.exports = { router, adminRouter, createTicketLimit };

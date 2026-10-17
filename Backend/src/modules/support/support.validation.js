const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const ticketTypes = ['Issue', 'Request', 'Feedback', 'Payment', 'Order', 'Product', 'KYC', 'Account', 'Other'];
const priorities = ['Low', 'Medium', 'High'];
const statuses = ['Open', 'In Progress', 'Resolved', 'Closed'];

const attachment = Joi.object({
  url: Joi.string().uri().required(),
  publicId: Joi.string().allow('').default(''),
});

const createTicketSchema = Joi.object({
  type: Joi.string().valid(...ticketTypes).default('Other'),
  subject: Joi.string().trim().min(1).max(200).required(),
  message: Joi.string().trim().min(1).max(5000).required(),
  priority: Joi.string().valid(...priorities).default('Medium'),
  relatedOrderId: objectId.allow('', null).default(null),
  attachments: Joi.array().items(attachment).max(3).default([]),
  callbackPhone: Joi.string().trim().max(30).allow('').optional(),
});

const replySchema = Joi.object({
  message: Joi.string().trim().min(1).max(5000).required(),
});

const updateTicketSchema = Joi.object({
  status: Joi.string().valid(...statuses),
  priority: Joi.string().valid(...priorities),
  assignedTo: objectId.allow('', null),
}).min(1);

module.exports = {
  createTicketSchema,
  replySchema,
  updateTicketSchema,
  ticketTypes,
  priorities,
  statuses,
};

const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const addToCartSchema = Joi.object({
  productId: Joi.string().required().messages({
    'string.empty': 'Product ID is required',
    'any.required': 'Product ID is required',
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    'number.base': 'Quantity must be a valid number',
    'number.min': 'Quantity must be at least 1',
    'any.required': 'Quantity is required',
  }),
  color: Joi.string().trim().allow('', null).optional(),
}).unknown(true);

const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required().messages({
    'number.base': 'Quantity must be a valid number',
    'number.min': 'Quantity must be at least 1',
    'any.required': 'Quantity is required',
  }),
  color: Joi.string().trim().allow('', null).optional(),
}).unknown(true);

const addressObjectSchema = Joi.object({
  fullName: Joi.string().trim().optional(),
  contactName: Joi.string().trim().optional(),
  name: Joi.string().trim().optional(),
  phone: Joi.string().trim().optional(),
  addressLine1: Joi.string().trim().required().messages({
    'string.empty': 'Address Line 1 is required',
    'any.required': 'Address Line 1 is required',
  }),
  addressLine2: Joi.string().trim().allow('', null).optional(),
  city: Joi.string().trim().required().messages({
    'string.empty': 'City is required',
    'any.required': 'City is required',
  }),
  state: Joi.string().trim().required().messages({
    'string.empty': 'State is required',
    'any.required': 'State is required',
  }),
  postalCode: Joi.string().trim().required().messages({
    'string.empty': 'Postal Code is required',
    'any.required': 'Postal Code is required',
  }),
  pincode: Joi.string().trim().optional(),
  country: Joi.string().trim().default('India'),
});

const checkoutSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .optional(),
  shippingAddress: Joi.object({
    addressLine1: Joi.string().trim().required(),
    addressLine2: Joi.string().trim().allow('', null).optional(),
    city: Joi.string().trim().required(),
    state: Joi.string().trim().required(),
    postalCode: Joi.string().trim().optional(),
    pincode: Joi.string().trim().optional(),
    country: Joi.string().trim().default('India'),
    contactName: Joi.string().trim().optional(),
    phone: Joi.string().trim().optional(),
  }).required(),
  billingAddress: Joi.object({
    addressLine1: Joi.string().trim().optional(),
    addressLine2: Joi.string().trim().allow('', null).optional(),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    postalCode: Joi.string().trim().optional(),
    pincode: Joi.string().trim().optional(),
    country: Joi.string().trim().default('India'),
    contactName: Joi.string().trim().optional(),
    phone: Joi.string().trim().optional(),
  }).optional(),
  paymentMethod: Joi.string()
    .valid('COD', 'CREDIT', 'UPI')
    .default('COD'),
  couponCode: Joi.string().trim().allow('', null).optional(),
  idempotencyKey: Joi.string().trim().optional(),
  notes: Joi.string().trim().allow('', null).optional(),
});

const addressSchema = Joi.object({
  fullName: Joi.string().trim().required().messages({
    'string.empty': 'Full name is required',
    'any.required': 'Full name is required',
  }),
  phone: Joi.string().trim().required().messages({
    'string.empty': 'Phone number is required',
    'any.required': 'Phone number is required',
  }),
  addressLine1: Joi.string().trim().required().messages({
    'string.empty': 'Address Line 1 is required',
    'any.required': 'Address Line 1 is required',
  }),
  addressLine2: Joi.string().trim().allow('', null).optional(),
  city: Joi.string().trim().required().messages({
    'string.empty': 'City is required',
    'any.required': 'City is required',
  }),
  state: Joi.string().trim().required().messages({
    'string.empty': 'State is required',
    'any.required': 'State is required',
  }),
  postalCode: Joi.string().trim().required().messages({
    'string.empty': 'Postal Code is required',
    'any.required': 'Postal Code is required',
  }),
  country: Joi.string().trim().default('India'),
  isDefault: Joi.boolean().default(false),
  type: Joi.string().valid('HOME', 'WORK', 'WAREHOUSE', 'SHOP', 'OTHER').default('SHOP'),
});

const updateAddressSchema = Joi.object({
  fullName: Joi.string().trim().optional(),
  phone: Joi.string().trim().optional(),
  addressLine1: Joi.string().trim().optional(),
  addressLine2: Joi.string().trim().allow('', null).optional(),
  city: Joi.string().trim().optional(),
  state: Joi.string().trim().optional(),
  postalCode: Joi.string().trim().optional(),
  country: Joi.string().trim().optional(),
  isDefault: Joi.boolean().optional(),
  type: Joi.string().valid('HOME', 'WORK', 'WAREHOUSE', 'SHOP', 'OTHER').optional(),
});

const createReturnSchema = Joi.object({
  orderId: Joi.string().required().messages({
    'string.empty': 'Order ID is required',
    'any.required': 'Order ID is required',
  }),
  reason: Joi.string().trim().valid('Damaged product', 'Wrong item received', 'Quality issue', 'Not as described', 'Other').required().messages({
    'string.empty': 'Return reason is required',
    'any.required': 'Return reason is required',
  }),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        reason: Joi.string().trim().optional(),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one item must be returned',
      'any.required': 'Return items are required',
    }),
  images: Joi.array().items(Joi.string().uri().allow('')).optional(),
  note: Joi.string().trim().max(1000).allow('', null).optional(),
});

const createTicketSchema = Joi.object({
  subject: Joi.string().trim().required().messages({
    'string.empty': 'Subject is required',
    'any.required': 'Subject is required',
  }),
  category: Joi.string()
    .valid('GENERAL', 'ORDER', 'PRODUCT', 'PAYMENT', 'DELIVERY', 'RETURN', 'OTHER')
    .default('GENERAL'),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
  message: Joi.string().trim().required().messages({
    'string.empty': 'Message is required',
    'any.required': 'Message is required',
  }),
  orderId: Joi.string().allow('', null).optional(),
  attachments: Joi.array().items(Joi.string()).optional(),
});

const sendTicketMessageSchema = Joi.object({
  message: Joi.string().trim().required().messages({
    'string.empty': 'Message is required',
    'any.required': 'Message is required',
  }),
  attachments: Joi.array().items(Joi.string()).optional(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().optional(),
  phone: Joi.string().trim().optional(),
  businessName: Joi.string().trim().optional(),
  gstin: Joi.string().trim().allow('', null).optional(),
  gstStatus: Joi.string().valid('UNREGISTERED', 'REGISTERED', 'COMPOSITION').optional(),
  address: Joi.object({
    addressLine1: Joi.string().trim().optional(),
    addressLine2: Joi.string().trim().allow('', null).optional(),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    postalCode: Joi.string().trim().optional(),
    country: Joi.string().trim().optional(),
  }).optional(),
});

const updateBusinessProfileSchema = Joi.object({
  businessName: Joi.string().trim().optional(),
  ownerName: Joi.string().trim().optional(),
  category: Joi.string().trim().optional(),
  businessType: Joi.string().trim().optional(),
  phone: Joi.string().trim().optional(),
  street: Joi.string().trim().allow('', null).optional(),
  addressLine1: Joi.string().trim().allow('', null).optional(),
  city: Joi.string().trim().allow('', null).optional(),
  state: Joi.string().trim().allow('', null).optional(),
  pincode: Joi.string().trim().allow('', null).optional(),
  postalCode: Joi.string().trim().allow('', null).optional(),
  country: Joi.string().trim().allow('', null).optional(),
  gstStatus: Joi.string().valid('UNREGISTERED', 'REGISTERED', 'COMPOSITION').optional(),
  gstNumber: Joi.string().trim().uppercase().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/).allow('', null).optional(),
  gstin: Joi.string().trim().uppercase().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/).allow('', null).optional(),
  tradeLicenseNumber: Joi.string().trim().allow('', null).optional(),
  address: Joi.alternatives().try(
    Joi.string().trim().allow('', null),
    Joi.object({
      addressLine1: Joi.string().trim().optional(),
      addressLine2: Joi.string().trim().allow('', null).optional(),
      city: Joi.string().trim().optional(),
      state: Joi.string().trim().optional(),
      postalCode: Joi.string().trim().optional(),
      country: Joi.string().trim().optional(),
    })
  ).optional(),
  contactPerson: Joi.object({
    name: Joi.string().trim().optional(),
    phone: Joi.string().trim().optional(),
    email: Joi.string().email({ tlds: { allow: false } }).optional(),
  }).optional(),
  documents: Joi.array().optional(),
});

const acceptInviteSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    'string.empty': 'Invitation token is required',
    'any.required': 'Invitation token is required',
  }),
});

const cancelOrderSchema = Joi.object({
  reason: Joi.string().trim().valid('Ordered by mistake', 'Found better price', 'Delivery too slow', 'Other').required().messages({
    'any.only': 'Select a valid cancellation reason',
    'string.empty': 'Cancellation reason is required',
    'any.required': 'Cancellation reason is required',
  }),
  note: Joi.string().trim().max(1000).allow('', null).optional(),
});

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  checkoutSchema,
  addressSchema,
  updateAddressSchema,
  createReturnSchema,
  createTicketSchema,
  sendTicketMessageSchema,
  updateProfileSchema,
  updateBusinessProfileSchema,
  acceptInviteSchema,
  cancelOrderSchema,
};

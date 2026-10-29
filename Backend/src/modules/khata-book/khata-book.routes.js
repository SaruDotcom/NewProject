const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { ROLES } = require('../../config/constants');
const controller = require('./khata-book.controller');
const { entrySchema, listQuerySchema, settingsSchema } = require('./khata-book.validation');

const router = express.Router();
router.use(authenticate, authorize(ROLES.WHOLESALER));
router.get('/settings', controller.getSettings);
router.put('/settings', validate(settingsSchema), controller.updateSettings);
router.get('/export/:format', validate(listQuerySchema, 'query'), controller.export);
router.get('/', validate(listQuerySchema, 'query'), controller.list);
router.post('/', validate(entrySchema), controller.create);
router.put('/:id', validate(entrySchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;

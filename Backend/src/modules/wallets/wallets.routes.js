const express = require('express');
const router = express.Router();
const walletController = require('./wallets.controller');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

router.get('/me', walletController.getMyWallet);
router.get('/transactions', walletController.getMyTransactions);

module.exports = router;

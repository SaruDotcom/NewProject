const { WalletTransaction } = require('../../models');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { parsePagination } = require('../../utils/pagination');
const WalletService = require('../../services/wallet.service');

class WalletController {
  // Get current user's wallet
  getMyWallet = asyncHandler(async (req, res) => {
    const wallet = await WalletService.getWalletSummary(
      req.user._id,
      req.user.role === 'WHOLESALER' ? 'WHOLESALER' : 'RETAILER'
    );
    return ApiResponse.success(res, wallet, 'Wallet details retrieved');
  });

  // Get current user's wallet transaction ledger
  getMyTransactions = asyncHandler(async (req, res) => {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = { ownerId: req.user._id };

    if (req.query.type) filter.type = req.query.type;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      WalletTransaction.countDocuments(filter),
    ]);

    return ApiResponse.paginated(
      res,
      transactions,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
      'Wallet transactions retrieved'
    );
  });
}

module.exports = new WalletController();

const { AuditLog } = require('../../models');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { parsePagination } = require('../../utils/pagination');

class AuditController {
  listAuditLogs = asyncHandler(async (req, res) => {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};

    if (req.query.actorId) filter.actorId = req.query.actorId;
    if (req.query.actorRole) filter.actorRole = req.query.actorRole;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.entityId) filter.entityId = req.query.entityId;

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actorId', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return ApiResponse.paginated(
      res,
      logs,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
      'Audit logs retrieved successfully'
    );
  });
}

module.exports = new AuditController();

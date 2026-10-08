/**
 * Standard API response builders
 */
class ApiResponse {
  static success(res, data = {}, message = 'Operation successful', statusCode = 200, meta = null) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static created(res, data = {}, message = 'Resource created successfully', meta = null) {
    return this.success(res, data, message, 201, meta);
  }

  static noContent(res) {
    return res.status(204).send();
  }

  static paginated(res, data = [], meta = {}, message = 'Data retrieved successfully') {
    return res.status(200).json({
      success: true,
      message,
      data,
      meta: {
        page: meta.page || 1,
        limit: meta.limit || 20,
        total: meta.total || 0,
        totalPages: meta.totalPages || (meta.limit ? Math.ceil((meta.total || 0) / meta.limit) : 1),
        hasNext: meta.page < meta.totalPages,
        hasPrev: meta.page > 1,
      },
    });
  }

  static error(res, message = 'An error occurred', statusCode = 500, code = 'ERROR', errors = []) {
    return res.status(statusCode).json({
      success: false,
      message,
      code,
      errors: errors.length > 0 ? errors : undefined,
    });
  }
}

module.exports = ApiResponse;

const AuthService = require('./auth.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class AuthController {
  login = asyncHandler(async (req, res) => {
    const result = await AuthService.login({ ...req.body, req });
    return ApiResponse.success(res, result, 'Login successful');
  });

  register = asyncHandler(async (req, res) => {
    const result = await AuthService.register(req.body, req);
    return ApiResponse.created(res, result, 'User registered successfully');
  });

  refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    const result = await AuthService.refresh(refreshToken, req);
    return ApiResponse.success(res, result, 'Token refreshed successfully');
  });

  logout = asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    await AuthService.logout(refreshToken, req.user, req);
    return ApiResponse.success(res, {}, 'Logout successful');
  });

  getMe = asyncHandler(async (req, res) => {
    return ApiResponse.success(res, req.user, 'Current user profile');
  });

  forgotPassword = asyncHandler(async (req, res) => {
    const result = await AuthService.forgotPassword(req.body.email);
    return ApiResponse.success(res, result, result.message);
  });

  resetPassword = asyncHandler(async (req, res) => {
    const result = await AuthService.resetPassword(req.body.token, req.body.newPassword);
    return ApiResponse.success(res, result, result.message);
  });
}

module.exports = new AuthController();

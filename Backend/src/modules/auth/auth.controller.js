const AuthService = require('./auth.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class AuthController {
  login = asyncHandler(async (req, res) => {
    const result = await AuthService.login({ ...req.body, req });
    return ApiResponse.success(res, result, result.requiresTwoFactor ? 'Verification code sent' : 'Login successful');
  });

  sendTwoFactorCode = asyncHandler(async (req, res) => {
    const result = await AuthService.sendTwoFactorCode(req.user._id, 'ENABLE_2FA');
    return ApiResponse.success(res, result, `Verification code sent to ${result.maskedEmail}`);
  });

  resendTwoFactorCode = asyncHandler(async (req, res) => {
    const result = await AuthService.sendTwoFactorCode(req.user._id, 'ENABLE_2FA', true);
    return ApiResponse.success(res, result, `Verification code sent to ${result.maskedEmail}`);
  });

  verifyTwoFactorCode = asyncHandler(async (req, res) => {
    const result = await AuthService.verifyTwoFactorCode(req.user._id, req.body.code);
    return ApiResponse.success(res, result, 'Two-factor authentication enabled');
  });

  disableTwoFactor = asyncHandler(async (req, res) => {
    const result = await AuthService.disableTwoFactor(req.user._id);
    return ApiResponse.success(res, result, 'Two-factor authentication disabled');
  });

  resendLoginCode = asyncHandler(async (req, res) => {
    const result = await AuthService.resendLoginCode(req.body.challengeToken);
    return ApiResponse.success(res, result, `Verification code sent to ${result.maskedEmail}`);
  });

  verifyLoginCode = asyncHandler(async (req, res) => {
    const result = await AuthService.verifyLoginCode(req.body.challengeToken, req.body.code, req);
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

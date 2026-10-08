const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const { NotFoundError } = require('../utils/errors');

class StorageService {
  /**
   * Get file disk path securely
   */
  static getFilePath(subfolder, filename) {
    const safeFilename = path.basename(filename);
    const fullPath = path.join(env.UPLOAD_PATH, subfolder, safeFilename);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundError('Requested file not found');
    }

    return fullPath;
  }

  /**
   * Delete file from disk
   */
  static async deleteFile(subfolder, filename) {
    try {
      const fullPath = path.join(env.UPLOAD_PATH, subfolder, path.basename(filename));
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch (err) {
      // Silently catch deletion errors
    }
  }
}

module.exports = StorageService;

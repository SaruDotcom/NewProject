const mongoose = require('mongoose');

const adminProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    department: {
      type: String,
      default: 'Executive',
      trim: true,
    },
    permissions: [
      {
        type: String,
        trim: true,
      },
    ],
    isSuperAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const AdminProfile = mongoose.model('AdminProfile', adminProfileSchema);
module.exports = AdminProfile;

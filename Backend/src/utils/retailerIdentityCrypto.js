const crypto = require('crypto');
const env = require('../config/env');
const { InternalServerError } = require('./errors');

function getEncryptionKey() {
  const value = env.RETAILER_IDENTITY_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new InternalServerError(
      'Retailer identity encryption is not configured. Set RETAILER_IDENTITY_ENCRYPTION_KEY to a 32-byte hexadecimal key.',
      'IDENTITY_ENCRYPTION_NOT_CONFIGURED'
    );
  }
  return Buffer.from(value, 'hex');
}

function encryptIdentityNumber(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function decryptIdentityNumber(value) {
  if (!value) return '';
  const [version, ivHex, tagHex, ciphertextHex] = String(value).split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !ciphertextHex) {
    throw new Error('Stored retailer identity data has an invalid encrypted format.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encryptIdentityNumber, decryptIdentityNumber };

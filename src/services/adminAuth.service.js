'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminRepository = require('../repositories/admin.repository');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function generateToken(admin) {
  return jwt.sign(
    { adminId: admin.id, email: admin.email, name: admin.name, role: admin.role },
    env.adminAuth.jwtSecret,
    { expiresIn: env.adminAuth.jwtExpiry }
  );
}

/**
 * Returns the decoded payload if the token is valid and
 * unexpired, or null otherwise. Never throws — callers treat a
 * null return as "not authenticated".
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, env.adminAuth.jwtSecret);
  } catch (err) {
    return null;
  }
}

/**
 * Authenticates an admin by email/password. Deliberately uses
 * the same generic error message for "no such admin" and "wrong
 * password" so a login attempt can't be used to enumerate valid
 * admin email addresses.
 */
async function login(email, password) {
  const admin = await adminRepository.findByEmail(email.trim().toLowerCase());
  if (!admin || !admin.is_active) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const isValid = await verifyPassword(password, admin.password_hash);
  if (!isValid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  await adminRepository.updateLastLogin(admin.id);
  const token = generateToken(admin);

  return { admin, token };
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken, login };

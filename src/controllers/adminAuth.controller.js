'use strict';

const adminAuthService = require('../services/adminAuth.service');
const { setAdminTokenCookie, clearAdminTokenCookie } = require('../utils/adminSession');
const { url } = require('../utils/url');

async function showLogin(req, res) {
  res.render('admin/login', { title: 'Admin Login', errors: {}, formValues: {} });
}

async function login(req, res) {
  const { email, password } = req.body;

  try {
    const { token } = await adminAuthService.login(email, password);
    setAdminTokenCookie(res, token);
    res.redirect(url('/admin/dashboard'));
  } catch (err) {
    if (err.isOperational) {
      return res.status(401).render('admin/login', {
        title: 'Admin Login',
        errors: { _general: { msg: err.message } },
        formValues: { email },
      });
    }
    throw err;
  }
}

async function logout(req, res) {
  clearAdminTokenCookie(res);
  res.redirect(url('/admin/login'));
}

module.exports = { showLogin, login, logout };

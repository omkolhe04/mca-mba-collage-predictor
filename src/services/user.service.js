'use strict';

const userRepository = require('../repositories/user.repository');

/**
 * The core "no login/signup" identity logic. Called every time
 * the prediction form is submitted. Mobile number is the unique
 * key: a new mobile creates a user, an existing one updates
 * their latest details. The user never sees this happen.
 */
async function createOrUpdateUser({ name, mobile, email, gender, categoryId, homeUniversityId }) {
  const user = await userRepository.upsertByMobile({
    name,
    mobile,
    email,
    gender,
    last_category_id: categoryId,
    last_home_university_id: homeUniversityId,
  });
  return user;
}

async function findUserById(userId) {
  if (!userId) {
    return null;
  }
  return userRepository.findById(userId);
}

module.exports = { createOrUpdateUser, findUserById };

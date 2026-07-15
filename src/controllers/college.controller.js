'use strict';

const collegeDetailService = require('../services/collegeDetail.service');

async function showDetail(req, res) {
  const detail = await collegeDetailService.getCollegeDetail(req.params.id);

  if (!detail) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that college.',
    });
  }

  res.render('pages/college-detail', {
    title: detail.college.name,
    ...detail,
    CAP_ROUNDS: detail.roundCodes,
  });
}

module.exports = { showDetail };

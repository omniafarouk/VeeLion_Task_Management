const activityService = require('../services/activity.service');

async function getActivity(req, res) {
  const activities = await activityService.getAllActivity();
  res.json({ data: activities });
}

async function addActivity(req, res) {
  const bodyData = req.body || {};
  // Must add validation for the body here (body mush have info and action fields)
  const normalized = validateCreateActivity(bodyData);
  const newActivity = await activityService.createNewActivity(normalized);
  res.status(201).json({ data: newActivity });
}

module.exports = {
  getActivity,
  addActivity,
};

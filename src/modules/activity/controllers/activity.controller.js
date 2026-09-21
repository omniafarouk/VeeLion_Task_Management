const aSvc = require('../services/activity.service');

async function get_activity(req, res) {
  const x = await aSvc.getAllActivity();
  res.json(x);
}

async function addActivity(req, res) {
  const bodyData = req.body || {};
  // Must add validation for the body here (body mush have info and action fields)
  const made = await aSvc.createNewActivity(bodyData);
  res.status(201).json(made);
}

module.exports = {
  get_activity,
  addActivity,
};

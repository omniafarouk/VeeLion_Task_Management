const aSvc = require('../services/activity.service');

function get_activity(req, res) {
  const x = aSvc.getAllActivity();
  res.json(x);
}

function addActivity(req, res) {
  const bodyData = req.body || {};
  // Must add validation for the body here (body mush have info and action fields)
  const made = aSvc.createNewActivity(bodyData);
  res.status(201).json(made);
}

module.exports = {
  get_activity,
  addActivity,
};

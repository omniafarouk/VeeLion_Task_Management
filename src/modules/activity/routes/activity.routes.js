const express = require('express');

const c = require('../controllers/activity.controller');
const asyncHandler = require('../../../middleware/asyncHandler');

const activityRouter = express.Router();

activityRouter.get('/', asyncHandler(c.get_activity));
activityRouter.post('/', asyncHandler(c.addActivity));

module.exports = activityRouter;

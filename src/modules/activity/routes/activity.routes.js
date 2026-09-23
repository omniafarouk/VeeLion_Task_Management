const express = require('express');

const activityController = require('../controllers/activity.controller');    // Rename to clear name for better code quality
const asyncHandler = require('../../../middleware/asyncHandler');

const activityRouter = express.Router();

activityRouter.get('/', asyncHandler(activityController.getActivity));
activityRouter.post('/', asyncHandler(activityController.addActivity));

module.exports = activityRouter;

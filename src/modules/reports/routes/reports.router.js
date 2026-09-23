const express = require('express');

const reportsController = require('../controllers/reports.controller');
const asyncHandler = require('../../../middleware/asyncHandler');

const reportsRouter = express.Router();

reportsRouter.get('/tasks-summary', asyncHandler(reportsController.getTasksSummary));

module.exports = reportsRouter;

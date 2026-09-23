const reportsService = require('../services/reports.service');

async function getTasksSummary(req, res) {
    const tasksSummary = await reportsService.buildTasksSummary();
    res.status(200).json({ data: tasksSummary });
}

module.exports = {
    getTasksSummary
};

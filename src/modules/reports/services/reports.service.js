const tasksService = require('../../tasks/services/tasks.service');
const activityService = require('../../activity/services/activity.service');

function aggregateSummary(tasks, activities, recentWindowMs = 24 * 60 * 60 * 1000) {
    const byStatus = { todo: 0, 'in-progress': 0, done: 0 }; // in progress constant to 0 at the moment for lack of logic to set it
    // const byStatus = { todo: 0, done: 0 };
    for (const task of tasks) {
        byStatus[task.completed ? 'done' : 'todo'] += 1;
    }
    const cutoff = Date.now() - recentWindowMs;
    const recentActivityCount = activities.filter(
        (a) => new Date(a.when).getTime() >= cutoff
    ).length;

    return { total: tasks.length, byStatus, recentActivityCount };
}

async function buildTasksSummary() {
    const [tasks, activities] = await Promise.all([
        tasksService.getAllTasks(),
        activityService.getAllActivity(),
    ]);

    return aggregateSummary(tasks, activities);
}

module.exports = { buildTasksSummary };
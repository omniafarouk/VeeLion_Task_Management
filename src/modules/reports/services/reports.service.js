const tasksService = require('../../tasks/services/tasks.service');
const activityService = require('../../activity/services/activity.service');

function aggregateSummary(tasks, activities, recentWindowMs = 24 * 60 * 60 * 1000) {
    const byStatus = { todo: 0, 'in-progress': 0, done: 0 };
    for (const task of tasks) {
        byStatus[task.completed ? 'done' : 'todo'] += 1;
    }
    // NOTE: the task data model only tracks a boolean `completed` field —
    // there is no persisted concept of "in-progress". We map:
    //   completed === false -> todo
    //   completed === true  -> done
    // "in-progress" is always 0 since it cannot be derived from the data
    // without inventing an arbitrary, undocumented business rule.

    const cutoff = Date.now() - recentWindowMs;
    const recentActivityCount = activities.filter(
        (a) => new Date(a.when).getTime() >= cutoff
    ).length;

    return { total: tasks.length, byStatus, recentActivityCount };
}

async function buildTasksSummary() {
    const [tasks, activities] = await Promise.all([
        // design choice: 2 independent concurrent fetch calls for optimized performance
        tasksService.getAllTasks(),
        activityService.getAllActivity(),
    ]);

    return aggregateSummary(tasks, activities);
}

module.exports = { buildTasksSummary };
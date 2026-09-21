const tasksService = require('../services/tasks.service');
const { validateCreateTask, validateUpdateTask } = require('../utils/taskValidator');

async function listTasks(req, res) {
  const tasks = await tasksService.getAllTasks();
  res.status(200).json({ data: tasks });
}

async function getTask(req, res) {
  const task = await tasksService.getTaskById(req.params.id);
  res.status(200).json({ data: task });
}

async function createTask(req, res) {
  const payload = req.body || {};

  // if (typeof payload !== 'object' || Array.isArray(payload)) {
  //   return res.status(400).json({ error: { message: 'Body must be an object.' } });
  // }

  // if (typeof payload.title !== 'string') {
  //   return res
  //     .status(400)
  //     .json({ error: { message: 'title is required and must be string' } });
  // }

  // payload.title = payload.title.trim();
  // if (!payload.title) {
  //   return res.status(400).json({ error: { message: 'title cannot be empty' } });
  // }

  // if (payload.completed === undefined) {
  //   payload.completed = false;
  // }

  // if (typeof payload.completed !== 'boolean') {
  //   return res.status(400).json({ error: { message: 'completed must be boolean' } });
  // }

  const normalized = validateCreateTask(payload);
  const task = await tasksService.createTask(normalized);

  res.status(201).json({ data: task });
}

async function patchTask(req, res) {
  const updates = req.body || {};

  const normalized = validateUpdateTask(updates);
  const task = await tasksService.updateTask(req.params.id, normalized);

  res.status(200).json({ data: task });
}

async function removeTask(req, res) {
  await tasksService.deleteTask(req.params.id);
  res.status(204).send();
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  patchTask,
  removeTask,
};

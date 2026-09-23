const path = require('node:path');
const { createId } = require('../../../utils/id');
const { readJsonArray, writeJsonArray } = require('../../../utils/jsonStore');

const ACTIVITY_FILEPATH = path.join(process.cwd(), 'data', 'activity.json');
// better to rename the file path into something more descriptive

async function loadData() {   // Make the function async for optimized performance
  return readJsonArray(ACTIVITY_FILEPATH);
}

// function loadData() {    // Synchronous Operation
//   if (!fs.existsSync(fp)) {
//     fs.writeFileSync(fp, '[]');
//   }

//   let raw = fs.readFileSync(fp, 'utf8');
//   if (!raw) {
//     raw = '[]';
//   }

//   return JSON.parse(raw);
// }

function getAllActivity() {
  const arr = loadData();
  return arr;
}

async function createNewActivity(b) { // Make write async with isolation guarantee
  const list = loadData();
  const one = {
    id: createId(),   // This may cause collisions in case of 2 concurrent requests
    action: b.action,
    info: b.info,
    when: new Date().toISOString(),
  };

  list.push(one); // this would cause dataloss for concurrent writes (race condition)
  //fs.writeFileSync(fp, JSON.stringify(list, null, 2));
  await writeJsonArray(ACTIVITY_FILEPATH, list);

  return one;
}

module.exports = {
  getAllActivity,
  createNewActivity,
};

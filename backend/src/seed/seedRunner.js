require('dotenv').config();
const { dbManager } = require('../config/db');
const { createAppContext } = require('../server');
const { seedSystemData } = require('./seedData');

async function run() {
  const mode = await dbManager.connect();
  const context = createAppContext();
  await seedSystemData(context);
  console.log(`Seed completed successfully in ${mode} mode.`);
  await dbManager.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

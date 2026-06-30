require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const q1 = { assignedTo: { $in: [null, undefined] } };
  const q2 = { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] };
  
  const c1 = await db.collection('leads').countDocuments(q1);
  const c2 = await db.collection('leads').countDocuments(q2);
  
  console.log("q1 count:", c1);
  console.log("q2 count:", c2);
  
  process.exit(0);
}
run();

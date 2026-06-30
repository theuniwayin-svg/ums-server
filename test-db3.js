require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  mongoose.set('debug', true);
  const db = mongoose.connection.db;
  
  console.log('Without sort:');
  const res1 = await db.collection('leads').find({ isDeleted: { $ne: true } }).skip(0).limit(20).toArray();
  console.log('Count:', res1.length);
  
  console.log('With sort:');
  const res2 = await db.collection('leads').find({ isDeleted: { $ne: true } }).sort({ updatedAt: -1 }).skip(0).limit(20).toArray();
  console.log('Count:', res2.length);

  await mongoose.disconnect();
}
test();

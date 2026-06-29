require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log('Users in DB:');
  users.forEach(u => console.log(u.email, u.passwordHash ? '(has password)' : '(no password)'));
  await mongoose.disconnect();
}
test();

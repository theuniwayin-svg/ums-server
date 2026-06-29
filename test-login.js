require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await mongoose.connection.db.collection('users').findOne({ email: 'admin@theuniwayin.com' });
  if (!user) {
    console.log('User not found!');
  } else {
    const isMatch = await bcrypt.compare('Admin@123', user.passwordHash);
    console.log('Password match:', isMatch);
  }
  await mongoose.disconnect();
}
test();

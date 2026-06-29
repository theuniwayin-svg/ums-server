require('dotenv').config();
const mongoose = require('mongoose');
const { Types } = mongoose;

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('--- TEST QUERY ---');
    const query = { isDeleted: { $ne: true } };
    
    const count = await db.collection('leads').countDocuments(query);
    console.log(`Leads matching { isDeleted: { $ne: true } }: ${count}`);
    
    // Test with empty query
    const countEmpty = await db.collection('leads').countDocuments({});
    console.log(`Leads matching {}: ${countEmpty}`);
    
    // Find one lead
    const oneLead = await db.collection('leads').findOne(query);
    console.log('Sample lead:', JSON.stringify(oneLead, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
test();

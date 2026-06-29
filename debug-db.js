require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('--- USERS ---');
    const users = await db.collection('users').find({}).toArray();
    users.forEach(u => console.log(`Email: ${u.email}, Role: ${u.role}, ID: ${u._id}, Active: ${u.isActive}`));
    
    console.log('\n--- LEADS ---');
    const leadsCount = await db.collection('leads').countDocuments();
    const leadsWithAssignedTo = await db.collection('leads').countDocuments({ assignedTo: { $exists: true, $ne: null } });
    const leadsWithoutAssignedTo = await db.collection('leads').countDocuments({ assignedTo: { $exists: false } });
    const leadsWithNullAssignedTo = await db.collection('leads').countDocuments({ assignedTo: null });
    
    console.log(`Total Leads: ${leadsCount}`);
    console.log(`Assigned Leads: ${leadsWithAssignedTo}`);
    console.log(`Unassigned Leads (missing): ${leadsWithoutAssignedTo}`);
    console.log(`Unassigned Leads (null): ${leadsWithNullAssignedTo}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
test();

require('dotenv').config();
const mongoose = require('mongoose');

async function fixDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const resAssigned = await db.collection('leads').updateMany(
    { assignedTo: "" },
    { $set: { assignedTo: null } }
  );
  console.log('Fixed assignedTo = "":', resAssigned.modifiedCount);

  const resCreated = await db.collection('leads').updateMany(
    { createdBy: "" },
    { $set: { createdBy: null } }
  );
  console.log('Fixed createdBy = "":', resCreated.modifiedCount);

  const resUpdated = await db.collection('leads').updateMany(
    { updatedBy: "" },
    { $set: { updatedBy: null } }
  );
  console.log('Fixed updatedBy = "":', resUpdated.modifiedCount);
  
  // also check for any string 'null' or 'undefined'
  const resAssignedStr = await db.collection('leads').updateMany(
    { assignedTo: { $in: ["null", "undefined"] } },
    { $set: { assignedTo: null } }
  );
  console.log('Fixed assignedTo = "null"/"undefined":', resAssignedStr.modifiedCount);

  await mongoose.disconnect();
}
fixDb();

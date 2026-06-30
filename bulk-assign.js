const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const leadSchema = new mongoose.Schema({}, { strict: false });
const Lead = mongoose.model('Lead', leadSchema, 'leads');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const staff1Id = new mongoose.Types.ObjectId("6a42d31f45e7f203d613016a");
  const staff2Id = new mongoose.Types.ObjectId("6a42d2cc45e7f203d6130168");

  // Fetch all leads
  const allLeads = await Lead.find({}).exec();
  console.log(`Found ${allLeads.length} leads in the database.`);
  
  if (allLeads.length < 192) {
    console.log(`Not enough leads to assign. Only ${allLeads.length} available.`);
    process.exit(1);
  }

  // Get the first 96 for staff1 and the next 96 for staff2
  const staff1Leads = allLeads.slice(0, 96);
  const staff2Leads = allLeads.slice(96, 192);

  const staff1LeadIds = staff1Leads.map(l => l._id);
  const staff2LeadIds = staff2Leads.map(l => l._id);

  console.log(`Assigning ${staff1LeadIds.length} leads to Staff 1 (Ponnoose M John)...`);
  const result1 = await Lead.updateMany(
    { _id: { $in: staff1LeadIds } },
    { $set: { assignedTo: staff1Id } }
  );
  console.log(`Staff 1 assignment result:`, result1);

  console.log(`Assigning ${staff2LeadIds.length} leads to Staff 2 (Sreenidhi Umes)...`);
  const result2 = await Lead.updateMany(
    { _id: { $in: staff2LeadIds } },
    { $set: { assignedTo: staff2Id } }
  );
  console.log(`Staff 2 assignment result:`, result2);

  console.log('Bulk assignment completed successfully.');
  process.exit(0);
}

run().catch(console.error);

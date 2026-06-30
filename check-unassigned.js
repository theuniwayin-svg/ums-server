const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const leadSchema = new mongoose.Schema({}, { strict: false });
const Lead = mongoose.model('Lead', leadSchema, 'leads');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const nullAssigned = await Lead.countDocuments({ assignedTo: null });
  const missingAssigned = await Lead.countDocuments({ assignedTo: { $exists: false } });
  const emptyStringAssigned = await Lead.countDocuments({ assignedTo: '' });
  const undefinedAssigned = await Lead.countDocuments({ assignedTo: undefined });
  const totalLeads = await Lead.countDocuments({});

  console.log('Total leads:', totalLeads);
  console.log('assignedTo = null:', nullAssigned);
  console.log('assignedTo field missing (not exists):', missingAssigned);
  console.log('assignedTo = empty string:', emptyStringAssigned);
  console.log('assignedTo = undefined:', undefinedAssigned);

  // Show a sample of "unassigned" leads
  const sampleNull = await Lead.find({ assignedTo: null }).limit(2).select('studentName assignedTo').lean();
  const sampleMissing = await Lead.find({ assignedTo: { $exists: false } }).limit(2).select('studentName assignedTo').lean();

  console.log('\nSample null leads:', JSON.stringify(sampleNull, null, 2));
  console.log('\nSample missing leads:', JSON.stringify(sampleMissing, null, 2));

  process.exit(0);
}

run().catch(console.error);

require('dotenv').config();
const mongoose = require('mongoose');
const { Schema } = mongoose;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const leadSchema = new Schema({ assignedTo: { type: Schema.Types.ObjectId } }, { strict: false });
  const Lead = mongoose.model('Lead', leadSchema, 'leads');
  
  const q1 = { assignedTo: { $in: [null, undefined] } };
  const c1 = await Lead.countDocuments(q1);
  const r1 = await Lead.find(q1).limit(5).exec();
  
  const q2 = { assignedTo: null };
  const c2 = await Lead.countDocuments(q2);
  const r2 = await Lead.find(q2).limit(5).exec();
  
  console.log("q1 count:", c1, "results:", r1.length);
  console.log("q2 count:", c2, "results:", r2.length);
  
  process.exit(0);
}
run();

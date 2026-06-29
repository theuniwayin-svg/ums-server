const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const leadSchema = new mongoose.Schema({}, { strict: false });
const Lead = mongoose.model('Lead', leadSchema, 'leads');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const leads = await Lead.find({});
  let updatedCount = 0;

  for (const lead of leads) {
    let changed = false;
    let newPhone = lead.get('phone');

    if (newPhone && typeof newPhone === 'string') {
      newPhone = newPhone.trim();
      // If it's a 10 digit number, prepend +91
      if (/^\d{10}$/.test(newPhone)) {
        newPhone = '+91' + newPhone;
        changed = true;
      } else if (!newPhone.startsWith('+') && newPhone.length > 10) {
        // e.g., 91 9876543210
        const digits = newPhone.replace(/\D/g, '');
        if (digits.length === 12 && digits.startsWith('91')) {
          newPhone = '+' + digits;
          changed = true;
        }
      }
    }

    if (changed) {
      await Lead.updateOne({ _id: lead._id }, { $set: { phone: newPhone } });
      updatedCount++;
      console.log(`Updated lead ${lead._id}: ${lead.get('phone')} -> ${newPhone}`);
    }
  }

  console.log(`Updated ${updatedCount} leads.`);
  process.exit(0);
}

run().catch(console.error);

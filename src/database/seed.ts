import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import * as path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  process.exit(1);
}

const adminEmail = 'admin@theuniwayin.com';
const adminPassword = 'Admin@123';

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    passwordHash: String,
    role: String,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const LeadSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    parentPhone: String,
    email: String,
    city: String,
    state: String,
    course: String,
    preferredCollege: String,
    source: { type: String, required: true },
    otherSourceDescription: String,
    status: { type: String, default: 'New' },
    temperature: { type: String, default: 'Warm' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const NoteSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    content: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);

const UserModel = mongoose.model('User', UserSchema);
const LeadModel = mongoose.model('Lead', LeadSchema);
const NoteModel = mongoose.model('Note', NoteSchema);

async function seed() {
  console.log('🌱 Starting seed...');

  await mongoose.connect(MONGODB_URI!);
  console.log('✅ Connected to MongoDB');

  // 1. Seed Admin
  let admin = await UserModel.findOne({ email: adminEmail });
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    admin = await UserModel.create({
      name: 'Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      isActive: true,
      isDeleted: false,
    });
    console.log(`✅ Admin seeded: ${adminEmail}`);
  } else {
    admin.passwordHash = await bcrypt.hash(adminPassword, 12);
    await admin.save();
    console.log(`ℹ️  Admin already exists. Password updated to default.`);
  }

  // 2. Read Excel file
  const excelPath = path.resolve(__dirname, '../../../leads/Merged_Leads.xlsx');
  console.log(`📂 Reading leads from: ${excelPath}`);
  
  let workbook;
  try {
    workbook = xlsx.readFile(excelPath);
  } catch (err: any) {
    console.error('❌ Could not read Excel file:', err.message);
    await mongoose.disconnect();
    return;
  }

  const sheetName = workbook.SheetNames[0];
  const rawData: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  console.log(`📊 Found ${rawData.length} rows in the Excel file.`);

  let successCount = 0;
  let duplicateCount = 0;
  let skipCount = 0;

  for (const row of rawData) {
    const name = row['Name'];
    const contactRaw = row['Contact'];
    const course = row['Course'] || '';
    const rawStatus = row['Status'] || '';
    const remarks = row['Remarks'] || '';
    const email = row['Email'] || '';
    const city = row['City'] || '';
    const sourceRaw = row['Source'] || 'Other';

    if (!name || !contactRaw) {
      skipCount++;
      continue;
    }

    // Clean phone number (extract only digits)
    const phone = String(contactRaw).replace(/\D/g, '');
    if (phone.length < 5) {
      skipCount++;
      continue;
    }

    // Map Temperature
    let temperature = 'Warm';
    const statusUpper = String(rawStatus).toUpperCase();
    if (statusUpper.includes('HOT')) temperature = 'Hot';
    if (statusUpper.includes('COLD')) temperature = 'Cold';
    
    // Check if lead exists
    const existingLead = await LeadModel.findOne({ phone });
    if (existingLead) {
      duplicateCount++;
      continue;
    }

    const lead = new LeadModel({
      studentName: String(name),
      phone,
      email: String(email).trim() || undefined,
      city: String(city).trim() || undefined,
      course: String(course).trim() || undefined,
      source: 'Other',
      otherSourceDescription: String(sourceRaw).substring(0, 100),
      status: remarks ? 'Called' : 'New',
      temperature,
      createdBy: admin._id,
    });

    await lead.save();
    successCount++;

    // Add Note if Remarks exist
    if (remarks) {
      await NoteModel.create({
        leadId: lead._id,
        createdBy: admin._id,
        createdByName: admin.name || 'Admin',
        content: String(remarks).substring(0, 2000),
      });
    }
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`   ✅ Successfully imported: ${successCount} leads`);
  console.log(`   ⏭️  Skipped (No valid phone/name): ${skipCount}`);
  console.log(`   🔄 Skipped (Duplicate phone): ${duplicateCount}`);

  await mongoose.disconnect();
  console.log('✅ Done.');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

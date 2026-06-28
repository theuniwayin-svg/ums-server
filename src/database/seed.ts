import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import * as xlsx from 'xlsx';
import {
  Lead,
  LeadSchema,
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from '../modules/leads/schemas/lead.schema';
import { Note, NoteSchema } from '../modules/notes/schemas/note.schema';
import { User, UserRole, UserSchema } from '../modules/users/schemas/user.schema';

const MONGODB_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
const SEED_ADMIN_EMAILS =
  process.env.SEED_ADMIN_EMAILS || 'admin@uniwayin.com,admin@theuniwayin.com';

if (!MONGODB_URI) {
  console.error(
    '❌ MONGODB_URI is not set. Copy .env.example to .env and configure it.',
  );
  process.exit(1);
}

const UserModel =
  mongoose.models.User || mongoose.model(User.name, UserSchema, 'users');
const LeadModel =
  mongoose.models.Lead || mongoose.model(Lead.name, LeadSchema, 'leads');
const NoteModel =
  mongoose.models.Note || mongoose.model(Note.name, NoteSchema, 'notes');

function normalizeText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeEmail(value: unknown): string | undefined {
  const email = normalizeText(value).toLowerCase();
  return email || undefined;
}

function normalizeTemperature(value: unknown): LeadTemperature {
  const text = normalizeText(value).toUpperCase();
  if (text.includes('HOT')) return LeadTemperature.HOT;
  if (text.includes('COLD')) return LeadTemperature.COLD;
  return LeadTemperature.WARM;
}

function resolveWorkbookPath(): string {
  const candidates = [
    path.resolve(process.cwd(), '../leads/Merged_Leads.xlsx'),
    path.resolve(__dirname, '../../../leads/Merged_Leads.xlsx'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find Merged_Leads.xlsx. Checked: ${candidates.join(', ')}`);
}

async function seedAdmins() {
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
  const emails = [...new Set(SEED_ADMIN_EMAILS.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))];

  if (!emails.length) {
    throw new Error('No admin emails configured for seeding');
  }

  const seededAdmins: Array<{ email: string; userId: mongoose.Types.ObjectId }> = [];

  for (const email of emails) {
    const user = await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          name: 'Admin',
          email,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
          isDeleted: false,
        },
      },
      { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' },
    );

    seededAdmins.push({ email: user.email, userId: user._id });
  }

  return seededAdmins;
}

async function seed() {
  console.log('🌱 Starting seed...');

  await mongoose.connect(MONGODB_URI!, {
    serverSelectionTimeoutMS: 30000,
  });
  console.log('✅ Connected to MongoDB');

  const admins = await seedAdmins();
  const primaryAdmin = await UserModel.findOne({ email: admins[0].email }).exec();

  if (!primaryAdmin) {
    throw new Error('Primary admin could not be created');
  }

  console.log(
    `✅ Admin accounts seeded/updated: ${admins.map((admin) => admin.email).join(', ')}`,
  );

  const workbookPath = resolveWorkbookPath();
  console.log(`📂 Reading leads from: ${workbookPath}`);

  const workbook = xlsx.readFile(workbookPath);
  const sheetName = workbook.SheetNames[0];
  const rawRows: Array<Record<string, unknown>> = xlsx.utils.sheet_to_json(
    workbook.Sheets[sheetName],
    { defval: '' },
  );

  console.log(`📊 Found ${rawRows.length} rows in the Excel file.`);

  const seenPhones = new Set<string>();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let duplicateWorkbookCount = 0;
  let noteCount = 0;

  for (const row of rawRows) {
    const studentName = normalizeText(row['Name']);
    const phone = normalizePhone(row['Contact']);
    const remarks = normalizeText(row['Remarks']);

    if (!studentName || phone.length < 5) {
      skippedCount++;
      continue;
    }

    if (seenPhones.has(phone)) {
      duplicateWorkbookCount++;
      continue;
    }

    seenPhones.add(phone);

    const existedBefore = await LeadModel.exists({ phone });
    const lead = await LeadModel.findOneAndUpdate(
      { phone },
      {
        $set: {
          studentName,
          phone,
          email: normalizeEmail(row['Email']),
          city: normalizeText(row['City']) || undefined,
          course: normalizeText(row['Course']) || undefined,
          source: LeadSource.META_ADS,
          otherSourceDescription: normalizeText(row['Source']).slice(0, 100) || 'Excel import',
          status: remarks ? LeadStatus.CALLED : LeadStatus.NEW,
          temperature: normalizeTemperature(row['Status']),
          createdBy: primaryAdmin._id,
          assignedTo: primaryAdmin._id,
          updatedBy: primaryAdmin._id,
          isDeleted: false,
        },
      },
      { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' },
    );

    if (existedBefore) {
      updatedCount++;
    } else {
      createdCount++;
    }

    if (lead && remarks) {
      await NoteModel.findOneAndUpdate(
        { leadId: lead._id },
        {
          $set: {
            leadId: lead._id,
            createdBy: primaryAdmin._id,
            createdByName: primaryAdmin.name || 'Admin',
            content: remarks.slice(0, 2000),
          },
        },
        { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' },
      );
      noteCount++;
    }
  }

  console.log('\n🎉 Seeding complete!');
  console.log(`   ✅ Leads created: ${createdCount}`);
  console.log(`   🔁 Leads updated: ${updatedCount}`);
  console.log(`   📝 Notes written: ${noteCount}`);
  console.log(`   ⏭️  Skipped (invalid rows): ${skippedCount}`);
  console.log(`   🔄 Skipped (duplicate phone in workbook): ${duplicateWorkbookCount}`);

  await mongoose.disconnect();
  console.log('✅ Done.');
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect failures
  }
  process.exit(1);
});

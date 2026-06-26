import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  process.exit(1);
}

if (!SEED_ADMIN_PASSWORD) {
  console.error('❌ SEED_ADMIN_PASSWORD is not set. Configure it before running the seed script.');
  process.exit(1);
}

const adminPassword = SEED_ADMIN_PASSWORD;

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

const UserModel = mongoose.model('User', UserSchema);

async function seedFirstAdmin() {
  console.log('🌱 Starting seed...');

  await mongoose.connect(MONGODB_URI!);
  console.log('✅ Connected to MongoDB');

  const existing = await UserModel.findOne({ email: 'admin@uniwayin.com' });
  if (existing) {
    console.log('ℹ️  Admin already seeded. Skipping.');
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await UserModel.create({
    name: 'Admin',
    email: 'admin@uniwayin.com',
    passwordHash,
    role: 'admin',
    isActive: true,
    isDeleted: false,
  });

  console.log('✅ First admin seeded: admin@uniwayin.com');
  console.log('⚠️  Change this password immediately after first login!');

  await mongoose.disconnect();
  console.log('✅ Done.');
}

seedFirstAdmin().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

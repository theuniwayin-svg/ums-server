const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { LeadsService } = require('./dist/modules/leads/leads.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const leadsService = app.get(LeadsService);
  
  console.log('Direct test 1:');
  const r1 = await leadsService.leadModel.find({ isDeleted: { $ne: true } }).lean();
  console.log(r1.length);
  
  console.log('Direct test 2:');
  const r2 = await leadsService.leadModel.find({ status: 'Called', isDeleted: { $ne: true } }).lean();
  console.log(r2.length);

  await app.close();
}
bootstrap();

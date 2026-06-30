const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { LeadsService } = require('./dist/modules/leads/leads.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const leadsService = app.get(LeadsService);
  
  const user = { _id: "6a3e85ff8a7afe60d97e15e0", role: 'admin' };
  
  console.log('Testing with assignedTo=unassigned, page=2...');
  try {
    const res = await leadsService.findAll({ assignedTo: 'unassigned', page: 2, limit: 10 }, user);
    console.log(`Leads returned: ${res.data.length}, Total: ${res.meta.total}`);
  } catch (err) {
    console.error(err);
  }

  await app.close();
}
bootstrap();

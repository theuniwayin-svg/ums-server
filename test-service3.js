const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { LeadsService } = require('./dist/modules/leads/leads.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const leadsService = app.get(LeadsService);
  
  const user = { _id: "6a3e85ff8a7afe60d97e15e0", role: 'admin' };
  
  console.log('Testing without filters...');
  const res1 = await leadsService.findAll({}, user);
  console.log(`Leads: ${res1.data.length}, Total: ${res1.meta.total}`);
  
  console.log('Executing raw find with exact same populate:');
  const rawData = await leadsService.leadModel.find({})
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTo', 'name email role')
    .sort({ updatedAt: -1 })
    .skip(0)
    .limit(20)
    .exec();
    
  console.log(`Raw leads count: ${rawData.length}`);

  await app.close();
}
bootstrap();

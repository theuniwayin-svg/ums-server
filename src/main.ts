import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Pino logger
  app.useLogger(app.get(Logger));

  // Cookie parser
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global response transform
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['api/health'],
  });

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like server-to-server or curl)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:4000',
        'https://ums.theuniway.co.in',
      ].filter(Boolean);

      // Allow if origin is in the explicit list, a Vercel deployment URL, or any localhost
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('UMS API — Uniwayin Management System')
      .setDescription('Lead & Admissions CRM API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('users')
      .addTag('leads')
      .addTag('activities')
      .addTag('notes')
      .addTag('follow-ups')
      .addTag('analytics')
      .addTag('audit')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');

    const logger = app.get(Logger);
    logger.log(`🚀 UMS API running on port ${port}`);
    logger.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  } catch (err) {
    console.error('❌ Failed to start application:', err);
    process.exit(1);
  }
}

bootstrap();

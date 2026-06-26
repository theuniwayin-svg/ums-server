import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  MONGODB_URI: Joi.string().uri().optional(),
  MONGO_URI: Joi.string().uri().optional(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  FRONTEND_URL: Joi.string().uri().required(),
  RESEND_API_KEY: Joi.string().required(),
  RESEND_FROM_EMAIL: Joi.string().email().default('noreply@uniwayin.com'),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
  SENTRY_DSN: Joi.string().uri().optional().allow(''),
}).or('MONGODB_URI', 'MONGO_URI');

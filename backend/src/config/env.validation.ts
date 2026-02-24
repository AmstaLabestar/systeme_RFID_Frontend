import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(4012),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),

  JWT_ACCESS_SECRET: Joi.string().min(64).required(),
  JWT_REFRESH_SECRET: Joi.string().min(64).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  MAGIC_LINK_TTL: Joi.string().default('15m'),
  TWO_FACTOR_STEP_TTL: Joi.string().default('5m'),

  DASHBOARD_REDIRECT_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  CORS_ALLOWED_ORIGINS: Joi.string().required(),

  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(16).default(12),

  DEFAULT_TENANT_NAME: Joi.string().min(2).max(120).default('Tech Souveraine'),
  DEFAULT_TENANT_DOMAIN: Joi.string().domain().default('techsouveraine.com'),
  DEFAULT_ROLE_NAME: Joi.string().min(2).max(60).default('owner'),

  OTP_MAX_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  TOTP_ISSUER: Joi.string().min(2).max(120).default('RFID SaaS'),
  TWO_FACTOR_ENCRYPTION_KEY: Joi.string().length(64).hex().required(),

  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  MAGIC_LINK_CALLBACK_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),

  EMAIL_PROVIDER: Joi.string().valid('console', 'smtp').default('console'),
  EMAIL_FROM: Joi.string().email().required(),
  SMTP_HOST: Joi.when('EMAIL_PROVIDER', {
    is: 'smtp',
    then: Joi.string().hostname().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  SMTP_PORT: Joi.when('EMAIL_PROVIDER', {
    is: 'smtp',
    then: Joi.number().port().required(),
    otherwise: Joi.number().optional(),
  }),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.when('EMAIL_PROVIDER', {
    is: 'smtp',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  SMTP_PASS: Joi.when('EMAIL_PROVIDER', {
    is: 'smtp',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),

});

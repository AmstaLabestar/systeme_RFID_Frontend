import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import type { ValidationError } from 'class-validator';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SanitizeBodyPipe } from './common/pipes/sanitize-body.pipe';
import { PrismaService } from './infrastructure/prisma/prisma.service';

function parseCorsOrigins(rawOrigins: string): string[] {
  const baseOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const expandedOrigins = new Set<string>(baseOrigins);

  baseOrigins.forEach((origin) => {
    if (origin === '*') {
      return;
    }

    try {
      const url = new URL(origin);
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        return;
      }

      const alternateHost = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
      expandedOrigins.add(`${url.protocol}//${alternateHost}${url.port ? `:${url.port}` : ''}`);
    } catch {
      // Ignore malformed origins here; validation belongs to env configuration.
    }
  });

  return Array.from(expandedOrigins);
}

function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  const traverse = (entries: ValidationError[]) => {
    entries.forEach((entry) => {
      if (entry.constraints) {
        messages.push(...Object.values(entry.constraints));
      }

      if (entry.children && entry.children.length > 0) {
        traverse(entry.children);
      }
    });
  };

  traverse(errors);
  return messages;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
    }),
  );

  const allowedOrigins = parseCorsOrigins(configService.getOrThrow<string>('CORS_ALLOWED_ORIGINS'));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin blocked.'), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  });

  app.useGlobalPipes(
    new SanitizeBodyPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = flattenValidationErrors(errors);
        return new BadRequestException(messages.join(' | ') || 'Validation failed.');
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await prismaService.enableShutdownHooks(app);

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);
}

void bootstrap();

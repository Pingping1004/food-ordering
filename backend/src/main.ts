import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './libs/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import * as fs from 'fs';
import * as bodyParser from 'body-parser';
import {
  globalRateLimit,
  paymentRateLimit,
  orderRateLimit,
  orderFetchingLimit,
  schoolCodeRateLimit,
  joinSchoolRateLimit,
} from './rateLimiting.middleware';

dotenv.config();
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions:
      process.env.NODE_ENV === 'development'
        ? {
            key: fs.readFileSync('./cert/localhost-key.pem'),
            cert: fs.readFileSync('./cert/localhost.pem'),
          }
        : undefined,
    bodyParser: false,
  });

  app.setGlobalPrefix('api');
  const logger = new Logger('Bootstrap');

  app.use('/api/payment/webhook', bodyParser.raw({ type: 'application/json' }));

  app.use(
    express.json({
      limit: '10mb',
    }),
  );

  const allowedOrigins = [
    'https://promptserve.online',
    'https://api.promptserve.online',
    'https://promptserve-mvp.onrender.com',
    'https://localhost:8000',
    'https://localhost:3000',
    'http://localhost:3000',
    process.env.FRONTEND_BASE_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
    process.env.WEBHOOK_ENDPOINT,
    // Extra origins, comma-separated (e.g. a second local frontend port for perf runs). Leave unset in production.
    ...(process.env.CORS_EXTRA_ORIGINS?.split(',') ?? []).map((o) => o.trim()),
  ].map((origin) => origin?.replace(/\/$/, ''));

  app.enableCors({
    origin: (origin, callback) => {
      const cleanOrigin = origin?.replace(/\/$/, '');
      const isAllowed = !origin || allowedOrigins.includes(cleanOrigin);

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`🚫 Blocked by CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    // Auth is a Bearer token (Supabase) – no cookies cross origins any more.
    credentials: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'x-order-secret',
      'Authorization',
      'sentry-trace',
      'baggage',
      'stripe-signature',
    ],
  });

  logger.log('Webhook endpoint: ', process.env.WEBHOOK_ENDPOINT);

  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use(helmet());
  app.use(compression());

  app.use(globalRateLimit);
  app.use('/api/payment', paymentRateLimit);
  app.use('/api/order/create', orderRateLimit);
  app.use('/api/order/new', orderFetchingLimit);
  app.use('/api/me/school', schoolCodeRateLimit);
  app.use('/api/me/redeem-code', joinSchoolRateLimit);

  app.getHttpAdapter().get('/health', (req: Request, res: Response) => {
    res.send('OK');
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validateCustomDecorators: true,

      exceptionFactory: (errors) => {
        const formatErrors = (validationErrors: any[]) => {
          return validationErrors.map((error) => {
            if (error.children && error.children.length > 0) {
              return {
                property: error.property,
                children: formatErrors(error.children),
              };
            }
            return {
              property: error.property,
              constraints: error.constraints,
              messages: error.constraints
                ? Object.values(error.constraints)
                : [],
            };
          });
        };

        const detailedErrors = formatErrors(errors);

        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          errors: detailedErrors,
        });
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  process.on('uncaughtException', (err) => {
    logger.error('GLOBAL UNCAUGHT EXCEPTION:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('GLOBAL UNHANDLED REJECTION at:', promise, 'reason:', reason);
    process.exit(1);
  });

  const port = process.env.PORT || 4000;
  logger.log('NESTJS is running on port: ', port);
  await app.listen(port);
}
bootstrap();

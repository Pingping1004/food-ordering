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
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import * as fs from 'fs';
import * as bodyParser from 'body-parser';
import {
  globalRateLimit,
  authRateLimit,
  paymentRateLimit,
  orderRateLimit,
} from './rateLimiting.middleware';
import './auth/jobs/tokenClean.job';

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
    httpsOptions: process.env.NODE_ENV === 'development' ? {
      key: fs.readFileSync('./cert/localhost-key.pem'),
      cert: fs.readFileSync('./cert/localhost.pem'),
    } : undefined,
    bodyParser: false
  });

  app.setGlobalPrefix('api');
  const logger = new Logger('Bootstrap');

  app.use(
    '/api/payment/webhook',
    bodyParser.raw({ type: 'application/json' })
  );

  app.use(
    express.json({
      limit: '10mb',
    })
  );

  const allowedOrigins = [
    'https://promptserve.online',
    'https://api.promptserve.online',
    'https://promptserve-mvp.onrender.com',
    'https://localhost:8000',
    process.env.FRONTEND_BASE_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
    process.env.WEBHOOK_ENDPOINT,
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
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'X-CSRF-Token',
      'x-csrf-token',
      'X-Csrf-Token',
      'x-xsrf-token',
      'Authorization',
      'skipauth',
      'stripe-signature'
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  logger.log('Webhook endpoint: ', process.env.WEBHOOK_ENDPOINT);

  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use(helmet());
  app.use(compression());
  
  app.use(globalRateLimit);
  app.use('/api/auth', authRateLimit);
  app.use('/api/payment', paymentRateLimit);
  app.use('/api/order/create', orderRateLimit);

  app.getHttpAdapter().get('/health', (req: Request, res: Response) => {
    res.send('OK');
  });

  function assertEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Environment variable ${name} is missing.`);
    }
    return value;
  }

  const APP_GLOBAL_SECRET = assertEnvVar('APP_GLOBAL_SECRET');
  if (!APP_GLOBAL_SECRET) {
    const errorMessage =
      '❌ CRITICAL: APP_GLOBAL_SECRET is missing. Cannot start the server.';
    logger.error(errorMessage);

    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
  app.set('secret', APP_GLOBAL_SECRET);

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
        // This helper function recursively formats validation errors
        const formatErrors = (validationErrors: any[]) => {
          return validationErrors.map((error) => {
            if (error.children && error.children.length > 0) {
              return {
                property: error.property,
                children: formatErrors(error.children), // Recursively call formatErrors for children
              };
            }
            // For individual errors, get the constraint messages
            return {
              property: error.property,
              constraints: error.constraints, // Keep the original constraints object for debugging
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

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
import helmet from 'helmet';
import compression from 'compression';
import * as bodyParser from 'body-parser';
import {
  globalRateLimit,
  paymentRateLimit,
  orderRateLimit,
  orderFetchingLimit,
  schoolCodeRateLimit,
  joinSchoolRateLimit,
} from './rateLimiting.middleware';

/** Everything `main.ts` applies to the HTTP app, shared so integration tests exercise the real pipeline. */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  const logger = new Logger('Bootstrap');

  app.use('/api/payment/webhook', bodyParser.raw({ type: 'application/json' }));

  // The payment slip is posted as a base64 image, so only that route gets a large JSON body. Everything else is
  // small; a tight default stops a few oversized requests from tying up memory during a rush.
  app.use('/api/payment/verify', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? '256kb' }));

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
      'Idempotency-Key',
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
}

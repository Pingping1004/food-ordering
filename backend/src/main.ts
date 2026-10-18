import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { configureApp } from './app.setup';

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

  configureApp(app);
  const logger = new Logger('Bootstrap');

  // A stray rejected promise (e.g. a failed push notification) must not take the API down mid-lunch-rush: log it.
  process.on('unhandledRejection', (reason) => {
    logger.error('UNHANDLED REJECTION (process kept alive):', reason);
  });

  // After an uncaught exception state is undefined, so restart, but drain in-flight requests first (the host restarts us).
  let shuttingDown = false;
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION, shutting down gracefully:', err);
    if (shuttingDown) return;
    shuttingDown = true;
    setTimeout(() => process.exit(1), 10_000).unref();
    app.close().finally(() => process.exit(1));
  });

  const port = process.env.PORT || 4000;
  logger.log('NESTJS is running on port: ', port);
  await app.listen(port);
}
bootstrap();

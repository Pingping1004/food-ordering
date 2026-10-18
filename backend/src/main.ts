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

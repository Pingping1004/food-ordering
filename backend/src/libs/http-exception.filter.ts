import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch() // Catch ALL exceptions
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | object | null = null;

    const origin = request.headers.origin;

    const allowedOrigins = [
      'https://promptserve.online',
      'https://api.promptserve.online',
      'https://promptserve-mvp.onrender.com',
      'https://localhost:8000',
      process.env.FRONTEND_BASE_URL,
      process.env.NEXT_PUBLIC_BACKEND_API_URL,
      process.env.WEBHOOK_ENDPOINT,
    ].map((origin) => origin?.replace(/\/$/, ''));

    if (origin && allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      response.header('Access-Control-Allow-Origin', origin);
      response.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Authorization, x-order-secret',
      );
      response.header(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Expected 4xx (validation, 404, 403, 429...) are normal traffic: one short line, no stack. A flood of them
      // during a lunch rush used to write two stack-traced ERROR entries per request.
      if (status >= 500) {
        this.logger.error('HttpException Caught:', exception);
      } else {
        this.logger.warn(
          `${request.method} ${request.url} -> ${status} ${exception.message}`,
        );
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, any>;

        return response.status(status).json({
          statusCode: status,
          ...res, // preserve other necessary fields like code
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errors = [exceptionResponse];
      }
    } else if (exception instanceof Error) {
      // Express middleware errors (body-parser 413 / malformed JSON 400) carry their own 4xx status.
      const e = exception as Error & { status?: number; statusCode?: number };
      const carried = e.status ?? e.statusCode;
      if (typeof carried === 'number' && carried >= 400 && carried < 500) {
        status = carried;
        message = status === 413 ? 'Request body too large' : 'Bad request';
        this.logger.warn(`${request.method} ${request.url} -> ${status} ${exception.message}`);
      } else {
        this.logger.error(
          'Unhandled JavaScript Error Caught by Filter:',
          exception,
        );
        // Never echo internal error text (Prisma/SQL/stack details) to the client.
        message = 'Internal server error';
        status = HttpStatus.INTERNAL_SERVER_ERROR;
      }
    } else {
      this.logger.error('Truly Unknown Exception Caught by Filter:', exception);

      message = 'An unknown error occurred.';
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    response.status(status).json({
      statusCode: status,
      message,
      errors: status >= 500 ? null : errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

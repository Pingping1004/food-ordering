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
      response.header('Access-Control-Allow-Credentials', 'true');
      response.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Authorization, X-CSRF-Token, x-csrf-token, XSRF-TOKEN, x-xsrf-token',
      );
      response.header(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      response.header('Access-Control-Expose-Headers', 'Set-Cookie');
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      this.logger.error('HttpException Caught:', exception);
      this.logger.error('Exception Response:', exceptionResponse);

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
      this.logger.error(
        'Unhandled JavaScript Error Caught by Filter:',
        exception,
      );

      message = exception.message || 'An unexpected error occurred.';
      errors = [message];
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    } else {
      this.logger.error('Truly Unknown Exception Caught by Filter:', exception);

      message = 'An unknown error occurred.';
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    response.status(status).json({
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
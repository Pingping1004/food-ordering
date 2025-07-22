import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch() // Catch ALL exceptions
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | object | null = null; // To hold validation messages

    const origin = request.headers.origin;

    const allowedOrigins = [
      'https://food-ordering.online',
      'https://food-ordering-mvp.onrender.com',
      process.env.FRONTEND_BASE_URL,
      process.env.NEXT_PUBLIC_BACKEND_API_URL,
      process.env.WEBHOOK_ENDPOINT,
    ].map((origin) => origin?.replace(/\/$/, ''));

    if (origin && allowedOrigins.includes(origin.replace(/\$/, ''))) {
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

      // Log the full exception object for debugging
      this.logger.error(`HttpException Caught:`, exception);
      this.logger.error(`Exception Response:`, exceptionResponse);

      // Handle ValidationPipe's BadRequestException format (often an array of strings)
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const msg = (exceptionResponse as any).message;
        if (Array.isArray(msg)) {
          message = 'Validation Failed'; // General message
          errors = msg; // Detailed validation errors
        } else {
          message = msg; // Single string message (e.g., from ParseFilePipe)
          errors = [msg];
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errors = [exceptionResponse];
      }
    } else if (exception instanceof Error) {
      // Catch generic JavaScript Errors (e.g., TypeError, ReferenceError)
      this.logger.error(
        'Unhandled JavaScript Error Caught by Filter:',
        exception,
      );
      message = exception.message || 'An unexpected error occurred.';
      errors = [message];
      status = HttpStatus.INTERNAL_SERVER_ERROR; // Default to 500 for generic errors
    } else {
      // Catch truly unknown exceptions
      this.logger.error('Truly Unknown Exception Caught by Filter:', exception);
      message = 'An unknown error occurred.';
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // Always send back a structured error response
    response.status(status).json({
      statusCode: status,
      message: message,
      errors: errors, // This field will contain specific validation messages
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

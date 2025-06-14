// src/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch() // Catch ALL exceptions
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | object | null = null; // To hold validation messages

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Log the full exception object for debugging
      console.error(`HttpException Caught:`, exception);
      console.error(`Exception Response:`, exceptionResponse);

      // Handle ValidationPipe's BadRequestException format (often an array of strings)
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse) {
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
      console.error('Unhandled JavaScript Error Caught by Filter:', exception);
      message = exception.message || 'An unexpected error occurred.';
      errors = [message];
      status = HttpStatus.INTERNAL_SERVER_ERROR; // Default to 500 for generic errors
    } else {
      // Catch truly unknown exceptions
      console.error('Truly Unknown Exception Caught by Filter:', exception);
      message = 'An unknown error occurred.';
      errors = null; // No specific error details
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
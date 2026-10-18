import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

/** Status carried by non-Nest errors raised by Express middleware (body-parser's 413 / malformed-JSON 400, ...). */
const clientErrorStatus = (exception: unknown): number | null => {
  const e = exception as { status?: unknown; statusCode?: unknown; expose?: unknown };
  const status = typeof e?.status === 'number' ? e.status : e?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
};

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  private readonly logger = new Logger(CatchEverythingFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : (clientErrorStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR);

    // Unexpected failures were previously swallowed with no trace. Log them (message + stack only, never the request body).
    if (httpStatus >= 500) {
      const err = exception as Error;
      this.logger.error(
        `${ctx.getRequest().method} ${httpAdapter.getRequestUrl(ctx.getRequest())} -> ${httpStatus}: ${err?.message}`,
        err?.stack,
      );
    }

    const responseBody = {
      statusCode: httpStatus,
      message:
        httpStatus >= 500
          ? 'Internal server error'
          : httpStatus === 413
            ? 'Request body too large'
            : 'Bad request',
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

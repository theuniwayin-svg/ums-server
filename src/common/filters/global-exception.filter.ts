import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = `HTTP_${status}`;
      } else {
        message = Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message.join('; ')
          : exceptionResponse.message || exception.message;
        code = exceptionResponse.code || `HTTP_${status}`;
        details = exceptionResponse.details;
      }
    } else if (
      exception &&
      typeof exception === 'object' &&
      (exception as any).code === 11000
    ) {
      // MongoDB duplicate key error
      status = HttpStatus.CONFLICT;
      code = 'DUPLICATE_KEY';
      message = 'A record with this value already exists';
      details = { keyPattern: (exception as any).keyPattern };
    } else {
      this.logger.error(`Unhandled exception at ${request.method} ${request.url}`);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    });
  }
}

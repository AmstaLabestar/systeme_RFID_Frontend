import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

function extractMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);

    if (messages.length > 0) {
      return messages.join(' | ');
    }
  }

  if (value && typeof value === 'object') {
    const candidate = (value as Record<string, unknown>).message;
    return extractMessage(candidate, fallback);
  }

  return fallback;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const defaultMessage =
      statusCode >= 500 ? 'Une erreur interne est survenue.' : 'Requete invalide.';

    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const message = extractMessage(exceptionResponse, defaultMessage);

    const body: ErrorBody = {
      statusCode,
      message,
      error: HttpStatus[statusCode] || 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (statusCode >= 500) {
      const errorForLog =
        exception instanceof Error
          ? exception.stack ?? exception.message
          : JSON.stringify(exception);

      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode} | ${message}`,
        errorForLog,
      );
    }

    response.status(statusCode).json(body);
  }
}

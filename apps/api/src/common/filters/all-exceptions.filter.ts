import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

// Database errors a client can cause, mapped to a 4xx with a generic message.
// Prisma's own message names tables and values, so it is never passed through.
const PRISMA_CLIENT_ERRORS: Record<string, { status: HttpStatus; message: string; error: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'A record with this value already exists', error: 'Conflict' },
  P2003: { status: HttpStatus.BAD_REQUEST, message: 'A referenced record does not exist', error: 'BadRequest' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found', error: 'NotFound' },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const prismaError =
      exception instanceof Prisma.PrismaClientKnownRequestError ? PRISMA_CLIENT_ERRORS[exception.code] : undefined;
    const status = isHttpException
      ? exception.getStatus()
      : (prismaError?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    let message: string | string[] = prismaError?.message ?? 'Internal server error';
    let error = prismaError?.error ?? 'InternalServerError';

    if (prismaError && exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.warn(`${request.method} ${request.url} -> ${status} (Prisma ${exception.code})`);
    }

    if (isHttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;
        message = (record.message as string | string[]) ?? exception.message;
        error = (record.error as string) ?? exception.name;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

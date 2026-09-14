import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown): { status: number; body: Record<string, unknown> } {
  const result = { status: 0, body: {} as Record<string, unknown> };
  const response = {
    status: (code: number) => {
      result.status = code;
      return response;
    },
    json: (body: Record<string, unknown>) => {
      result.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'PATCH', url: '/api/admin/products/p1' }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return result;
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`sku`) value SECRET-SKU', {
    code,
    clientVersion: 'test',
  });
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps a unique constraint violation to 409 without echoing Prisma detail', () => {
    const { status, body } = run(prismaError('P2002'));
    expect(status).toBe(409);
    expect(JSON.stringify(body)).not.toContain('SECRET-SKU');
    expect(JSON.stringify(body)).not.toContain('sku');
  });

  it('maps a missing record to 404 and a broken reference to 400', () => {
    expect(run(prismaError('P2025')).status).toBe(404);
    expect(run(prismaError('P2003')).status).toBe(400);
  });

  it('keeps unknown database errors as a generic 500 with no stack in the body', () => {
    const { status, body } = run(new Error('Transaction already closed: internal detail'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('Transaction');
    expect(body).not.toHaveProperty('stack');
    expect(run(prismaError('P2034')).status).toBe(500);
  });

  it('passes HttpException responses through unchanged', () => {
    const { status, body } = run(new BadRequestException('Variant does not belong to this product'));
    expect(status).toBe(400);
    expect(body.message).toBe('Variant does not belong to this product');
  });
});

import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const run = (exception: unknown) => {
  const res: any = { statusCode: 0, headers: {} as Record<string, string>, body: undefined as any };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  res.header = () => res;
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  const host: any = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ headers: {}, method: 'POST', url: '/api/x' }) }) };
  new HttpExceptionFilter().catch(exception, host);
  return res;
};

describe('HttpExceptionFilter', () => {
  it('should answer 503 with Retry-After when the DB cannot start a transaction in time (P2028)', () => {
    const res = run(Object.assign(new Error('Transaction API error: Unable to start a transaction in the given time.'), { code: 'P2028' }));
    expect(res.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.headers['Retry-After']).toBe('2');
  });

  it('should answer 503 on pool exhaustion (P2024) and pg connect timeouts', () => {
    expect(run(Object.assign(new Error('x'), { code: 'P2024' })).statusCode).toBe(503);
    expect(run(new Error('timeout exceeded when trying to connect')).statusCode).toBe(503);
  });

  it('should never echo internal error text for unexpected 500s', () => {
    const res = run(new Error('relation "Order" does not exist at /srv/app/secret.ts'));
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('Order');
    expect(JSON.stringify(res.body)).not.toContain('secret.ts');
  });

  it('should pass a middleware 4xx (payload too large) through instead of 500', () => {
    const res = run(Object.assign(new Error('request entity too large'), { status: 413 }));
    expect(res.statusCode).toBe(413);
  });

  it('should keep Nest HTTP exceptions as they are', () => {
    expect(run(new NotFoundException('nope')).statusCode).toBe(404);
    expect(run(new BadRequestException('bad')).statusCode).toBe(400);
  });
});

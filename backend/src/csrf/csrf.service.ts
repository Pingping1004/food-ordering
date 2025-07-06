// src/common/utils/csrf.util.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfTokenService {
  private readonly CSRF_SECRET: string;

  constructor() {
    const envSecret = process.env.CSRF_SECRET;

    if (!envSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('CRITICAL ERROR: CSRF_SECRET is not defined in production environment!');
        process.exit(1); // Exit process in production if critical secret is missing
      } else {
        console.warn('WARNING: CSRF_SECRET is not defined. Using a fallback for development only.');
      }
    } else {
      this.CSRF_SECRET = envSecret;
    }

    if (this.CSRF_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
      console.warn('SECURITY WARNING: CSRF_SECRET is too short. It should be at least 32 characters for production.');
    }
  }

  generateToken(): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const token = crypto.createHmac('sha256', this.CSRF_SECRET)
      .update(salt)
      .digest('hex');
    return `${salt}-${token}`;
  }

  verifyToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('-');
    if (parts.length !== 2) {
      return false;
    }

    const salt = parts[0];
    const incomingTokenHash = parts[1];

    const expectedTokenHash = crypto.createHmac('sha256', this.CSRF_SECRET)
      .update(salt)
      .digest('hex');

    return this.timingSafeEqual(Buffer.from(incomingTokenHash), Buffer.from(expectedTokenHash));
  }

  private timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }
}
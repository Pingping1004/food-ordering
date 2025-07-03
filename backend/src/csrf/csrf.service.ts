// src/common/utils/csrf.util.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfTokenService {
  private readonly CSRF_SECRET: string;

  constructor() {
    // We safely extract the environment variable first.
    const envSecret = process.env.CSRF_SECRET;

    if (!envSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('CRITICAL ERROR: CSRF_SECRET is not defined in production environment!');
        process.exit(1); // Exit process in production if critical secret is missing
      } else {
        console.warn('WARNING: CSRF_SECRET is not defined. Using a fallback for development only.');
        // For development, provide a fallback.
        // Make sure this fallback is ONLY for dev and never used in production.
        this.CSRF_SECRET = 'dev_only_very_long_secret_for_csrf_fallback_CHANGE_ME_IN_PROD';
      }
    } else {
      // If the environment variable is set, assign it directly.
      this.CSRF_SECRET = envSecret;
    }

    // Optional: Add a check for secret length for better security in production
    if (this.CSRF_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
      console.warn('SECURITY WARNING: CSRF_SECRET is too short. It should be at least 32 characters for production.');
    }
  }

  /**
   * Generates a new CSRF token.
   * The token combines a random salt with an HMAC, separated by a hyphen.
   */
  generateToken(): string {
    const salt = crypto.randomBytes(16).toString('hex'); // Generate a random salt
    const token = crypto.createHmac('sha256', this.CSRF_SECRET)
                        .update(salt) // Hash the salt with the secret
                        .digest('hex');
    return `${salt}-${token}`; // Return salt and hash joined
  }

  /**
   * Verifies an incoming CSRF token.
   * It extracts the salt and recreates the expected hash to compare.
   */
  verifyToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false; // Token is missing or not a string
    }

    const parts = token.split('-');
    if (parts.length !== 2) {
      return false; // Token format is invalid (should be salt-hash)
    }

    const salt = parts[0];
    const incomingTokenHash = parts[1];

    // Recreate the expected hash using the extracted salt and secret
    const expectedTokenHash = crypto.createHmac('sha256', this.CSRF_SECRET)
                                    .update(salt)
                                    .digest('hex');

    // Use a timing-safe comparison to prevent timing attacks
    return this.timingSafeEqual(Buffer.from(incomingTokenHash), Buffer.from(expectedTokenHash));
  }

  /**
   * Performs a timing-safe comparison of two buffers.
   * Prevents timing attacks where an attacker might infer information
   * about the secret by measuring response times.
   */
  private timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i]; // XOR operation sets bits where they differ
    }
    return result === 0; // If result is 0, buffers are identical
  }
}
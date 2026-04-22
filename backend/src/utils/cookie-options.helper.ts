import { CookieOptions } from 'express';

const isProd = process.env.NODE_ENV === 'production';
const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || (isProd ? '.promptserve.online' : undefined);

export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 30 * 60 * 1000,
  // maxAge: 60 * 1000,
  path: '/',
  domain: cookieDomain,
};

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 60 * 60 * 24 * 1000,
  path: '/',
  domain: cookieDomain,
};

export const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  domain: cookieDomain,
};

export const clearAccessToken: CookieOptions = {
  path: '/',
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  domain: cookieDomain,
};

export const clearRefreshToken: CookieOptions = {
  path: '/',
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  domain: cookieDomain,
};
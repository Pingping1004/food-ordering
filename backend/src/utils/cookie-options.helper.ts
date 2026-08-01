import { CookieOptions } from 'express';

const isProd = process.env.NODE_ENV === 'production';
const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || (isProd ? '.promptserve.online' : undefined);
const cookieSecure = isProd ? true : false;
const cookieSameSite = isProd ? 'none' : 'lax';

const baseOptions: Partial<CookieOptions> = isProd
  ? {}
  : { secure: cookieSecure, sameSite: cookieSameSite, domain: undefined };

export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 30 * 60 * 1000,
  path: '/',
  domain: cookieDomain,
  ...baseOptions,
};

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 7 * 60 * 60 * 24 * 1000,
  path: '/',
  domain: cookieDomain,
  ...baseOptions,
};

export const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  domain: cookieDomain,
  ...baseOptions,
};

export const clearAccessToken: CookieOptions = {
  path: '/',
  secure: cookieSecure,
  sameSite: cookieSameSite,
  domain: cookieDomain,
  ...baseOptions,
};

export const clearRefreshToken: CookieOptions = {
  path: '/',
  secure: cookieSecure,
  sameSite: cookieSameSite,
  domain: cookieDomain,
  ...baseOptions,
};

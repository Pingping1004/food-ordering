import { CookieOptions } from 'express';

const isProd = process.env.NODE_ENV === 'production';

export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  // maxAge: 30 * 60 * 1000,
  maxAge: 60 * 1000,
  path: '/',
  domain: isProd ? '.promptserve.online' : undefined,
};

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 2 * 60 * 1000,
  path: '/',
  domain: isProd ? '.promptserve.online' : undefined,
};

export const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  domain: isProd ? '.promptserve.online' : undefined,
};

export const clearAccessToken: CookieOptions = {
  path: '/',
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  domain: isProd ? '.promptserve.online' : undefined,
};

export const clearRefreshToken: CookieOptions = {
  path: '/',
  secure: true,
  sameSite: isProd ? 'none' : 'lax',
  domain: isProd ? '.promptserve.online' : undefined,
};
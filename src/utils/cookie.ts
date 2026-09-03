import { type  Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { TokenServices } from '@/services/index.js';
import { config } from '@/config/config.js';

export function setAuthCookies(
  c: Context,
  tokens: Awaited<ReturnType<typeof TokenServices.generateAuthTokens>>,
) {
  const isProd = config.env === "production";
  setCookie(c, "accessToken", tokens.access.token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/v1",
    maxAge: 60 * 60 // 60 minutes,
  });

  setCookie(c, "refreshToken", tokens.refresh.token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/v1",
    maxAge: 60 * 60 * 24 * 7 // 7 days,
  });
}

export function clearAuthCookies(c: Context) {
  deleteCookie(c, "accessToken", { path: "/v1" });
  deleteCookie(c, "refreshToken", { path: "/v1" });
}

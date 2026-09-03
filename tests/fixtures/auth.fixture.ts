// tests/fixtures/auth.fixture.ts
import dayjs from "dayjs";
import { TokenServices } from "@/services/index.js";
import { TokenTypes } from "@/models/token.js";

export async function getAccessToken(userId: string) {
  return TokenServices.generateToken(userId, dayjs().add(60, "minutes"), TokenTypes.ACCESS);
}

export function authCookieHeader(accessToken: string) {
  return { Cookie: `accessToken=${accessToken}` };
}
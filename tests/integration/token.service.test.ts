import { describe, it, expect } from "bun:test";
import dayjs from "dayjs";
import { decode } from "hono/jwt";
import { TokenServices } from "@/services/index.js";
import { prisma } from "../setup/db-setup.js";
import { withCleanDb } from "../setup/reset-db.js";
import { TokenTypes } from "@/models/token.js";
import { insertUser } from "../fixtures/user.fixture.js";

describe("TokenService", () => {
  withCleanDb();

  describe("generateToken", () => {
    it("menghasilkan JWT dengan payload sub, type, exp yang benar", async () => {
      const expires = dayjs().add(30, "minutes");
      const token = await TokenServices.generateToken("user-1", expires, TokenTypes.ACCESS);

      const { payload } = decode(token);
      expect(payload.sub).toBe("user-1");
      expect(payload.type).toBe(TokenTypes.ACCESS);
      expect(payload.exp).toBe(expires.unix());
    });

    it("menggunakan secret custom jika diberikan (untuk kasus generate token dengan secret berbeda)", async () => {
      const expires = dayjs().add(10, "minutes");
      const token = await TokenServices.generateToken("user-1", expires, TokenTypes.ACCESS, "custom-secret");

      const { payload } = decode(token);
      expect(payload.sub).toBe("user-1");
      await expect(TokenServices.verifyToken(token, TokenTypes.ACCESS)).rejects.toBeDefined();
    });
  });

  describe("saveToken", () => {
    it("menyimpan token ke DB dengan field yang sesuai, default blacklisted=false", async () => {
      const { user } = await insertUser();
      const expires = dayjs().add(7, "days");
      const token = await TokenServices.generateToken(user.id, expires, TokenTypes.REFRESH);

      const saved = await TokenServices.saveToken({ token, userId: user.id, expires, type: TokenTypes.REFRESH });

      expect(saved.token).toBe(token);
      expect(saved.blacklisted).toBe(false);
      expect(saved.expires.getTime()).toBe(expires.toDate().getTime());

      const inDb = await prisma.token.findUnique({ where: { id: saved.id } });
      expect(inDb).not.toBeNull();
    });

    it("menyimpan newEmail jika diberikan (kasus token update email)", async () => {
      const { user } = await insertUser();
      const expires = dayjs().add(5, "minutes");
      const token = await TokenServices.generateToken(user.id, expires, TokenTypes.VERIFY_EMAIL);

      const saved = await TokenServices.saveToken({
        token,
        userId: user.id,
        expires,
        type: TokenTypes.VERIFY_EMAIL,
        newEmail: "baru@gmail.com",
      });

      expect(saved.newEmail).toBe("baru@gmail.com");
    });
  });

  describe("verifyToken", () => {
    it("mengembalikan token doc jika token valid & ada di DB", async () => {
      const { user } = await insertUser();
      const tokens = await TokenServices.generateAuthTokens(user.id);

      const result = await TokenServices.verifyToken(tokens.refresh.token, TokenTypes.REFRESH);
      expect(result.userId).toBe(user.id);
    });

    it("throw UNAUTHORIZED jika token tidak pernah disimpan ke DB", async () => {
      const { user } = await insertUser();
      const token = await TokenServices.generateToken(user.id, dayjs().add(1, "day"), TokenTypes.REFRESH);

      await expect(TokenServices.verifyToken(token, TokenTypes.REFRESH)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throw UNAUTHORIZED jika type token tidak cocok (mis. ACCESS dipakai sebagai REFRESH)", async () => {
      const { user } = await insertUser();
      const expires = dayjs().add(1, "day");
      const token = await TokenServices.generateToken(user.id, expires, TokenTypes.ACCESS);
      await TokenServices.saveToken({ token, userId: user.id, expires, type: TokenTypes.ACCESS });

      await expect(TokenServices.verifyToken(token, TokenTypes.REFRESH)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throw UNAUTHORIZED jika token sudah expired secara JWT (verify signature gagal duluan)", async () => {
      const { user } = await insertUser();
      const expires = dayjs().subtract(1, "minute");
      const token = await TokenServices.generateToken(user.id, expires, TokenTypes.REFRESH);
      await TokenServices.saveToken({ token, userId: user.id, expires, type: TokenTypes.REFRESH });

      await expect(TokenServices.verifyToken(token, TokenTypes.REFRESH)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throw UNAUTHORIZED jika token blacklisted", async () => {
      const { user } = await insertUser();
      const expires = dayjs().add(1, "day");
      const token = await TokenServices.generateToken(user.id, expires, TokenTypes.REFRESH);
      await TokenServices.saveToken({ token, userId: user.id, expires, type: TokenTypes.REFRESH, blacklisted: true });

      await expect(TokenServices.verifyToken(token, TokenTypes.REFRESH)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throw UNAUTHORIZED jika string token asal/malformed", async () => {
      await expect(
        TokenServices.verifyToken("bukan.jwt.valid", TokenTypes.ACCESS),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe("generateAuthTokens", () => {
    it("menghasilkan access + refresh token dengan expiry sesuai config, hanya refresh tersimpan di DB", async () => {
      const { user } = await insertUser();
      const before = dayjs();
      const tokens = await TokenServices.generateAuthTokens(user.id);

      expect(tokens.access.token).toBeDefined();
      expect(tokens.refresh.token).toBeDefined();

      const accessExpiresMinutes = dayjs(tokens.access.expires).diff(before, "minutes");
      expect(accessExpiresMinutes).toBeGreaterThanOrEqual(59);
      expect(accessExpiresMinutes).toBeLessThanOrEqual(60);

      const refreshInDb = await prisma.token.findFirst({
        where: { token: tokens.refresh.token, type: TokenTypes.REFRESH },
      });
      expect(refreshInDb).not.toBeNull();

      const accessInDb = await prisma.token.findFirst({ where: { token: tokens.access.token } });
      expect(accessInDb).toBeNull();
    });
  });

  // describe("generateVerifyEmailToken", () => {
  //   it("menghapus token VERIFY_EMAIL lama sebelum membuat yang baru (hanya 1 token aktif per user)", async () => {
  //     const { user } = await insertUser();
  //     const first = await TokenServices.generateVerifyEmailToken(user.id);
  //     const second = await TokenServices.generateVerifyEmailToken(user.id);

  //     const tokensInDb = await prisma.token.findMany({ where: { userId: user.id, type: TokenTypes.VERIFY_EMAIL } });

  //     expect(tokensInDb.length).toBe(1);
  //     expect(tokensInDb[0].token).toBe(second);
  //     expect(tokensInDb[0].token).not.toBe(first);
  //   });

  //   it("tidak mengganggu token tipe lain milik user yang sama", async () => {
  //     const { user } = await insertUser();
  //     await TokenServices.generateAuthTokens(user.id);
  //     await TokenServices.generateVerifyEmailToken(user.id);

  //     const refreshCount = await prisma.token.count({ where: { userId: user.id, type: TokenTypes.REFRESH } });
  //     expect(refreshCount).toBe(1);
  //   });
  // });

  // describe("generateResetPasswordToken", () => {
  //   it("menghapus token RESET_PASSWORD lama sebelum membuat yang baru", async () => {
  //     const { user } = await insertUser();
  //     await TokenServices.generateResetPasswordToken(user.id);
  //     await TokenServices.generateResetPasswordToken(user.id);

  //     const count = await prisma.token.count({ where: { userId: user.id, type: TokenTypes.RESET_PASSWORD } });
  //     expect(count).toBe(1);
  //   });
  // });
});
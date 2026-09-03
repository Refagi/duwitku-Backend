import { describe, it, expect } from "bun:test";
import app from "@/app.js";
import { prisma } from "../setup/db-setup.js";
import { withCleanDb } from "../setup/reset-db.js";
import { insertUser } from "../fixtures/user.fixture.js";
import { insertAccount } from "../fixtures/account.fixture.js";
import { insertCategory } from "../fixtures/category.fixture.js";
import { insertTransaction } from "../fixtures/transaction.fixture.js";
import { getAccessToken, authCookieHeader } from "../fixtures/auth.fixture.js";
import * as HttpStatusCodes from "stoker/http-status-codes";

async function createTransactionViaApi(
  token: string,
  body: {
    accountId: string;
    categoryId: string;
    type: "INCOME" | "EXPENSE";
    amount: number;
    date?: string;
    note?: string;
  },
) {
  const res = await app.request("/v1/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authCookieHeader(token) },
    body: JSON.stringify({ date: new Date().toISOString(), ...body }),
  });
  return res;
}

describe("Transaction routes", () => {
  withCleanDb();

  describe("GET /v1/transactions", () => {
    it("401 tanpa token", async () => {
      const res = await app.request("/v1/transactions");
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED);
    });

    it("200 hanya mengembalikan transaksi milik user sendiri, urut date desc", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);
      const otherAccount = await insertAccount(otherUser.id);
      const otherCategory = await insertCategory(otherUser.id);

      const old = await insertTransaction(user.id, account.id, category.id, {
        date: new Date("2026-01-01"),
      });
      const recent = await insertTransaction(user.id, account.id, category.id, {
        date: new Date("2026-06-01"),
      });
      await insertTransaction(otherUser.id, otherAccount.id, otherCategory.id);

      const res = await app.request("/v1/transactions", { headers: authCookieHeader(token) });

      expect(res.status).toBe(HttpStatusCodes.OK);
      const body = await res.json();
      expect(body.data.total).toBe(2);
      expect(body.data.data.map((t: any) => t.id)).toEqual([recent.id, old.id]);
    });

    it("200 filter berdasarkan accountId, categoryId, dan type", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const accountA = await insertAccount(user.id, { name: "A" });
      const accountB = await insertAccount(user.id, { name: "B" });
      const category = await insertCategory(user.id);

      const target = await insertTransaction(user.id, accountA.id, category.id, { type: "INCOME" });
      await insertTransaction(user.id, accountB.id, category.id, { type: "EXPENSE" });

      const res = await app.request(
        `/v1/transactions?accountId=${accountA.id}&type=INCOME`,
        { headers: authCookieHeader(token) },
      );

      const body = await res.json();
      expect(body.data.data.length).toBe(1);
      expect(body.data.data[0].id).toBe(target.id);
    });

    it("200 filter berdasarkan rentang tanggal (from/to)", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);

      await insertTransaction(user.id, account.id, category.id, { date: new Date("2026-01-01") });
      const inRange = await insertTransaction(user.id, account.id, category.id, { date: new Date("2026-03-15") });
      await insertTransaction(user.id, account.id, category.id, { date: new Date("2026-06-01") });

      const res = await app.request(
        "/v1/transactions?from=2026-03-01&to=2026-03-31",
        { headers: authCookieHeader(token) },
      );

      const body = await res.json();
      expect(body.data.data.length).toBe(1);
      expect(body.data.data[0].id).toBe(inRange.id);
    });

    it("200 filter berdasarkan rentang nominal (minAmount/maxAmount)", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);

      await insertTransaction(user.id, account.id, category.id, { amount: 10000 });
      const mid = await insertTransaction(user.id, account.id, category.id, { amount: 50000 });
      await insertTransaction(user.id, account.id, category.id, { amount: 200000 });

      const res = await app.request(
        "/v1/transactions?minAmount=20000&maxAmount=100000",
        { headers: authCookieHeader(token) },
      );

      const body = await res.json();
      expect(body.data.data.length).toBe(1);
      expect(body.data.data[0].id).toBe(mid.id);
    });

    it("200 pencarian note (q) case-insensitive", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);

      const match = await insertTransaction(user.id, account.id, category.id, { note: "Beli Kopi Susu" });
      await insertTransaction(user.id, account.id, category.id, { note: "Bensin motor" });

      const res = await app.request("/v1/transactions?q=kopi", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.data.length).toBe(1);
      expect(body.data.data[0].id).toBe(match.id);
    });

    it("200 pagination page & limit", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);

      for (let i = 0; i < 5; i++) {
        await insertTransaction(user.id, account.id, category.id, { date: new Date(2026, 0, i + 1) });
      }

      const res = await app.request("/v1/transactions?page=2&limit=2", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.data.length).toBe(2);
      expect(body.data.total).toBe(5);
      expect(body.data.page).toBe(2);
      expect(body.data.limit).toBe(2);
    });
  });

  describe("POST /v1/transactions", () => {
    it("201 dan saldo dompet bertambah untuk type INCOME", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { balance: 100000 });
      const category = await insertCategory(user.id, { type: "INCOME" });

      const res = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "INCOME",
        amount: 50000,
      });

      expect(res.status).toBe(HttpStatusCodes.CREATED);
      const updatedAccount = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(updatedAccount!.balance)).toBe(150000);
    });

    it("201 dan saldo dompet berkurang untuk type EXPENSE", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { balance: 100000 });
      const category = await insertCategory(user.id, { type: "EXPENSE" });

      const res = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 30000,
      });

      expect(res.status).toBe(HttpStatusCodes.CREATED);
      const updatedAccount = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(updatedAccount!.balance)).toBe(70000);
    });

    it("404 jika accountId bukan milik sendiri", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);
      const otherAccount = await insertAccount(otherUser.id);
      const category = await insertCategory(user.id);

      const res = await createTransactionViaApi(token, {
        accountId: otherAccount.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 10000,
      });

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND);
    });

    it("404 jika categoryId bukan milik sendiri", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const otherCategory = await insertCategory(otherUser.id);

      const res = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: otherCategory.id,
        type: "EXPENSE",
        amount: 10000,
      });

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND);
    });

    it("400 jika amount <= 0", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);

      const res = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: -5000,
      });

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST);
    });

    it("gagal create tidak mengubah saldo sama sekali (atomicity)", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { balance: 100000 });
      const otherCategory = await insertCategory(otherUser.id); // bukan milik sendiri -> gagal

      await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: otherCategory.id,
        type: "EXPENSE",
        amount: 10000,
      });

      const unchanged = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(unchanged!.balance)).toBe(100000);
    });
  });

  describe("PUT /v1/transactions/:id", () => {
    it("200, saldo disesuaikan net delta jika dompet tidak berubah", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { balance: 100000 });
      const category = await insertCategory(user.id, { type: "EXPENSE" });

      const createRes = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 20000,
      });
      const { data } = await createRes.json();
      // saldo sekarang: 100000 - 20000 = 80000

      const res = await app.request(`/v1/transactions/${data.transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 50000 }),
      });

      expect(res.status).toBe(HttpStatusCodes.OK);
      const body = await res.json();
      expect(body.data.transaction.isEdited).toBe(true);

      const updatedAccount = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(updatedAccount!.balance)).toBe(50000);
    });

    it("200, saldo dipindah dengan benar jika accountId diganti", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const accountOld = await insertAccount(user.id, { name: "Lama", balance: 100000 });
      const accountNew = await insertAccount(user.id, { name: "Baru", balance: 50000 });
      const category = await insertCategory(user.id, { type: "EXPENSE" });

      const createRes = await createTransactionViaApi(token, {
        accountId: accountOld.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 20000,
      });
      const { data } = await createRes.json();

      const res = await app.request(`/v1/transactions/${data.transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authCookieHeader(token) },
        body: JSON.stringify({ accountId: accountNew.id }),
      });

      expect(res.status).toBe(HttpStatusCodes.OK);

      const oldAfter = await prisma.account.findUnique({ where: { id: accountOld.id } });
      const newAfter = await prisma.account.findUnique({ where: { id: accountNew.id } });
      expect(Number(oldAfter!.balance)).toBe(100000);
      expect(Number(newAfter!.balance)).toBe(30000);
    });

    it("409 jika transaksi sudah pernah diedit sebelumnya", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { balance: 100000 });
      const category = await insertCategory(user.id);

      const createRes = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 10000,
      });
      const { data } = await createRes.json();

      await app.request(`/v1/transactions/${data.transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 15000 }),
      });

      const secondEditRes = await app.request(`/v1/transactions/${data.transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 20000 }),
      });

      expect(secondEditRes.status).toBe(HttpStatusCodes.CONFLICT);
    });

    it("404 jika transaksi bukan milik sendiri", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);
      const otherAccount = await insertAccount(otherUser.id);
      const otherCategory = await insertCategory(otherUser.id);
      const otherTx = await insertTransaction(otherUser.id, otherAccount.id, otherCategory.id);

      const res = await app.request(`/v1/transactions/${otherTx.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 99999 }),
      });

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND);
    });

    it("404 jika accountId baru bukan milik sendiri", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);
      const otherAccount = await insertAccount(otherUser.id);

      const createRes = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 10000,
      });
      const { data } = await createRes.json();

      const res = await app.request(`/v1/transactions/${data.transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authCookieHeader(token) },
        body: JSON.stringify({ accountId: otherAccount.id }),
      });

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND);
    });
  });

  describe("DELETE /v1/transactions/:id", () => {
    it("200 dan saldo dikembalikan (reverse) untuk EXPENSE", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { balance: 100000 });
      const category = await insertCategory(user.id, { type: "EXPENSE" });

      const createRes = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 30000,
      });
      const { data } = await createRes.json();

      const res = await app.request(`/v1/transactions/${data.transaction.id}`, {
        method: "DELETE",
        headers: authCookieHeader(token),
      });

      expect(res.status).toBe(HttpStatusCodes.OK);
      const found = await prisma.transaction.findUnique({ where: { id: data.transaction.id } });
      expect(found).toBeNull();

      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(accountAfter!.balance)).toBe(100000);
    });

    it("200 dan saldo dikembalikan (reverse) untuk INCOME", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { balance: 100000 });
      const category = await insertCategory(user.id, { type: "INCOME" });

      const createRes = await createTransactionViaApi(token, {
        accountId: account.id,
        categoryId: category.id,
        type: "INCOME",
        amount: 40000,
      });
      const { data } = await createRes.json();

      const res = await app.request(`/v1/transactions/${data.transaction.id}`, {
        method: "DELETE",
        headers: authCookieHeader(token),
      });

      expect(res.status).toBe(HttpStatusCodes.OK);
      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } });
      expect(Number(accountAfter!.balance)).toBe(100000);
    });

    it("404 jika transaksi bukan milik sendiri", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);
      const otherAccount = await insertAccount(otherUser.id);
      const otherCategory = await insertCategory(otherUser.id);
      const otherTx = await insertTransaction(otherUser.id, otherAccount.id, otherCategory.id);

      const res = await app.request(`/v1/transactions/${otherTx.id}`, {
        method: "DELETE",
        headers: authCookieHeader(token),
      });

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND);
      const stillExists = await prisma.transaction.findUnique({ where: { id: otherTx.id } });
      expect(stillExists).not.toBeNull();
    });
  });
});
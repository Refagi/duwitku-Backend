import { describe, it, expect } from "bun:test";
import dayjs from "dayjs";
import app from "@/app.js";
import { withCleanDb } from "../setup/reset-db.js";
import { insertUser } from "../fixtures/user.fixture.js";
import { insertAccount } from "../fixtures/account.fixture.js";
import { insertCategory } from "../fixtures/category.fixture.js";
import { insertTransaction } from "../fixtures/transaction.fixture.js";
import { getAccessToken, authCookieHeader } from "../fixtures/auth.fixture.js";
import * as HttpStatusCodes from "stoker/http-status-codes";

describe("Dashboard routes", () => {
  withCleanDb();

  describe("GET /v1/dashboard/summary", () => {
    it("401 tanpa token", async () => {
      const res = await app.request("/v1/dashboard/summary");
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED);
    });

    it("200 dan totalBalance adalah jumlah saldo semua dompet milik sendiri saja", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);

      await insertAccount(user.id, { balance: 100000 });
      await insertAccount(user.id, { balance: 250000 });
      await insertAccount(otherUser.id, { balance: 999999 });

      const res = await app.request("/v1/dashboard/summary", { headers: authCookieHeader(token) });

      expect(res.status).toBe(HttpStatusCodes.OK);
      const body = await res.json();
      expect(body.data.totalBalance).toBe(350000);
    });

    it("200 income/expense hanya menghitung transaksi bulan berjalan", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);

      await insertTransaction(user.id, account.id, category.id, {
        type: "INCOME",
        amount: 500000,
        date: dayjs().date(1).toDate(),
      });
      await insertTransaction(user.id, account.id, category.id, {
        type: "EXPENSE",
        amount: 150000,
        date: dayjs().date(1).toDate(),
      });

      await insertTransaction(user.id, account.id, category.id, {
        type: "INCOME",
        amount: 9999999,
        date: dayjs().subtract(2, "months").toDate(),
      });

      const res = await app.request("/v1/dashboard/summary", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.income).toBe(500000);
      expect(body.data.expense).toBe(150000);
      expect(body.data.cashFlow).toBe(350000);
    });

    it("200 topExpenses maksimal 5 kategori, urut total tertinggi", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);

      const categoriesWithAmount = [
        { name: "Makan", amount: 300000 },
        { name: "Transport", amount: 250000 },
        { name: "Hiburan", amount: 200000 },
        { name: "Belanja", amount: 150000 },
        { name: "Tagihan", amount: 100000 },
        { name: "Lainnya", amount: 50000 },
      ];

      for (const c of categoriesWithAmount) {
        const category = await insertCategory(user.id, { name: c.name, type: "EXPENSE" });
        await insertTransaction(user.id, account.id, category.id, {
          type: "EXPENSE",
          amount: c.amount,
          date: dayjs().date(1).toDate(),
        });
      }

      const res = await app.request("/v1/dashboard/summary", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.topExpenses.length).toBe(5);
      expect(body.data.topExpenses[0]).toMatchObject({ categoryName: "Makan", total: 300000 });
      expect(body.data.topExpenses.map((t: any) => t.categoryName)).not.toContain("Lainnya");

      const totals = body.data.topExpenses.map((t: any) => t.total);
      expect(totals).toEqual([...totals].sort((a, b) => b - a));
    });

    it("200 recentTransactions maksimal 5, urut date desc, include account & category", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id, { name: "Dompet Utama" });
      const category = await insertCategory(user.id, { name: "Makan" });

      const created = [];
      for (let i = 0; i < 7; i++) {
        created.push(
          await insertTransaction(user.id, account.id, category.id, {
            date: dayjs().date(1).add(i, "hours").toDate(),
          }),
        );
      }

      const res = await app.request("/v1/dashboard/summary", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.recentTransactions.length).toBe(5);

      expect(body.data.recentTransactions[0].id).toBe(created[6].id);
      expect(body.data.recentTransactions[0].account.name).toBe("Dompet Utama");
      expect(body.data.recentTransactions[0].category.name).toBe("Makan");
    });

    it("200 dan tidak terpengaruh data user lain sama sekali (isolasi penuh)", async () => {
      const { user } = await insertUser();
      const { user: otherUser } = await insertUser();
      const token = await getAccessToken(user.id);

      const otherAccount = await insertAccount(otherUser.id, { balance: 500000 });
      const otherCategory = await insertCategory(otherUser.id);
      await insertTransaction(otherUser.id, otherAccount.id, otherCategory.id, {
        type: "INCOME",
        amount: 1000000,
        date: dayjs().date(1).toDate(),
      });

      const res = await app.request("/v1/dashboard/summary", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.totalBalance).toBe(0);
      expect(body.data.income).toBe(0);
      expect(body.data.expense).toBe(0);
      expect(body.data.topExpenses).toEqual([]);
      expect(body.data.recentTransactions).toEqual([]);
    });
  });

  describe("GET /v1/dashboard/chart", () => {
    it("401 tanpa token", async () => {
      const res = await app.request("/v1/dashboard/chart");
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED);
    });

    it("200 default ke tahun berjalan jika query year tidak dikirim", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);

      const res = await app.request("/v1/dashboard/chart", { headers: authCookieHeader(token) });

      expect(res.status).toBe(HttpStatusCodes.OK);
      const body = await res.json();
      expect(body.data.year).toBe(new Date().getFullYear());
      expect(body.data.data.length).toBe(12);
    });

    it("200 dan agregasi income/expense per bulan benar untuk tahun tertentu", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);
      const account = await insertAccount(user.id);
      const category = await insertCategory(user.id);

      await insertTransaction(user.id, account.id, category.id, {
        type: "INCOME",
        amount: 300000,
        date: new Date("2026-03-15"),
      });
      await insertTransaction(user.id, account.id, category.id, {
        type: "EXPENSE",
        amount: 100000,
        date: new Date("2026-03-20"),
      });
      await insertTransaction(user.id, account.id, category.id, {
        type: "INCOME",
        amount: 200000,
        date: new Date("2026-03-25"),
      });

      await insertTransaction(user.id, account.id, category.id, {
        type: "INCOME",
        amount: 999999,
        date: new Date("2025-03-15"),
      });

      const res = await app.request("/v1/dashboard/chart?year=2026", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.year).toBe(2026);
      const march = body.data.data.find((m: any) => m.month === 3);
      expect(march.income).toBe(500000);
      expect(march.expense).toBe(100000);
    });

    it("200 bulan tanpa transaksi tetap muncul dengan income & expense 0", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);

      const res = await app.request("/v1/dashboard/chart?year=2025", { headers: authCookieHeader(token) });

      const body = await res.json();
      expect(body.data.data.length).toBe(12);
      expect(body.data.data.every((m: any) => m.income === 0 && m.expense === 0)).toBe(true);
    });

    it("400 jika year di luar rentang valid (kurang dari 2000)", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);

      const res = await app.request("/v1/dashboard/chart?year=1999", { headers: authCookieHeader(token) });

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST);
    });

    it("400 jika year bukan angka", async () => {
      const { user } = await insertUser();
      const token = await getAccessToken(user.id);

      const res = await app.request("/v1/dashboard/chart?year=abcd", { headers: authCookieHeader(token) });

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST);
    });
  });
});
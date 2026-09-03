import type { Context } from "hono";
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { SavingServices } from "@/services/index.js";
import type {
  CreateSavingsGoalBody, UpdateSavingsGoalBody, SavingsGoalIdParam, AllocateSavingsBody,
} from "../models/saving.js";

class SavingController {
  static list = async (c: Context) => {
    const userId = c.get("userId") as string;
    const goals = await SavingServices.list(userId);
    return c.json({ status: HttpStatusCodes.OK, message: "Daftar rencana tabungan berhasil diambil", data: { goals } });
  };

  static detail = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as SavingsGoalIdParam;
    const result = await SavingServices.getDetail(userId, id);
    return c.json({ status: HttpStatusCodes.OK, message: "Detail rencana tabungan berhasil diambil", data: result });
  };

  static create = async (c: Context) => {
    const userId = c.get("userId") as string;
    const body = c.get("parsedJson") as CreateSavingsGoalBody;
    const goal = await SavingServices.create(userId, body);
    return c.json({ status: HttpStatusCodes.CREATED, message: "Rencana tabungan berhasil dibuat", data: { goal } }, HttpStatusCodes.CREATED);
  };

  static update = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as SavingsGoalIdParam;
    const body = c.get("parsedJson") as UpdateSavingsGoalBody;
    const goal = await SavingServices.update(userId, id, body);
    return c.json({ status: HttpStatusCodes.OK, message: "Rencana tabungan berhasil diperbarui", data: { goal } });
  };

  static remove = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as SavingsGoalIdParam;
    await SavingServices.remove(userId, id);
    return c.json({ status: HttpStatusCodes.OK, message: "Rencana tabungan berhasil dihapus" });
  };

  static deposit = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as SavingsGoalIdParam;
    const body = c.get("parsedJson") as AllocateSavingsBody;
    const allocation = await SavingServices.deposit(userId, id, body);
    return c.json({ status: HttpStatusCodes.CREATED, message: "Dana berhasil dialokasikan", data: { allocation } }, HttpStatusCodes.CREATED);
  };

  static withdraw = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as SavingsGoalIdParam;
    const body = c.get("parsedJson") as AllocateSavingsBody;
    const allocation = await SavingServices.withdraw(userId, id, body);
    return c.json({ status: HttpStatusCodes.CREATED, message: "Dana berhasil ditarik", data: { allocation } }, HttpStatusCodes.CREATED);
  };
}

export default SavingController;
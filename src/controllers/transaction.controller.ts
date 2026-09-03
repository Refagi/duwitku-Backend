import type { Context } from "hono";
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { TransactionServices } from "@/services/index.js";
import type {
  CreateTransactionBody,
  UpdateTransactionBody,
  TransactionIdParam,
  TransactionQuery,
} from "@/models/transaction.js";

class TransactionController {
  static list = async (c: Context) => {
    const userId = c.get("userId") as string;
    const query = c.get("parsedQuery") as TransactionQuery;

    const result = await TransactionServices.list(userId, query);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Riwayat transaksi berhasil diambil",
      data: result,
    });
  };

  static create = async (c: Context) => {
    const userId = c.get("userId") as string;
    const body = c.get("parsedJson") as CreateTransactionBody;

    const transaction = await TransactionServices.create(userId, body);

    return c.json(
      {
        status: HttpStatusCodes.CREATED,
        message: "Transaksi berhasil dicatat",
        data: { transaction },
      },
      HttpStatusCodes.CREATED,
    );
  };

  static update = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as TransactionIdParam;
    const body = c.get("parsedJson") as UpdateTransactionBody;

    const transaction = await TransactionServices.update(userId, id, body);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Transaksi berhasil diperbarui",
      data: { transaction },
    });
  };

  static remove = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as TransactionIdParam;

    await TransactionServices.remove(userId, id);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Transaksi berhasil dihapus",
    });
  };
}

export default TransactionController;
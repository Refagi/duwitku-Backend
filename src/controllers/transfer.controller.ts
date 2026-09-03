import type { Context } from "hono";
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { TransferServices } from "@/services/index.js";
import type {
  CreateTransferBody,
  UpdateTransferBody,
  TransferIdParam,
  TransferQuery,
} from "@/models/transfer.js";

class TransferController {
  static list = async (c: Context) => {
    const userId = c.get("userId") as string;
    const query = c.get("parsedQuery") as TransferQuery;

    const result = await TransferServices.list(userId, query);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Riwayat transfer berhasil diambil",
      data: result,
    });
  };

  static create = async (c: Context) => {
    const userId = c.get("userId") as string;
    const body = c.get("parsedJson") as CreateTransferBody;

    const transfer = await TransferServices.create(userId, body);

    return c.json(
      {
        status: HttpStatusCodes.CREATED,
        message: "Transfer berhasil dicatat",
        data: { transfer },
      },
      HttpStatusCodes.CREATED,
    );
  };

  static update = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as TransferIdParam;
    const body = c.get("parsedJson") as UpdateTransferBody;

    const transfer = await TransferServices.update(userId, id, body);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Transfer berhasil diperbarui",
      data: { transfer },
    });
  };

  static remove = async (c: Context) => {
    const userId = c.get("userId") as string;
    const { id } = c.get("parsedParam") as TransferIdParam;

    await TransferServices.remove(userId, id);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Transfer berhasil dihapus",
    });
  };
}

export default TransferController;
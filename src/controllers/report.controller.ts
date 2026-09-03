import type { Context } from "hono";
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { ReportServices } from "@/services/index.js";
import type { ReportQuery } from "@/models/report.js";

class ReportController {
  static summary = async (c: Context) => {
    const userId = c.get("userId") as string;
    const query = c.get("parsedQuery") as ReportQuery;
    const summary = await ReportServices.summary(userId, query);
    return c.json({ status: HttpStatusCodes.OK, message: "Laporan berhasil diambil", data: summary });
  };
}

export default ReportController;
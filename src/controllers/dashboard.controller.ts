import type { Context } from "hono";
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { DashboardServices } from "@/services/index.js";
import type { DashboardChartQuery } from "@/models/dashboard.js";

class DashboardController {
  static summary = async (c: Context) => {
    const userId = c.get("userId") as string;

    const summary = await DashboardServices.summary(userId);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Ringkasan dashboard berhasil diambil",
      data: summary,
    });
  };

  static chart = async (c: Context) => {
    const userId = c.get("userId") as string;
    const query = c.get("parsedQuery") as DashboardChartQuery;

    const chart = await DashboardServices.chart(userId, query);

    return c.json({
      status: HttpStatusCodes.OK,
      message: "Data grafik berhasil diambil",
      data: chart,
    });
  };
}

export default DashboardController;
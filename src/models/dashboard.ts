import type { z } from "zod";
import type { dashboardChartQuerySchema } from "@/validations/dashboard.js";

export type DashboardChartQuery = z.infer<typeof dashboardChartQuerySchema>;
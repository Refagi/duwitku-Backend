import { z } from "zod";

export const reportQuerySchema = z.object({
  from: z.string().min(1, "Tanggal awal wajib diisi"),
  to: z.string().min(1, "Tanggal akhir wajib diisi"),
});
import app from "@/app.js";
import { logger } from "@/config/logger.js";
import { config } from "@/config/config.js";

await logger.init();

logger.info("Personal Finance API is booting up", {
  env: config.env,
  port: config.port,
});


export default {
  fetch: app.fetch,
};
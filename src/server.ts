import "reflect-metadata";
import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createDataSource } from "./database/data-source.js";
import { bootstrapDatabase } from "./database/bootstrap.js";
import { Logger } from "./logger.js";
import { createApp } from "./app.js";
import { SessionService } from "./sessions/service.js";
import { AuthorizationCodeService } from "./auth/authorization-codes.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const dataSource = createDataSource(config);
  await dataSource.initialize();
  await bootstrapDatabase(dataSource, config, logger);
  const sessions = new SessionService(dataSource, config);
  const authorizationCodes = new AuthorizationCodeService(dataSource, config);
  await sessions.cleanupExpired();
  await authorizationCodes.cleanupExpired();
  const cleanupTimer = setInterval(() => void Promise.all([sessions.cleanupExpired(), authorizationCodes.cleanupExpired()]).catch((error) => logger.error("Authentication cleanup failed", { error: error instanceof Error ? error.message : String(error) })), 60 * 60_000);
  cleanupTimer.unref();

  const server = createServer(createApp(dataSource, config, logger));
  server.listen(config.port, "0.0.0.0", () => logger.info("Authentication server listening", { port: config.port }));

  const shutdown = (signal: string) => {
    logger.info("Shutdown requested", { signal });
    clearInterval(cleanupTimer);
    server.close(() => void dataSource.destroy().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level: "error", message: "Startup failed", error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});

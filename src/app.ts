import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import type { DataSource } from "typeorm";
import type { Config } from "./config.js";
import type { Logger } from "./logger.js";
import { authRouter } from "./auth/routes.js";
import { forwardAuthRouter } from "./auth/forward-auth.js";
import { adminApiRouter } from "./admin/routes.js";
import { webRouter } from "./web/routes.js";
import { HttpError } from "./http.js";

export function createApp(dataSource: DataSource, config: Config, logger: Logger): express.Express {
  const app = express();
  const root = path.dirname(fileURLToPath(import.meta.url));
  const frontendDirectory = path.join(root, "web", "public");

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustedProxies);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  }));
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => logger.info("HTTP request", { method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt, ip: req.ip }));
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use(cookieParser());
  app.use("/assets", express.static(path.join(frontendDirectory, "assets"), { immutable: true, maxAge: "1y" }));
  app.use("/assets", (_req, res) => res.status(404).end());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/ready", async (_req, res) => {
    try {
      await dataSource.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api/auth", authRouter(dataSource, config));
  app.use("/api/auth", forwardAuthRouter(dataSource, config));
  app.use("/api/admin", adminApiRouter(dataSource, config));
  app.use("/api", (_req, res) => res.status(404).json({ error: "not_found" }));
  app.use(webRouter(frontendDirectory));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: "invalid_request_body" });
      return;
    }
    logger.error("Unhandled request error", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "internal_server_error" });
  };
  app.use(errorHandler);

  return app;
}

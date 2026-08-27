import path from "node:path";
import { Router } from "express";

export function webRouter(frontendDirectory: string): Router {
  const router = Router();
  router.get(/.*/, (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(frontendDirectory, "index.html"));
  });

  return router;
}

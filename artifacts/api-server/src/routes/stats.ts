import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/stats", (_req, res) => {
  res.json({
    status: "online",
    uptime: Math.floor(process.uptime()),
    platform: "Ubuntu 24.04",
    auth: "Key-only",
    toolCount: 50,
    version: "2.0",
    timestamp: new Date().toISOString(),
  });
});

export default router;

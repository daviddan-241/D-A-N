import { Router, type IRouter } from "express";
import healthRouter from "./health";
import statsRouter from "./stats";
import statusRouter from "./status";
import terminalKeysRouter from "./terminal-keys";

const router: IRouter = Router();

router.use(healthRouter);
router.use(statsRouter);
router.use(statusRouter);
router.use(terminalKeysRouter);

export default router;

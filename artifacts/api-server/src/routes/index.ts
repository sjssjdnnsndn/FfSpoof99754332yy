import { Router, type IRouter } from "express";
import healthRouter from "./health";
import keepaliveRouter from "./keepalive";

const router: IRouter = Router();

router.use(healthRouter);
router.use(keepaliveRouter);

export default router;

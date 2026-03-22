import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teachmeRouter from "./teachme";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teachmeRouter);

export default router;

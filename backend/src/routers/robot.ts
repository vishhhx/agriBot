import { Router } from "express";
import { getBotById, getMyBots } from "../controllers/robot";
import { authenticate } from "../middlewares/auth";

export const robotRouter = Router();

robotRouter.get("/my-bots", authenticate, getMyBots);
robotRouter.get("/:robotId", authenticate, getBotById);

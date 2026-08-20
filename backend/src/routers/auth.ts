import { Router } from "express";
import {
  getCurrentUser,
  getWsToken,
  googleOAuthCallback,
  initGoogleOAuth,
  logout,
} from "../controllers/auth";
import { authenticate } from "../middlewares/auth";

export const authRouter = Router();

authRouter.get("/google", initGoogleOAuth);
authRouter.get("/google/callback", googleOAuthCallback);
authRouter.get("/me", authenticate, getCurrentUser);
authRouter.get("/ws-token", authenticate, getWsToken);
authRouter.post("/logout", logout);

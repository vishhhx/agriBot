import type { AuthTokenPayload } from "../services/auth";

declare global {
  namespace Express {
    interface Request {
      user: AuthTokenPayload;
    }
  }
}

export {};

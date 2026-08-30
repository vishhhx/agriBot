import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/auth";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const cookieToken = req.cookies?.__session;
    const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");

    console.log("Cookie token exists:", !!cookieToken);
    console.log("Header token exists:", !!headerToken);

    console.log("Cookie token prefix:", cookieToken?.substring(0, 30));

    console.log("Header token prefix:", headerToken?.substring(0, 30));

    const token = cookieToken || headerToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    console.log("USING TOKEN:", token === cookieToken ? "COOKIE" : "HEADER");

    const payload = verifyAuthToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
};

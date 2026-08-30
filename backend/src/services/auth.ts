import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export const issueAuthToken = ({ userId, email }: AuthTokenPayload): string => {
  return jwt.sign(
    {
      userId,
      email,
    },
    ENV.JWT_SECRET!,
    {
      expiresIn: "7d",
      issuer: "aurax",
      subject: userId,
    },
  );
};

// =====================================================
// SHORT-LIVED WEBSOCKET TOKEN
//
// Issued on demand for a browser session.
// Used as ?token= on the WebSocket URL because
// httpOnly cookies cannot be read by JavaScript
// and therefore cannot be sent cross-origin.
// =====================================================

export const issueWsToken = ({ userId, email }: AuthTokenPayload): string => {
  return jwt.sign(
    {
      userId,
      email,
    },
    ENV.JWT_SECRET!,
    {
      expiresIn: "60s",
      issuer: "aurax",
      subject: userId,
    },
  );
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  console.log("Verifying token:", token, " JWT_SECRET:", ENV.JWT_SECRET);
  const payload = jwt.verify(token, ENV.JWT_SECRET!, {
    issuer: "aurax",
  });

  if (
    typeof payload !== "object" ||
    !payload ||
    typeof payload.userId !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Invalid JWT payload");
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
};

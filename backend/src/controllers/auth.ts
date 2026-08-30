import crypto from "node:crypto";
import type { Request, Response } from "express";
import { ENV } from "../config/env";
import { GoogleAuthService } from "../services/google";
import {
  createGoogleUser,
  findUserByEmail,
  findUserById,
  updateGoogleUser,
} from "../services/user";
import { issueAuthToken, issueWsToken } from "../services/auth";
const oauthStateCookie = "google_oauth_state";
const sessionCookie = "__session";
const frontendUrl = ENV.FRONTEND_URL || "http://localhost:3000";

const redirectToLoginWithError = (res: Response, message: string): void => {
  const params = new URLSearchParams({ error: message });
  return res.redirect(`${frontendUrl}/login?${params.toString()}`);
};
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: ENV.COOKIE_SECURE,
  path: "/",
};

export const initGoogleOAuth = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const state = crypto.randomBytes(32).toString("hex");

    const googleAuthService = new GoogleAuthService();

    const url = googleAuthService.getAuthorizationUrl(state);

    res.cookie(oauthStateCookie, state, {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      data: url,
      message: "Google sign-in initialized",
    });
  } catch (error) {
    console.error("Google OAuth initialization error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to initialize Google sign-in",
    });
  }
};

export const googleOAuthCallback = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  try {
    const code =
      typeof req.query.code === "string" ? req.query.code : undefined;

    const state =
      typeof req.query.state === "string" ? req.query.state : undefined;

    const savedState = req.cookies?.[oauthStateCookie];

    if (!code || !state || !savedState || state !== savedState) {
      res.clearCookie(oauthStateCookie, cookieOptions);
      return redirectToLoginWithError(
        res,
        "Google sign-in request is invalid or expired.",
      );
    }

    res.clearCookie(oauthStateCookie, cookieOptions);

    const googleAuthService = new GoogleAuthService();

    const profile = await googleAuthService.getProfile(code);

    if (!profile.verified) {
      return redirectToLoginWithError(
        res,
        "Your Google email must be verified.",
      );
    }

    if (!profile.email) {
      return redirectToLoginWithError(
        res,
        "Google account email was not provided.",
      );
    }

    let user = await findUserByEmail(profile.email);

    if (!user) {
      user = await createGoogleUser({
        googleId: profile.id,
        email: profile.email,
        name: profile.name || "Google User",
        avatarUrl: profile.avatarUrl,
      });

      console.log("New Google user created:", user.userId);
    } else {
      user =
        (await updateGoogleUser(user.userId, {
          googleId: profile.id,
          name: profile.name?.slice(0, 30),
          avatarUrl: profile.avatarUrl,
        })) || user;

      console.log("Existing Google user logged in:", user.userId);
    }

    const token = issueAuthToken({
      userId: user.userId,
      email: user.email,
    });

    res.cookie(sessionCookie, token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${frontendUrl}/auth/success`);
  } catch (error) {
    console.error("Google OAuth callback error:", error);

    return redirectToLoginWithError(
      res,
      "Google sign-in failed. Please try again.",
    );
  }
};

export const logout = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    res.clearCookie(sessionCookie, cookieOptions);

    return res.status(200).json({
      success: true,
      data: null,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to logout",
    });
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const user = await findUserByEmail(req.user.email);

    if (!user || user.userId !== req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User session is no longer valid",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        services: user.services,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load the current user",
    });
  }
};

export const getUserInfo = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        services: user.services,
      },
      message: "User info retrieved successfully",
    });
  } catch (error) {
    console.error("Get user info error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user info",
    });
  }
};

// =====================================================
// WS TOKEN
//
// Returns a short-lived (60s) JWT the browser uses
// as ?token= on the WebSocket URL.
//
// Because __session is httpOnly, JavaScript cannot
// read it. This endpoint runs server-side where the
// cookie is accessible, issues a short-lived token,
// and returns it as plain JSON.
// =====================================================

export const getWsToken = (
  req: Request,
  res: Response,
): Response => {
  const token = issueWsToken({
    userId: req.user.userId,
    email: req.user.email,
  });

  return res.status(200).json({
    success: true,
    data: { token },
  });
};

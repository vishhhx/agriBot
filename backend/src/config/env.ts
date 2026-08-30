const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

export const ENV = {
  COOKIE_SECURE: true,
  FRONTEND_URL: frontendUrl,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  JWT_SECRET: process.env.JWT_SECRET,
};

import { google } from "googleapis";
import { ENV } from "../config/env";

const SCOPES = ["openid", "email", "profile"];

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  verified: boolean;
}

export class GoogleAuthService {
  private readonly oauth2Client = new google.auth.OAuth2(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_REDIRECT_URI,
  );

  getAuthorizationUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
    });
  }

  async getProfile(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.oauth2Client.getToken(code);
    if (!tokens.access_token)
      throw new Error("Google did not return an access token.");

    this.oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();
    if (!data.id || !data.email)
      throw new Error("Google did not return a complete profile.");

    return {
      id: data.id,
      email: data.email,
      name: data.name?.trim() || data.email.split("@")[0] || "Unknown",
      avatarUrl: data.picture || undefined,
      verified: data.verified_email ?? false,
    };
  }
}

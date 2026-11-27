/**
 * What an `OAuth` declaration may say, and the endpoints of the providers Halo knows.
 *
 *   tool Google : OAuth(provider: "google", clientId: Env.GOOGLE_CLIENT_ID, scopes: ["..."])
 *   tool Drive  : REST("https://www.googleapis.com/drive/v3", auth: Google)
 *
 * A preset supplies URLs only. Halo ships no client ids: the client is always the user's own.
 * No node:* imports: the validator (and so the browser playground) reads this file.
 */

/** The grants a connection can use. "authorization_code" always uses PKCE and state. */
export const OAUTH_GRANTS = ["authorization_code", "client_credentials", "device"] as const;
export type OAuthGrant = (typeof OAUTH_GRANTS)[number];

/** The settings an `OAuth(...)` declaration takes. */
export const OAUTH_SETTINGS = ["provider", "clientId", "clientSecret", "scopes", "grant", "authorizeUrl", "tokenUrl", "deviceUrl", "revokeUrl", "issuer", "tenant", "audience", "resource"] as const;

export interface OAuthEndpoints {
  authorizeUrl?: string;
  tokenUrl?: string;
  deviceUrl?: string;
  revokeUrl?: string;
  /** The issuer a token response's `iss` (RFC 9207) must match, when the server sends one. */
  issuer?: string;
}

/** The providers Halo knows the endpoints of. `tenant` is Microsoft's directory (default "common"). */
export const OAUTH_PRESETS: Record<string, (tenant?: string) => OAuthEndpoints> = {
  google: () => ({
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    deviceUrl: "https://oauth2.googleapis.com/device/code",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    issuer: "https://accounts.google.com",
  }),
  github: () => ({
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    deviceUrl: "https://github.com/login/device/code",
  }),
  microsoft: (tenant = "common") => {
    const t = encodeURIComponent(tenant);
    return {
      authorizeUrl: `https://login.microsoftonline.com/${t}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${t}/oauth2/v2.0/token`,
      deviceUrl: `https://login.microsoftonline.com/${t}/oauth2/v2.0/devicecode`,
    };
  },
  slack: () => ({
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    revokeUrl: "https://slack.com/api/auth.revoke",
  }),
};

export const OAUTH_PRESET_NAMES = Object.keys(OAUTH_PRESETS);

/**
 * The tool providers whose `auth:` takes an OAuth connection. A package's http provider takes one
 * too; the validator learns those from the installed packages.
 */
export const OAUTH_TOOL_PROVIDERS = ["REST", "GET", "POST", "Slack", "GitHub", "Linear", "Figma", "Email"] as const;

/** The email services that sign in with OAuth (the others take an API key or a password). */
export const OAUTH_EMAIL_SERVICES = ["gmail", "outlook"] as const;

/** Whether a URL may be an OAuth endpoint: https, or http on the loopback address (for local servers and tests). */
export function endpointProblem(url: string): string | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "is not a URL";
  }
  if (u.protocol === "https:") return undefined;
  if (u.protocol === "http:" && /^(127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname)) return undefined;
  return "must be https (or http on 127.0.0.1)";
}

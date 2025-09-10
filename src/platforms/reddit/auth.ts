import { logger } from "../../utils/logger.js";
import {
  AdvancedRetry,
  ErrorClassifier,
} from "../../utils/backoff-strategy.js";

/**
 * Reddit OAuth2 authentication configuration
 */
export interface RedditAuthConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username?: string;
  password?: string;
  refreshToken?: string;
  deviceId?: string;
}

/**
 * Reddit OAuth2 token response
 */
export interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

/**
 * Reddit OAuth2 authentication state
 */
export interface RedditAuthState {
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  refreshToken?: string;
  scope: string;
}

/**
 * Reddit OAuth2 authentication manager
 */
export class RedditAuth {
  private config: RedditAuthConfig;
  private authState: RedditAuthState | undefined;
  private tokenEndpoint = "https://www.reddit.com/api/v1/access_token";
  private revokeEndpoint = "https://www.reddit.com/api/v1/revoke_token";
  private retryClient: AdvancedRetry;

  constructor(config: RedditAuthConfig) {
    this.config = config;
    this.validateConfig();

    // Setup retry client with exponential backoff
    this.retryClient = AdvancedRetry.withExponentialBackoff(
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        onFailedAttempt: (error) => {
          logger.warn(
            `Reddit auth retry attempt ${error.attemptNumber}: ${error.message}`,
          );
        },
        shouldRetry: (error) => ErrorClassifier.isRetryable(error),
      },
      {
        initialDelayMs: 1000,
        maxDelayMs: 30000,
      },
    );
  }

  /**
   * Validate authentication configuration
   */
  private validateConfig(): void {
    if (!this.config.clientId) {
      throw new Error("Reddit clientId is required");
    }
    if (!this.config.clientSecret) {
      throw new Error("Reddit clientSecret is required");
    }
    if (!this.config.userAgent) {
      throw new Error("Reddit userAgent is required");
    }
  }

  /**
   * Get authorization headers for token requests
   */
  private getAuthHeaders(): Record<string, string> {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString("base64");

    return {
      Authorization: `Basic ${credentials}`,
      "User-Agent": this.config.userAgent,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  /**
   * Authenticate using script app flow (username/password)
   */
  async authenticateScript(): Promise<RedditAuthState> {
    if (!this.config.username || !this.config.password) {
      throw new Error(
        "Username and password required for script authentication",
      );
    }

    const params = new URLSearchParams({
      grant_type: "password",
      username: this.config.username,
      password: this.config.password,
    });

    return this.requestToken(params);
  }

  /**
   * Authenticate using installed app flow (device ID)
   */
  async authenticateInstalled(): Promise<RedditAuthState> {
    if (!this.config.deviceId) {
      throw new Error("Device ID required for installed app authentication");
    }

    const params = new URLSearchParams({
      grant_type: "https://oauth.reddit.com/grants/installed_client",
      device_id: this.config.deviceId,
    });

    return this.requestToken(params);
  }

  /**
   * Authenticate using client credentials (app-only)
   */
  async authenticateClientCredentials(): Promise<RedditAuthState> {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
    });

    return this.requestToken(params);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<RedditAuthState> {
    if (!this.config.refreshToken && !this.authState?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const refreshToken =
      this.config.refreshToken || this.authState?.refreshToken;

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken!,
    });

    return this.requestToken(params);
  }

  /**
   * Request token from Reddit OAuth2 endpoint
   */
  private async requestToken(
    params: URLSearchParams,
  ): Promise<RedditAuthState> {
    return this.retryClient.execute(async () => {
      const response = await fetch(this.tokenEndpoint, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `Reddit auth failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
        (error as any).statusCode = response.status;
        throw error;
      }

      const tokenData = (await response.json()) as RedditTokenResponse;

      // Calculate expiration time (slightly before actual expiry for safety)
      const expiresAt = new Date(
        Date.now() + (tokenData.expires_in - 60) * 1000,
      );

      this.authState = {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type,
        expiresAt,
        ...(tokenData.refresh_token && {
          refreshToken: tokenData.refresh_token,
        }),
        scope: tokenData.scope,
      };

      logger.info("Reddit authentication successful", {
        scope: tokenData.scope,
        expiresIn: tokenData.expires_in,
      });

      return this.authState;
    });
  }

  /**
   * Revoke a token
   */
  async revokeToken(token?: string): Promise<void> {
    const tokenToRevoke = token || this.authState?.accessToken;

    if (!tokenToRevoke) {
      throw new Error("No token to revoke");
    }

    const params = new URLSearchParams({
      token: tokenToRevoke,
      token_type_hint: token ? "refresh_token" : "access_token",
    });

    await this.retryClient.execute(async () => {
      const response = await fetch(this.revokeEndpoint, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: params.toString(),
      });

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        throw new Error(
          `Failed to revoke token: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      if (!token) {
        this.authState = undefined;
      }

      logger.info("Reddit token revoked successfully");
    });
  }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.authState && this.isTokenValid()) {
      return this.authState.accessToken;
    }

    // Try to refresh if we have a refresh token
    if (this.authState?.refreshToken || this.config.refreshToken) {
      try {
        const newState = await this.refreshAccessToken();
        return newState.accessToken;
      } catch (error) {
        logger.warn("Failed to refresh token, re-authenticating", error);
      }
    }

    // Re-authenticate based on available credentials
    let newState: RedditAuthState;

    if (this.config.username && this.config.password) {
      newState = await this.authenticateScript();
    } else if (this.config.deviceId) {
      newState = await this.authenticateInstalled();
    } else {
      newState = await this.authenticateClientCredentials();
    }

    return newState.accessToken;
  }

  /**
   * Check if current token is valid
   */
  isTokenValid(): boolean {
    if (!this.authState) {
      return false;
    }

    // Check if token has expired (with 1 minute buffer)
    const now = new Date();
    const buffer = new Date(now.getTime() + 60000); // 1 minute buffer

    return this.authState.expiresAt > buffer;
  }

  /**
   * Get authorization header for API requests
   */
  async getAuthHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `Bearer ${token}`;
  }

  /**
   * Get current authentication state
   */
  getAuthState(): RedditAuthState | undefined {
    return this.authState;
  }

  /**
   * Clear authentication state
   */
  clearAuth(): void {
    this.authState = undefined;
  }
}

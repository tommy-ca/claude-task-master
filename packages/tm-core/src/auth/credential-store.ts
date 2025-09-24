/**
 * Credential storage and management
 */

import fs from 'fs';
import path from 'path';
import { AuthCredentials, AuthenticationError, AuthConfig } from './types.js';
import { getAuthConfig } from './config.js';
import { getLogger } from '../logger/index.js';

/**
 * CredentialStore manages the persistence and retrieval of authentication credentials.
 *
 * Runtime vs Persisted Shape:
 * - When retrieved (getCredentials): expiresAt is normalized to number (milliseconds since epoch)
 * - When persisted (saveCredentials): expiresAt is stored as ISO string for readability
 *
 * This normalization ensures consistent runtime behavior while maintaining
 * human-readable persisted format in the auth.json file.
 */
export class CredentialStore {
	private static instance: CredentialStore | null = null;
	private logger = getLogger('CredentialStore');
	private config: AuthConfig;
	// Clock skew tolerance for expiry checks (30 seconds)
	private readonly CLOCK_SKEW_MS = 30_000;

	private constructor(config?: Partial<AuthConfig>) {
		this.config = getAuthConfig(config);
	}

	/**
	 * Get the singleton instance of CredentialStore
	 */
	static getInstance(config?: Partial<AuthConfig>): CredentialStore {
		if (!CredentialStore.instance) {
			CredentialStore.instance = new CredentialStore(config);
		} else if (config) {
			// Warn if config is provided after initialization
			const logger = getLogger('CredentialStore');
			logger.warn(
				'getInstance called with config after initialization; config is ignored.'
			);
		}
		return CredentialStore.instance;
	}

	/**
	 * Reset the singleton instance (useful for testing)
	 */
	static resetInstance(): void {
		CredentialStore.instance = null;
	}

	/**
	 * Get stored authentication credentials
	 * @returns AuthCredentials with expiresAt as number (milliseconds) for runtime use
	 */
	getCredentials(options?: { allowExpired?: boolean }): AuthCredentials | null {
		try {
			if (!fs.existsSync(this.config.configFile)) {
				return null;
			}

			const authData = JSON.parse(
				fs.readFileSync(this.config.configFile, 'utf-8')
			) as AuthCredentials;

			// Normalize/migrate timestamps to numeric (handles both number and ISO string)
			let expiresAtMs: number | undefined;
			if (typeof authData.expiresAt === 'number') {
				expiresAtMs = Number.isFinite(authData.expiresAt)
					? authData.expiresAt
					: undefined;
			} else if (typeof authData.expiresAt === 'string') {
				const parsed = Date.parse(authData.expiresAt);
				expiresAtMs = Number.isNaN(parsed) ? undefined : parsed;
			} else {
				expiresAtMs = undefined;
			}

			// Validate expiration time for tokens
			if (expiresAtMs === undefined) {
				this.logger.warn('No valid expiration time provided for token');
				return null;
			}

			// Update the authData with normalized timestamp
			authData.expiresAt = expiresAtMs;

			// Check if the token has expired (with clock skew tolerance)
			const now = Date.now();
			const allowExpired = options?.allowExpired ?? false;
			if (now >= expiresAtMs - this.CLOCK_SKEW_MS && !allowExpired) {
				this.logger.warn(
					'Authentication token has expired or is about to expire',
					{
						expiresAt: authData.expiresAt,
						currentTime: new Date(now).toISOString(),
						skewWindow: `${this.CLOCK_SKEW_MS / 1000}s`
					}
				);
				return null;
			}

			// Return valid token
			return authData;
		} catch (error) {
			this.logger.error(
				`Failed to read auth credentials: ${(error as Error).message}`
			);

			// Quarantine corrupt file to prevent repeated errors
			try {
				if (fs.existsSync(this.config.configFile)) {
					const corruptFile = `${this.config.configFile}.corrupt-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
					fs.renameSync(this.config.configFile, corruptFile);
					this.logger.warn(`Quarantined corrupt auth file to: ${corruptFile}`);
				}
			} catch (quarantineError) {
				// If we can't quarantine, log but don't throw
				this.logger.debug(
					`Could not quarantine corrupt file: ${(quarantineError as Error).message}`
				);
			}

			return null;
		}
	}

	/**
	 * Save authentication credentials
	 * @param authData - Credentials with expiresAt as number or string (will be persisted as ISO string)
	 */
	saveCredentials(authData: AuthCredentials): void {
		try {
			// Ensure directory exists
			if (!fs.existsSync(this.config.configDir)) {
				fs.mkdirSync(this.config.configDir, { recursive: true, mode: 0o700 });
			}

			// Add timestamp without mutating caller's object
			authData = { ...authData, savedAt: new Date().toISOString() };

			// Validate and normalize expiresAt timestamp
			if (authData.expiresAt !== undefined) {
				let validTimestamp: number | undefined;

				if (typeof authData.expiresAt === 'number') {
					validTimestamp = Number.isFinite(authData.expiresAt)
						? authData.expiresAt
						: undefined;
				} else if (typeof authData.expiresAt === 'string') {
					const parsed = Date.parse(authData.expiresAt);
					validTimestamp = Number.isNaN(parsed) ? undefined : parsed;
				}

				if (validTimestamp === undefined) {
					throw new AuthenticationError(
						`Invalid expiresAt format: ${authData.expiresAt}`,
						'SAVE_FAILED'
					);
				}

				// Store as ISO string for consistency
				authData.expiresAt = new Date(validTimestamp).toISOString();
			}

			// Save credentials atomically with secure permissions
			const tempFile = `${this.config.configFile}.tmp`;
			fs.writeFileSync(tempFile, JSON.stringify(authData, null, 2), {
				mode: 0o600
			});
			fs.renameSync(tempFile, this.config.configFile);
		} catch (error) {
			throw new AuthenticationError(
				`Failed to save auth credentials: ${(error as Error).message}`,
				'SAVE_FAILED',
				error
			);
		}
	}

	/**
	 * Clear stored credentials
	 */
	clearCredentials(): void {
		try {
			if (fs.existsSync(this.config.configFile)) {
				fs.unlinkSync(this.config.configFile);
			}
		} catch (error) {
			throw new AuthenticationError(
				`Failed to clear credentials: ${(error as Error).message}`,
				'CLEAR_FAILED',
				error
			);
		}
	}

	/**
	 * Check if credentials exist and are valid
	 */
	hasValidCredentials(): boolean {
		const credentials = this.getCredentials({ allowExpired: false });
		return credentials !== null;
	}

	/**
	 * Get configuration
	 */
	getConfig(): AuthConfig {
		return { ...this.config };
	}

	/**
	 * Clean up old corrupt auth files
	 * Removes corrupt files older than the specified age
	 */
	cleanupCorruptFiles(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
		try {
			const dir = path.dirname(this.config.configFile);
			const baseName = path.basename(this.config.configFile);
			const prefix = `${baseName}.corrupt-`;

			if (!fs.existsSync(dir)) {
				return;
			}

			const entries = fs.readdirSync(dir, { withFileTypes: true });
			const now = Date.now();

			for (const entry of entries) {
				if (!entry.isFile()) continue;
				const file = entry.name;

				// Check if file matches pattern: baseName.corrupt-{timestamp}
				if (!file.startsWith(prefix)) continue;
				const suffix = file.slice(prefix.length);
				if (!/^\d+$/.test(suffix)) continue; // Fixed regex, not from variable input

				const filePath = path.join(dir, file);
				try {
					const stats = fs.statSync(filePath);
					const age = now - stats.mtimeMs;

					if (age > maxAgeMs) {
						fs.unlinkSync(filePath);
						this.logger.debug(`Cleaned up old corrupt file: ${file}`);
					}
				} catch (error) {
					// Ignore errors for individual file cleanup
					this.logger.debug(
						`Could not clean up corrupt file ${file}: ${(error as Error).message}`
					);
				}
			}
		} catch (error) {
			// Log but don't throw - this is a cleanup operation
			this.logger.debug(
				`Error during corrupt file cleanup: ${(error as Error).message}`
			);
		}
	}
}

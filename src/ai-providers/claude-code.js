/**
 * src/ai-providers/claude-code.js
 *
 * Implementation for interacting with Claude models via Claude Code CLI
 * using the official ai-sdk-provider-claude-code package.
 */

import { createClaudeCode } from 'ai-sdk-provider-claude-code';
import { BaseAIProvider } from './base-provider.js';
import { getClaudeCodeSettingsForCommand } from '../../scripts/modules/config-manager.js';

export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Claude Code';
	}

	/**
	 * Override validateAuth to skip API key validation for Claude Code
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Claude Code doesn't require an API key
		// Authentication is handled by the claude login command
	}

	/**
	 * Creates and returns a Claude Code client instance using the official provider.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.commandName] - Name of the command invoking the service
	 * @param {string} [params.baseURL] - Optional custom API endpoint (not used by Claude Code)
	 * @returns {Function} Claude Code provider instance
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			// Get settings from config manager
			const defaultSettings = getClaudeCodeSettingsForCommand(params?.commandName);
			
			// Create the official provider with default settings
			return createClaudeCode({
				defaultSettings
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}

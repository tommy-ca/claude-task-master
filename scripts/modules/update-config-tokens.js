/**
 * update-config-tokens.js
 * Updates config.json with correct maxTokens values from supported-models.json
 */

import fs from 'fs';
import supportedModels from './supported-models.json' with { type: 'json' };

/**
 * Updates the config file with correct maxTokens values from supported-models.json
 * @param {string} configPath - Path to the config.json file to update
 * @returns {boolean} True if successful, false otherwise
 */
export function updateConfigMaxTokens(configPath) {
	try {
		// Load config
		const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

		// Update each role's maxTokens if the model exists in supported-models.json
		const roles = ['main', 'research', 'fallback'];

		for (const role of roles) {
			if (config.models && config.models[role]) {
				const provider = config.models[role].provider;
				const modelId = config.models[role].modelId;

				// Find the model in supported models
				if (supportedModels[provider]) {
					const modelData = supportedModels[provider].find(
						(m) => m.id === modelId
					);
					if (modelData && modelData.max_tokens) {
						config.models[role].maxTokens = modelData.max_tokens;
					}
				}
			}
		}

		// Write back the updated config
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		return true;
	} catch (error) {
		console.error('Error updating config maxTokens:', error.message);
		return false;
	}
}

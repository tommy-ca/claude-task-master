import { jest } from '@jest/globals';

// Mock the base provider to avoid circular dependencies
jest.unstable_mockModule('../../src/ai-providers/base-provider.js', () => ({
	BaseAIProvider: class {
		constructor() {
			this.name = 'Base Provider';
		}
		handleError(context, error) {
			throw error;
		}
	}
}));

// Mock the config manager
jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	getClaudeCodeSettingsForCommand: jest.fn(() => ({
		maxTurns: 5,
		permissionMode: 'default'
	}))
}));

// Mock the official ai-sdk-provider-claude-code package
jest.unstable_mockModule('ai-sdk-provider-claude-code', () => ({
	createClaudeCode: jest.fn(() => {
		const provider = (modelId, settings) => ({
			// Mock language model that implements AI SDK interface
			id: modelId,
			settings,
			specificationVersion: 'v2',
			defaultObjectGenerationMode: 'json',
			supportsImageUrls: false,
			supportedUrls: {},
			supportsStructuredOutputs: false,
			provider: 'claude-code',
			doGenerate: jest.fn(async () => ({
				text: 'Hello from Claude Code!',
				finishReason: 'stop',
				usage: { promptTokens: 10, completionTokens: 20 }
			})),
			doStream: jest.fn(async function* () {
				yield { type: 'text-delta', textDelta: 'Hello' };
				yield { type: 'text-delta', textDelta: ' from' };
				yield { type: 'text-delta', textDelta: ' Claude!' };
				yield { type: 'finish', finishReason: 'stop' };
			})
		});
		provider.languageModel = jest.fn((id, settings) => provider(id, settings));
		provider.chat = provider.languageModel;
		return provider;
	})
}));

// Import after mocking
const { ClaudeCodeProvider } = await import(
	'../../src/ai-providers/claude-code.js'
);

describe('Claude Code Integration with Official Package', () => {
	let provider;

	beforeEach(() => {
		provider = new ClaudeCodeProvider();
		jest.clearAllMocks();
	});

	describe('provider instantiation', () => {
		it('should create provider instance successfully', () => {
			expect(provider).toBeDefined();
			expect(provider.name).toBe('Claude Code');
		});

		it('should not require API key validation', () => {
			expect(() => provider.validateAuth()).not.toThrow();
			expect(() => provider.validateAuth({ apiKey: null })).not.toThrow();
			expect(() => provider.validateAuth({ 
				apiKey: 'some-key',
				baseURL: 'https://example.com'
			})).not.toThrow();
		});
	});

	describe('client creation', () => {
		it('should create client using official provider', () => {
			const client = provider.getClient({});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
			expect(client.languageModel).toBeDefined();
			expect(client.chat).toBeDefined();
		});

		it('should pass command-specific settings to provider', async () => {
			const client = provider.getClient({ commandName: 'parse-prd' });
			expect(client).toBeDefined();
			
			// Verify that the createClaudeCode was called with settings
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
			expect(createClaudeCode).toHaveBeenCalledWith({
				defaultSettings: expect.objectContaining({
					maxTurns: 5,
					permissionMode: 'default'
				})
			});
		});

		it('should handle client creation without parameters', () => {
			const client = provider.getClient();
			expect(client).toBeDefined();
		});
	});

	describe('model creation and usage', () => {
		it('should create models with correct configuration', () => {
			const client = provider.getClient({});
			
			// Test creating models
			const opusModel = client('opus');
			expect(opusModel).toBeDefined();
			expect(opusModel.id).toBe('opus');
			
			const sonnetModel = client('sonnet');
			expect(sonnetModel).toBeDefined();
			expect(sonnetModel.id).toBe('sonnet');
		});

		it('should support languageModel method', () => {
			const client = provider.getClient({});
			const model = client.languageModel('sonnet', { maxTurns: 3 });
			
			expect(model).toBeDefined();
			expect(model.id).toBe('sonnet');
			expect(model.settings).toEqual(expect.objectContaining({
				maxTurns: 3
			}));
		});

		it('should support chat method as alias', () => {
			const client = provider.getClient({});
			const model = client.chat('opus');
			
			expect(model).toBeDefined();
			expect(model.id).toBe('opus');
		});
	});

	describe('AI SDK v5 compatibility', () => {
		it('should create models compatible with AI SDK v5 interface', () => {
			const client = provider.getClient({});
			const model = client('sonnet');
			
			// Check for AI SDK v5 properties
			expect(model.specificationVersion).toBe('v2');
			expect(model.defaultObjectGenerationMode).toBe('json');
			expect(model.supportsImageUrls).toBe(false);
			expect(model.supportsStructuredOutputs).toBe(false);
			expect(model.provider).toBe('claude-code');
		});

		it('should support generation methods', async () => {
			const client = provider.getClient({});
			const model = client('sonnet');
			
			// Test generation
			const result = await model.doGenerate();
			expect(result.text).toBe('Hello from Claude Code!');
			expect(result.finishReason).toBe('stop');
			expect(result.usage).toEqual({
				promptTokens: 10,
				completionTokens: 20
			});
		});

		it('should support streaming', async () => {
			const client = provider.getClient({});
			const model = client('sonnet');
			
			// Test streaming
			const stream = model.doStream();
			const chunks = [];
			for await (const chunk of stream) {
				chunks.push(chunk);
			}
			
			expect(chunks).toHaveLength(4);
			expect(chunks[0]).toEqual({ type: 'text-delta', textDelta: 'Hello' });
			expect(chunks[3]).toEqual({ type: 'finish', finishReason: 'stop' });
		});
	});

	describe('error handling', () => {
		it('should handle provider creation errors', async () => {
			// Mock createClaudeCode to throw an error
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
			createClaudeCode.mockImplementationOnce(() => {
				throw new Error('Provider initialization failed');
			});

			const errorProvider = new ClaudeCodeProvider();
			expect(() => errorProvider.getClient({})).toThrow('Provider initialization failed');
		});
	});
});

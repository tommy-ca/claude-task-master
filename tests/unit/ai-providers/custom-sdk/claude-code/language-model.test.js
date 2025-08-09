import { jest } from '@jest/globals';

// Mock supporting modules used by the language model
jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/claude-code/message-converter.js',
	() => ({
		convertToClaudeCodeMessages: jest.fn((prompt) => ({
			messagesPrompt: prompt
		}))
	})
);

jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/claude-code/json-extractor.js',
	() => ({
		extractJson: jest.fn((text) => text)
	})
);

jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/claude-code/errors.js',
	() => ({
		createAPICallError: jest.fn((opts) => new Error(opts.message)),
		createAuthenticationError: jest.fn((opts) => new Error(opts.message))
	})
);

// This mock will be controlled by tests
let mockClaudeCodeModule = null;
jest.unstable_mockModule('@anthropic-ai/claude-code', () => {
	if (mockClaudeCodeModule) {
		return mockClaudeCodeModule;
	}
	throw new Error("Cannot find module '@anthropic-ai/claude-code'");
});

// Import the module under test
const { ClaudeCodeLanguageModel } = await import(
	'../../../../../src/ai-providers/custom-sdk/claude-code/language-model.js'
);

// Helper to reset dynamic import state
const resetModuleState = async () => {
	mockClaudeCodeModule = null;
	jest.resetModules();
};

describe('ClaudeCodeLanguageModel (ai-sdk-provider-claude-code@beta aligned)', () => {
	afterEach(async () => {
		await resetModuleState();
	});

	it('constructs with model id and exposes provider name', async () => {
		const model = new ClaudeCodeLanguageModel({ id: 'opus', settings: {} });
		expect(model.modelId).toBe('opus');
		expect(model.provider).toBe('claude-code');
	});

	it('throws a helpful error when the underlying SDK is not installed (lazy load)', async () => {
		const { ClaudeCodeLanguageModel: TestModel } = await import(
			'../../../../../src/ai-providers/custom-sdk/claude-code/language-model.js'
		);
		const model = new TestModel({ id: 'opus', settings: {} });

		await expect(
			model.doGenerate({ prompt: [{ role: 'user', content: 'Hi' }], mode: { type: 'regular' } })
		).rejects.toThrow(
			"Claude Code SDK is not installed. Please install '@anthropic-ai/claude-code' to use the claude-code provider."
		);
	});

	it('generates text when SDK is available', async () => {
		// Provide a mocked implementation of the SDK's query async generator
		mockClaudeCodeModule = {
			AbortError: class AbortError extends Error {},
			query: ({ prompt }) =>
				(async function* () {
					yield { type: 'system', subtype: 'init', session_id: 'sess-1' };
					yield {
						type: 'assistant',
						message: { content: [{ type: 'text', text: 'Hello ' }] }
					};
					yield {
						type: 'assistant',
						message: { content: [{ type: 'text', text: 'World' }] }
					};
					yield {
						type: 'result',
						session_id: 'sess-1',
						total_cost_usd: 0.001,
						duration_ms: 123,
						usage: {
							input_tokens: 10,
							output_tokens: 5
						}
					};
				})()
		};

		jest.resetModules();
		const { ClaudeCodeLanguageModel: FreshModel } = await import(
			'../../../../../src/ai-providers/custom-sdk/claude-code/language-model.js'
		);

		const model = new FreshModel({ id: 'sonnet', settings: {} });
		const result = await model.doGenerate({
			prompt: [{ role: 'user', content: 'Hi' }],
			mode: { type: 'regular' }
		});

		expect(result.text).toBe('Hello World');
		expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
		expect(result.providerMetadata['claude-code'].sessionId).toBe('sess-1');
	});
});
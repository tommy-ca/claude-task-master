import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock external modules
jest.mock('child_process', () => ({
	execSync: jest.fn()
}));

// Mock console methods
jest.mock('console', () => ({
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
}));

describe('Kilo Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('.kilocodemodes')) {
				return 'Existing kilocodemodes content';
			}
			if (filePath.toString().includes('-rules')) {
				return 'Existing mode rules content';
			}
			return '{}';
		});
		jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
		jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up the temporary directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			console.error(`Error cleaning up: ${err.message}`);
		}
	});

	// Test function that simulates the createProjectStructure behavior for Kilo files
	function mockCreateKiloStructure() {
		// Create main .kilo directory
		fs.mkdirSync(path.join(tempDir, '.kilo'), { recursive: true });

		// Create rules directory
		fs.mkdirSync(path.join(tempDir, '.kilo', 'rules'), { recursive: true });

		// Create mode-specific rule directories
		const kiloModes = [
			'architect',
			'ask',
			'orchestrator',
			'code',
			'debug',
			'test'
		];
		for (const mode of kiloModes) {
			fs.mkdirSync(path.join(tempDir, '.kilo', `rules-${mode}`), {
				recursive: true
			});
			fs.writeFileSync(
				path.join(tempDir, '.kilo', `rules-${mode}`, `${mode}-rules`),
				`Content for ${mode} rules`
			);
		}

		// Create additional directories
		fs.mkdirSync(path.join(tempDir, '.kilo', 'config'), { recursive: true });
		fs.mkdirSync(path.join(tempDir, '.kilo', 'templates'), { recursive: true });
		fs.mkdirSync(path.join(tempDir, '.kilo', 'logs'), { recursive: true });

		// Copy .kilocodemodes file
		fs.writeFileSync(
			path.join(tempDir, '.kilocodemodes'),
			'Kilocodemodes file content'
		);
	}

	test('creates all required .kilo directories', () => {
		// Act
		mockCreateKiloStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.kilo'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules'),
			{ recursive: true }
		);

		// Verify all mode directories are created
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-architect'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-ask'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-orchestrator'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-code'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-debug'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-test'),
			{ recursive: true }
		);
	});

	test('creates rule files for all modes', () => {
		// Act
		mockCreateKiloStructure();

		// Assert - check all rule files are created
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-architect', 'architect-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-ask', 'ask-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-orchestrator', 'orchestrator-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-code', 'code-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-debug', 'debug-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'rules-test', 'test-rules'),
			expect.any(String)
		);
	});

	test('creates .kilocodemodes file in project root', () => {
		// Act
		mockCreateKiloStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilocodemodes'),
			expect.any(String)
		);
	});

	test('creates additional required Kilo directories', () => {
		// Act
		mockCreateKiloStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'config'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'templates'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kilo', 'logs'),
			{ recursive: true }
		);
	});
});

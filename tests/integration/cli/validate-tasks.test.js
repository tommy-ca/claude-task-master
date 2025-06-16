import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const TASK_MASTER_CLI = 'node ../../../../bin/task-master.js'; // Adjusted path relative to test file

// Helper function to construct fixture path
const fixturePath = (filename) =>
  path.resolve(__dirname, 'fixtures', filename);

// Helper to run CLI command, capture output, and handle errors
const runCLI = (args) => {
  try {
    const output = execSync(`${TASK_MASTER_CLI} ${args}`, { encoding: 'utf8', stdio: 'pipe' });
    return { stdout: output, stderr: '', exitCode: 0 };
  } catch (error) {
    // error.stdout and error.stderr are Buffers, convert to string
    return {
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : '',
      exitCode: error.status || 1, // error.status is the exit code
    };
  }
};

describe('CLI command: validate-tasks', () => {
  const validTasksFile = fixturePath('valid-tasks.json');
  const invalidTaskFieldFile = fixturePath('invalid-task-field.json');
  const invalidFileStructureFile = fixturePath('invalid-file-structure.json');
  const tasksForTagValidationFile = fixturePath('tasks-for-tag-validation.json');

  // Test 1: Validate a valid tasks.json file
  test('should succeed with a valid tasks.json file', () => {
    const { stdout, exitCode } = runCLI(`validate-tasks --file ${validTasksFile}`);
    expect(stdout).toMatch(/Validation successful for entire file structure/i);
    expect(exitCode).toBe(0);
  });

  // Test 2: Validate tasks.json with an invalid task field
  test('should fail with specific error for invalid task field', () => {
    const { stdout, stderr, exitCode } = runCLI(`validate-tasks --file ${invalidTaskFieldFile}`);
    expect(stdout).toMatch(/Validation failed/i);
    expect(stdout).toMatch(/Path: \/mainS\/tasks\/0\/status - Issue: value 'invalid_status_value' is not one of allowed values/i);
    expect(exitCode).toBe(1);
  });

  // Test 3: Validate tasks.json with invalid file structure (e.g., missing metadata)
  test('should fail with specific error for invalid file structure', () => {
    const { stdout, stderr, exitCode } = runCLI(`validate-tasks --file ${invalidFileStructureFile}`);
    expect(stdout).toMatch(/Validation failed/i);
    expect(stdout).toMatch(/Path: \/brokenTagS - Issue: property 'metadata' is missing/i);
    expect(exitCode).toBe(1);
  });

  // Test 4: Validate a specific tag with an invalid task
  test('should fail for a specific tag containing an invalid task', () => {
    const { stdout, stderr, exitCode } = runCLI(
      `validate-tasks --file ${tasksForTagValidationFile} --tag validTagWithInvalidTaskS`
    );
    expect(stdout).toMatch(/Validation failed for tasks for tag 'validTagWithInvalidTaskS'/i);
    // The error path will be relative to the array being validated
    expect(stdout).toMatch(/Path: \/0 - Issue: property 'status' is missing/i);
    expect(exitCode).toBe(1);
  });

  // Test 5: Validate a non-existent tag
  test('should error when trying to validate a non-existent tag', () => {
    const { stdout, stderr, exitCode } = runCLI(
      `validate-tasks --file ${tasksForTagValidationFile} --tag nonExistentTagS`
    );
    // This error comes from the command itself, not the schema validation, so it might be in stderr or different stdout format
    expect(stdout).toMatch(/Tag 'nonExistentTagS' not found or has no tasks array/i);
    expect(exitCode).toBe(1);
  });

  // Test 6: Validate a specific tag with all valid tasks
  test('should succeed for a specific tag with all valid tasks', () => {
    const { stdout, exitCode } = runCLI(
      `validate-tasks --file ${tasksForTagValidationFile} --tag validTagWithValidTasksS`
    );
    expect(stdout).toMatch(/Validation successful for tasks for tag 'validTagWithValidTasksS'/i);
    expect(exitCode).toBe(0);
  });
   // Test 7: Validate a specific tag with no tasks (should be valid)
  test('should succeed for a specific tag with no tasks', () => {
    const { stdout, exitCode } = runCLI(
      `validate-tasks --file ${tasksForTagValidationFile} --tag anotherValidTagS`
    );
    expect(stdout).toMatch(/Validation successful for tasks for tag 'anotherValidTagS'/i);
    expect(exitCode).toBe(0);
  });
});

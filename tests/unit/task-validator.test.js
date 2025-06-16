import {
  validateTask,
  validateTasksArray,
  validateTasksFile,
  formatAjvError,
} from '../../scripts/modules/task-validator.js';

// Minimal valid task for reuse
const createValidTask = (id = 1) => ({
  id,
  title: `Test Task ${id}`,
  description: `Description for task ${id}`,
  status: 'pending',
  // Omitting optional fields for baseline validity
  dependencies: [],
  priority: 'medium',
  details: 'Some details',
  testStrategy: 'Test strategy',
  subtasks: [],
});

// Minimal valid metadata for reuse
const createValidMetadata = () => ({
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  description: 'Test metadata',
});

describe('task-validator.js', () => {
  describe('validateTask', () => {
    test('should return isValid: true for a valid task object', () => {
      const task = createValidTask();
      const result = validateTask(task);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    test('should return isValid: false if title is missing', () => {
      const task = { ...createValidTask(), title: undefined };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: { missingProperty: 'title' },
          }),
        ])
      );
    });

    test('should return isValid: false for invalid status enum value', () => {
      const task = { ...createValidTask(), status: 'completed' }; // 'completed' is not in the enum
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
            instancePath: '/status',
            params: { allowedValues: ['pending', 'in-progress', 'done', 'review', 'deferred', 'cancelled'] },
          }),
        ])
      );
    });

    test('should return isValid: false for invalid priority enum value', () => {
      const task = { ...createValidTask(), priority: 'urgent' };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
            instancePath: '/priority',
            params: { allowedValues: ['high', 'medium', 'low'] },
          }),
        ])
      );
    });

    test('should return isValid: false if dependencies contains non-integer', () => {
      const task = { ...createValidTask(), dependencies: ['not-a-number'] };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'type',
            instancePath: '/dependencies/0',
            params: { type: 'integer' },
          }),
        ])
      );
    });

    test('should return isValid: false if a subtask is missing its title', () => {
      const task = {
        ...createValidTask(),
        subtasks: [{ ...createValidTask(2), title: undefined }],
      };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            instancePath: '/subtasks/0',
            params: { missingProperty: 'title' },
          }),
        ])
      );
    });

     test('should return isValid: true for a task with all optional fields', () => {
      const task = {
        ...createValidTask(),
        previousStatus: "pending",
        acceptanceCriteria: "All tests pass",
        parentTaskId: 100
      };
      const result = validateTask(task);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('validateTasksArray', () => {
    test('should return isValid: true for an array with one valid task', () => {
      const tasksArray = [createValidTask()];
      const result = validateTasksArray(tasksArray);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    test('should return isValid: false for an array with one invalid task', () => {
      const tasksArray = [{ ...createValidTask(), status: 'invalidStatus' }];
      const result = validateTasksArray(tasksArray);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
            instancePath: '/0/status',
          }),
        ])
      );
    });
  });

  describe('validateTasksFile', () => {
    test('should return isValid: true for a valid tasks file structure', () => {
      const tasksFile = {
        masterS: { // Adhering to ^.+$ pattern by ending with S or any char
          tasks: [createValidTask()],
          metadata: createValidMetadata(),
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    test('should return isValid: false if a tag is missing metadata', () => {
      const tasksFile = {
        testTagS: { // Adhering to ^.+$ pattern
          tasks: [createValidTask()],
          // metadata is missing
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            instancePath: '/testTagS',
            params: { missingProperty: 'metadata' },
          }),
        ])
      );
    });

    test('should return isValid: false if a tag is missing tasks array', () => {
      const tasksFile = {
        anotherTagS: { // Adhering to ^.+$ pattern
          // tasks is missing
          metadata: createValidMetadata(),
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            instancePath: '/anotherTagS',
            params: { missingProperty: 'tasks' },
          }),
        ])
      );
    });

    test('should return isValid: false if a tag contains an invalid task', () => {
      const tasksFile = {
        badTaskTagS: { // Adhering to ^.+$ pattern
          tasks: [{ ...createValidTask(), id: 'not-a-number' }],
          metadata: createValidMetadata(),
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'type',
            instancePath: '/badTaskTagS/tasks/0/id',
            params: { type: 'integer' },
          }),
        ])
      );
    });

    test('should return isValid: false for file with additional top-level property', () => {
      const tasksFile = {
        masterS: { // Adhering to ^.+$ pattern
          tasks: [createValidTask()],
          metadata: createValidMetadata(),
        },
        unexpectedProperty: {}, // This should fail due to additionalProperties: false
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
            params: { additionalProperty: 'unexpectedProperty' }
          }),
        ])
      );
    });

    test('should return isValid: true for an empty object file', () => {
      // Empty object is valid because patternProperties doesn't require a match,
      // and there are no other top-level required properties.
      const tasksFile = {};
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('formatAjvError', () => {
    test('should format "required" error', () => {
      const error = {
        instancePath: '/task',
        keyword: 'required',
        params: { missingProperty: 'title' },
        message: "should have required property 'title'",
      };
      expect(formatAjvError(error)).toBe(
        "Path: /task - Issue: property 'title' is missing (Keyword: required)"
      );
    });

    test('should format "enum" error', () => {
      const error = {
        instancePath: '/task/status',
        keyword: 'enum',
        params: { allowedValues: ['pending', 'done'] },
        data: 'invalid',
        message: 'must be equal to one of the allowed values',
      };
      expect(formatAjvError(error)).toBe(
        "Path: /task/status - Issue: value 'invalid' is not one of allowed values: [pending, done] (Keyword: enum)"
      );
    });

    test('should format "type" error', () => {
      const error = {
        instancePath: '/task/id',
        keyword: 'type',
        params: { type: 'integer' },
        data: 'string-id',
        message: 'must be integer',
      };
      expect(formatAjvError(error)).toBe(
        "Path: /task/id - Issue: value 'string-id' should be of type 'integer' (Keyword: type)"
      );
    });

    test('should format "pattern" error', () => {
      const error = {
        instancePath: '/tagKey',
        keyword: 'pattern',
        params: { pattern: '^.+$' },
        data: '', // Example of data that fails the pattern for a non-empty string
        message: 'must match pattern "^.+$"',
      };
      expect(formatAjvError(error)).toBe(
        "Path: /tagKey - Issue: value '' does not match pattern '^.+$' (Keyword: pattern)"
      );
    });

    test('should format a generic error', () => {
      const error = {
        instancePath: '/task/customField',
        keyword: 'custom',
        params: { foo: 'bar' },
        message: 'custom validation failed',
      };
      expect(formatAjvError(error)).toBe(
        'Path: /task/customField - Issue: custom validation failed (Keyword: custom)'
      );
    });

    test('should use "root" for path if instancePath is empty', () => {
      const error = {
        instancePath: '',
        keyword: 'required',
        params: { missingProperty: 'someProperty' },
        message: "should have required property 'someProperty'",
      };
      expect(formatAjvError(error)).toBe(
        "Path: root - Issue: property 'someProperty' is missing (Keyword: required)"
      );
    });
  });
});

import {
  validateTask,
  validateTasksArray,
  validateTasksFile,
  formatAjvError,
  initializeValidationSchemas,
  resetSchemaState,
} from '../../scripts/modules/task-validator.js';

describe('task-validator.js - Error Handling', () => {
  beforeEach(() => {
    // Reset schema state before each test
    resetSchemaState();
  });

  afterEach(() => {
    // Reset schema state after each test
    resetSchemaState();
  });

  describe('formatAjvError - Error Handling Extensions', () => {
    test('should format schema-compilation error', () => {
      const error = {
        instancePath: '',
        keyword: 'schema-compilation',
        message: 'Schema compilation failed: Invalid schema structure',
      };
      expect(formatAjvError(error)).toBe(
        'Path: root - Issue: Schema compilation error: Schema compilation failed: Invalid schema structure (Keyword: schema-compilation)'
      );
    });

    test('should format validation-runtime error', () => {
      const error = {
        instancePath: '/task',
        keyword: 'validation-runtime',
        message: 'Validation runtime error: Circular reference detected',
      };
      expect(formatAjvError(error)).toBe(
        'Path: /task - Issue: Runtime validation error: Validation runtime error: Circular reference detected (Keyword: validation-runtime)'
      );
    });

    test('should format schema-reference error', () => {
      const error = {
        instancePath: '',
        keyword: 'schema-reference',
        message: 'Task schema (task.schema.json) not loaded into Ajv.',
      };
      expect(formatAjvError(error)).toBe(
        'Path: root - Issue: Schema reference error: Task schema (task.schema.json) not loaded into Ajv. (Keyword: schema-reference)'
      );
    });

    test('should handle missing params gracefully', () => {
      const error = {
        instancePath: '/task',
        keyword: 'required',
        message: "should have required property 'title'",
        params: null // Missing params
      };
      expect(formatAjvError(error)).toBe(
        "Path: /task - Issue: property 'undefined' is missing (Keyword: required)"
      );
    });

    test('should handle missing params object gracefully', () => {
      const error = {
        instancePath: '/task',
        keyword: 'enum',
        message: 'must be equal to one of the allowed values',
        data: 'invalid',
        params: null // Missing params
      };
      expect(formatAjvError(error)).toBe(
        "Path: /task - Issue: value 'invalid' is not one of allowed values: [undefined] (Keyword: enum)"
      );
    });
  });

  describe('initializeValidationSchemas', () => {
    test('should return success when schemas are properly initialized', () => {
      const result = initializeValidationSchemas();

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should return cached result on subsequent calls', () => {
      // First call
      const result1 = initializeValidationSchemas();
      expect(result1.success).toBe(true);

      // Second call should return cached result
      const result2 = initializeValidationSchemas();
      expect(result2.success).toBe(true);
    });
  });

  describe('resetSchemaState', () => {
    test('should reset schema state properly', () => {
      // First initialize schemas
      const result1 = initializeValidationSchemas();
      expect(result1.success).toBe(true);

      // Reset state
      resetSchemaState();

      // Should reinitialize successfully again
      const result2 = initializeValidationSchemas();
      expect(result2.success).toBe(true);
    });
  });

  describe('Validation with proper error handling', () => {
    test('should validate task successfully with proper schemas', () => {
      const task = { id: 1, title: 'Test', description: 'Test', status: 'pending' };
      const result = validateTask(task);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.schemaError).toBeUndefined();
    });

    test('should validate tasks file successfully with proper schemas', () => {
      const tasksFile = { 
        master: { 
          tasks: [{ id: 1, title: 'Test', description: 'Test', status: 'pending' }], 
          metadata: { 
            created: '2023-01-01T00:00:00Z', 
            updated: '2023-01-01T00:00:00Z', 
            description: 'test' 
          } 
        } 
      };
      const result = validateTasksFile(tasksFile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.schemaError).toBeUndefined();
    });

    test('should validate tasks array successfully with proper schemas', () => {
      const tasksArray = [{ id: 1, title: 'Test', description: 'Test', status: 'pending' }];
      const result = validateTasksArray(tasksArray);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.schemaError).toBeUndefined();
    });

    test('should handle invalid task data gracefully', () => {
      const invalidTask = { id: 'not-a-number', title: 'Test', description: 'Test', status: 'pending' };
      const result = validateTask(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.schemaError).toBeUndefined();
    });

    test('should handle invalid tasks file data gracefully', () => {
      const invalidTasksFile = { 
        master: { 
          tasks: [{ id: 'not-a-number', title: 'Test', description: 'Test', status: 'pending' }], 
          metadata: { 
            created: '2023-01-01T00:00:00Z', 
            updated: '2023-01-01T00:00:00Z', 
            description: 'test' 
          } 
        } 
      };
      const result = validateTasksFile(invalidTasksFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.schemaError).toBeUndefined();
    });

    test('should handle invalid tasks array data gracefully', () => {
      const invalidTasksArray = [{ id: 'not-a-number', title: 'Test', description: 'Test', status: 'pending' }];
      const result = validateTasksArray(invalidTasksArray);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.schemaError).toBeUndefined();
    });
  });
});
import { z } from 'zod';

// Define Zod schemas for task validation
const TaskStatusSchema = z.enum(['pending', 'in-progress', 'done', 'review', 'deferred', 'cancelled']);
const TaskPrioritySchema = z.enum(['high', 'medium', 'low']);

// Base task schema (without subtasks to avoid circular reference)
const BaseTaskSchema = z.object({
  id: z.number().int().describe('Unique identifier for the task'),
  title: z.string().describe('Title of the task'),
  description: z.string().describe('Detailed description of the task'),
  status: TaskStatusSchema.describe('Current status of the task'),
  dependencies: z.array(z.number().int()).optional().describe('List of task IDs that this task depends on'),
  priority: TaskPrioritySchema.default('medium').describe('Priority level of the task'),
  details: z.string().optional().describe('Additional details or notes for the task'),
  testStrategy: z.string().optional().describe('Testing strategy for the task'),
  previousStatus: z.string().optional().describe('The status of the task before the current status'),
  acceptanceCriteria: z.string().optional().describe('Acceptance criteria for completing the task'),
  parentTaskId: z.number().int().optional().describe('ID of the parent task, if this is a subtask')
});

// Task schema with recursive subtasks
const TaskSchema = BaseTaskSchema.extend({
  subtasks: z.lazy(() => z.array(TaskSchema)).optional().describe('List of subtasks')
});

// Metadata schema for tasks file
const MetadataSchema = z.object({
  created: z.string().datetime().describe('Creation timestamp'),
  updated: z.string().datetime().describe('Last update timestamp'),
  description: z.string().describe('Description of the tag/section')
});

// Tag section schema
const TagSectionSchema = z.object({
  tasks: z.array(TaskSchema).describe('Array of tasks in this tag'),
  metadata: MetadataSchema.describe('Metadata for this tag section')
});

// Tasks file schema (object with dynamic tag names)
const TasksFileSchema = z.record(z.string(), TagSectionSchema).describe('Tasks file with tag sections');

/**
 * Converts Zod validation errors to a format compatible with the existing error handling
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {Array} Array of error objects in AJV-like format
 */
function convertZodErrorsToAjvFormat(zodError) {
  return zodError.errors.map(error => {
    // Convert path to AJV format (with leading slash)
    const instancePath = error.path.length > 0 ? `/${error.path.join('/')}` : '';
    
    const baseError = {
      keyword: mapZodCodeToAjvKeyword(error.code),
      message: error.message,
      instancePath: instancePath,
      schemaPath: `#${instancePath}`,
      params: {}
    };

    // Add specific data and params based on error type
    if (error.code === 'invalid_enum_value') {
      baseError.data = error.received;
      baseError.params = { allowedValues: error.options };
    } else if (error.code === 'invalid_type') {
      baseError.data = error.received;
      baseError.expected = error.expected;
      baseError.received = error.received;
      
      // Handle missing required fields (undefined received)
      if (error.received === 'undefined') {
        baseError.keyword = 'required';
        // For missing required properties, extract the property name from the path
        const propertyName = error.path[error.path.length - 1];
        baseError.params = { missingProperty: propertyName };
        baseError.instancePath = error.path.length > 1 ? `/${error.path.slice(0, -1).join('/')}` : '';
      } else if (error.expected === 'number') {
        baseError.keyword = 'type';
        baseError.params = { type: 'integer' };
      } else {
        baseError.keyword = 'type';
        baseError.params = { type: error.expected };
      }
    } else if (error.code === 'too_small') {
      baseError.data = error.received;
      baseError.minimum = error.minimum;
    } else if (error.code === 'too_big') {
      baseError.data = error.received;
      baseError.maximum = error.maximum;
    } else {
      baseError.data = error.received || error.input;
    }

    return baseError;
  });
}

/**
 * Maps Zod error codes to AJV keywords for compatibility
 * @param {string} zodCode - Zod error code
 * @returns {string} AJV keyword
 */
function mapZodCodeToAjvKeyword(zodCode) {
  const mapping = {
    'invalid_type': 'type',
    'invalid_enum_value': 'enum',
    'too_small': 'minimum',
    'too_big': 'maximum',
    'invalid_string': 'format',
    'invalid_date': 'format'
  };
  
  return mapping[zodCode] || zodCode;
}

/**
 * Validates a task object against the task schema.
 * @param {object} taskObject - The task object to validate.
 * @returns {{ isValid: boolean, errors: object[] | null, schemaError?: string }} Validation result.
 */
export function validateTask(taskObject) {
  try {
    TaskSchema.parse(taskObject);
    return {
      isValid: true,
      errors: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: convertZodErrorsToAjvFormat(error)
      };
    }
    
    return {
      isValid: false,
      errors: [{
        keyword: 'validation-runtime',
        message: `Validation runtime error: ${error.message}`,
        instancePath: '',
        schemaPath: ''
      }],
      schemaError: error.message
    };
  }
}

/**
 * Validates the entire tasks file content against the tasks file schema.
 * @param {object} tasksFileObject - The tasks file content (as a JavaScript object).
 * @returns {{ isValid: boolean, errors: object[] | null, schemaError?: string }} Validation result.
 */
export function validateTasksFile(tasksFileObject) {
  try {
    TasksFileSchema.parse(tasksFileObject);
    return {
      isValid: true,
      errors: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: convertZodErrorsToAjvFormat(error)
      };
    }
    
    return {
      isValid: false,
      errors: [{
        keyword: 'validation-runtime',
        message: `Validation runtime error: ${error.message}`,
        instancePath: '',
        schemaPath: ''
      }],
      schemaError: error.message
    };
  }
}

/**
 * Validates an array of task objects.
 * @param {object[]} tasksArray - The array of task objects to validate.
 * @returns {{ isValid: boolean, errors: object[] | null, schemaError?: string }} Validation result.
 */
export function validateTasksArray(tasksArray) {
  try {
    const TasksArraySchema = z.array(TaskSchema);
    TasksArraySchema.parse(tasksArray);
    return {
      isValid: true,
      errors: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: convertZodErrorsToAjvFormat(error)
      };
    }
    
    return {
      isValid: false,
      errors: [{
        keyword: 'validation-runtime',
        message: `Validation runtime error: ${error.message}`,
        instancePath: '',
        schemaPath: ''
      }],
      schemaError: error.message
    };
  }
}

/**
 * Formats a single validation error object into a user-friendly string.
 * @param {object} error - A validation error object (from Zod or converted format).
 * @returns {string} A formatted error string.
 */
export function formatAjvError(error) {
  const path = error.instancePath || 'root';
  let friendlyMessage = error.message;
  
  // Handle Zod error codes
  if (error.keyword === 'invalid_type') {
    friendlyMessage = `expected ${error.expected}, received ${error.received}`;
  } else if (error.keyword === 'invalid_enum_value') {
    friendlyMessage = `value '${error.data}' is not one of allowed values: [${error.params?.allowedValues?.join(', ')}]`;
  } else if (error.keyword === 'too_small') {
    friendlyMessage = `value is too small (minimum: ${error.minimum})`;
  } else if (error.keyword === 'too_big') {
    friendlyMessage = `value is too big (maximum: ${error.maximum})`;
  } else if (error.keyword === 'invalid_string') {
    friendlyMessage = `invalid string format`;
  } else if (error.keyword === 'invalid_date') {
    friendlyMessage = `invalid date format`;
  } else if (error.keyword === 'required') {
    friendlyMessage = `property '${error.params?.missingProperty}' is missing`;
  } else if (error.keyword === 'enum') {
    friendlyMessage = `value '${error.data}' is not one of allowed values: [${error.params?.allowedValues?.join(', ')}]`;
  } else if (error.keyword === 'type') {
    friendlyMessage = `value '${error.data}' should be of type '${error.params?.type}'`;
  } else if (error.keyword === 'pattern') {
    friendlyMessage = `value '${error.data}' does not match pattern '${error.params?.pattern}'`;
  } else if (error.keyword === 'schema-compilation') {
    friendlyMessage = `Schema compilation error: ${error.message}`;
  } else if (error.keyword === 'validation-runtime') {
    friendlyMessage = `Runtime validation error: ${error.message}`;
  } else if (error.keyword === 'schema-reference') {
    friendlyMessage = `Schema reference error: ${error.message}`;
  }
  
  return `Path: ${path} - Issue: ${friendlyMessage} (Keyword: ${error.keyword})`;
}

/**
 * Exports the schema initialization function for testing and debugging purposes.
 * @returns {Object} Initialization result with success status and error details
 */
export function initializeValidationSchemas() {
  // With Zod, schemas are always ready - no initialization needed
  return { success: true, error: null };
}

/**
 * Resets the schema compilation state (useful for testing).
 * No-op with Zod since there's no state to reset.
 */
export function resetSchemaState() {
  // No-op with Zod - schemas are stateless
}

// Export the schemas for direct use if needed
export { TaskSchema, TasksFileSchema, TaskStatusSchema, TaskPrioritySchema };

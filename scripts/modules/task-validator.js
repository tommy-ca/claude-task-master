import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schema compilation state
let schemaCompilationState = {
  isInitialized: false,
  initializationError: null,
  validateTaskSchema: null,
  validateTasksFileSchema: null,
  ajv: null
};

/**
 * Initializes the schema validation system with robust error handling.
 * @returns {Object} Initialization result with success status and error details
 */
function initializeSchemas() {
  if (schemaCompilationState.isInitialized) {
    return {
      success: !schemaCompilationState.initializationError,
      error: schemaCompilationState.initializationError
    };
  }

  try {
    // Adjust the path according to the actual location of schema files relative to this script
    const taskSchemaPath = path.resolve(__dirname, '../../schemas/task.schema.json');
    const tasksFileSchemaPath = path.resolve(__dirname, '../../schemas/tasks-file.schema.json');

    // Check if schema files exist
    if (!fs.existsSync(taskSchemaPath)) {
      throw new Error(`Task schema file not found at: ${taskSchemaPath}`);
    }
    if (!fs.existsSync(tasksFileSchemaPath)) {
      throw new Error(`Tasks file schema not found at: ${tasksFileSchemaPath}`);
    }

    // Load and parse schemas with error handling
    let taskSchema, tasksFileSchema;
    try {
      const taskSchemaContent = fs.readFileSync(taskSchemaPath, 'utf-8');
      taskSchema = JSON.parse(taskSchemaContent);
    } catch (error) {
      throw new Error(`Failed to load or parse task schema: ${error.message}`);
    }

    try {
      const tasksFileSchemaContent = fs.readFileSync(tasksFileSchemaPath, 'utf-8');
      tasksFileSchema = JSON.parse(tasksFileSchemaContent);
    } catch (error) {
      throw new Error(`Failed to load or parse tasks file schema: ${error.message}`);
    }

    // Initialize AJV with error handling
    let ajv;
    try {
      ajv = new Ajv({ allErrors: true, verbose: true });
      addFormats(ajv);
    } catch (error) {
      throw new Error(`Failed to initialize AJV validator: ${error.message}`);
    }

    // Add task schema to Ajv instance to resolve $ref in tasksFileSchema
    try {
      ajv.addSchema(taskSchema, 'task.schema.json');
    } catch (error) {
      throw new Error(`Failed to add task schema to AJV: ${error.message}`);
    }

    // Compile schemas with error handling
    let validateTaskSchema, validateTasksFileSchema;
    try {
      validateTaskSchema = ajv.compile(taskSchema);
    } catch (error) {
      throw new Error(`Failed to compile task schema: ${error.message}`);
    }

    try {
      validateTasksFileSchema = ajv.compile(tasksFileSchema);
    } catch (error) {
      throw new Error(`Failed to compile tasks file schema: ${error.message}`);
    }

    // Store successful compilation results
    schemaCompilationState = {
      isInitialized: true,
      initializationError: null,
      validateTaskSchema,
      validateTasksFileSchema,
      ajv
    };

    return { success: true, error: null };

  } catch (error) {
    // Store initialization error
    schemaCompilationState = {
      isInitialized: true,
      initializationError: error,
      validateTaskSchema: null,
      validateTasksFileSchema: null,
      ajv: null
    };

    return { success: false, error };
  }
}

/**
 * Gets the validation functions, initializing schemas if needed.
 * @returns {Object} Validation functions or error state
 */
function getValidationFunctions() {
  const initResult = initializeSchemas();
  if (!initResult.success) {
    return {
      success: false,
      error: initResult.error,
      validateTaskSchema: null,
      validateTasksFileSchema: null
    };
  }

  return {
    success: true,
    error: null,
    validateTaskSchema: schemaCompilationState.validateTaskSchema,
    validateTasksFileSchema: schemaCompilationState.validateTasksFileSchema
  };
}

/**
 * Validates a task object against the task.schema.json.
 * @param {object} taskObject - The task object to validate.
 * @returns {{ isValid: boolean, errors: object[] | null, schemaError?: string }} Validation result.
 */
export function validateTask(taskObject) {
  const validationFunctions = getValidationFunctions();
  
  if (!validationFunctions.success) {
    return {
      isValid: false,
      errors: [{
        keyword: 'schema-compilation',
        message: `Schema compilation failed: ${validationFunctions.error.message}`,
        instancePath: '',
        schemaPath: ''
      }],
      schemaError: validationFunctions.error.message
    };
  }

  try {
    const isValid = validationFunctions.validateTaskSchema(taskObject);
    return {
      isValid,
      errors: isValid ? null : validationFunctions.validateTaskSchema.errors,
    };
  } catch (error) {
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
 * Validates the entire tasks file content against the tasks-file.schema.json.
 * @param {object} tasksFileObject - The tasks file content (as a JavaScript object).
 * @returns {{ isValid: boolean, errors: object[] | null, schemaError?: string }} Validation result.
 */
export function validateTasksFile(tasksFileObject) {
  const validationFunctions = getValidationFunctions();
  
  if (!validationFunctions.success) {
    return {
      isValid: false,
      errors: [{
        keyword: 'schema-compilation',
        message: `Schema compilation failed: ${validationFunctions.error.message}`,
        instancePath: '',
        schemaPath: ''
      }],
      schemaError: validationFunctions.error.message
    };
  }

  try {
    const isValid = validationFunctions.validateTasksFileSchema(tasksFileObject);
    return {
      isValid,
      errors: isValid ? null : validationFunctions.validateTasksFileSchema.errors,
    };
  } catch (error) {
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
 * Requires task.schema.json to be added to Ajv instance first (which is done above).
 * @param {object[]} tasksArray - The array of task objects to validate.
 * @returns {{ isValid: boolean, errors: object[] | null, schemaError?: string }} Validation result.
 */
export function validateTasksArray(tasksArray) {
  const validationFunctions = getValidationFunctions();
  
  if (!validationFunctions.success) {
    return {
      isValid: false,
      errors: [{
        keyword: 'schema-compilation',
        message: `Schema compilation failed: ${validationFunctions.error.message}`,
        instancePath: '',
        schemaPath: ''
      }],
      schemaError: validationFunctions.error.message
    };
  }

  try {
    // Define schema on the fly or pre-compile if used frequently
    const schemaForArray = {
      type: 'array',
      items: { $ref: 'task.schema.json' }
    };
    
    const ajv = schemaCompilationState.ajv;
    const validate = ajv.getSchema('task.schema.json') // Check if task schema is loaded
      ? ajv.compile(schemaForArray)
      : null;

    if (!validate) {
      // This case should ideally not happen if ajv.addSchema was successful
      return {
        isValid: false,
        errors: [{ 
          keyword: 'schema-reference',
          message: "Task schema (task.schema.json) not loaded into Ajv.",
          instancePath: '',
          schemaPath: ''
        }],
        schemaError: "Task schema reference not found"
      };
    }
    
    const isValid = validate(tasksArray);
    return {
      isValid,
      errors: isValid ? null : validate.errors,
    };
  } catch (error) {
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
 * Formats a single Ajv error object into a user-friendly string.
 * @param {object} error - An Ajv error object.
 * @returns {string} A formatted error string.
 */
export function formatAjvError(error) {
  const path = error.instancePath || 'root';
  let friendlyMessage = error.message;
  
  if (error.keyword === 'required') {
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
  return initializeSchemas();
}

/**
 * Resets the schema compilation state (useful for testing).
 */
export function resetSchemaState() {
  schemaCompilationState = {
    isInitialized: false,
    initializationError: null,
    validateTaskSchema: null,
    validateTasksFileSchema: null,
    ajv: null
  };
}

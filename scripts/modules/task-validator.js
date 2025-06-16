import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load schemas
// Adjust the path according to the actual location of schema files relative to this script
const taskSchemaPath = path.resolve(__dirname, '../../schemas/task.schema.json');
const tasksFileSchemaPath = path.resolve(__dirname, '../../schemas/tasks-file.schema.json');

const taskSchema = JSON.parse(fs.readFileSync(taskSchemaPath, 'utf-8'));
const tasksFileSchema = JSON.parse(fs.readFileSync(tasksFileSchemaPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// Add task schema to Ajv instance to resolve $ref in tasksFileSchema
ajv.addSchema(taskSchema, 'task.schema.json');

// Compile schemas
const validateTaskSchema = ajv.compile(taskSchema);
const validateTasksFileSchema = ajv.compile(tasksFileSchema);

/**
 * Validates a task object against the task.schema.json.
 * @param {object} taskObject - The task object to validate.
 * @returns {{ isValid: boolean, errors: object[] | null }} Validation result.
 */
export function validateTask(taskObject) {
  const isValid = validateTaskSchema(taskObject);
  return {
    isValid,
    errors: isValid ? null : validateTaskSchema.errors,
  };
}

/**
 * Validates the entire tasks file content against the tasks-file.schema.json.
 * @param {object} tasksFileObject - The tasks file content (as a JavaScript object).
 * @returns {{ isValid: boolean, errors: object[] | null }} Validation result.
 */
export function validateTasksFile(tasksFileObject) {
  const isValid = validateTasksFileSchema(tasksFileObject);
  return {
    isValid,
    errors: isValid ? null : validateTasksFileSchema.errors,
  };
}

// Example of compiling a schema for an array of tasks, if needed later.
// const validateTasksArraySchema = ajv.compile({
//   type: 'array',
//   items: { $ref: 'task.schema.json' },
// });

/**
 * Validates an array of task objects.
 * Requires task.schema.json to be added to Ajv instance first (which is done above).
 * @param {object[]} tasksArray - The array of task objects to validate.
 * @returns {{ isValid: boolean, errors: object[] | null }} Validation result.
 */
export function validateTasksArray(tasksArray) {
  // Define schema on the fly or pre-compile if used frequently
  const schemaForArray = {
    type: 'array',
    items: { $ref: 'task.schema.json' }
  };
  const validate = ajv.getSchema('task.schema.json') // Check if task schema is loaded
    ? ajv.compile(schemaForArray)
    : null;

  if (!validate) {
    // This case should ideally not happen if ajv.addSchema was successful
    return {
      isValid: false,
      errors: [{ message: "Task schema (task.schema.json) not loaded into Ajv." }]
    };
  }
  const isValid = validate(tasksArray);
  return {
    isValid,
    errors: isValid ? null : validate.errors,
  };
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
    friendlyMessage = `property '${error.params.missingProperty}' is missing`;
  } else if (error.keyword === 'enum') {
    friendlyMessage = `value '${error.data}' is not one of allowed values: [${error.params.allowedValues.join(', ')}]`;
  } else if (error.keyword === 'type') {
    friendlyMessage = `value '${error.data}' should be of type '${error.params.type}'`;
  } else if (error.keyword === 'pattern') {
    friendlyMessage = `value '${error.data}' does not match pattern '${error.params.pattern}'`;
  }
  return `Path: ${path} - Issue: ${friendlyMessage} (Keyword: ${error.keyword})`;
}

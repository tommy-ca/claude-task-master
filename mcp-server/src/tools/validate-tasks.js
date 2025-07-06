/**
 * tools/validate-tasks.js
 * Tool for validating tasks file structure and content
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { validateTasksFile, validateTasksArray, formatAjvError } from '../../../scripts/modules/task-validator.js';
import { readJSON } from '../../../scripts/modules/utils.js';

/**
 * Register the validateTasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerValidateTasksTool(server) {
	server.addTool({
		name: 'validate_tasks',
		description:
			'Validates the structure and content of the tasks.json file or a specific tag within it.',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Validate only the specified tag tasks array')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Validating tasks with args: ${JSON.stringify(args)}`);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				if (!tasksJsonPath) {
					return createErrorResponse(
						`Could not find tasks.json file in project: ${args.projectRoot}`
					);
				}

				// Read the tasks file
				const tasksData = readJSON(tasksJsonPath, args.projectRoot);
				if (!tasksData) {
					return createErrorResponse(
						`Could not read tasks file at: ${tasksJsonPath}`
					);
				}

				let result;
				let validationTargetDescription;

				if (args.tag) {
					// Validate specific tag
					validationTargetDescription = `tasks for tag '${args.tag}'`;
					const tagToValidate = args.tag;
					const fullData = tasksData._rawTaggedData || tasksData;

					if (fullData && fullData[tagToValidate] && Array.isArray(fullData[tagToValidate].tasks)) {
						result = validateTasksArray(fullData[tagToValidate].tasks);
					} else {
						return createErrorResponse(
							`Tag '${tagToValidate}' not found or has no tasks array in ${tasksJsonPath}`
						);
					}
				} else {
					// Validate entire file structure
					validationTargetDescription = `entire file structure of ${tasksJsonPath}`;
					const fullData = tasksData._rawTaggedData || tasksData;
					result = validateTasksFile(fullData);
				}

				if (result.isValid) {
					const successMessage = `Validation successful for ${validationTargetDescription}.`;
					log.info(successMessage);
					return {
						success: true,
						data: {
							message: successMessage,
							isValid: true,
							validationTarget: validationTargetDescription,
							filePath: tasksJsonPath
						}
					};
				} else {
					const errorMessages = (result.errors || []).map(error => formatAjvError(error));
					const failureMessage = `Validation failed for ${validationTargetDescription}`;
					
					log.error(`${failureMessage}: ${errorMessages.join('; ')}`);
					
					return {
						success: false,
						error: {
							message: failureMessage,
							isValid: false,
							validationTarget: validationTargetDescription,
							filePath: tasksJsonPath,
							errors: errorMessages
						}
					};
				}

			} catch (error) {
				log.error(`Error in validateTasks tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
import { generateObject, streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await streamObject({
	model: openai('gpt-4o-mini'),
	prompt: 'What is the capital of France?',
	schema: z.object({
		capital: z.string()
	}),
	maxOutputTokens: 100,
});

console.log(result);
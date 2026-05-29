import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_PROMPT = `
You are an expert technical writer and software engineer.
Summarize the following commit messages into a clear, structured release note or PR description.
Group them by features, bug fixes, and chores if possible.

Commits:
{{commits}}
`;

export interface LlmOptions {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  customPrompt?: string;
}

export async function generateReport(
  commits: string[],
  options: LlmOptions
): Promise<string> {
  const commitList = commits.map(c => `- ${c}`).join('\n');
  const template = options.customPrompt || DEFAULT_PROMPT;
  const prompt = template.replace('{{commits}}', commitList);

  const provider = options.provider.toLowerCase();

  if (provider === 'openai' || provider === 'custom') {
    const config: any = { apiKey: options.apiKey };
    if (options.baseUrl) {
      config.baseURL = options.baseUrl;
    }
    
    const openai = new OpenAI(config);
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content || '';
  }

  if (provider === 'gemini') {
    // Note: custom base URL for Google SDK might require custom fetch or proxy
    const genAI = new GoogleGenerativeAI(options.apiKey);
    const model = genAI.getGenerativeModel({ model: options.model || 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  throw new Error(`Unsupported LLM provider: ${options.provider}`);
}

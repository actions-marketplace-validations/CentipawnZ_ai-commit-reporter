import * as core from '@actions/core';
import * as github from '@actions/github';
import { generateReport } from './llm';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const llmProvider = core.getInput('llm-provider', { required: true });
    const llmApiKey = core.getInput('llm-api-key', { required: true });
    const llmModel = core.getInput('llm-model');
    const llmBaseUrl = core.getInput('llm-base-url');
    const customPrompt = core.getInput('prompt-template');
    const outputMode = core.getInput('output-mode');

    const octokit = github.getOctokit(token);
    const context = github.context;

    let commits: string[] = [];

    if (context.eventName === 'pull_request') {
      const prNumber = context.payload.pull_request?.number;
      if (!prNumber) throw new Error('Could not get PR number from context');

      const { data } = await octokit.rest.pulls.listCommits({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
      });
      
      commits = data.map((commit) => commit.commit.message);
    } else {
      // Fallback to push event commits
      const payloadCommits = context.payload.commits;
      if (payloadCommits && Array.isArray(payloadCommits)) {
        commits = payloadCommits.map((c: any) => c.message);
      } else {
        core.info('No commits found in event payload.');
        return;
      }
    }

    if (commits.length === 0) {
      core.info('No commits to process.');
      return;
    }

    core.info(`Found ${commits.length} commits. Generating report using ${llmProvider}...`);
    
    const report = await generateReport(commits, {
      provider: llmProvider,
      apiKey: llmApiKey,
      model: llmModel,
      baseUrl: llmBaseUrl,
      customPrompt: customPrompt
    });

    core.setOutput('report', report);

    if (outputMode === 'pr_comment' && context.eventName === 'pull_request') {
      const prNumber = context.payload.pull_request?.number;
      if (prNumber) {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: `### 🤖 AI Commit Report\n\n${report}`,
        });
        core.info('Successfully commented on the PR.');
      }
    } else {
      core.info('Generated Report:');
      core.info(report);
    }

  } catch (error: any) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

run();

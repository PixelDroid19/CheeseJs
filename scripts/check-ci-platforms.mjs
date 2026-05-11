import { spawnSync } from 'node:child_process';

const requiredNativePlatforms = [
  'ubuntu-latest',
  'macos-latest',
  'windows-latest',
];
const workflow = readFlag('--workflow') ?? 'build.yml';
const runId = readFlag('--run-id');
const branch = readFlag('--branch');

function readFlag(name) {
  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  const withValue = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (withValue) return withValue.slice(name.length + 1);

  return undefined;
}

function runGh(args, options = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    throw new Error(
      [
        `gh ${args.join(' ')} failed.`,
        stderr && `stderr:\n${stderr}`,
        stdout && `stdout:\n${stdout}`,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return result.stdout;
}

function getLatestRunId() {
  const args = [
    'run',
    'list',
    '--workflow',
    workflow,
    '--limit',
    '1',
    '--json',
    'databaseId,status,conclusion,headBranch,headSha,url,workflowName',
  ];

  if (branch) args.push('--branch', branch);

  const runs = JSON.parse(runGh(args));
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new Error(`No GitHub Actions runs found for workflow "${workflow}".`);
  }

  return runs[0].databaseId;
}

function assertSuccessfulRun(run) {
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error(
      `Workflow run ${run.databaseId} is not successful: status=${run.status}, conclusion=${run.conclusion}, url=${run.url}`
    );
  }
}

function jobMatches(job, jobName, platform) {
  const normalized = job.name.toLowerCase();
  return (
    normalized.includes(jobName.toLowerCase()) &&
    normalized.includes(platform.toLowerCase())
  );
}

function successfulJob(jobs, jobName, platform) {
  return jobs.find(
    (job) =>
      jobMatches(job, jobName, platform) &&
      job.status === 'completed' &&
      job.conclusion === 'success'
  );
}

function assertStep(job, stepName) {
  if (!Array.isArray(job.steps)) return;

  const step = job.steps.find((candidate) => candidate.name === stepName);
  if (!step) {
    throw new Error(`Job "${job.name}" is missing step "${stepName}".`);
  }

  if (step.conclusion !== 'success') {
    throw new Error(
      `Job "${job.name}" step "${stepName}" is not successful: ${step.conclusion}`
    );
  }
}

function assertPlatformJobs(run) {
  const jobs = run.jobs ?? [];
  const quality = jobs.find((job) => job.name === 'quality');
  if (
    !quality ||
    quality.status !== 'completed' ||
    quality.conclusion !== 'success'
  ) {
    throw new Error('Required quality job did not complete successfully.');
  }

  for (const platform of requiredNativePlatforms) {
    const nativeJob = successfulJob(jobs, 'native-platforms', platform);
    if (!nativeJob) {
      throw new Error(
        `Missing successful native-platforms job for ${platform}.`
      );
    }

    assertStep(nativeJob, 'Build and package native app');
    assertStep(nativeJob, 'Verify native package artifact');
    assertStep(nativeJob, 'Bundle budget check');
  }

  const releaseJobs = jobs.filter(
    (job) =>
      job.name.toLowerCase().includes('release') && job.conclusion !== 'skipped'
  );

  if (releaseJobs.length > 0) {
    for (const platform of requiredNativePlatforms) {
      const releaseJob = successfulJob(jobs, 'release', platform);
      if (!releaseJob) {
        throw new Error(`Missing successful release job for ${platform}.`);
      }

      assertStep(releaseJob, 'Build and package Zero Native app');
      assertStep(releaseJob, 'Verify native package artifact');
      assertStep(releaseJob, 'Bundle budget check');
    }
  }
}

const selectedRunId = runId ?? getLatestRunId();
const run = JSON.parse(
  runGh([
    'run',
    'view',
    String(selectedRunId),
    '--json',
    'databaseId,status,conclusion,headBranch,headSha,url,jobs,workflowName',
  ])
);

assertSuccessfulRun(run);
assertPlatformJobs(run);

console.log(
  `CI platform check passed for ${run.workflowName} run ${run.databaseId}: ${run.url}`
);

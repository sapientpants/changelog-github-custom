#!/usr/bin/env node

/**
 * =============================================================================
 * SCRIPT: Version and Release Manager
 * PURPOSE: Validate changesets and manage version bumps for releases
 * USAGE: Called by main.yml workflow after successful validation
 * OUTPUTS: Sets GitHub Actions outputs for version and changed status
 * =============================================================================
 */

import { execSync } from 'child_process';
import fs from 'fs';

// Execute shell command and return trimmed output
const exec = (cmd) => execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
// eslint-disable-next-line no-console
const log = (msg) => console.log(msg);

// Append key=value pairs to the GitHub Actions output file (no-op outside Actions)
const appendOutputs = (outputs) => {
  if (!process.env.GITHUB_OUTPUT) return;
  for (const [key, value] of Object.entries(outputs)) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
};

// Paths that contribute to the published package. A commit requires a release
// only when it touches at least one of these; repo tooling (workflows,
// scripts, configs, docs, lockfiles) never does, even with a feat:/fix: subject.
const isPackagePath = (path) =>
  /^(src|tests|dist)\//.test(path) || path === 'package.json' || /^tsconfig.*\.json$/.test(path);

// A subject alone does not make a commit releasable
const isReleasableSubject = (subject) => /^(feat|fix|perf|refactor)(\(.+\))?:/.test(subject);

async function main() {
  try {
    // =============================================================================
    // CHANGESET DETECTION
    // Check if changesets exist in .changeset directory
    // =============================================================================

    // Look for changeset markdown files (excluding README.md)
    const hasChangesets =
      fs.existsSync('.changeset') &&
      fs.readdirSync('.changeset').some((f) => f.endsWith('.md') && f !== 'README.md');

    if (!hasChangesets) {
      // =============================================================================
      // VALIDATE COMMITS MATCH CHANGESETS
      // Ensure feat/fix commits have corresponding changesets
      // =============================================================================

      // Find the last git tag to determine commit range
      let lastTag = '';
      try {
        lastTag = exec('git describe --tags --abbrev=0');
      } catch {
        // No tags exist yet (first release)
        lastTag = '';
      }

      // Get commits (subject + changed files) since last tag, or all commits if no tags.
      // "@@@%s" is a delimiter that cannot appear in a commit subject, and
      // --name-only lists each commit's paths directly below its subject.
      const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
      const commits = exec(`git log ${commitRange} --pretty=format:"@@@%s" --name-only`)
        .split('@@@')
        .map((entry) => {
          const lines = entry
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          return { subject: lines[0] ?? '', files: lines.slice(1) };
        })
        .filter((commit) => commit.subject);

      // A commit is releasable only if its subject marks user-facing work AND
      // it touches at least one path that ships in the published package.
      const releasableCommits = commits.filter(
        (commit) => isReleasableSubject(commit.subject) && commit.files.some(isPackagePath),
      );

      if (releasableCommits.length === 0) {
        // No commits that need a release
        log('⏭️ No releasable package commits found, skipping release');
        appendOutputs({ changed: false });
        process.exit(0);
      }

      // Filter out commits already reflected in CHANGELOG.md (from a previous
      // release whose tag push failed); do not re-demand their changesets
      const changelogContent = fs.existsSync('CHANGELOG.md')
        ? fs.readFileSync('CHANGELOG.md', 'utf-8')
        : '';
      const newReleasableCommits = releasableCommits.filter(
        (commit) => !changelogContent.includes(commit.subject),
      );

      if (newReleasableCommits.length === 0) {
        // All package commits are already in the changelog (from a previous release)
        log('⏭️ All releasable commits already documented, skipping release');
        appendOutputs({ changed: false });
        process.exit(0);
      }

      // VALIDATION ERROR: Found releasable commits without changesets
      // This enforces that all features/fixes are documented in changelog
      log('❌ Found releasable commits but no changeset');
      log('Commits that require a changeset:');
      newReleasableCommits.forEach((commit) => log(`  - ${commit.subject}`));
      log('\nPlease add a changeset by running: pnpm changeset');
      process.exit(1);
    }

    // =============================================================================
    // VERSION MANAGEMENT
    // Apply changesets to bump version and update CHANGELOG.md
    // =============================================================================

    // Get current version from package.json
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const currentVersion = pkg.version;
    log(`Current version: ${currentVersion}`);

    // Apply all pending changesets
    // This updates package.json version and CHANGELOG.md
    exec('pnpm changeset version');

    // Check if version actually changed
    const updatedPkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const newVersion = updatedPkg.version;

    if (currentVersion === newVersion) {
      // No version bump needed (e.g., all changesets were --empty)
      log('⏭️ No version change');
      appendOutputs({ changed: false, version: currentVersion });
      process.exit(0);
    }

    log(`📦 Version changed to: ${newVersion}`);

    // =============================================================================
    // GITHUB ACTIONS OUTPUT
    // Set outputs for workflow to use in subsequent steps
    // These values are used by main.yml to decide whether to create a release
    // =============================================================================

    appendOutputs({ changed: true, version: newVersion });
  } catch (error) {
    // Error handling with clear message
    // Common errors: permission issues, git conflicts, invalid changesets
    // eslint-disable-next-line no-console
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

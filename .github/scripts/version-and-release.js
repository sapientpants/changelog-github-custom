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
// package.json is further narrowed by touchesPackage below.
const isPackagePath = (path) =>
  /^(src|tests|dist)\//.test(path) || path === 'package.json' || /^tsconfig.*\.json$/.test(path);

// A subject alone does not make a commit releasable
const isReleasableSubject = (subject) => /^(feat|fix|perf|refactor)(\(.+\))?:/.test(subject);

// Returns true if the command exits 0, false otherwise
const succeeds = (cmd) => {
  try {
    exec(cmd);
    return true;
  } catch {
    return false;
  }
};

// Whether a GitHub release exists for the tag (requires the gh CLI)
const releaseExists = (tag) => {
  try {
    exec(`gh release view "${tag}" --json tagName`);
    return true;
  } catch (error) {
    if (/release not found/i.test(String(error.stderr))) return false;
    throw error;
  }
};

// package.json without fields that do not affect what the package does
// (dev tooling), so dependency maintenance neither requires a release nor
// blocks a release retry
const shippedManifest = (json) => {
  const manifest = JSON.parse(json);
  delete manifest.devDependencies;
  delete manifest.scripts;
  return JSON.stringify(manifest);
};

// Whether a commit changed the shipped part of package.json
const shippedManifestChanged = (hash) => {
  try {
    return (
      shippedManifest(exec(`git show "${hash}^:package.json"`)) !==
      shippedManifest(exec(`git show "${hash}:package.json"`))
    );
  } catch {
    // Root commit or package.json added: treat as changed
    return true;
  }
};

// Whether a commit touches the published package; a package.json change
// counts only if it goes beyond dev tooling
const touchesPackage = ({ hash, files }) =>
  files.some((file) => file !== 'package.json' && isPackagePath(file)) ||
  (files.includes('package.json') && shippedManifestChanged(hash));

// Detect a version that was tagged but never released: the release job failed
// after the version commit and tag were pushed. Its changesets are already
// consumed, so without this the release (and npm publish) is never retried.
// Only safe when the shipped package is unchanged since the tag.
const findUnreleasedVersion = (version) => {
  const tag = `v${version}`;
  if (!succeeds(`git rev-parse -q --verify "refs/tags/${tag}"`)) return null;
  if (releaseExists(tag)) return null;
  const sourceUnchanged = succeeds(`git diff --quiet "${tag}" -- src "tsconfig*.json"`);
  const manifestUnchanged =
    shippedManifest(exec(`git show "${tag}:package.json"`)) ===
    shippedManifest(fs.readFileSync('package.json', 'utf-8'));
  if (!sourceUnchanged || !manifestUnchanged) {
    log(`⚠️ ${tag} was tagged but never released, and the package changed since; not retrying it`);
    return null;
  }
  return version;
};

// Output a release of the current version (without bumping or re-tagging it)
// and exit, if it was tagged but never released
const retryIfUnreleased = (version) => {
  if (!findUnreleasedVersion(version)) return;
  log(`♻️ v${version} was tagged but never released, retrying its release`);
  appendOutputs({ changed: true, version, retry: true });
  process.exit(0);
};

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
      // RETRY UNRELEASED VERSION
      // Re-run the release for a version that was tagged but never released
      // =============================================================================

      retryIfUnreleased(JSON.parse(fs.readFileSync('package.json', 'utf-8')).version);

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

      // Get commits (hash, subject + changed files) since last tag, or all commits if no tags.
      // "@@@%H %s" is a delimiter that cannot appear in a commit subject, and
      // --name-only lists each commit's paths directly below its subject.
      const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
      const commits = exec(`git log ${commitRange} --pretty=format:"@@@%H %s" --name-only`)
        .split('@@@')
        .map((entry) => {
          const [header = '', ...files] = entry
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          return { hash: header.slice(0, 40), subject: header.slice(41), files };
        })
        .filter((commit) => commit.subject);

      // A commit is releasable only if its subject marks user-facing work AND
      // it touches at least one path that ships in the published package.
      const releasableCommits = commits.filter(
        (commit) => isReleasableSubject(commit.subject) && touchesPackage(commit),
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
      // No version bump needed (e.g., all changesets were --empty), but the
      // current version may still be awaiting a release
      retryIfUnreleased(currentVersion);
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

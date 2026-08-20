// Adapted from https://github.com/changesets/changesets/blob/main/packages/changelog-github/src/index.ts
import type { ChangelogFunctions } from '@changesets/types';
import { getCommitInfo, getPullRequestInfo } from '@changesets/get-github-info';

interface Options {
  repo: string;
}

const changelogFunctions: ChangelogFunctions = {
  getDependencyReleaseLine: async (changesets, dependenciesUpdated, options) => {
    const opts = options as unknown as Options;
    if (!opts.repo) {
      throw new Error(
        'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
      );
    }
    if (dependenciesUpdated.length === 0) return '';

    const changesetLink = `- Updated dependencies [${(
      await Promise.all(
        changesets.map(async (cs) => {
          if (cs.commit) {
            const commitInfo = await getCommitInfo({
              repo: opts.repo,
              commit: cs.commit,
            });
            return commitInfo?.commit?.markdownLink ?? null;
          }
          return null;
        }),
      )
    )
      .filter((_) => _)
      .join(', ')}]:`;

    const updatedDependenciesList = dependenciesUpdated.map(
      (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
    );

    return [changesetLink, ...updatedDependenciesList].join('\n');
  },
  getReleaseLine: async (changeset, _type, options) => {
    const opts = options as unknown as Options | undefined;
    if (!opts?.repo) {
      throw new Error(
        'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
      );
    }

    let prFromSummary: number | undefined;
    let commitFromSummary: string | undefined;

    const replacedChangelog = changeset.summary
      .replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr: string) => {
        const num = Number(pr);
        if (!isNaN(num)) prFromSummary = num;
        return '';
      })
      .replace(/^\s*commit:\s*([^\s]+)/im, (_, commit: string) => {
        commitFromSummary = commit;
        return '';
      })
      .replace(/^\s*(?:author|user):\s*@?([^\s]+)/gim, () => {
        return '';
      })
      .trim();

    const [firstLine, ...futureLines] = replacedChangelog.split('\n').map((l) => l.trimRight());

    const links = await (async () => {
      if (prFromSummary !== undefined) {
        const prInfo = await getPullRequestInfo({
          repo: opts.repo,
          pull: prFromSummary,
        });
        if (!prInfo) {
          return { commit: null, pull: null, user: null };
        }
        let commitLink: string | null = null;
        if (prInfo.commit) {
          commitLink = prInfo.commit.markdownLink ?? null;
        }
        if (commitFromSummary) {
          const shortCommitId = commitFromSummary.slice(0, 7);
          commitLink = `[\`${shortCommitId}\`](https://github.com/${opts.repo}/commit/${commitFromSummary})`;
        }
        const pullLink = prInfo.pull?.markdownLink ?? null;
        const userLink = prInfo.author?.markdownLink ?? null;
        return { commit: commitLink, pull: pullLink, user: userLink };
      }
      const commitToFetchFrom = commitFromSummary || changeset.commit;
      if (commitToFetchFrom) {
        try {
          const commitInfo = await getCommitInfo({
            repo: opts.repo,
            commit: commitToFetchFrom,
          });
          if (!commitInfo) {
            return { commit: null, pull: null, user: null };
          }
          return {
            commit: commitInfo.commit?.markdownLink ?? null,
            pull: commitInfo.pull?.markdownLink ?? null,
            user: commitInfo.author?.markdownLink ?? null,
          };
        } catch {
          // Handle getCommitInfo errors gracefully as expected by tests
          return {
            commit: null,
            pull: null,
            user: null,
          };
        }
      }
      return {
        commit: null,
        pull: null,
        user: null,
      };
    })();

    const prefix = [
      links.pull === null ? '' : ` ${links.pull}`,
      links.commit === null ? '' : ` ${links.commit}`,
    ].join('');

    return `\n\n-${prefix ? `${prefix} -` : ''} ${firstLine}\n${futureLines
      .map((l) => `  ${l}`)
      .join('\n')}`;
  },
};

export default changelogFunctions;

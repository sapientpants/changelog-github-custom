// Adapted from https://github.com/changesets/changesets/blob/main/packages/changelog-github/src/index.ts
import type { ChangelogFunctions } from '@changesets/types';
import { getCommitInfo, getPullRequestInfo } from '@changesets/get-github-info';

/**
 * Options accepted by this changelog generator via `.changeset/config.json`:
 *
 * ```json
 * "changelog": ["changelog-github-custom", { "repo": "org/repo" }]
 * ```
 */
export interface Options {
  /** GitHub repository slug in `owner/repo` form. */
  repo: string;
}

interface Links {
  commit: string | null;
  pull: string | null;
  user: string | null;
}

const NO_LINKS: Links = { commit: null, pull: null, user: null };

function isOptions(options: unknown): options is Options {
  return (
    typeof options === 'object' &&
    options !== null &&
    typeof (options as { repo?: unknown }).repo === 'string' &&
    (options as { repo: string }).repo.length > 0
  );
}

function requireRepo(options: unknown): Options {
  if (!isOptions(options)) {
    throw new Error(
      'Please provide a repo to this changelog generator like this:\n"changelog": ["changelog-github-custom", { "repo": "org/repo" }]',
    );
  }
  return options;
}

/**
 * GitHub lookups are best-effort: a changelog entry without links is better
 * than a failed `changeset version`. Any rejection degrades to `undefined`,
 * the same value the lookup returns when the object is not found.
 */
async function safeLookup<T>(lookup: () => Promise<T | undefined>): Promise<T | undefined> {
  try {
    return await lookup();
  } catch {
    return undefined;
  }
}

const changelogFunctions: ChangelogFunctions = {
  getDependencyReleaseLine: async (changesets, dependenciesUpdated, options) => {
    const { repo } = requireRepo(options);
    if (dependenciesUpdated.length === 0) return '';

    const commitLinks = await Promise.all(
      changesets.map(async ({ commit }) => {
        if (!commit) return null;
        const commitInfo = await safeLookup(() => getCommitInfo({ repo, commit }));
        return commitInfo?.commit.markdownLink ?? null;
      }),
    );

    const changesetLink = `- Updated dependencies [${commitLinks.filter(Boolean).join(', ')}]:`;

    const updatedDependenciesList = dependenciesUpdated.map(
      (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
    );

    return [changesetLink, ...updatedDependenciesList].join('\n');
  },
  getReleaseLine: async (changeset, _type, options) => {
    const { repo } = requireRepo(options);

    let prFromSummary: number | undefined;
    let commitFromSummary: string | undefined;

    const replacedChangelog = changeset.summary
      .replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr: string) => {
        prFromSummary = Number(pr);
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

    const [firstLine, ...futureLines] = replacedChangelog.split('\n').map((l) => l.trimEnd());

    const links = await (async (): Promise<Links> => {
      if (prFromSummary !== undefined) {
        const pull = prFromSummary;
        const prInfo = await safeLookup(() => getPullRequestInfo({ repo, pull }));
        if (!prInfo) return NO_LINKS;

        let commitLink = prInfo.commit?.markdownLink ?? null;
        if (commitFromSummary) {
          const shortCommitId = commitFromSummary.slice(0, 7);
          commitLink = `[\`${shortCommitId}\`](https://github.com/${repo}/commit/${commitFromSummary})`;
        }
        return {
          commit: commitLink,
          pull: prInfo.pull.markdownLink,
          user: prInfo.author?.markdownLink ?? null,
        };
      }

      const commitToFetchFrom = commitFromSummary || changeset.commit;
      if (commitToFetchFrom) {
        const commit = commitToFetchFrom;
        const commitInfo = await safeLookup(() => getCommitInfo({ repo, commit }));
        if (!commitInfo) return NO_LINKS;
        return {
          commit: commitInfo.commit.markdownLink,
          pull: commitInfo.pull?.markdownLink ?? null,
          user: commitInfo.author?.markdownLink ?? null,
        };
      }

      return NO_LINKS;
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

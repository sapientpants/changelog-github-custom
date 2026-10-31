import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NewChangesetWithCommit, ModCompWithPackage } from '@changesets/types';
import { getCommitInfo, getPullRequestInfo } from '@changesets/get-github-info';
import changelogFunctions from '../src/changelog-custom.js';

vi.mock('@changesets/get-github-info', () => ({
  getCommitInfo: vi.fn(),
  getPullRequestInfo: vi.fn(),
}));

const mockedGetCommitInfo = vi.mocked(getCommitInfo);
const mockedGetPullRequestInfo = vi.mocked(getPullRequestInfo);

const REPO = 'owner/repo';
const OPTIONS = { repo: REPO };
const MISSING_REPO_ERROR =
  'Please provide a repo to this changelog generator like this:\n"changelog": ["changelog-github-custom", { "repo": "org/repo" }]';

function commitInfo(sha: string) {
  return {
    sha,
    url: `https://github.com/${REPO}/commit/${sha}`,
    markdownLink: `[\`${sha}\`](https://github.com/${REPO}/commit/${sha})`,
  };
}

function pullInfo(number: number) {
  return {
    number,
    url: `https://github.com/${REPO}/pull/${number}`,
    markdownLink: `[#${number}](https://github.com/${REPO}/pull/${number})`,
  };
}

function authorInfo(login: string) {
  return {
    login,
    url: `https://github.com/${login}`,
    markdownLink: `[@${login}](https://github.com/${login})`,
  };
}

function changeset(summary: string, commit?: string): NewChangesetWithCommit {
  return commit === undefined
    ? { id: 'test', summary, releases: [] }
    : { id: 'test', summary, releases: [], commit };
}

function dependency(name: string, newVersion: string): ModCompWithPackage {
  return {
    name,
    type: 'patch',
    oldVersion: '0.0.0',
    newVersion,
    changesets: [],
    packageJson: { name, version: newVersion },
    dir: `/path/to/${name}`,
  };
}

describe('Custom Changelog Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDependencyReleaseLine', () => {
    it.each([
      ['null', null],
      ['an empty object', {}],
      ['an empty repo', { repo: '' }],
      ['a non-string repo', { repo: 42 }],
    ])('should throw when options are %s', async (_label, options) => {
      await expect(
        changelogFunctions.getDependencyReleaseLine(
          [],
          [dependency('package-a', '1.0.0')],
          options,
        ),
      ).rejects.toThrow(MISSING_REPO_ERROR);
      expect(mockedGetCommitInfo).not.toHaveBeenCalled();
    });

    it('should return empty string when no dependencies updated', async () => {
      const result = await changelogFunctions.getDependencyReleaseLine(
        [changeset('Test', 'abc1234')],
        [],
        OPTIONS,
      );
      expect(result).toBe('');
      expect(mockedGetCommitInfo).not.toHaveBeenCalled();
    });

    it('should format dependency updates with commit links', async () => {
      mockedGetCommitInfo
        .mockResolvedValueOnce({ commit: commitInfo('abc1234') })
        .mockResolvedValueOnce({ commit: commitInfo('def5678') });

      const result = await changelogFunctions.getDependencyReleaseLine(
        [changeset('Test', 'abc1234'), changeset('Test', 'def5678')],
        [dependency('package-a', '1.2.3'), dependency('package-b', '2.0.0')],
        OPTIONS,
      );

      expect(mockedGetCommitInfo).toHaveBeenCalledTimes(2);
      expect(mockedGetCommitInfo).toHaveBeenNthCalledWith(1, { repo: REPO, commit: 'abc1234' });
      expect(mockedGetCommitInfo).toHaveBeenNthCalledWith(2, { repo: REPO, commit: 'def5678' });
      expect(result).toBe(
        [
          `- Updated dependencies [${commitInfo('abc1234').markdownLink}, ${commitInfo('def5678').markdownLink}]:`,
          '  - package-a@1.2.3',
          '  - package-b@2.0.0',
        ].join('\n'),
      );
    });

    it('should skip changesets without commits', async () => {
      mockedGetCommitInfo.mockResolvedValueOnce({ commit: commitInfo('def5678') });

      const result = await changelogFunctions.getDependencyReleaseLine(
        [changeset('Test'), changeset('Test', 'def5678')],
        [dependency('package-a', '1.2.3')],
        OPTIONS,
      );

      expect(mockedGetCommitInfo).toHaveBeenCalledTimes(1);
      expect(mockedGetCommitInfo).toHaveBeenCalledWith({ repo: REPO, commit: 'def5678' });
      expect(result).toBe(
        `- Updated dependencies [${commitInfo('def5678').markdownLink}]:\n  - package-a@1.2.3`,
      );
    });

    it('should omit the link when the commit is not found', async () => {
      mockedGetCommitInfo.mockResolvedValueOnce(undefined);

      const result = await changelogFunctions.getDependencyReleaseLine(
        [changeset('Test', 'abc1234')],
        [dependency('package-a', '1.2.3')],
        OPTIONS,
      );

      expect(result).toBe('- Updated dependencies []:\n  - package-a@1.2.3');
    });

    it('should degrade gracefully when getCommitInfo rejects', async () => {
      mockedGetCommitInfo
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ commit: commitInfo('def5678') });

      const result = await changelogFunctions.getDependencyReleaseLine(
        [changeset('Test', 'abc1234'), changeset('Test', 'def5678')],
        [dependency('package-a', '1.2.3')],
        OPTIONS,
      );

      expect(mockedGetCommitInfo).toHaveBeenCalledTimes(2);
      expect(result).toBe(
        `- Updated dependencies [${commitInfo('def5678').markdownLink}]:\n  - package-a@1.2.3`,
      );
    });
  });

  describe('getReleaseLine', () => {
    it.each([
      ['null', null],
      ['an empty object', {}],
      ['an empty repo', { repo: '' }],
      ['a non-string repo', { repo: 42 }],
    ])('should throw when options are %s', async (_label, options) => {
      await expect(
        changelogFunctions.getReleaseLine(changeset('Test changeset', 'abc123'), 'patch', options),
      ).rejects.toThrow(MISSING_REPO_ERROR);
      expect(mockedGetCommitInfo).not.toHaveBeenCalled();
      expect(mockedGetPullRequestInfo).not.toHaveBeenCalled();
    });

    it('should format basic changeset with commit', async () => {
      mockedGetCommitInfo.mockResolvedValueOnce({ commit: commitInfo('abc1234') });

      const result = await changelogFunctions.getReleaseLine(
        changeset('Fix: Fixed a bug in the system', 'abc1234'),
        'patch',
        OPTIONS,
      );

      expect(mockedGetCommitInfo).toHaveBeenCalledTimes(1);
      expect(mockedGetCommitInfo).toHaveBeenCalledWith({ repo: REPO, commit: 'abc1234' });
      expect(mockedGetPullRequestInfo).not.toHaveBeenCalled();
      expect(result).toBe(
        `\n\n- ${commitInfo('abc1234').markdownLink} - Fix: Fixed a bug in the system\n`,
      );
    });

    it('should include the PR link reported by the commit lookup', async () => {
      mockedGetCommitInfo.mockResolvedValueOnce({
        commit: commitInfo('abc1234'),
        pull: pullInfo(42),
        author: authorInfo('someone'),
      });

      const result = await changelogFunctions.getReleaseLine(
        changeset('Fix: Fixed a bug', 'abc1234'),
        'patch',
        OPTIONS,
      );

      expect(result).toBe(
        `\n\n- ${pullInfo(42).markdownLink} ${commitInfo('abc1234').markdownLink} - Fix: Fixed a bug\n`,
      );
    });

    it('should extract and use PR number from summary', async () => {
      mockedGetPullRequestInfo.mockResolvedValueOnce({
        pull: pullInfo(123),
        author: authorInfo('user'),
      });

      const result = await changelogFunctions.getReleaseLine(
        changeset('PR: #123\nFix: Fixed a bug'),
        'patch',
        OPTIONS,
      );

      expect(mockedGetPullRequestInfo).toHaveBeenCalledTimes(1);
      expect(mockedGetPullRequestInfo).toHaveBeenCalledWith({ repo: REPO, pull: 123 });
      expect(mockedGetCommitInfo).not.toHaveBeenCalled();
      expect(result).toBe(`\n\n- ${pullInfo(123).markdownLink} - Fix: Fixed a bug\n`);
    });

    it('should use the commit reported by the PR lookup when the summary has none', async () => {
      mockedGetPullRequestInfo.mockResolvedValueOnce({
        pull: pullInfo(123),
        commit: commitInfo('fedcba9'),
      });

      const result = await changelogFunctions.getReleaseLine(
        changeset('PR: #123\nFix: Fixed a bug'),
        'patch',
        OPTIONS,
      );

      expect(result).toBe(
        `\n\n- ${pullInfo(123).markdownLink} ${commitInfo('fedcba9').markdownLink} - Fix: Fixed a bug\n`,
      );
    });

    it('should prefer the commit from the summary over the one reported by the PR lookup', async () => {
      mockedGetPullRequestInfo.mockResolvedValueOnce({
        pull: pullInfo(123),
        author: authorInfo('user'),
        commit: commitInfo('existing'),
      });

      const result = await changelogFunctions.getReleaseLine(
        changeset('PR: #123\ncommit: abcdef1234567890\nFix: Fixed a bug'),
        'patch',
        OPTIONS,
      );

      expect(mockedGetPullRequestInfo).toHaveBeenCalledTimes(1);
      expect(mockedGetPullRequestInfo).toHaveBeenCalledWith({ repo: REPO, pull: 123 });
      expect(mockedGetCommitInfo).not.toHaveBeenCalled();
      expect(result).toBe(
        `\n\n- ${pullInfo(123).markdownLink} [\`abcdef1\`](https://github.com/${REPO}/commit/abcdef1234567890) - Fix: Fixed a bug\n`,
      );
    });

    it('should look up the commit from the summary instead of the changeset commit', async () => {
      mockedGetCommitInfo.mockResolvedValueOnce({ commit: commitInfo('1111111') });

      const result = await changelogFunctions.getReleaseLine(
        changeset('commit: 1111111\nFix: Fixed a bug', '2222222'),
        'patch',
        OPTIONS,
      );

      expect(mockedGetCommitInfo).toHaveBeenCalledTimes(1);
      expect(mockedGetCommitInfo).toHaveBeenCalledWith({ repo: REPO, commit: '1111111' });
      expect(result).toBe(`\n\n- ${commitInfo('1111111').markdownLink} - Fix: Fixed a bug\n`);
    });

    it('should ignore user/author mentions in summary', async () => {
      mockedGetCommitInfo.mockResolvedValueOnce({
        commit: commitInfo('abc1234'),
        author: authorInfo('defaultuser'),
      });

      const result = await changelogFunctions.getReleaseLine(
        changeset('author: @johndoe\nuser: @janedoe\nFix: Fixed a bug', 'abc1234'),
        'patch',
        OPTIONS,
      );

      expect(mockedGetCommitInfo).toHaveBeenCalledTimes(1);
      expect(mockedGetCommitInfo).toHaveBeenCalledWith({ repo: REPO, commit: 'abc1234' });
      expect(result).toBe(`\n\n- ${commitInfo('abc1234').markdownLink} - Fix: Fixed a bug\n`);
    });

    it('should indent continuation lines and strip trailing whitespace', async () => {
      mockedGetCommitInfo.mockResolvedValueOnce({ commit: commitInfo('abc1234') });

      const result = await changelogFunctions.getReleaseLine(
        changeset(
          'Fix: Fixed a bug  \n\nThis is additional information\t\nabout the fix',
          'abc1234',
        ),
        'patch',
        OPTIONS,
      );

      expect(result).toBe(
        [
          `\n\n- ${commitInfo('abc1234').markdownLink} - Fix: Fixed a bug`,
          '  ',
          '  This is additional information',
          '  about the fix',
        ].join('\n'),
      );
    });

    it('should handle changeset without any links', async () => {
      const result = await changelogFunctions.getReleaseLine(
        changeset('Fix: Fixed a bug'),
        'patch',
        OPTIONS,
      );

      expect(mockedGetCommitInfo).not.toHaveBeenCalled();
      expect(mockedGetPullRequestInfo).not.toHaveBeenCalled();
      expect(result).toBe('\n\n- Fix: Fixed a bug\n');
    });

    it('should handle empty summary', async () => {
      const result = await changelogFunctions.getReleaseLine(changeset(''), 'patch', OPTIONS);
      expect(result).toBe('\n\n- \n');
    });

    it('should not use the release type in the output', async () => {
      const result = await changelogFunctions.getReleaseLine(
        changeset('Breaking: Removed an API'),
        'major',
        OPTIONS,
      );
      expect(result).toBe('\n\n- Breaking: Removed an API\n');
    });

    describe('graceful degradation', () => {
      it('should render a plain line when the commit is not found', async () => {
        mockedGetCommitInfo.mockResolvedValueOnce(undefined);

        const result = await changelogFunctions.getReleaseLine(
          changeset('Fix: Test', 'abc123'),
          'patch',
          OPTIONS,
        );

        expect(result).toBe('\n\n- Fix: Test\n');
      });

      it('should render a plain line when getCommitInfo rejects', async () => {
        mockedGetCommitInfo.mockRejectedValueOnce(new Error('Network error'));

        const result = await changelogFunctions.getReleaseLine(
          changeset('Fix: Test', 'abc123'),
          'patch',
          OPTIONS,
        );

        expect(mockedGetCommitInfo).toHaveBeenCalledTimes(1);
        expect(result).toBe('\n\n- Fix: Test\n');
      });

      it('should render a plain line when the PR is not found', async () => {
        mockedGetPullRequestInfo.mockResolvedValueOnce(undefined);

        const result = await changelogFunctions.getReleaseLine(
          changeset('PR: #123\nFix: Test'),
          'patch',
          OPTIONS,
        );

        expect(mockedGetCommitInfo).not.toHaveBeenCalled();
        expect(result).toBe('\n\n- Fix: Test\n');
      });

      it('should render a plain line when getPullRequestInfo rejects', async () => {
        mockedGetPullRequestInfo.mockRejectedValueOnce(new Error('Network error'));

        const result = await changelogFunctions.getReleaseLine(
          changeset('PR: #123\ncommit: abcdef1234567890\nFix: Test'),
          'patch',
          OPTIONS,
        );

        expect(mockedGetPullRequestInfo).toHaveBeenCalledTimes(1);
        expect(mockedGetCommitInfo).not.toHaveBeenCalled();
        expect(result).toBe('\n\n- Fix: Test\n');
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import changelogFunctions from '../src/changelog-custom.js';

vi.mock('@changesets/get-github-info', () => ({
  getCommitInfo: vi.fn(),
  getPullRequestInfo: vi.fn(),
}));

describe('Custom Changelog Generator', () => {
  let getCommitInfo: ReturnType<typeof vi.fn>;
  let getPullRequestInfo: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const githubInfo = await import('@changesets/get-github-info');
    getCommitInfo = githubInfo.getCommitInfo as ReturnType<typeof vi.fn>;
    getPullRequestInfo = githubInfo.getPullRequestInfo as ReturnType<typeof vi.fn>;
  });

  describe('getDependencyReleaseLine', () => {
    it('should throw error when repo option is missing', async () => {
      await expect(changelogFunctions.getDependencyReleaseLine([], [], {})).rejects.toThrow(
        'Please provide a repo to this changelog generator',
      );
    });

    it('should return empty string when no dependencies updated', async () => {
      const result = await changelogFunctions.getDependencyReleaseLine([], [], {
        repo: 'owner/repo',
      });
      expect(result).toBe('');
    });

    it('should format dependency updates with commit links', async () => {
      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'abc1234',
          url: 'https://github.com/owner/repo/commit/abc1234',
          markdownLink: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
        },
      });
      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'def5678',
          url: 'https://github.com/owner/repo/commit/def5678',
          markdownLink: '[`def5678`](https://github.com/owner/repo/commit/def5678)',
        },
      });

      const changesets = [
        { id: 'changeset1', summary: 'Test', releases: [], commit: 'abc1234' },
        { id: 'changeset2', summary: 'Test', releases: [], commit: 'def5678' },
      ];

      const dependencies = [
        {
          name: 'package-a',
          type: 'minor' as const,
          oldVersion: '1.2.0',
          newVersion: '1.2.3',
          changesets: [],
          packageJson: { name: 'package-a', version: '1.2.3' },
          dir: '/path/to/package-a',
        },
        {
          name: 'package-b',
          type: 'major' as const,
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
          changesets: [],
          packageJson: { name: 'package-b', version: '2.0.0' },
          dir: '/path/to/package-b',
        },
      ];

      const result = await changelogFunctions.getDependencyReleaseLine(changesets, dependencies, {
        repo: 'owner/repo',
      });

      expect(getCommitInfo).toHaveBeenCalledTimes(2);
      expect(getCommitInfo).toHaveBeenNthCalledWith(1, {
        repo: 'owner/repo',
        commit: 'abc1234',
      });
      expect(getCommitInfo).toHaveBeenNthCalledWith(2, {
        repo: 'owner/repo',
        commit: 'def5678',
      });
      expect(result).toContain('Updated dependencies');
      expect(result).toContain('[`abc1234`](https://github.com/owner/repo/commit/abc1234)');
      expect(result).toContain('[`def5678`](https://github.com/owner/repo/commit/def5678)');
      expect(result).toContain('package-a@1.2.3');
      expect(result).toContain('package-b@2.0.0');
    });

    it('should handle changesets without commits', async () => {
      const changesets = [
        { id: 'changeset1', summary: 'Test', releases: [] },
        { id: 'changeset2', summary: 'Test', releases: [], commit: 'def5678' },
      ];

      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'def5678',
          url: 'https://github.com/owner/repo/commit/def5678',
          markdownLink: '[`def5678`](https://github.com/owner/repo/commit/def5678)',
        },
      });

      const dependencies = [
        {
          name: 'package-a',
          type: 'minor' as const,
          oldVersion: '1.2.0',
          newVersion: '1.2.3',
          changesets: [],
          packageJson: { name: 'package-a', version: '1.2.3' },
          dir: '/path/to/package-a',
        },
      ];

      const result = await changelogFunctions.getDependencyReleaseLine(changesets, dependencies, {
        repo: 'owner/repo',
      });

      expect(getCommitInfo).toHaveBeenCalledTimes(1);
      expect(getCommitInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        commit: 'def5678',
      });
      expect(result).toContain('Updated dependencies');
      expect(result).toContain('[`def5678`](https://github.com/owner/repo/commit/def5678)');
      expect(result).toContain('package-a@1.2.3');
    });
  });

  describe('getReleaseLine', () => {
    it('should throw error when repo option is missing', async () => {
      const changeset = {
        id: 'test',
        summary: 'Test changeset',
        releases: [],
        commit: 'abc123',
      };

      await expect(changelogFunctions.getReleaseLine(changeset, 'patch', null)).rejects.toThrow(
        'Please provide a repo to this changelog generator',
      );

      await expect(changelogFunctions.getReleaseLine(changeset, 'patch', {})).rejects.toThrow(
        'Please provide a repo to this changelog generator',
      );
    });

    it('should format basic changeset with commit', async () => {
      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'abc1234',
          url: 'https://github.com/owner/repo/commit/abc1234',
          markdownLink: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'Fix: Fixed a bug in the system',
        releases: [],
        commit: 'abc1234',
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(getCommitInfo).toHaveBeenCalledTimes(1);
      expect(getCommitInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        commit: 'abc1234',
      });
      expect(result).toContain('Fix: Fixed a bug in the system');
      expect(result).toContain('[`abc1234`](https://github.com/owner/repo/commit/abc1234)');
    });

    it('should extract and use PR number from summary', async () => {
      getPullRequestInfo.mockResolvedValueOnce({
        pull: {
          number: 123,
          url: 'https://github.com/owner/repo/pull/123',
          markdownLink: '[#123](https://github.com/owner/repo/pull/123)',
        },
        author: {
          login: 'user',
          url: 'https://github.com/user',
          markdownLink: '[@user](https://github.com/user)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'PR: #123\nFix: Fixed a bug',
        releases: [],
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(getPullRequestInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        pull: 123,
      });
      expect(result).toContain('[#123](https://github.com/owner/repo/pull/123)');
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should extract commit from summary and override with short commit in PR links', async () => {
      getPullRequestInfo.mockResolvedValueOnce({
        pull: {
          number: 123,
          url: 'https://github.com/owner/repo/pull/123',
          markdownLink: '[#123](https://github.com/owner/repo/pull/123)',
        },
        author: {
          login: 'user',
          url: 'https://github.com/user',
          markdownLink: '[@user](https://github.com/user)',
        },
        commit: {
          sha: 'existing',
          url: 'https://github.com/owner/repo/commit/existing',
          markdownLink: '[`existing`](https://github.com/owner/repo/commit/existing)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'PR: #123\ncommit: abcdef1234567890\nFix: Fixed a bug',
        releases: [],
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(getPullRequestInfo).toHaveBeenCalledTimes(1);
      expect(getPullRequestInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        pull: 123,
      });
      expect(result).toContain('[#123](https://github.com/owner/repo/pull/123)');
      expect(result).toContain(
        '[`abcdef1`](https://github.com/owner/repo/commit/abcdef1234567890)',
      );
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should ignore user/author mentions in summary', async () => {
      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'abc1234',
          url: 'https://github.com/owner/repo/commit/abc1234',
          markdownLink: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
        },
        author: {
          login: 'defaultuser',
          url: 'https://github.com/defaultuser',
          markdownLink: '[@defaultuser](https://github.com/defaultuser)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'author: @johndoe\nuser: @janedoe\nFix: Fixed a bug',
        releases: [],
        commit: 'abc1234',
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(getCommitInfo).toHaveBeenCalledTimes(1);
      expect(getCommitInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        commit: 'abc1234',
      });

      // Should not contain user attribution
      expect(result).not.toContain('Thanks');
      expect(result).not.toContain('johndoe');
      expect(result).not.toContain('janedoe');
      expect(result).not.toContain('defaultuser');
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should handle multiline summaries', async () => {
      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'abc1234',
          url: 'https://github.com/owner/repo/commit/abc1234',
          markdownLink: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'Fix: Fixed a bug\n\nThis is additional information\nabout the fix',
        releases: [],
        commit: 'abc1234',
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(getCommitInfo).toHaveBeenCalledTimes(1);
      expect(getCommitInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        commit: 'abc1234',
      });
      expect(result).toContain('Fix: Fixed a bug');
      expect(result).toContain('This is additional information');
      expect(result).toContain('about the fix');
      expect(result).toContain('[`abc1234`](https://github.com/owner/repo/commit/abc1234)');
    });

    it('should handle changeset without any links', async () => {
      const changeset = {
        id: 'test',
        summary: 'Fix: Fixed a bug',
        releases: [],
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(result).toBe('\n\n- Fix: Fixed a bug\n');
    });

    it('should handle both PR and commit links', async () => {
      getPullRequestInfo.mockResolvedValueOnce({
        pull: {
          number: 123,
          url: 'https://github.com/owner/repo/pull/123',
          markdownLink: '[#123](https://github.com/owner/repo/pull/123)',
        },
        author: {
          login: 'user',
          url: 'https://github.com/user',
          markdownLink: '[@user](https://github.com/user)',
        },
        commit: {
          sha: 'existing',
          url: 'https://github.com/owner/repo/commit/existing',
          markdownLink: '[`existing`](https://github.com/owner/repo/commit/existing)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'PR: #123\ncommit: newcommit123\nFix: Fixed a bug',
        releases: [],
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(getPullRequestInfo).toHaveBeenCalledTimes(1);
      expect(getPullRequestInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        pull: 123,
      });
      expect(result).toContain('[#123](https://github.com/owner/repo/pull/123)');
      expect(result).toContain('[`newcomm`](https://github.com/owner/repo/commit/newcommit123)');
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should use changeset commit when no PR or commit in summary', async () => {
      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'def5678',
          url: 'https://github.com/owner/repo/commit/def5678',
          markdownLink: '[`def5678`](https://github.com/owner/repo/commit/def5678)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'Fix: Fixed a bug',
        releases: [],
        commit: 'def5678',
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });

      expect(getCommitInfo).toHaveBeenCalledTimes(1);
      expect(getCommitInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        commit: 'def5678',
      });
      expect(result).toContain('[`def5678`](https://github.com/owner/repo/commit/def5678)');
    });

    // Test empty summary
    it('should handle empty summary', async () => {
      const changeset = {
        id: 'test',
        summary: '',
        releases: [],
      };
      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });
      expect(result).toBe('\n\n- \n');
    });

    // Test error handling
    it('should handle getInfo errors gracefully', async () => {
      getCommitInfo.mockRejectedValueOnce(new Error('Network error'));
      const changeset = {
        id: 'test',
        summary: 'Fix: Test',
        releases: [],
        commit: 'abc123',
      };
      const result = await changelogFunctions.getReleaseLine(changeset, 'patch', {
        repo: 'owner/repo',
      });
      expect(result).toContain('Fix: Test');
    });

    // Test different release types
    it('should handle major release type', async () => {
      getCommitInfo.mockResolvedValueOnce({
        commit: {
          sha: 'abc1234',
          url: 'https://github.com/owner/repo/commit/abc1234',
          markdownLink: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
        },
      });

      const changeset = {
        id: 'test',
        summary: 'Fix: Fixed a bug',
        releases: [],
        commit: 'abc1234',
      };

      const result = await changelogFunctions.getReleaseLine(changeset, 'major', {
        repo: 'owner/repo',
      });

      expect(getCommitInfo).toHaveBeenCalledTimes(1);
      expect(getCommitInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        commit: 'abc1234',
      });
      expect(result).toContain('[`abc1234`](https://github.com/owner/repo/commit/abc1234)');
      expect(result).toContain('Fix: Fixed a bug');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import changelogFunctions from '../src/changelog-custom.js';

// Mock the @changesets/get-github-info module
vi.mock('@changesets/get-github-info', () => ({
  getInfo: vi.fn(),
  getInfoFromPullRequest: vi.fn(),
}));

describe('Custom Changelog Generator', () => {
  let getInfo: ReturnType<typeof vi.fn>;
  let getInfoFromPullRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const githubInfo = await import('@changesets/get-github-info');
    getInfo = githubInfo.getInfo as ReturnType<typeof vi.fn>;
    getInfoFromPullRequest = githubInfo.getInfoFromPullRequest as ReturnType<typeof vi.fn>;
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
      getInfo.mockResolvedValueOnce({
        links: {
          commit: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
          pull: null,
          user: null,
        },
      });
      getInfo.mockResolvedValueOnce({
        links: {
          commit: '[`def5678`](https://github.com/owner/repo/commit/def5678)',
          pull: null,
          user: null,
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

      getInfo.mockResolvedValueOnce({
        links: {
          commit: '[`def5678`](https://github.com/owner/repo/commit/def5678)',
          pull: null,
          user: null,
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
      getInfo.mockResolvedValueOnce({
        links: {
          commit: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
          pull: null,
          user: null,
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

      expect(result).toContain('Fix: Fixed a bug in the system');
      expect(result).toContain('[`abc1234`](https://github.com/owner/repo/commit/abc1234)');
    });

    it('should extract and use PR number from summary', async () => {
      getInfoFromPullRequest.mockResolvedValueOnce({
        links: {
          commit: null,
          pull: '[#123](https://github.com/owner/repo/pull/123)',
          user: '[@user](https://github.com/user)',
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

      expect(getInfoFromPullRequest).toHaveBeenCalledWith({
        repo: 'owner/repo',
        pull: 123,
      });
      expect(result).toContain('[#123](https://github.com/owner/repo/pull/123)');
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should extract commit from summary and override with short commit in PR links', async () => {
      getInfoFromPullRequest.mockResolvedValueOnce({
        links: {
          commit: null,
          pull: '[#123](https://github.com/owner/repo/pull/123)',
          user: '[@user](https://github.com/user)',
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

      expect(result).toContain('[#123](https://github.com/owner/repo/pull/123)');
      expect(result).toContain(
        '[`abcdef1`](https://github.com/owner/repo/commit/abcdef1234567890)',
      );
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should ignore user/author mentions in summary', async () => {
      getInfo.mockResolvedValueOnce({
        links: {
          commit: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
          pull: null,
          user: '[@defaultuser](https://github.com/defaultuser)',
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

      // Should not contain user attribution
      expect(result).not.toContain('Thanks');
      expect(result).not.toContain('johndoe');
      expect(result).not.toContain('janedoe');
      expect(result).not.toContain('defaultuser');
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should handle multiline summaries', async () => {
      getInfo.mockResolvedValueOnce({
        links: {
          commit: '[`abc1234`](https://github.com/owner/repo/commit/abc1234)',
          pull: null,
          user: null,
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
      getInfoFromPullRequest.mockResolvedValueOnce({
        links: {
          commit: '[`existing`](https://github.com/owner/repo/commit/existing)',
          pull: '[#123](https://github.com/owner/repo/pull/123)',
          user: null,
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

      expect(result).toContain('[#123](https://github.com/owner/repo/pull/123)');
      expect(result).toContain('[`newcomm`](https://github.com/owner/repo/commit/newcommit123)');
      expect(result).toContain('Fix: Fixed a bug');
    });

    it('should use changeset commit when no PR or commit in summary', async () => {
      getInfo.mockResolvedValueOnce({
        links: {
          commit: '[`def5678`](https://github.com/owner/repo/commit/def5678)',
          pull: null,
          user: null,
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

      expect(getInfo).toHaveBeenCalledWith({
        repo: 'owner/repo',
        commit: 'def5678',
      });
      expect(result).toContain('[`def5678`](https://github.com/owner/repo/commit/def5678)');
    });
  });
});

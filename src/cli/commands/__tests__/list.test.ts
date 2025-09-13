/**
 * Tests for list command
 * Validates querying, filtering, and output formatting
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import type { Mock } from "vitest";
import { Command } from "commander";
import { createListCommand } from "../list.js";
import { DatabaseManager } from "../../../database/database.js";
import type { ForumPost, Comment, User } from "../../../types/core.js";

// Mock database manager
vi.mock("../../../database/database.js", () => ({
  DatabaseManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    insertPost: vi.fn().mockResolvedValue(undefined),
    insertComment: vi.fn().mockResolvedValue(undefined),
    insertUser: vi.fn().mockResolvedValue(undefined),
    queryPosts: vi.fn().mockResolvedValue([]),
    queryComments: vi.fn().mockResolvedValue([]),
    queryUsers: vi.fn().mockResolvedValue([]),
    getStatistics: vi.fn().mockResolvedValue({
      totalPosts: 0,
      totalComments: 0,
      totalUsers: 0,
      platformCounts: {},
      dateRange: { earliest: null, latest: null },
    }),
    searchContent: vi.fn().mockResolvedValue({
      posts: [],
      comments: [],
    }),
  })),
}));

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});

// Mock process.exit to prevent test runner from exiting
const mockProcessExit = vi
  .spyOn(process, "exit")
  .mockImplementation((code?: number) => {
    throw new Error(`process.exit called with code ${code}`);
  });

describe("List Command", () => {
  let program: Command;
  let listCommand: Command;

  beforeAll(() => {
    program = new Command();
    program.exitOverride(); // Prevent process.exit
    listCommand = createListCommand();
    program.addCommand(listCommand);
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
    vi.clearAllMocks();

    // Reset DatabaseManager mock completely
    vi.resetModules();
  });

  describe("Command Structure", () => {
    it("should have list command with correct structure", () => {
      expect(listCommand.name()).toBe("list");
      expect(listCommand.description()).toContain("List and query data");
    });

    it("should have all required subcommands", () => {
      const subcommands = listCommand.commands.map((cmd) => cmd.name());
      expect(subcommands).toContain("posts");
      expect(subcommands).toContain("comments");
      expect(subcommands).toContain("users");
      expect(subcommands).toContain("stats");
      expect(subcommands).toContain("search");
    });

    it("should have all required options", () => {
      const postsCmd = listCommand.commands.find(
        (cmd) => cmd.name() === "posts",
      );
      const options = postsCmd?.options.map((opt) => opt.long) || [];
      expect(options).toContain("--database");
      expect(options).toContain("--platform");
      expect(options).toContain("--limit");
      expect(options).toContain("--offset");
      expect(options).toContain("--sort-by");
      expect(options).toContain("--sort-order");
      expect(options).toContain("--author");
      expect(options).toContain("--min-score");
      expect(options).toContain("--start-date");
      expect(options).toContain("--end-date");
      expect(options).toContain("--format");
      expect(options).toContain("--verbose");
    });
  });

  describe("Posts Subcommand", () => {
    it("should have posts subcommand with filtering options", () => {
      const postsCmd = listCommand.commands.find(
        (cmd) => cmd.name() === "posts",
      );
      expect(postsCmd).toBeDefined();
      expect(postsCmd?.description()).toContain("List posts");

      const options = postsCmd?.options.map((opt) => opt.long) || [];
      expect(options).toContain("--database");
      expect(options).toContain("--platform");
      expect(options).toContain("--author");
      expect(options).toContain("--min-score");
      expect(options).toContain("--format");
    });

    it("should execute posts listing with mock data", async () => {
      const mockPosts: ForumPost[] = [
        {
          id: "1",
          title: "Test Post",
          content: "Test content",
          author: "testuser",
          url: "https://example.com/post1",
          score: 100,
          commentCount: 10,
          createdAt: new Date("2024-01-01"),
          platform: "reddit",
        },
      ];

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: vi.fn().mockResolvedValue(mockPosts),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--format",
          "json",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join("\n");
      expect(output).toContain("Test Post");
    });
  });

  describe("Comments Subcommand", () => {
    it("should have comments subcommand with options", () => {
      const commentsCmd = listCommand.commands.find(
        (cmd) => cmd.name() === "comments",
      );
      expect(commentsCmd).toBeDefined();
      expect(commentsCmd?.description()).toContain("List comments");

      const options = commentsCmd?.options.map((opt) => opt.long) || [];
      expect(options).toContain("--post-id");
      expect(options).toContain("--platform");
      expect(options).toContain("--author");
      expect(options).toContain("--min-score");
    });

    it("should execute comments listing with mock data", async () => {
      const mockComments: Comment[] = [
        {
          id: "c1",
          postId: "p1",
          parentId: null,
          author: "commenter",
          content: "Test comment",
          score: 50,
          createdAt: new Date("2024-01-02"),
          depth: 0,
          platform: "hackernews",
        },
      ];

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryComments: vi.fn().mockResolvedValue(mockComments),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "comments",
          "--format",
          "simple",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe("Users Subcommand", () => {
    it("should have users subcommand with options", () => {
      const usersCmd = listCommand.commands.find(
        (cmd) => cmd.name() === "users",
      );
      expect(usersCmd).toBeDefined();
      expect(usersCmd?.description()).toContain("List users");

      const options = usersCmd?.options.map((opt) => opt.long) || [];
      expect(options).toContain("--min-karma");
      expect(options).toContain("--platform");
      expect(options).toContain("--sort-by");
    });

    it("should execute users listing with mock data", async () => {
      const mockUsers: User[] = [
        {
          id: "u1",
          username: "testuser",
          karma: 1000,
          createdAt: new Date("2023-01-01"),
          platform: "reddit",
        },
      ];

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryUsers: vi.fn().mockResolvedValue(mockUsers),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "users",
          "--min-karma",
          "500",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe("Stats Subcommand", () => {
    it("should have stats subcommand", () => {
      const statsCmd = listCommand.commands.find(
        (cmd) => cmd.name() === "stats",
      );
      expect(statsCmd).toBeDefined();
      expect(statsCmd?.description()).toContain("Show database statistics");
    });

    it("should display statistics", async () => {
      const mockStats = {
        totalPosts: 100,
        totalComments: 500,
        totalUsers: 50,
        platformCounts: {
          reddit: 60,
          hackernews: 40,
        },
        dateRange: {
          earliest: new Date("2023-01-01"),
          latest: new Date("2024-01-01"),
        },
      };

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getStatistics: vi.fn().mockResolvedValue(mockStats),
      }));

      try {
        await program.parseAsync(["node", "test", "list", "stats"]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join("\n");
      expect(output).toContain("100");
      expect(output).toContain("500");
      expect(output).toContain("50");
    });
  });

  describe("Search Subcommand", () => {
    it("should have search subcommand with query parameter", () => {
      const searchCmd = listCommand.commands.find(
        (cmd) => cmd.name() === "search",
      );
      expect(searchCmd).toBeDefined();
      expect(searchCmd?.description()).toContain("Search posts and comments");

      const options = searchCmd?.options.map((opt) => opt.long) || [];
      expect(options).toContain("--platform");
      expect(options).toContain("--limit");
      expect(options).toContain("--format");
    });

    it("should execute search with results", async () => {
      const mockResults = {
        posts: [
          {
            id: "p1",
            title: "Search Result Post",
            content: "Content with search term",
            author: "author1",
            url: "https://example.com",
            score: 75,
            commentCount: 5,
            createdAt: new Date("2024-01-01"),
            platform: "reddit" as const,
          },
        ],
        comments: [
          {
            id: "c1",
            postId: "p1",
            parentId: null,
            author: "commenter1",
            content: "Comment with search term",
            score: 25,
            createdAt: new Date("2024-01-02"),
            depth: 0,
            platform: "reddit" as const,
          },
        ],
      };

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        searchContent: vi.fn().mockResolvedValue(mockResults),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "search",
          "search term",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join("\n");
      expect(output).toContain("Search Result");
    });
  });

  describe("Output Formatting", () => {
    it("should support table format", async () => {
      const mockPosts: ForumPost[] = [
        {
          id: "1",
          title: "Table Format Test",
          content: "Content",
          author: "user1",
          url: "https://example.com",
          score: 100,
          commentCount: 10,
          createdAt: new Date("2024-01-01"),
          platform: "reddit",
        },
      ];

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: vi.fn().mockResolvedValue(mockPosts),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--format",
          "table",
          "--limit",
          "1",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      // Table format should include borders
      const output = mockConsoleLog.mock.calls.join("\n");
      expect(output).toMatch(/[─│┌┐└┘├┤┬┴┼]/); // Table border characters
    });

    it("should support JSON format", async () => {
      const mockPosts: ForumPost[] = [
        {
          id: "1",
          title: "JSON Format Test",
          content: "Content",
          author: "user1",
          url: "https://example.com",
          score: 100,
          commentCount: 10,
          createdAt: new Date("2024-01-01"),
          platform: "reddit",
        },
      ];

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: vi.fn().mockResolvedValue(mockPosts),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--format",
          "json",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join("");
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should support simple format", async () => {
      const mockPosts: ForumPost[] = [
        {
          id: "1",
          title: "Simple Format Test",
          content: "Content",
          author: "user1",
          url: "https://example.com",
          score: 100,
          commentCount: 10,
          createdAt: new Date("2024-01-01"),
          platform: "reddit",
        },
      ];

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: vi.fn().mockResolvedValue(mockPosts),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--format",
          "simple",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join("\n");
      // Simple format should not have table borders
      expect(output).not.toMatch(/[─│┌┐└┘├┤┬┴┼]/);
      expect(output).toContain("Simple Format Test");
    });
  });

  describe("Filtering Options", () => {
    it("should filter by platform", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      const queryPostsMock = vi.fn().mockResolvedValue([]);

      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: queryPostsMock,
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--platform",
          "reddit",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(queryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: "reddit",
        }),
      );
    });

    it("should filter by author", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      const queryPostsMock = vi.fn().mockResolvedValue([]);

      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: queryPostsMock,
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--author",
          "testuser",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(queryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          author: "testuser",
        }),
      );
    });

    it("should filter by minimum score", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      const queryPostsMock = vi.fn().mockResolvedValue([]);

      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: queryPostsMock,
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--min-score",
          "100",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(queryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          minScore: 100,
        }),
      );
    });

    it("should filter by date range", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      const queryPostsMock = vi.fn().mockResolvedValue([]);

      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: queryPostsMock,
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--start-date",
          "2024-01-01",
          "--end-date",
          "2024-12-31",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(queryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
    });
  });

  describe("Sorting Options", () => {
    it("should sort by date", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      const queryPostsMock = vi.fn().mockResolvedValue([]);

      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: queryPostsMock,
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--sort-by",
          "date",
          "--sort-order",
          "desc",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(queryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: "date",
          sortOrder: "desc",
        }),
      );
    });

    it("should sort by score", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      const queryPostsMock = vi.fn().mockResolvedValue([]);

      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: queryPostsMock,
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--sort-by",
          "score",
          "--sort-order",
          "asc",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(queryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: "score",
          sortOrder: "asc",
        }),
      );
    });

    it("should sort by comment count", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      const queryPostsMock = vi.fn().mockResolvedValue([]);

      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: queryPostsMock,
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--sort-by",
          "comments",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(queryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: "comments",
        }),
      );
    });
  });

  describe("Pagination", () => {
    it("should apply limit and offset", async () => {
      // Create a completely fresh mock
      const freshQueryPostsMock = vi.fn().mockResolvedValue([]);

      // Reset the module mock
      vi.resetModules();
      vi.clearAllMocks();

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: freshQueryPostsMock,
      }));

      // Create a fresh program instance for this test
      const freshProgram = new Command();
      freshProgram.exitOverride();
      const freshListCommand = createListCommand();
      freshProgram.addCommand(freshListCommand);

      try {
        await freshProgram.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--limit",
          "20",
          "--offset",
          "10",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(freshQueryPostsMock).toHaveBeenCalledTimes(1);
      expect(freshQueryPostsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 10,
        }),
      );
    });
  });

  describe("Verbose Mode", () => {
    it("should show additional details in verbose mode", async () => {
      const mockPosts: ForumPost[] = [
        {
          id: "1",
          title: "Verbose Test",
          content: "Detailed content that should be shown",
          author: "user1",
          url: "https://example.com",
          score: 100,
          commentCount: 10,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          platform: "reddit",
          metadata: {
            extra: "metadata",
          },
        },
      ];

      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: vi.fn().mockResolvedValue(mockPosts),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--verbose",
          "--format",
          "simple",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join("\n");
      // Verbose mode should show more details
      expect(output).toContain("Detailed content");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      }));

      try {
        await program.parseAsync(["node", "test", "list", "posts"]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleError).toHaveBeenCalled();
      const errorOutput = mockConsoleError.mock.calls.join("\n");
      expect(errorOutput).toContain("Error");
    });

    it("should handle invalid date format", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: vi.fn().mockResolvedValue([]),
      }));

      try {
        await program.parseAsync([
          "node",
          "test",
          "list",
          "posts",
          "--start-date",
          "invalid-date",
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      // Should either handle gracefully or show error
      expect(
        mockConsoleLog.mock.calls.length + mockConsoleError.mock.calls.length,
      ).toBeGreaterThan(0);
    });
  });

  describe("Empty Results", () => {
    it("should handle empty results gracefully", async () => {
      const MockedDb = DatabaseManager as unknown as Mock;
      MockedDb.mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        queryPosts: vi.fn().mockResolvedValue([]),
      }));

      try {
        await program.parseAsync(["node", "test", "list", "posts"]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join("\n");
      expect(output).toContain("No posts found");
    });
  });
});

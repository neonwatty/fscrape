#!/usr/bin/env npx tsx

import { HackerNewsParsers, HackerNewsValidators } from "./src/platforms/hackernews/parsers.js";
import type { HNItem, HNUser } from "./src/platforms/hackernews/client.js";

/**
 * Test suite for HackerNews response parsers
 */
async function testHackerNewsParsers() {
  console.log("🧪 Testing HackerNews Response Parsers\n");

  let testsPassed = 0;
  let totalTests = 0;

  // Test 1: Parse regular story post
  try {
    totalTests++;
    console.log("Test 1: Parse regular story post");
    
    const storyItem: HNItem = {
      id: 12345,
      type: "story",
      by: "testuser",
      time: 1699564800,
      title: "Test Story Title",
      text: "<p>Story content with <code>code</code></p>",
      url: "https://example.com/article",
      score: 100,
      descendants: 50,
      kids: [12346, 12347],
      dead: false,
      deleted: false,
    };

    const post = HackerNewsParsers.parsePost(storyItem);
    
    if (!post) throw new Error("Failed to parse story");
    if (post.id !== "12345") throw new Error("ID mismatch");
    if (post.title !== "Test Story Title") throw new Error("Title mismatch");
    if (post.author !== "testuser") throw new Error("Author mismatch");
    if (post.score !== 100) throw new Error("Score mismatch");
    if (post.commentCount !== 50) throw new Error("Comment count mismatch");
    if (!post.content?.includes("Story content with `code`")) throw new Error("Content not cleaned properly");
    if (post.metadata?.domain !== "example.com") throw new Error("Domain not extracted");
    
    console.log("✅ Story parsing passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Story parsing failed:", error, "\n");
  }

  // Test 2: Parse Show HN post
  try {
    totalTests++;
    console.log("Test 2: Parse Show HN post");
    
    const showHNItem: HNItem = {
      id: 12348,
      type: "story",
      by: "maker",
      time: 1699564800,
      title: "Show HN: My New Project",
      text: "Check out this cool project",
      score: 50,
      descendants: 20,
      kids: [],
    };

    const post = HackerNewsParsers.parsePost(showHNItem);
    
    if (!post) throw new Error("Failed to parse Show HN");
    if (post.metadata?.storyType !== "show") throw new Error("Story type not detected as 'show'");
    if (!post.metadata?.tags?.includes("Show HN")) throw new Error("Show HN tag not added");
    
    console.log("✅ Show HN parsing passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Show HN parsing failed:", error, "\n");
  }

  // Test 3: Parse Ask HN post
  try {
    totalTests++;
    console.log("Test 3: Parse Ask HN post");
    
    const askHNItem: HNItem = {
      id: 12349,
      type: "story",
      by: "curious",
      time: 1699564800,
      title: "Ask HN: How do you manage time?",
      text: "Looking for time management tips",
      score: 30,
      descendants: 100,
    };

    const post = HackerNewsParsers.parsePost(askHNItem);
    
    if (!post) throw new Error("Failed to parse Ask HN");
    if (post.metadata?.storyType !== "ask") throw new Error("Story type not detected as 'ask'");
    if (!post.metadata?.tags?.includes("Ask HN")) throw new Error("Ask HN tag not added");
    
    console.log("✅ Ask HN parsing passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Ask HN parsing failed:", error, "\n");
  }

  // Test 4: Parse job post
  try {
    totalTests++;
    console.log("Test 4: Parse job post");
    
    const jobItem: HNItem = {
      id: 12350,
      type: "job",
      by: "company",
      time: 1699564800,
      title: "Company (YC S21) Is Hiring Engineers",
      text: "Join our team!",
      url: "https://company.com/careers",
      score: 1,
    };

    const post = HackerNewsParsers.parsePost(jobItem);
    
    if (!post) throw new Error("Failed to parse job");
    if (post.metadata?.type !== "job") throw new Error("Type not marked as job");
    if (!post.metadata?.tags?.includes("Job")) throw new Error("Job tag not added");
    
    console.log("✅ Job parsing passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Job parsing failed:", error, "\n");
  }

  // Test 5: Parse comment
  try {
    totalTests++;
    console.log("Test 5: Parse comment");
    
    const commentItem: HNItem = {
      id: 12351,
      type: "comment",
      by: "commenter",
      time: 1699564800,
      text: "<p>This is a <i>comment</i> with <a href=\"http://example.com\">link</a></p>",
      parent: 12345,
      score: 10,
      kids: [12352],
    };

    const comment = HackerNewsParsers.parseComment(commentItem, "12345", 1);
    
    if (!comment) throw new Error("Failed to parse comment");
    if (comment.id !== "12351") throw new Error("Comment ID mismatch");
    if (comment.postId !== "12345") throw new Error("Post ID mismatch");
    if (comment.parentId !== "12345") throw new Error("Parent ID mismatch");
    if (comment.depth !== 1) throw new Error("Depth mismatch");
    if (!comment.content.includes("This is a _comment_ with [link](http://example.com)")) {
      throw new Error("Comment content not cleaned properly");
    }
    
    console.log("✅ Comment parsing passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Comment parsing failed:", error, "\n");
  }

  // Test 6: Parse deleted/dead items
  try {
    totalTests++;
    console.log("Test 6: Handle deleted/dead items");
    
    const deletedItem: HNItem = {
      id: 12352,
      type: "story",
      deleted: true,
      time: 1699564800,
    };

    const deadItem: HNItem = {
      id: 12353,
      type: "comment",
      dead: true,
      time: 1699564800,
    };

    const deletedPost = HackerNewsParsers.parsePost(deletedItem);
    const deadComment = HackerNewsParsers.parseComment(deadItem, "12345");
    
    if (deletedPost !== null) throw new Error("Deleted post should return null");
    if (deadComment !== null) throw new Error("Dead comment should return null");
    
    console.log("✅ Deleted/dead item handling passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Deleted/dead item handling failed:", error, "\n");
  }

  // Test 7: Parse user
  try {
    totalTests++;
    console.log("Test 7: Parse user");
    
    const hnUser: HNUser = {
      id: "pg",
      created: 1160418092,
      karma: 155111,
      about: "Bug fixer. Co-founder of <a href=\"http://ycombinator.com\">YC</a>.",
      submitted: [1, 2, 3, 4, 5],
    };

    const user = HackerNewsParsers.parseUser(hnUser);
    
    if (user.id !== "pg") throw new Error("User ID mismatch");
    if (user.username !== "pg") throw new Error("Username mismatch");
    if (user.karma !== 155111) throw new Error("Karma mismatch");
    if (!user.metadata?.about?.includes("Bug fixer")) throw new Error("About not parsed");
    if (user.metadata?.submittedCount !== 5) throw new Error("Submitted count mismatch");
    
    console.log("✅ User parsing passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ User parsing failed:", error, "\n");
  }

  // Test 8: HTML content cleaning
  try {
    totalTests++;
    console.log("Test 8: HTML content cleaning");
    
    const htmlContent = `<p>Paragraph 1</p><p>Paragraph 2</p>
<code>inline code</code>
<pre><code>block
code</code></pre>
<i>italic</i>
<a href="http://example.com">link text</a>
&gt; quoted &lt; text &amp; more`;

    const cleaned = HackerNewsParsers.cleanContent(htmlContent);
    
    if (!cleaned.includes("Paragraph 1\n\nParagraph 2")) throw new Error("Paragraphs not cleaned");
    if (!cleaned.includes("`inline code`")) throw new Error("Inline code not cleaned");
    if (!cleaned.includes("```\nblock\ncode\n```")) throw new Error("Code block not cleaned");
    if (!cleaned.includes("_italic_")) throw new Error("Italic not cleaned");
    if (!cleaned.includes("[link text](http://example.com)")) throw new Error("Link not cleaned");
    if (!cleaned.includes("> quoted < text & more")) throw new Error("HTML entities not decoded");
    
    console.log("✅ HTML cleaning passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ HTML cleaning failed:", error, "\n");
  }

  // Test 9: Validators
  try {
    totalTests++;
    console.log("Test 9: HackerNews validators");
    
    // Test item ID validation
    if (!HackerNewsValidators.isValidItemId(12345)) throw new Error("Valid ID rejected");
    if (!HackerNewsValidators.isValidItemId("12345")) throw new Error("String ID rejected");
    if (HackerNewsValidators.isValidItemId(-1)) throw new Error("Negative ID accepted");
    if (HackerNewsValidators.isValidItemId("abc")) throw new Error("Invalid string ID accepted");
    
    // Test username validation
    if (!HackerNewsValidators.isValidUsername("pg")) throw new Error("Valid username rejected");
    if (!HackerNewsValidators.isValidUsername("user_123")) throw new Error("Username with underscore rejected");
    if (HackerNewsValidators.isValidUsername("user@email")) throw new Error("Invalid username accepted");
    if (HackerNewsValidators.isValidUsername("verylongusernamethatexceedslimit")) throw new Error("Too long username accepted");
    
    // Test URL validation
    if (!HackerNewsValidators.isHackerNewsUrl("https://news.ycombinator.com/item?id=123")) throw new Error("HN URL rejected");
    if (HackerNewsValidators.isHackerNewsUrl("https://example.com")) throw new Error("Non-HN URL accepted");
    
    // Test ID extraction from URL
    const extractedId = HackerNewsValidators.extractItemIdFromUrl("https://news.ycombinator.com/item?id=12345");
    if (extractedId !== 12345) throw new Error("ID extraction failed");
    
    console.log("✅ Validators passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Validators failed:", error, "\n");
  }

  // Test 10: Batch parsing
  try {
    totalTests++;
    console.log("Test 10: Batch parse items");
    
    const items: HNItem[] = [
      {
        id: 1,
        type: "story",
        by: "user1",
        time: 1699564800,
        title: "Story 1",
        score: 10,
      },
      {
        id: 2,
        type: "comment",
        by: "user2",
        time: 1699564800,
        text: "Comment 1",
        parent: 1,
        score: 5,
      },
      {
        id: 3,
        type: "job",
        by: "company",
        time: 1699564800,
        title: "Job Post",
      },
      {
        id: 4,
        type: "story",
        deleted: true,
        time: 1699564800,
      },
    ];

    const { posts, comments } = HackerNewsParsers.batchParseItems(items);
    
    if (posts.length !== 2) throw new Error(`Expected 2 posts, got ${posts.length}`);
    if (comments.length !== 1) throw new Error(`Expected 1 comment, got ${comments.length}`);
    if (posts[0].id !== "1") throw new Error("First post ID mismatch");
    if (posts[1].id !== "3") throw new Error("Second post ID mismatch");
    if (comments[0].id !== "2") throw new Error("Comment ID mismatch");
    
    console.log("✅ Batch parsing passed\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Batch parsing failed:", error, "\n");
  }

  // Summary
  console.log("═".repeat(50));
  console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
  
  if (testsPassed === totalTests) {
    console.log("✅ All HackerNews parser tests passed successfully!");
  } else {
    console.log(`❌ ${totalTests - testsPassed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testHackerNewsParsers().catch(console.error);
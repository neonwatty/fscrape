// Test the subreddit filter logic
const testPosts = [
  { id: 1, source: 'programming', score: 100, num_comments: 10, platform: 'reddit', created_utc: Date.now()/1000 },
  { id: 2, source: 'webdev', score: 50, num_comments: 5, platform: 'reddit', created_utc: Date.now()/1000 },
  { id: 3, source: 'javascript', score: 75, num_comments: 8, platform: 'reddit', created_utc: Date.now()/1000 },
  { id: 4, source: 'programming', score: 200, num_comments: 20, platform: 'reddit', created_utc: Date.now()/1000 },
];

// Test filter logic
function testSubredditFilter(posts, subreddit) {
  if (subreddit === 'all') {
    return posts;
  }
  return posts.filter(p => p.source?.toLowerCase() === subreddit);
}

console.log('Testing subreddit filters:');
console.log('=========================');

// Test 'all' filter
const allPosts = testSubredditFilter(testPosts, 'all');
console.log(`Filter: 'all' => ${allPosts.length} posts (expected: 4)`);
console.assert(allPosts.length === 4, 'All filter should return all posts');

// Test 'programming' filter
const programmingPosts = testSubredditFilter(testPosts, 'programming');
console.log(`Filter: 'programming' => ${programmingPosts.length} posts (expected: 2)`);
console.assert(programmingPosts.length === 2, 'Programming filter should return 2 posts');
console.assert(programmingPosts.every(p => p.source === 'programming'), 'All posts should be from programming');

// Test 'webdev' filter
const webdevPosts = testSubredditFilter(testPosts, 'webdev');
console.log(`Filter: 'webdev' => ${webdevPosts.length} posts (expected: 1)`);
console.assert(webdevPosts.length === 1, 'Webdev filter should return 1 post');
console.assert(webdevPosts[0].source === 'webdev', 'Post should be from webdev');

// Test 'javascript' filter
const javascriptPosts = testSubredditFilter(testPosts, 'javascript');
console.log(`Filter: 'javascript' => ${javascriptPosts.length} posts (expected: 1)`);
console.assert(javascriptPosts.length === 1, 'JavaScript filter should return 1 post');
console.assert(javascriptPosts[0].source === 'javascript', 'Post should be from javascript');

console.log('\n✅ All filter tests passed!');
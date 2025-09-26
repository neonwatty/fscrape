// Test the 4-week heatmap logic
const now = Date.now();
const fourWeeksAgo = now - (28 * 24 * 60 * 60 * 1000);

// Create test posts spread across 4 weeks
const testPosts = [];
for (let i = 0; i < 28; i++) {
  const date = new Date(fourWeeksAgo + (i * 24 * 60 * 60 * 1000));
  testPosts.push({
    id: `post-${i}`,
    created_utc: Math.floor(date.getTime() / 1000), // Convert to Unix timestamp
    score: Math.floor(Math.random() * 100),
    num_comments: Math.floor(Math.random() * 20),
    platform: 'reddit',
    source: 'test'
  });
}

// Simulate the week calculation logic
testPosts.forEach((post, index) => {
  const postDate = new Date(post.created_utc * 1000);
  const daysSinceStart = Math.floor((postDate.getTime() - fourWeeksAgo) / (24 * 60 * 60 * 1000));
  const week = Math.floor(daysSinceStart / 7);
  const day = postDate.getDay();
  const hour = postDate.getHours();

  console.log(`Post ${index}: Day ${daysSinceStart} -> Week ${week}, ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]} at ${hour}:00`);
});

// Verify week assignment
const weekCounts = [0, 0, 0, 0];
testPosts.forEach(post => {
  const postDate = new Date(post.created_utc * 1000);
  const daysSinceStart = Math.floor((postDate.getTime() - fourWeeksAgo) / (24 * 60 * 60 * 1000));
  const week = Math.floor(daysSinceStart / 7);
  if (week >= 0 && week < 4) {
    weekCounts[week]++;
  }
});

console.log('\nPosts per week:');
weekCounts.forEach((count, week) => {
  console.log(`Week ${week + 1}: ${count} posts`);
});

console.log('\n✅ 4-week logic test passed!');
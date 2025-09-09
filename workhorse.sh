#!/bin/bash
set -e  # Exit on any error

# Function to check command success
check_command() {
    if [ $? -ne 0 ]; then
        echo "❌ Error: $1 failed"
        exit 1
    fi
    echo "✅ $1 succeeded"
}

# Step 1: Work on next task
echo "🚀 Starting work on next task..."
todoq work-next
check_command "todoq work-next"

# Step 2: Fix any issues
echo "🔧 Running tfq fix-all..."
tfq fix-all
FIX_EXIT_CODE=$?

# Check if exit code is 0 or 1 (both acceptable)
if [ "$FIX_EXIT_CODE" -ne 0 ] && [ "$FIX_EXIT_CODE" -ne 1 ]; then
    echo "❌ tfq fix-all failed with exit code $FIX_EXIT_CODE"
    exit 1
fi

# Step 3: Check and conditionally complete
echo "📊 Checking tfq count..."
TFQ_COUNT=$(tfq count)

if [ "$TFQ_COUNT" -eq 0 ]; then
    echo "✨ No issues found! Marking task complete..."
    todoq current --complete
    echo "🎉 Task successfully completed!"
    
    # Step 4: Commit and push changes
    echo "💾 Checking for changes to commit..."
    if [ -n "$(git status --porcelain)" ]; then
        echo "📝 Changes detected. Committing..."
        
        # Get task number and name for commit message
        TASK_NUM=$(todoq current --number 2>/dev/null || echo "")
        TASK_NAME=$(todoq current --json 2>/dev/null | grep '"name"' | head -1 | cut -d'"' -f4 || echo "Complete task")
        
        # Create commit message with task number
        if [ -n "$TASK_NUM" ]; then
            COMMIT_MSG="Task $TASK_NUM: $TASK_NAME"
        else
            COMMIT_MSG="$TASK_NAME"
        fi
        
        # Stage all changes
        git add .
        check_command "git add"
        
        # Commit with task description
        git commit -m "$COMMIT_MSG"
        check_command "git commit"
        
        # Push to remote
        echo "🚀 Pushing to remote..."
        git push
        check_command "git push"
    else
        echo "✨ No changes to commit"
    fi
else
    echo "⚠️  $TFQ_COUNT issues remain"
    echo "📝 Task remains in progress for manual review"
fi
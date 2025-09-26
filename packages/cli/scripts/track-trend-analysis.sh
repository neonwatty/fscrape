#!/bin/bash

# Trend Analysis Implementation Progress Tracker
# This script provides a quick overview of the implementation progress

echo "======================================"
echo "Trend Analysis Implementation Progress"
echo "======================================"
echo ""

# Show overall stats
echo "📊 Overall Statistics:"
todoq stats | grep -E "Total|Completed|In Progress|Pending"
echo ""

# Show current task
echo "🎯 Current Task:"
todoq current
echo ""

# Show Phase 1 tasks (Priority 1 foundation)
echo "📋 Phase 1 - Foundation Tasks (Priority 1):"
todoq list | grep -E "18\.(1\.1|1\.2|2\.1|2\.2|3\.1)" | head -10
echo ""

# Show in-progress tasks
echo "🚀 Tasks In Progress:"
todoq list --status in_progress
echo ""

# Show next pending tasks
echo "⏭️  Next Pending Tasks:"
todoq list --status pending | grep "P1" | head -5
echo ""

# Show subtask tree for 18.0
echo "🌳 Task Hierarchy:"
todoq list --tree | grep -A 40 "18.0"

echo ""
echo "======================================"
echo "Run 'todoq start <task-number>' to begin a task"
echo "Run 'todoq complete <task-number>' to mark a task complete"
echo "======================================"
#!/bin/bash
cd /home/z/my-project
while true; do
  echo "=== Starting Next.js at $(date) ===" >> dev.log
  bun run dev >> dev.log 2>&1
  EXIT_CODE=$?
  echo "=== Exited with code $EXIT_CODE at $(date), restarting in 2s ===" >> dev.log
  sleep 2
done

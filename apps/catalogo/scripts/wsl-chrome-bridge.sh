#!/bin/bash
# Bridge script to launch Windows Chrome from WSL
# Used by Antigravity/Playwright to control the browser

# Path to Chrome on Windows (accessible via /mnt/c)
CHROME_WIN="C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR="C:\Users\lukka\.gemini\antigravity-browser-profile"

# Convert arguments if necessary, but mostly pass them through
# We rely on cmd.exe to handle the Windows path launching
# "/c start" launches it detached so this script can exit (optional) 
# or we can run it directly to keep the pid alive if Playwright needs it.
# Playwright usually needs the PID. 'start' allows it to run, but Playwright might lose track.
# HOWEVER, the issue we had was "hanging". 
# Let's try direct invocation via exec which keeps the process attached in a way WSL handles?
# No, verifying earlier: direct invocation hung.
# Best approach: Use `/mnt/c/.../chrome.exe` directly but ensure no I/O blocks it.
# The user's successful manual command was: `& "C:\..."` in PowerShell.
# In WSL: `/mnt/c/.../chrome.exe ...` should work.

echo "Launching Chrome Bridge (Detached)..."
/mnt/c/Windows/System32/cmd.exe /c start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  "$@"

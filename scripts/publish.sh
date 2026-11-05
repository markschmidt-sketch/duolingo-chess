#!/bin/sh
# One-time publish to GitHub Pages. Needs: gh auth login -h github.com
set -e
REPO=${1:-duolingo-chess}
LOGIN=$(gh api user --hostname github.com --jq .login)
ID=$(gh api user --hostname github.com --jq .id)
# Use GitHub's no-reply address so no personal/work email ends up in a public repo.
git config user.name "$LOGIN"
git config user.email "$ID+$LOGIN@users.noreply.github.com"
git commit --amend --no-edit --reset-author -q
gh repo create "$LOGIN/$REPO" --public --source . --push --description "Offline iPhone app: read a Duolingo chess screenshot and finish the game vs Stockfish"
gh api -X POST "repos/$LOGIN/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 || \
  gh api -X PUT "repos/$LOGIN/$REPO/pages" -f build_type=workflow >/dev/null
gh workflow run pages.yml -R "$LOGIN/$REPO" 2>/dev/null || true
echo "Deploying… watch: gh run watch -R $LOGIN/$REPO"
echo "App URL (ready in ~1 min): https://$LOGIN.github.io/$REPO/"

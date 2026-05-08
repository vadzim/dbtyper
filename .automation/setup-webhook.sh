#!/bin/bash
# Setup GitHub webhook for smee.io integration
# This script creates a new smee.io channel and configures GitHub webhook

set -e

echo "GitHub Webhook Setup for Smee.io"
echo "================================="
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed"
  echo "Install it from: https://cli.github.com/"
  exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
  echo "Error: curl is not installed"
  exit 1
fi

# Get repository info
REPO_INFO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
if [ -z "$REPO_INFO" ]; then
  echo "Error: Could not determine repository"
  echo "Make sure you're in a git repository with GitHub remote"
  exit 1
fi

echo "Repository: $REPO_INFO"
echo ""

# Create new smee.io channel
echo "Creating new smee.io channel..."
SMEE_URL=$(curl -s -X POST https://smee.io/new -H "Content-Type: application/json" | grep -o 'https://smee.io/[^"]*' | head -1)

if [ -z "$SMEE_URL" ]; then
  echo "Error: Could not create smee.io channel"
  echo "Please visit https://smee.io manually and create a channel"
  exit 1
fi

echo "✓ Created smee.io channel: $SMEE_URL"
echo ""

# Save smee URL to config file
CONFIG_FILE=".automation/smee-config.json"
mkdir -p .automation
cat > "$CONFIG_FILE" <<EOF
{
  "smeeUrl": "$SMEE_URL",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repository": "$REPO_INFO"
}
EOF

echo "✓ Saved configuration to $CONFIG_FILE"
echo ""

# Ask user if they want to configure GitHub webhook
read -p "Do you want to configure GitHub webhook now? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Skipping GitHub webhook configuration."
  echo ""
  echo "To configure manually:"
  echo "1. Go to: https://github.com/$REPO_INFO/settings/hooks/new"
  echo "2. Set Payload URL to: $SMEE_URL"
  echo "3. Set Content type to: application/json"
  echo "4. Select 'Let me select individual events'"
  echo "5. Check 'Issues' only"
  echo "6. Click 'Add webhook'"
  echo ""
  echo "Your smee.io URL: $SMEE_URL"
  exit 0
fi

echo ""
echo "Configuring GitHub webhook..."

# Create webhook using gh CLI
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO_INFO/hooks" \
  -f name='web' \
  -f "config[url]=$SMEE_URL" \
  -f "config[content_type]=json" \
  -f "config[insecure_ssl]=0" \
  -F "events[]=issues" \
  -F active=true \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✓ GitHub webhook configured successfully"
else
  echo "⚠ Could not configure webhook automatically"
  echo ""
  echo "Please configure manually:"
  echo "1. Go to: https://github.com/$REPO_INFO/settings/hooks/new"
  echo "2. Set Payload URL to: $SMEE_URL"
  echo "3. Set Content type to: application/json"
  echo "4. Select 'Let me select individual events'"
  echo "5. Check 'Issues' only"
  echo "6. Click 'Add webhook'"
fi

echo ""
echo "Setup Complete!"
echo "==============="
echo ""
echo "Your smee.io URL: $SMEE_URL"
echo ""
echo "Next steps:"
echo "1. Start smee client (Terminal 1):"
echo "   npx smee-client --url $SMEE_URL --port 3000"
echo ""
echo "2. Start monitor in webhook mode (Terminal 2):"
echo "   npm run monitor -- --mode webhook --smee-url $SMEE_URL"
echo ""
echo "Or use the simplified command:"
echo "   npm run monitor -- --mode webhook"
echo "   (reads URL from $CONFIG_FILE)"
echo ""

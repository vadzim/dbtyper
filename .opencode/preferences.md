# OpenCode Preferences

## Pull Request Creation

When creating pull requests in this repository, **always enable auto-merge** by default.

Use one of these methods:

1. Use the script: `./scripts/create-pr.sh "title" "body"`
2. Or after creating PR with `gh pr create`, run: `gh pr merge --auto --merge`

The repository is configured with:

- Auto-merge enabled at repo level
- Branch protection requiring "test" check to pass
- PRs will auto-merge once checks are green

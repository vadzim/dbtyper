# GitHub Label Configuration for Automation

**Labels Created:**
- `approved` - Color: `#0e8a16` (green) - "Approved by maintainer for automated implementation"
- `in-progress` - Color: `#fbca04` (yellow) - "Currently being implemented"

---

## Label Purposes

### `approved` Label
Triggers the automated issue implementation system. When a maintainer adds this label to an issue, the automation system will implement the feature.

### `in-progress` Label
Indicates that an issue is currently being worked on. This label is:
- **Automatically added** by the automation system when implementation starts
- **Automatically removed** when PR is created or implementation fails
- **Can be manually added** by you when implementing something yourself
- **Helps avoid duplicate work** - shows others that the issue is being worked on

---

## Restricting Label to Maintainers Only

GitHub doesn't have built-in label restrictions, but you can enforce this through repository settings and team permissions.

### Option 1: Repository Permissions (Recommended)

**Configure repository access levels:**

1. **Go to repository settings:**
   ```
   https://github.com/vadzim/dbtyper/settings/access
   ```

2. **Set base permissions:**
   - Settings → Collaborators and teams → Base permissions
   - Set to "Read" for general contributors
   - This prevents non-maintainers from adding labels

3. **Grant maintainer access:**
   - Add maintainers with "Maintain" or "Admin" role
   - Only these users can add/remove labels

**Access levels:**
- **Read:** Can view and comment (cannot add labels)
- **Triage:** Can manage issues and PRs (CAN add labels)
- **Write:** Can push to repository (CAN add labels)
- **Maintain:** Can manage repository (CAN add labels)
- **Admin:** Full access (CAN add labels)

**Result:** Only users with Triage, Write, Maintain, or Admin roles can add the `approved` label.

### Option 2: Branch Protection + CODEOWNERS

While this doesn't directly restrict labels, it ensures only maintainers can merge:

1. **Create `.github/CODEOWNERS` file:**
   ```
   # Require maintainer approval for all changes
   * @vadzim
   ```

2. **Enable branch protection:**
   - Settings → Branches → Add rule for `main`
   - Enable "Require pull request reviews before merging"
   - Enable "Require review from Code Owners"

**Result:** Even if someone adds `approved` label, only maintainers can merge the resulting PR.

### Option 3: GitHub Actions Workflow (Automated Enforcement)

Create a workflow that removes the `approved` label if added by non-maintainers:

**Create `.github/workflows/enforce-approved-label.yml`:**

```yaml
name: Enforce Approved Label

on:
  issues:
    types: [labeled]

jobs:
  check-approved-label:
    runs-on: ubuntu-latest
    if: github.event.label.name == 'approved'
    
    steps:
      - name: Check if user is maintainer
        id: check
        uses: actions/github-script@v7
        with:
          script: |
            const maintainers = ['vadzim']; // Add maintainer usernames here
            const user = context.payload.sender.login;
            
            if (!maintainers.includes(user)) {
              // Remove label if not a maintainer
              await github.rest.issues.removeLabel({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                name: 'approved'
              });
              
              // Add comment explaining why
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: `@${user} The \`approved\` label can only be added by maintainers. Please request approval from a maintainer.`
              });
              
              core.setFailed('Only maintainers can add the approved label');
            }
```

**Result:** Automatically removes `approved` label if added by non-maintainers and posts a comment.

### Option 4: Probot App (Advanced)

Use a GitHub App like Probot to enforce label restrictions programmatically.

---

## Implemented Approach

**Using GitHub's Built-in Permissions** ✅

Since this is a public repository without collaborators who have Triage access, the restriction is automatically enforced by GitHub:

✅ Only repository collaborators with "Triage" role or higher can add labels  
✅ Non-collaborators cannot add any labels (including `approved`)  
✅ Currently only @vadzim (admin) can add labels  
✅ No GitHub Actions workflow needed  

**How it works:**
1. Non-collaborators try to add `approved` label → GitHub prevents it
2. Only repository admin (@vadzim) can add labels
3. Simple and built-in to GitHub

---

## Managing Maintainers

### Current Maintainers

- @vadzim (Admin)

### Add a Maintainer

To allow someone else to add the `approved` label, give them repository access:

**Via GitHub CLI:**
```bash
gh api repos/vadzim/dbtyper/collaborators/<username> -X PUT -f permission=triage
```

**Via GitHub Web:**
1. Go to: https://github.com/vadzim/dbtyper/settings/access
2. Click "Add people"
3. Enter username
4. Select role: "Triage" (can manage issues/labels) or higher

### Remove a Maintainer

**Via GitHub CLI:**
```bash
gh api repos/vadzim/dbtyper/collaborators/<username> -X DELETE
```

**Via GitHub Web:**
1. Go to: https://github.com/vadzim/dbtyper/settings/access
2. Find the user
3. Click "Remove"

---

## Verifying Label Restrictions

### Test as non-maintainer:

1. Log in as a non-maintainer user
2. Try to add `approved` label to an issue
3. Should see: "You don't have permission to add labels"

### Test as maintainer:

1. Log in as maintainer
2. Add `approved` label to an issue
3. Should succeed
4. Automation should detect and start implementation

---

## Label Usage Guidelines

### For Maintainers

**Using `approved` label:**

Before adding, verify:
- [ ] Issue has clear description
- [ ] Acceptance criteria are well-defined
- [ ] Technical details are sufficient
- [ ] Issue is not a duplicate
- [ ] Feature aligns with project goals
- [ ] Test requirements are clear

After adding:
- Monitor automation logs: `.automation/logs/`
- Review PR when created (30-90 minutes)
- Provide feedback if needed
- Merge when satisfied

**Using `in-progress` label:**

- Add manually when you start implementing something yourself
- Prevents automation from picking up the same issue
- Remove when you create a PR or stop working on it

### For Contributors

**To get an issue approved:**

1. Create a well-structured issue (see template)
2. Include clear acceptance criteria
3. Provide technical details if known
4. Wait for maintainer review
5. Maintainer will add `approved` label if accepted

**Checking issue status:**

- No labels: Not yet reviewed
- `approved`: Approved, waiting for implementation
- `in-progress`: Currently being worked on (automated or manual)
- `approved` + `in-progress`: Automation is implementing it now

**Do not:**
- Add `approved` label yourself (only maintainers can)
- Add `in-progress` if you're not actually working on it

---

## Monitoring Label Usage

### Check who added labels:

```bash
# View issue events
gh issue view <number> --json labels,timelineItems

# Check label history
gh api repos/vadzim/dbtyper/issues/<number>/events | jq '.[] | select(.event=="labeled")'
```

### Audit approved labels:

```bash
# List all issues with approved label
gh issue list --label approved --state all

# Check who approved each
for issue in $(gh issue list --label approved --json number --jq '.[].number'); do
  echo "Issue #$issue:"
  gh api repos/vadzim/dbtyper/issues/$issue/events | jq '.[] | select(.event=="labeled" and .label.name=="approved") | {user: .actor.login, created_at: .created_at}'
done
```

---

## Troubleshooting

### Non-maintainer added approved label

**If using Option 1 (Permissions):**
- Shouldn't be possible if permissions are set correctly
- Check repository access settings

**If using Option 3 (GitHub Actions):**
- Label will be automatically removed
- Comment will explain why

**Manual fix:**
```bash
gh issue edit <number> --remove-label approved
```

### Automation not triggering

**Check:**
1. Label is exactly "approved" (case-sensitive)
2. Issue is open (not closed)
3. Monitoring script is running
4. Check logs: `.automation/logs/`

---

## Alternative Label Names

If you want to use a different label name:

1. **Create new label:**
   ```bash
   gh label create "auto-implement" --description "..." --color "0e8a16"
   ```

2. **Update configuration:**
   Edit `.automation/config.json`:
   ```json
   {
     "automation": {
       "approvalLabel": "auto-implement"
     }
   }
   ```

3. **Update scripts:**
   Scripts use the label from config, so no code changes needed

---

## Summary

✅ **Label created:** `approved` (green, #0e8a16)  
✅ **Purpose:** Trigger automated implementation  
✅ **Restriction:** Set repository base permissions to "Read"  
✅ **Maintainers:** Only users with Maintain/Admin role can add  
✅ **Verification:** Test with non-maintainer account  

**Next steps:**
1. Configure repository permissions (Option 1)
2. Add maintainers with appropriate roles
3. Test label restrictions
4. Document maintainer list
5. Start using automation system

---

## References

- GitHub Permissions: https://docs.github.com/en/organizations/managing-access-to-your-organizations-repositories/repository-roles-for-an-organization
- Branch Protection: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- CODEOWNERS: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners

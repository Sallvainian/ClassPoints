# CI Secrets Checklist

Required secrets for the ClassPoints CI/CD pipeline.

## Required Secrets

### 1. DOTENV_PRIVATE_KEY_LOCAL

**Purpose:** Decrypt `.env.local` for Supabase credentials in CI

**Where to set:**

1. Go to GitHub repository: https://github.com/Sallvainian/ClassPoints
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `DOTENV_PRIVATE_KEY_LOCAL`
5. Value: Contents of your `.env.keys` file (the private key)

**Security notes:**

- Never commit `.env.keys` to the repository
- Rotate if compromised
- Only repository admins should have access

**Verification:**

```bash
# Check if secret is set (won't show value)
gh secret list
```

## Optional Secrets

### SLACK_WEBHOOK (Not currently configured)

**Purpose:** Send notifications on CI failures

**Setup (if needed):**

1. Create Slack incoming webhook
2. Add to repository secrets as `SLACK_WEBHOOK`
3. Update workflow to use slack notification action

## Security Best Practices

1. **Least privilege** - Only add secrets that are necessary
2. **Rotation** - Rotate secrets periodically (quarterly recommended)
3. **Audit** - Review secret access in Settings → Security → Audit log
4. **No hardcoding** - Never put secrets in code or config files

## Troubleshooting

### Secret not available in workflow

**Symptom:** `secrets.DOTENV_PRIVATE_KEY_LOCAL` is empty

**Causes:**

1. Secret not set in repository settings
2. Workflow running from fork (secrets not available to forks by default)
3. Typo in secret name

**Fix:**

```bash
# Verify secret exists
gh secret list

# If missing, set it
gh secret set DOTENV_PRIVATE_KEY_LOCAL < .env.keys
```

### Fork PRs failing

**Symptom:** PR from fork fails with missing secrets

**Solution:** This is expected security behavior. Fork PRs run without secrets access.

Options:

1. Ask contributor to open PR from branch in main repo
2. Review code, then manually trigger workflow from main repo
3. Configure workflow to skip secret-dependent steps for forks

## Checklist

Before first CI run, verify:

- [ ] `DOTENV_PRIVATE_KEY_LOCAL` secret is set
- [ ] Repository visibility matches secret scope
- [ ] Workflow file references correct secret names
- [ ] Test locally with `./scripts/ci-local.sh` first

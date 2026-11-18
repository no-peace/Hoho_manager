# GitHub Actions workflow guide

This repository defines separate workflows for application verification, performance checks, security checks, release publishing, and validation of the automation itself. GitHub Actions are currently disabled by the repository owner, so these workflows do not execute until the owner re-enables Actions.

## Workflow map

| Workflow | File | Configured trigger (when enabled) | What it protects |
| --- | --- | --- | --- |
| CI | [ci.yml](workflows/ci.yml) | Every push, pull request, or manual run | Builds every workspace, typechecks, runs tests on Node.js 22/24/26, and records a server benchmark on Node.js 26 |
| Lighthouse | [lighthouse.yml](workflows/lighthouse.yml) | Pull requests, pushes to main, or manual run | Measures the production client in mobile and desktop profiles |
| Security | [security.yml](workflows/security.yml) | Pull requests, pushes to main, weekly schedule, or manual run | Scans Git history for secrets, runs Semgrep, and audits npm dependencies |
| Release | [release.yml](workflows/release.yml) | A pushed `v*` tag or manual run | Verifies the exact tag before creating a GitHub Release |
| Workflow validation | [workflow-validation.yml](workflows/workflow-validation.yml) | Changes to workflow configuration on main/PR, or manual run | Runs actionlint against workflow YAML, expressions, and common configuration mistakes |

## How the checks fit together

1. **CI is the required application gate when Actions are enabled.** A change should build, typecheck, and pass tests on all supported Node.js lines.
2. **Lighthouse is a performance regression signal.** Review both mobile and desktop artifacts; a successful workflow means Lighthouse completed, not that every metric is perfect unless the configured assertions passed.
3. **Security checks are independent.** A clean npm audit does not replace secret scanning or static analysis.
4. **Workflow validation protects the automation.** Changes to GitHub Actions configuration are checked by actionlint so workflow errors are caught before relying on them.
5. **Release verification is tag-specific.** When Actions are enabled, the release job checks out and tests the exact tag that will be published. A failed verification prevents the publish job from running.

## Creating a release

### Automatic release

1. Create and push a semantic-version tag, for example `v1.2.3`.
2. GitHub starts the Release workflow.
3. The workflow validates the tag, checks out that exact tag, builds, typechecks, and runs tests.
4. Only if verification succeeds does GitHub create a Release with generated release notes.

### Manual release

1. Open the repository on GitHub.
2. Select **Actions** → **Release** → **Run workflow**.
3. Enter an existing tag such as `v1.2.3`.
4. Run the workflow and inspect the **Verify exact release tag** job.
5. The release is published only if the tag exists and its code passes all verification steps.

Do not use a branch name or commit SHA in the manual tag field. The input must be an existing tag matching the `vMAJOR.MINOR.PATCH` format, optionally followed by a prerelease suffix.

## Security and maintenance rules

- Workflows start with no token permissions (`permissions: {}`) and grant `contents: read` only to jobs that need checkout. The release publish job alone receives `contents: write`.
- Third-party actions are pinned to full commit SHAs. Dependabot checks the GitHub Actions ecosystem weekly so these pins can be updated through reviewable pull requests.
- Keep dependency installation reproducible with `npm ci` and the root lockfile.
- Keep benchmark and Lighthouse artifacts short-lived; they are diagnostic outputs, not permanent backups.
- Never print secrets or write credentials into artifacts or dependency caches.
- Review Dependabot updates before merging. An update to an action SHA is a code change and should pass workflow validation.

## Deliberately not enabled

This repository is currently private. CodeQL code scanning and dependency-review features can depend on GitHub Code Security / Advanced Security entitlement for private repositories. They should only be enabled after confirming the repository has the required feature access; adding a workflow that will fail because the feature is unavailable would make the checks less reliable. The Semgrep, npm audit, and Gitleaks jobs are configured in the workflow files but are not executing while GitHub Actions are disabled.

## Troubleshooting

- **Workflow validation fails:** Open the actionlint step and fix the reported file/line. Re-run the workflow after updating the YAML.
- **Release says tag is missing:** Confirm the tag exists under **Code → Tags** and that the spelling is exact.
- **Release verification fails:** The publish job is intentionally skipped. Fix the code at the tag or create a corrected new tag; do not bypass verification.
- **Lighthouse artifact is missing:** Open the Lighthouse run and inspect the upload step. A missing artifact can mean Lighthouse did not produce its expected output directory.
- **A workflow was cancelled:** Newer commits to the same branch/PR may have superseded it because concurrency cancellation is enabled for non-release checks.

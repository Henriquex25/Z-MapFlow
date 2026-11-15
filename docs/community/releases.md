# Publishing releases

## Repository setup

The repository and releases must be public for anonymous community downloads and update checks. Configure **Settings → Pages → Source: GitHub Actions** for the documentation. Scripts do not change repository visibility.

Consider requiring CI on the main branch and enable GitHub’s private vulnerability reporting.

## One version source

Change **only `VERSION` at the repository root** to bump the app version. It contains stable `MAJOR.MINOR.PATCH`, without a `v` prefix.

The entry point embeds this root file and initializes the shared version before the app starts. The CLI, header badge, updater, native Wails package metadata and release scripts all read it. The frontend has no independent app version. The Wails wrapper supplies derived native metadata only during a build.

## Build a release draft

1. Merge the changes you want to release into `main`.
2. Update the root `VERSION` file, for example to `0.1.1`, commit and push to `main`.
3. Wait for **CI** to complete successfully for that exact commit, including the app and documentation jobs.
4. Open **GitHub → Actions → Build Linux release draft → Run workflow**, select **main** and run it.
5. Wait for the workflow to finish. It checks the version and prior CI, builds Linux x86_64, verifies the package checksums and creates a **draft** release named `v0.1.1`, with all assets and generated release notes.

The workflow must be merged into the default branch before the manual button becomes available. See [GitHub's manual workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The workflow runs only when manually requested. You do not need to create or push a tag yourself. The draft uses `v` followed by `VERSION` and targets the commit selected when the workflow was started, even if `main` advances during the build. The workflow never publishes the release automatically.

If CI is still running or failed for that commit, draft generation stops before the build. A build failure does not create a release. If asset upload fails, a partial draft can remain: keep it unpublished and rerun after fixing the failure. A retry can refresh the assets of an existing draft for the same commit without changing its title or notes. A draft for another commit is rejected; remove that draft or increment `VERSION`. Published releases cannot be overwritten by this workflow.

## Review and publish manually

1. Open **GitHub → Releases** and edit the generated draft.
2. Check its version, title, notes and the three assets listed below. Download and test the installation package before publishing. Resolve any upload failure before publishing a partial draft.
3. Keep it as a stable release, select **Set as the latest release** and choose **Publish release**.

Drafts and prereleases stay outside the updater. After publication as **Latest**, installed apps check it at startup and offer to update when its version is newer than their embedded version. An app already running `0.1.0` will not offer an update to `0.1.0`; use a higher version for subsequent changes.

Never reuse a published version or move a published tag. Publish a new version to correct an artifact. Only stable `MAJOR.MINOR.PATCH` releases are supported by this flow.

## Assets and update contract

- `z-mapflow_VERSION_linux_amd64.tar.gz`: initial installation package, icon, license and installer.
- `z-mapflow_linux_amd64`: executable consumed by the updater.
- `checksums.txt`: SHA-256 of those assets.

Asset names are part of the updater contract. Downloads come from `Henriquex25/Z-MapFlow`; the app rechecks the chosen release, verifies bytes and runs `--version` before replacement to check the version and runtime libraries. Keep release publishing rights limited to trusted maintainers.

A complete previous executable is retained as `.previous`. Replacement is atomic and immediate launch failures trigger rollback. Problems that occur after the GUI opens may require manual restoration; test the installed package before announcing it.

## Local build and package

```sh
python3 scripts/wails.py build -tags webkit2_41
python3 scripts/package_release.py
```

The packager rejects an executable whose reported version differs from the central file. No version argument or version linker override is needed.

Before announcing a release, check installation, version display, import, firmware building and updating from an earlier version in a temporary user profile. CI does not validate physical keyboard behavior. Windows/macOS packages and code signing are not part of the initial release workflow.

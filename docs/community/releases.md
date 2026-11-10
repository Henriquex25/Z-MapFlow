# Publishing releases

## Repository setup

The repository and releases must be public for anonymous community downloads and update checks. Configure **Settings → Pages → Source: GitHub Actions** for the documentation. Scripts do not change repository visibility.

Consider requiring CI on the main branch and enable GitHub’s private vulnerability reporting.

## One version source

Change **only `internal/version/VERSION`** to bump the app version. It contains stable `MAJOR.MINOR.PATCH`, without a `v` prefix.

Go embeds this file. The CLI, header badge, updater, native Wails package metadata and release scripts all read it. The frontend has no independent app version. The Wails wrapper supplies derived native metadata only during a build.

## Publish

1. Update the central version file, merge the release changes and verify CI.
2. Tag the reviewed commit with the matching version:

```sh
git tag "v$(python3 scripts/project_version.py)"
git push origin "v$(python3 scripts/project_version.py)"
```

The workflow rejects a tag that differs from the central file. It runs CI, builds Linux with the embedded version, creates the package and checksums, and uploads a draft release. It publishes only after all assets are present. A failed build/upload leaves the draft outside the updater.

Never reuse a published tag. Publish a new version to correct an artifact. The initial workflow distributes stable tags only.

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

# Contributing to Z-MapFlow

Code fixes, documentation, translations, usability improvements and new keyboard plugins are welcome.

- [Community guide](https://henriquex25.github.io/Z-MapFlow/community/contributing)
- [Development environment and checks](docs/community/development.md)
- [Step-by-step keyboard plugin guide](docs/plugins.md), including the [validation checklist](docs/plugins.md#contributor-validation-checklist)
- [Release process and central version](docs/community/releases.md)

Use the issue forms for bugs, features and proposed keyboards. Discuss substantial changes before implementing them. PRs should describe the concrete problem, resulting behavior and validation, with screenshots for interface changes.

Read `AGENT.md`. Keep hardware-specific rules in plugins, preserve immutable snapshots and saved project compatibility, and use simulated volumes for automated flash tests. Regenerate Wails bindings when changing Go models/API methods.

The UI and default documentation are English. Update `internal/i18n/pt-BR.json` for visible strings and preserve the distinction between interface language and keyboard layout. The application version is owned solely by `VERSION`.

Do not include credentials or personal configuration. The project uses MIT; contributions use the same license. Preserve third-party notices. Harassment, discrimination and personal attacks are not accepted in issues, pull requests or reviews.

## Maintainer workflow

Use a focused `feat/`, `fix/` or `docs/` branch and open a pull request targeting `main`; feature work is not committed directly to `main`. Open a draft while implementation or hardware validation is incomplete. The existing CI runs on pull requests and checks Linux, Windows and documentation. Review the diff and checks before merging; merging and release publication remain explicit maintainer actions. Release drafts are still created manually from `main`.

Repository owners should protect `main` with required CI checks and prohibit direct pushes. This recommendation does not imply that protection is already enabled.

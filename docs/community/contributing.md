# Contributing

Code fixes, documentation, translations, usability improvements and keyboard plugins are welcome. The project uses the **MIT license**; submitted contributions are distributed under that license.

## Issues

Choose the bug, feature or keyboard support form. Provide reproducible steps and the expected result. For firmware problems, include the keyboard, controller, variant and ZMK revision. Review files before attaching them and do not publish credentials or personal configuration unintentionally.

Report exploitable vulnerabilities according to [SECURITY.md](https://github.com/Henriquex25/Z-MapFlow/blob/main/SECURITY.md).

## Pull requests

1. Fork the repository and create a branch with a focused objective.
2. Read [development](./development) and the rules in `AGENT.md`.
3. Implement and validate the change; update affected guides and translations.
4. Open a PR using the template, explaining the problem, resulting behavior and verification.

Discuss larger changes in an issue first. Be respectful and focus reviews on the code. Harassment, discrimination and personal attacks are not accepted.

## New keyboards

Follow the [step-by-step plugin guide](../plugins). Hardware geometry, matrix order, controllers and build targets belong in a plugin, while shared functionality belongs in the core. State which builds and physical tests you performed. A working build does not prove successful flashing or correct hardware operation.

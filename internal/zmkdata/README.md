# Shared ZMK validation metadata

`catalog.json` is consumed by the backend and frontend. Refresh explicitly with
`python3 internal/zmkdata/update.py`. The script reads public MIT-licensed ZMK
headers at the revision recorded in the file; it is never run during startup or builds.

Names and parameter counts come from the headers. Binding signatures and command
forms follow ZMK's public behavior APIs. User header/define names and plugin
bindings extend this catalog at runtime. Firmware compilation remains the check
for board/module availability and native extensions.

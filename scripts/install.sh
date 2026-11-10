#!/bin/sh
# Install the extracted official Linux package for the current user.
set -eu
case "${1:-}" in ''|--no-launch) ;; *) echo 'Uso: ./install.sh [--no-launch]' >&2; exit 2;; esac
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$package_dir"
if ! command -v sha256sum >/dev/null 2>&1; then
  echo 'O comando sha256sum é necessário para conferir este pacote.' >&2; exit 1
fi
sha256sum -c checksums.txt
# Verify runtime libraries before changing an existing installation.
./z-mapflow --version >/dev/null
user_data_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}
install_dir="$user_data_dir/z-mapflow"
case "$install_dir" in *'"'*|*'`'*|*'$'*|*'\'*) echo 'O caminho de instalação contém caracteres não suportados.' >&2; exit 1;; esac
mkdir -p "$install_dir" "$user_data_dir/applications" "$HOME/.local/bin"
if [ -e "$HOME/.local/bin/z-mapflow" ] && [ ! -L "$HOME/.local/bin/z-mapflow" ]; then
  echo 'Já existe um arquivo em ~/.local/bin/z-mapflow; mova-o antes de instalar.' >&2; exit 1
fi
staged_binary=$(mktemp "$install_dir/.install-XXXXXX")
trap 'rm -f "$staged_binary"' EXIT HUP INT TERM
install -m 755 z-mapflow "$staged_binary"
mv -f "$staged_binary" "$install_dir/z-mapflow"
install -m 644 appicon.png "$install_dir/appicon.png"
install -m 644 LICENSE "$install_dir/LICENSE"
ln -sfn "$install_dir/z-mapflow" "$HOME/.local/bin/z-mapflow"
cat > "$user_data_dir/applications/z-mapflow.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Z-MapFlow
Comment=Editor visual e compilador de teclados ZMK
Exec="$install_dir/z-mapflow"
Icon=$install_dir/appicon.png
Terminal=false
Categories=Utility;Development;
StartupWMClass=z-mapflow
DESKTOP
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$user_data_dir/applications" >/dev/null 2>&1 || true
fi
printf 'Z-MapFlow instalado. Abra pelo menu de aplicativos.\n'
if [ "${1:-}" != --no-launch ]; then
  "$install_dir/z-mapflow" >/dev/null 2>&1 &
fi

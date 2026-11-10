# Instalação e atualização

A distribuição inicial é para **Linux x86_64**, com GTK 3 e WebKitGTK 4.1. Ubuntu/Pop!_OS 22.04 ou mais recente são a base da compilação. Windows, macOS e outras arquiteturas ainda não possuem pacotes oficiais.

## Instalar em poucos passos

1. Abra [GitHub Releases](https://github.com/Henriquex25/Z-MapFlow/releases/latest) e baixe `z-mapflow_VERSAO_linux_amd64.tar.gz`.
2. Extraia o arquivo e, dentro da pasta extraída, execute `./install.sh` no terminal. O instalador abre o aplicativo e cria uma entrada **Z-MapFlow** no menu de aplicativos.

A instalação é feita na pasta do usuário, sem `sudo`. Go, Node e ferramentas de desenvolvimento não são necessários. Nas próximas vezes, abra pelo menu de aplicativos.

Se faltarem bibliotecas no Ubuntu/Pop!_OS/Debian compatível, instale:

```sh
sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0
```

O pacote inclui `checksums.txt`; o instalador confere o executável antes de copiá-lo. Para conferir também o arquivo baixado, obtenha `checksums.txt` da mesma release e execute na pasta dos downloads:

```sh
sha256sum --ignore-missing -c checksums.txt
```

Para compilar firmwares, instale e inicie também o [Docker](https://docs.docker.com/get-started/get-docker/). Docker Desktop funciona quando seu contexto está disponível no CLI.

## Atualização automática

Ao iniciar, o aplicativo consulta a última release pública estável do repositório oficial. Ao encontrar uma versão mais recente, mostra um pop-up. Você pode fechar com **Agora não** ou escolher **Atualizar**.

Havendo alterações, o botão é **Salvar e atualizar**. Corrija campos inválidos antes de prosseguir. Compilações e gravações em andamento devem terminar ou ser canceladas primeiro.

O aplicativo baixa o executável correspondente ao sistema e arquitetura, confere tamanho, SHA-256 e o digest do GitHub quando disponível, verifica o formato/arquitetura Linux e executa uma conferência de versão sem abrir a interface (incluindo bibliotecas necessárias), instala e reinicia. O executável anterior fica como `z-mapflow.previous`. Uma falha na substituição ou ao iniciar o novo processo restaura o anterior.

Sem internet, com limite da API ou sem releases públicas, o editor continua disponível. Clique no indicador de atualizações no cabeçalho para tentar novamente. Não é necessário login nem token no aplicativo; releases de um repositório privado não ficam disponíveis para esta consulta pública.

## Dados e remoção

O projeto salvo e os builds ficam na pasta de configuração do aplicativo, normalmente `~/.config/z-mapflow`; a variável `XDG_CONFIG_HOME` é respeitada. Instalar/atualizar o aplicativo não apaga esses dados.

A instalação fica em `${XDG_DATA_HOME:-$HOME/.local/share}/z-mapflow`. Para remover apenas o aplicativo, apague essa pasta, `~/.local/share/applications/z-mapflow.desktop` (ou equivalente sob `XDG_DATA_HOME`) e o atalho `~/.local/bin/z-mapflow`. Preserve sua configuração para reinstalar depois.

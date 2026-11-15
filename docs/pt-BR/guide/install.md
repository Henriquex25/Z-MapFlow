# Instalação e atualização

O Z-MapFlow está disponível **somente para Linux x86_64**, com GTK 3 e WebKitGTK 4.1, compilado no Ubuntu 22.04. Windows, macOS e outras arquiteturas estão fora do escopo atual de distribuição. O instalador e o atualizador automático atendem Linux.

## Instalar em poucos passos

No Ubuntu, Pop!_OS ou Debian compatível, instale o runtime gráfico uma vez antes de executar o pacote baixado:

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-0
```

O gerenciador de pacotes instala também o GTK e as demais dependências desse runtime. Esses pacotes do sistema exigem acesso de administrador; o aplicativo é instalado na pasta do usuário.

1. Abra [GitHub Releases](https://github.com/Henriquex25/Z-MapFlow/releases/latest) e baixe `z-mapflow_VERSAO_linux_amd64.tar.gz`.
2. Extraia o arquivo e, dentro da pasta extraída, execute `./install.sh` no terminal. O instalador abre o aplicativo e cria uma entrada **Z-MapFlow** no menu de aplicativos.

A instalação é feita na pasta do usuário, sem `sudo`. Go, Node e ferramentas de desenvolvimento não são necessários. Nas próximas vezes, abra pelo menu de aplicativos.

Em outras distribuições Linux, instale os pacotes de runtime GTK 3 e WebKitGTK 4.1 pelo gerenciador de pacotes da distribuição.

O pacote inclui `checksums.txt`; o instalador confere o executável antes de copiá-lo. Para conferir também o arquivo baixado, obtenha `checksums.txt` da mesma release e execute na pasta dos downloads:

```sh
sha256sum --ignore-missing -c checksums.txt
```

## Docker para compilar firmware

**O Docker precisa estar instalado e em execução para compilar o firmware do teclado.** Instale o [Docker Engine ou Docker Desktop](https://docs.docker.com/get-started/get-docker/) e inicie o serviço Docker ou o aplicativo Desktop antes de usar **Compilar** ou **Salvar e compilar**.

O Z-MapFlow precisa ter acesso ao serviço Docker. Docker Desktop funciona quando seu contexto ativo está disponível pelo CLI. Se o app não conseguir acessar o Docker, consulte [problemas com Docker](./troubleshooting#docker-nao-e-encontrado).

Editar e salvar layouts e importar/exportar keymaps funciona sem Docker. Consulte [compilação e flash do firmware](./firmware) quando estiver pronto para compilar.

## Problemas de instalação

### Biblioteca WebKitGTK 4.1 ausente

**O que aparece**

O instalador confere os arquivos do pacote com sucesso e depois para com a mensagem:

```text
./z-mapflow: error while loading shared libraries: libwebkit2gtk-4.1.so.0: cannot open shared object file: No such file or directory
```

**O que significa**

Falta uma biblioteca do sistema necessária para abrir o app. O arquivo baixado usa as bibliotecas GTK 3 e WebKitGTK 4.1 instaladas no computador. Ter WebKitGTK 4.0 instalado não fornece a biblioteca exigida pela release.

As linhas terminadas em `OK` ou `SUCESSO` confirmam apenas que os arquivos correspondem aos checksums do pacote. A verificação seguinte confere se o app consegue iniciar com as bibliotecas do sistema. Se ela falhar, a instalação para antes de criar ou substituir arquivos do aplicativo. As novas compilações do instalador identificam separadamente a conferência dos arquivos, a checagem de dependências e a instalação.

**Como resolver**

No Ubuntu, Pop!_OS ou Debian compatível, execute os comandos abaixo na pasta do pacote descompactado:

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-0
./install.sh
```

O gerenciador de pacotes instala também as dependências desse runtime. Essa preparação do sistema é necessária uma vez; o app continua sendo instalado na pasta do usuário. Em outras distribuições, instale os runtimes GTK 3 e WebKitGTK 4.1 pelo gerenciador de pacotes correspondente.

Você pode reutilizar o arquivo que já baixou. A instalação termina quando aparece `Z-MapFlow installed. Open it from your application menu.` Se outro erro persistir, inclua a saída completa do terminal e a distribuição/versão do Linux em uma [issue de instalação](https://github.com/Henriquex25/Z-MapFlow/issues/new/choose).

## Atualização automática

Ao iniciar, o aplicativo consulta a última release pública estável do repositório oficial. Ao encontrar uma versão mais recente, mostra um pop-up. Você pode fechar com **Agora não** ou escolher **Atualizar**.

Havendo alterações, o botão é **Salvar e atualizar**. Corrija campos inválidos antes de prosseguir. Compilações e gravações em andamento devem terminar ou ser canceladas primeiro.

O aplicativo baixa o executável correspondente ao sistema e arquitetura, confere tamanho, SHA-256 e o digest do GitHub quando disponível, verifica o formato/arquitetura Linux e executa uma conferência de versão sem abrir a interface (incluindo bibliotecas necessárias), instala e reinicia. O executável anterior fica como `z-mapflow.previous`. Uma falha na substituição ou ao iniciar o novo processo restaura o anterior.

Sem internet, com limite da API ou sem releases públicas, o editor continua disponível. Clique no indicador de atualizações no cabeçalho para tentar novamente. Não é necessário login nem token no aplicativo; releases de um repositório privado não ficam disponíveis para esta consulta pública.

## Dados e remoção

O projeto salvo e os builds ficam na pasta de configuração do aplicativo, normalmente `~/.config/z-mapflow`; a variável `XDG_CONFIG_HOME` é respeitada. Instalar/atualizar o aplicativo não apaga esses dados.

A instalação fica em `${XDG_DATA_HOME:-$HOME/.local/share}/z-mapflow`. Para remover apenas o aplicativo, apague essa pasta, `~/.local/share/applications/z-mapflow.desktop` (ou equivalente sob `XDG_DATA_HOME`) e o atalho `~/.local/bin/z-mapflow`. Preserve sua configuração para reinstalar depois.

## Idioma e versão do aplicativo

A interface abre em inglês. Em **Settings → Application → Interface language**, selecione **Português (Brasil)**. A preferência fica salva neste computador e não muda o layout do teclado nem o firmware. A versão atual aparece discretamente ao lado do nome do aplicativo.

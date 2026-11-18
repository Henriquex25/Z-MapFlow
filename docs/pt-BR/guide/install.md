# Instalação e atualização

**Antes de baixar:** confira as [tabelas de teclados e controladoras compatíveis](./keyboards), incluindo as combinações testadas no hardware e as que continuam experimentais.

O Z-MapFlow atende **Linux x86_64**, com **builds Windows x64 em testes iniciais**. O workflow manual atualizado gera pacotes dos dois sistemas; releases anteriores podem conter apenas Linux. O CI nativo do Windows verifica a compilação e o instalador; a validação com teclado físico no Windows continua pendente. macOS e Windows ARM64 ainda não têm pacotes.

## Linux x86_64

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

## Windows x64

1. Baixe `z-mapflow_VERSAO_windows_amd64_setup.exe` nas [Releases](https://github.com/Henriquex25/Z-MapFlow/releases/latest), quando o asset Windows estiver disponível.
2. Feche uma instância aberta do Z-MapFlow, execute o instalador e escolha **Install**. A instalação fica em `%LOCALAPPDATA%\Programs\Z-MapFlow`, com atalhos no menu Iniciar e na área de trabalho, sem exigir administrador para o app.
3. Abra **Z-MapFlow** pelo menu Iniciar ou pela última tela do instalador.

É necessário Windows 10/11 x64 e Microsoft WebView2. O instalador e o app incluem o bootstrapper oficial da Microsoft; se o runtime estiver ausente, é necessário acesso à internet para obtê-lo. O usuário não precisa instalar Go, Node ou Wails. Os builds iniciais não têm assinatura digital, então o Windows pode exibir um aviso de editor desconhecido/SmartScreen. Baixe apenas da release oficial e, se necessário, confira o hash:

```powershell
Get-FileHash .\z-mapflow_VERSAO_windows_amd64_setup.exe -Algorithm SHA256
```

Compare com a linha correspondente em `checksums.txt` da mesma release. O asset `z-mapflow_windows_amd64.exe` é usado pelo atualizador; prefira o arquivo de setup para instalar.

Para compilar firmware, instale o [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/), habilite contêineres Linux (normalmente com WSL 2) e inicie o Docker. A edição/exportação de keymaps funciona sem Docker. Conecte o teclado diretamente ao Windows em bootloader para fazer flash; não é necessário passar o USB para o contêiner. O aplicativo usa a descoberta nativa de unidades do Windows e permite selecionar a unidade manualmente.

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

O aplicativo baixa o executável correspondente ao sistema e arquitetura, confere tamanho, SHA-256 e o digest do GitHub quando disponível, verifica o formato e a arquitetura do executável (ELF no Linux, PE no Windows) e executa uma conferência de versão sem abrir a interface (incluindo bibliotecas necessárias), instala e reinicia. O executável anterior fica como `z-mapflow.previous`. Uma falha na substituição ou ao iniciar o novo processo restaura o anterior.

Sem internet, com limite da API ou sem releases públicas, o editor continua disponível. Clique no indicador de atualizações no cabeçalho para tentar novamente. Não é necessário login nem token no aplicativo; releases de um repositório privado não ficam disponíveis para esta consulta pública.

## Dados e remoção

O projeto salvo e os builds ficam na pasta de configuração do aplicativo, normalmente `~/.config/z-mapflow`; a variável `XDG_CONFIG_HOME` é respeitada. Instalar/atualizar o aplicativo não apaga esses dados.

A instalação fica em `${XDG_DATA_HOME:-$HOME/.local/share}/z-mapflow`. Para remover apenas o aplicativo, apague essa pasta, `~/.local/share/applications/z-mapflow.desktop` (ou equivalente sob `XDG_DATA_HOME`) e o atalho `~/.local/bin/z-mapflow`. Preserve sua configuração para reinstalar depois.

## Idioma e versão do aplicativo

A interface abre em inglês. Em **Settings → Application → Interface language**, selecione **Português (Brasil)**. A preferência fica salva neste computador e não muda o layout do teclado nem o firmware. A versão atual aparece discretamente ao lado do nome do aplicativo.


No Windows, um processo auxiliar confirma que está pronto e aguarda o app anterior encerrar antes de substituir o `.exe` bloqueado. Ele confere novamente os bytes, preserva `z-mapflow.exe.previous` e reinicia o app. Falhas antes da transferência de controle aparecem no aplicativo; falhas posteriores são informadas por uma mensagem nativa. Isso não detecta todos os problemas após a nova interface abrir.

Projetos, histórico, preferências de apoio e dados do WebView2 ficam em `%APPDATA%\z-mapflow`. O diretório do WebView2 é estável entre atualizações. Use **Configurações → Aplicativos → Z-MapFlow → Desinstalar** para remover o programa. Os dados da configuração são preservados. O instalador remove apenas arquivos do aplicativo, sem apagar recursivamente a pasta escolhida.

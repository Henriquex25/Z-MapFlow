# Z-MapFlow

Editor desktop de keymaps ZMK inspirado no VIAL, com Go/Wails e React. O fluxo é **configurar visualmente → salvar e compilar → conectar em bootloader → enviar o firmware**.

A primeira integração é o **Sofle v2**, com 58 teclas e dois cliques de encoder. O core recebe a geometria, os índices ZMK e os alvos de compilação pelo contrato do plugin.

## Instalar

Baixe o pacote Linux x86_64 em [Releases](https://github.com/Henriquex25/Z-MapFlow/releases/latest), extraia e execute `./install.sh`. O aplicativo é instalado na pasta do usuário e cria um atalho no menu. Go e Node não são necessários; GTK 3 e WebKitGTK 4.1 devem estar disponíveis no sistema.

Ao iniciar, o app procura uma release pública estável mais recente. O pop-up permite adiar ou salvar a configuração, baixar, verificar a integridade, instalar e reiniciar. Docker só é necessário para compilar firmware. Veja [instalação e atualização](docs/guide/install.md).

[Documentação no GitHub Pages](https://henriquex25.github.io/Z-MapFlow/) · [Contribuir](CONTRIBUTING.md) · [Reportar problema](https://github.com/Henriquex25/Z-MapFlow/issues/new/choose) · [Licença MIT](LICENSE)

A publicação da documentação e dos primeiros pacotes depende de enviar estes workflows ao GitHub, habilitar Pages com GitHub Actions e criar uma tag de release. O repositório e as releases precisam ser públicos para acesso anônimo pela comunidade.

## O que funciona

- Arrastar ações da paleta para o teclado e encoders; trocar ações entre teclas.
- Adicionar, renomear, limpar, restaurar e reordenar camadas com referências estáveis.
- Criar macros com até dois parâmetros e controles nativos, combos, hold-taps genéricos, tap-dances, mod-morphs, sticky keys e outros behaviors.
- Editar argumentos de cada tecla, regras de camadas condicionais e input processors por dispositivo/camada.
- Configurar mod-tap e layer-tap independentemente, com quick tap, flavor, retro-tap e parâmetros posicionais de home-row mods.
- Selecionar símbolos US ou ABNT2, OLED, ações de mouse, perfis Bluetooth e repouso.
- Persistir a configuração no computador e importar/exportar projetos JSON e keymaps ZMK (`.keymap`).
- Gerar e visualizar os arquivos ZMK.
- Compilar em Docker em segundo plano, consultar logs, cancelar, recuperar builds anteriores e exportar UF2.
- Detectar volumes UF2 e enviar o firmware da metade escolhida, com alternativa de seleção manual.

**Salvar** grava apenas a configuração local. **Compilar** usa a última revisão salva. **Salvar e compilar** salva a edição atual e compila essa revisão. O editor continua disponível durante o build; alterações posteriores ficam para a próxima compilação.

## Desenvolvimento no Linux

Requer Go compatível com `go.mod`, Node/npm, Wails v2 e suas dependências nativas GTK/WebKit. Docker precisa estar em execução e acessível ao usuário para compilar firmware; editar e salvar não exige Docker.

```sh
cd frontend
npm ci
npm test
npm run build
cd ..
wails dev -tags webkit2_41
```

Os pacotes oficiais usam WebKitGTK 4.1. Se seu ambiente de desenvolvimento existente só possui WebKitGTK 4.0, omita `-tags webkit2_41` nos comandos Go/Wails.

Para gerar o executável desktop:

```sh
wails build -tags webkit2_41
```

O executável fica em `build/bin/z-mapflow`. Essa compilação empacota o aplicativo; os firmwares ZMK são compilados pelo botão do editor.

Atalhos: `Ctrl+S` salva e `Ctrl+Shift+S` salva e compila (`Cmd` no macOS).

O teclado abre ajustado ao espaço disponível (100% da escala ajustada) e oferece controles de zoom de 80% a 160%. Cada tecla mostra seu behavior, como `&kp` ou `&lt`, no canto superior esquerdo. **Descartar** volta à última configuração salva ou, antes do primeiro salvamento, ao estado em que o projeto foi aberto.

## Criar e atribuir macros, behaviors e combos

1. Abra **Macros** ou **Comportamentos** e crie o recurso. Clique numa ação da paleta e depois no campo que deseja preencher, ou arraste a ação até o campo.
2. Use **Atribuir ao teclado** no recurso criado. O aplicativo abre o layout com essa ação selecionada.
3. Escolha a camada e clique nas teclas ou nas zonas dos encoders que receberão a ação. A seleção permanece ativa para atribuir a mais de um destino; use **Cancelar seleção** ou `Esc` para encerrar.
4. Em **Combos**, crie um combo, selecione duas ou mais posições no desenho e preencha **Ação do combo** com uma tecla, macro ou behavior. As posições selecionadas passam a ativar essa ação; o mapeamento individual das teclas é preservado.
5. Use **Salvar** ou **Salvar e compilar** para persistir as configurações e suas atribuições.

Os recursos criados também aparecem na paleta **Recursos** e podem ser arrastados para o layout.

A atribuição valida a quantidade e o tipo dos parâmetros da ação: teclas e atalhos, camadas existentes, perfis Bluetooth configurados e comandos de iluminação. Comportamentos compostos verificam as ações filhas e rejeitam referências circulares. Os campos mantêm o último valor válido; rascunhos inválidos recebem indicação vermelha e bloqueiam o salvamento até serem corrigidos ou cancelados. Arrastes incompatíveis são recusados. O backend repete a validação ao salvar e gerar o firmware.

Os códigos e assinaturas vêm de um catálogo compartilhado entre a interface e Go, extraído dos headers oficiais de uma revisão ZMK fixada; consulte `internal/zmkdata/README.md`. Defines de headers do projeto continuam disponíveis. Propriedades e extensões nativas avançadas dependem também das regras dos módulos, do hardware e da revisão usados na compilação.

## Sofle e perfis de firmware

O perfil atual usa `nice_nano@2.0.0//zmk`, com `sofle_left` e `sofle_right`, conforme o [repositório de referência do autor](https://github.com/Henriquex25/zmk-config/blob/main/build.yaml). A revisão ZMK é fixada em `4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85`, com a imagem `zmkfirmware/zmk-build-arm:4.1`. Há também um perfil legado ZMK `v0.3.0`, usando `nice_nano_v2` e a imagem `:3.5`.

O template público contém um layout básico; o layout pessoal do autor não é carregado automaticamente. Use **Importar projeto** para abrir um projeto JSON ou um `.keymap` existente. A opção de layout do sistema muda a paleta de símbolos; bindings já colocados mantêm seus códigos.

## Importar e exportar keymaps

Selecione o teclado e a variante antes de importar um `.keymap`. O aplicativo usa a geometria e a ordem de bindings do plugin e carrega camadas, macros parametrizadas, combos, hold-taps genéricos, tap-dances, mod-morphs, sticky behaviors, encoders e input processors. Referências de camadas são convertidas para IDs estáveis, inclusive em parâmetros encaminhados por macros. Overrides parciais de `&mt`/`&lt` preservam os padrões nativos de cada behavior.

Defines de objetos e includes padrão são preservados antes dos headers gerados, incluindo ajustes de velocidade de mouse. Configurações Devicetree adicionais, propriedades de behaviors e subnós podem ser preservados e editados pelos campos avançados. Headers locais `.h` são carregados com suas dependências dentro da pasta da configuração e preservados no projeto. O importador ainda rejeita includes locais `.dtsi`, condicionais no próprio keymap e defines com parâmetros no próprio keymap; eles exigem expandir o arquivo antes da importação. Arquivos inválidos não substituem o projeto atual. O limite é 4 MB por arquivo.

O botão **.keymap** exporta a edição atual com o `.conf` correspondente, headers de idiomas e `build.yaml`. Ao exportar para uma pasta chamada `config/`, o `build.yaml` vai automaticamente para a pasta pai, na raiz do repositório. Em outras pastas, ele acompanha o keymap; nesse caso, coloque-o na raiz do zmk-config e os demais arquivos em `config/`. Para ABNT2, `keys_pt_abnt2.h` é incluído automaticamente. Arquivos auxiliares diferentes exigem confirmação antes de substituir. A importação também lê um `.conf` com o mesmo nome na pasta, consumindo as opções conhecidas e preservando as demais. Também lê o `build.yaml` da mesma pasta ou da pasta pai, associando snippets e argumentos CMake aos alvos da variante selecionada. Matrizes `include` explícitas são aceitas; expansões cartesianas e `exclude` exigem conversão prévia. O JSON continua incluindo a identificação de hardware. Encoders omitidos em uma camada herdam das camadas inferiores, conforme o ZMK.

## Espaço de edição

A barra lateral esquerda reúne Layout, Macros, Combos, Behaviors, Camadas condicionais e Configurações. A barra direita concentra importação/exportação, descarte, salvamento, compilação e prévia ZMK. Os botões usam ícones com tooltips e nomes acessíveis; mensagens de sucesso aparecem no rodapé.

As camadas aparecem em uma lista vertical à esquerda do teclado. Se faltar altura, a lista continua em novas colunas com rolagem horizontal e botões de navegação; a barra de rolagem fica separada das abas. O arraste e a navegação por teclado continuam disponíveis. Nome da camada e zoom ficam acima do layout.

As fontes Fira Sans e Fira Sans Condensed acompanham o aplicativo para manter a tipografia consistente sem downloads. Teclas usam rótulos menores, abreviações de behavior e até três linhas. Hold-taps mostram a ação de toque e a de segurar; tap-dances mostram as alternativas em linhas separadas. Os nomes e bindings originais continuam disponíveis nos tooltips e na edição.

A paleta inferior mostra todas as linhas do teclado nas resoluções desktop usuais. Arraste a divisória entre o layout e a paleta para ajustar o espaço de cada área. A divisória também aceita as setas para cima/baixo; Home ou duplo clique restauram a divisão automática. O botão da paleta permite recolhê-la; começar uma busca a expande automaticamente.

## Edição de recursos ZMK

- **Clique em uma tecla**, com nenhuma ação selecionada, para editar seu binding e seus argumentos. Os campos aceitam expressões como `LC(A)` e `RGB_COLOR_HSB(128,100,100)`; parâmetros de camada oferecem as camadas reais do projeto.
- Em **Comportamentos**, use **Adicionar tipo de comportamento** para mod-morph, sticky key, Caps Word, Key Repeat, ações de camada/mouse ou um behavior de módulo. Os controles separam a definição reutilizável dos parâmetros para novas atribuições. Personalizações dos behaviors base estão disponíveis no seletor **Comportamento base**.
- Em **Macros**, os passos incluem tocar, pressionar, soltar, esperar, ação no modo atual e controles ZMK. Controles de encaminhamento habilitam os parâmetros necessários; **Continuar quando soltar a macro** permite sequências que seguem a pressão/liberação física. A fila é dimensionada considerando composição, e o limite de 256 bindings é verificado depois da expansão dos passos.
- Em **Camadas condicionais**, escolha condições e destino. Em **Configurações**, ajuste encoders, iluminação, desligamento e cadeias de input processors. O listener de apontamento deve existir no hardware. Propriedades específicas da revisão, como layer locking, são habilitadas por metadados do perfil; o perfil legado não oferece locking.
- Os campos **Devicetree adicional**, **Defines antes dos headers** e **Kconfig adicional** preservam configurações de hardware e módulos fora dos formulários. O firmware ainda depende dos drivers e recursos realmente presentes na revisão ZMK e no teclado.

Em **Configurações → Flags de firmware**, adicione, altere ou remova flags Kconfig adicionais, como `CONFIG_ZMK_STUDIO=y`. Em **Compilação e conexão USB**, configure snippets e flags por alvo; os mesmos parâmetros são aplicados no build Docker e no `build.yaml` exportado. O preset **Habilitar Studio via USB** adiciona `studio-rpc-usb-uart`, `CONFIG_ZMK_STUDIO=y` e `CONFIG_ZMK_USB=y` ao alvo central declarado pelo plugin. A flag Studio anteriormente global é transferida para esse alvo. USB para digitação não exige o snippet do Studio. Atribua `&studio_unlock` a uma tecla para desbloqueá-lo. Configurações persistidas pelo Studio prevalecem sobre o keymap até usar “Restore Stock Settings”, conforme a [documentação oficial](https://zmk.dev/docs/features/studio).

Em **Headers e idiomas**, importe um `.h` existente ou crie e edite um header para outro layout. O include é adicionado ao keymap e os aliases de teclas ficam disponíveis para arrastar ou selecionar na aba **Idiomas**. Os headers, suas dependências e seus códigos simbólicos são preservados ao salvar, importar e exportar. O idioma do sistema operacional deve corresponder ao header. Headers devem ser compatíveis com ZMK, não headers exclusivos do QMK.

O projeto usa schema 2. Arquivos do schema 1 são migrados ao abrir/importar/salvar, mantendo o ajuste compartilhado de tap/hold que já utilizavam. Novos projetos começam com os padrões independentes do ZMK: mod-tap `hold-preferred` e layer-tap `tap-preferred`.

O provedor utiliza o contexto ativo do Docker CLI, incluindo `desktop-linux` do Docker Desktop, e transfere os arquivos via Docker API. As etapas west init/update/export/build correspondem às do [workflow oficial do ZMK](https://github.com/zmkfirmware/zmk/blob/main/.github/workflows/build-user-config.yml); revisão ZMK e imagem do container são fixadas pelo perfil de hardware.

A primeira compilação baixa a imagem e as dependências, podendo levar vários minutos. As próximas reutilizam imagem, dependências e um volume Docker de cache, com acesso exclusivo durante o build. Os alvos são reconfigurados com build pristine para evitar opções antigas após mudar flags ou snippets. Cada job usa um container temporário e um snapshot independente; os arquivos são transferidos por `docker cp`, inclusive com Docker Desktop, sem exigir montagem de pastas do host.

## Salvamento, firmware e flash

Os dados ficam em `os.UserConfigDir()/z-mapflow` (no Linux, normalmente `~/.config/z-mapflow`):

```text
project.json                  configuração salva
last-build.json               estado do último build
builds/<id>/project.json       snapshot compilado
builds/<id>/config/            fontes ZMK geradas
builds/<id>/build.log          log completo
builds/<id>/result.json        resultado e hashes dos artefatos
builds/<id>/artifacts/         firmwares por metade
```

O histórico mostra até 30 compilações recentes. Jobs e artefatos permanecem em disco; ainda não há limpeza automática. Os volumes Docker `zmapflow-*` guardam dependências e caches. Exportar o projeto permite transferir a configuração para outro computador; exportar firmware não exige nova compilação.

No flash, conecte uma metade por USB, pressione RESET duas vezes e indique qual metade está conectada. O aplicativo procura um volume com `INFO_UF2.TXT`, verifica a compatibilidade declarada pelo plugin e a integridade/família UF2, e copia o artefato correspondente. Repita para a outra metade quando necessário. A mensagem de envio concluído não confirma que o teclado reiniciou ou que o layout funciona no hardware.

A entrada automática em bootloader, compilação por GitHub Actions e distribuição validada para macOS/Windows ficam para próximas etapas. A descoberta de volumes já tem caminhos próprios para os três sistemas; o pacote desktop e o flash físico ainda precisam ser validados em cada plataforma. Esta implementação foi compilada no Linux e teve o envio de arquivos testado em volumes simulados.

## Verificações

```sh
# Na raiz
# Os assets em frontend/dist precisam existir para o embed do aplicativo.
go test -race -tags webkit2_41 ./...
go vet -tags webkit2_41 ./...

# Frontend
cd frontend
npm test
npm run build
npm run format:check
```

Teste opcional que baixa dependências e compila os dois firmwares reais:

```sh
ZMAPFLOW_DOCKER_TEST=1 go test ./internal/firmware -run TestDockerIntegration -v -timeout 45m
```

Para testar o perfil legado, adicione `ZMAPFLOW_DOCKER_VARIANT=nice_nano_v2_legacy`. O teste usa configuração própria, com macros, combo e behaviors, e não faz flash.

Leia [AGENT.md](AGENT.md) para contexto e regras do produto e [docs/plugins.md](docs/plugins.md) para implementar outro teclado.

## Comunidade e documentação

A documentação usa VitePress e Markdown em `docs/`, com busca local e publicação pelo workflow Pages. Para pré-visualizar: `npm ci --prefix docs` e `npm run dev --prefix docs`.

O CI valida Go, frontend, pacote/instalador e documentação. Tags `vMAJOR.MINOR.PATCH` disparam build, checksums e publicação da release completa. Dependabot acompanha Go, npm e Actions. Leia [como publicar versões](docs/community/releases.md).

Para usar sua logo, substitua **`build/appicon.png`** por um PNG quadrado, preferencialmente 1024×1024. Veja [logo e ícones](docs/community/branding.md).

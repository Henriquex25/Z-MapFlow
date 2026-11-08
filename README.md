# Z-MapFlow

Editor desktop de keymaps ZMK inspirado no VIAL, com Go/Wails e React. O fluxo é **configurar visualmente → salvar e compilar → conectar em bootloader → enviar o firmware**.

A primeira integração é o **Sofle v2**, com 58 teclas e dois cliques de encoder. O core recebe a geometria, os índices ZMK e os alvos de compilação pelo contrato do plugin.

## O que funciona

- Arrastar ações da paleta para o teclado e encoders; trocar ações entre teclas.
- Adicionar, renomear, limpar, restaurar e reordenar camadas com referências estáveis.
- Criar macros por sequência, combos por seleção no desenho, hold-taps e tap-dances.
- Configurar tapping term, quick tap, flavor e parâmetros posicionais de home-row mods.
- Selecionar símbolos US ou ABNT2, OLED, ações de mouse, perfis Bluetooth e repouso.
- Persistir a configuração no computador e importar/exportar projetos JSON.
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
wails dev
```

Para gerar o executável desktop:

```sh
wails build
```

O executável fica em `build/bin/z-mapflow`. Essa compilação empacota o aplicativo; os firmwares ZMK são compilados pelo botão do editor.

Atalhos: `Ctrl+S` salva e `Ctrl+Shift+S` salva e compila (`Cmd` no macOS).

O teclado abre ajustado ao espaço disponível (100% da escala ajustada) e oferece controles de zoom de 80% a 160%. Cada tecla mostra seu behavior, como `&kp` ou `&lt`, no canto superior esquerdo. **Descartar** volta à última configuração salva ou, antes do primeiro salvamento, ao estado em que o projeto foi aberto.

## Criar e atribuir macros, behaviors e combos

1. Abra **Macros** ou **Behaviors** e crie o recurso. Clique numa ação da paleta e depois no campo que deseja preencher, ou arraste a ação até o campo.
2. Use **Atribuir ao teclado** no recurso criado. O aplicativo abre o layout com essa ação selecionada.
3. Escolha a camada e clique nas teclas ou nas zonas dos encoders que receberão a ação. A seleção permanece ativa para atribuir a mais de um destino; use **Cancelar seleção** ou `Esc` para encerrar.
4. Em **Combos**, crie um combo, selecione duas ou mais posições no desenho e preencha **Ação do combo** com uma tecla, macro ou behavior. As posições selecionadas passam a ativar essa ação; o mapeamento individual das teclas é preservado.
5. Use **Salvar** ou **Salvar e compilar** para persistir as configurações e suas atribuições.

Os recursos criados também aparecem na paleta **Recursos** e podem ser arrastados para o layout.

## Sofle e perfis de firmware

O perfil atual usa `nice_nano@2.0.0//zmk`, com `sofle_left` e `sofle_right`, conforme o [repositório de referência do autor](https://github.com/Henriquex25/zmk-config/blob/main/build.yaml). A revisão ZMK é fixada em `4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85`, com a imagem `zmkfirmware/zmk-build-arm:4.1`. Há também um perfil legado ZMK `v0.3.0`, usando `nice_nano_v2` e a imagem `:3.5`.

O template público contém um layout básico; o layout pessoal do autor não é carregado automaticamente. A importação disponível é do formato JSON do Z-MapFlow, sem conversão automática de `.keymap` existente. A opção de layout do sistema muda a paleta de símbolos; bindings já colocados mantêm seus códigos.

A primeira compilação baixa a imagem e as dependências, podendo levar vários minutos. As próximas reutilizam um volume Docker de cache, com acesso exclusivo durante o build. Cada job usa um container temporário e um snapshot independente; os arquivos são transferidos por `docker cp`, inclusive com Docker Desktop, sem exigir montagem de pastas do host.

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
go test -race ./...
go vet ./...

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

# Z-MapFlow — contexto, regras de negócio e orientação de desenvolvimento

Este documento orienta a evolução do projeto. Reúne os requisitos informados pelo autor, a arquitetura e o estado da implementação em 29/10/2026. As seções 1–4 registram contexto, regras e direção arquitetural; as seções 5–7 descrevem a implementação, seus limites e a validação. Não considerar uma funcionalidade implementada apenas porque aparece como requisito neste arquivo.

## Development workflow — 2026-11-17

The author adopted feature branches and pull requests. Before new feature/fix work, create or use a focused branch outside `main`; preserve existing edits and never overwrite unrelated work. Prepare a reviewable implementation and checks, then use a draft PR while hardware validation remains pending. Do not merge PRs or publish releases without an explicit instruction. The existing PR CI covers Linux, Windows and documentation; release drafts remain manual. Repository branch protection is recommended, not assumed enabled.

## 1. Contexto e objetivo

O autor começou com um Corne foostan v4.1 de 42 teclas, comprado pronto, com QMK e configuração pelo aplicativo VIAL. Depois montou um Sofle v2 com controladoras SuperMini nRF52840, bateria e Bluetooth, adotando ZMK.

Atualmente, a configuração pelo Keymap Editor exige escolher parâmetros em listas, salvar em um repositório, aguardar um GitHub Actions, baixar os artefatos, conectar cada metade em modo bootloader e copiar seu firmware manualmente. Como o autor altera o layout quase diariamente, esse ciclo gera trabalho repetitivo.

O ZMK Studio não atende ao fluxo desejado pelo autor: ele quer manter teclas, behaviors, macros e demais configurações em uma fonte persistente, sem depender de alterações feitas separadamente no teclado. A preocupação relatada é perder ou ter de reconciliar essas alterações ao recompilar. Isso é a motivação do produto; o comportamento exato do Studio e de sua persistência não foi verificado nesta análise.

O Z-MapFlow deve oferecer uma experiência próxima à do VIAL para teclados com ZMK: edição visual, predominantemente por arrastar e soltar, seguida de compilação e flash guiados pelo próprio aplicativo desktop.

Fluxo pretendido:

```text
Configurar o layout → Salvar e compilar → Iniciar flash
→ Conectar uma metade em bootloader → Aplicativo copiar o firmware correto
→ Repetir para a outra metade conforme necessário
```

O usuário também deve poder salvar configurações sem compilar, compilar uma configuração já salva e exportar o firmware para uso posterior ou em outro computador.

## 2. Escopo e princípios do produto

- Linux é a primeira plataforma. Estruturar o projeto para versões futuras de macOS e Windows.
- Wails com backend Go e frontend React/TypeScript é a base existente.
- Sofle v2 é o único teclado previsto para a primeira versão, usando inicialmente o hardware do autor.
- Novos teclados ZMK, como outros modelos split da comunidade, devem entrar por plugins contribuídos por PRs.
- O core concentra as funcionalidades comuns entre teclados e executa os contratos dos plugins. Cada plugin concentra as particularidades de seu teclado.
- A interação principal deve ser visual: selecionar ações em uma paleta e soltá-las nas posições físicas do teclado. Formulários complementam ações com parâmetros, sem transformar a edição inteira em seleção por dropdowns.
- O layout físico representa o hardware. Remapear uma tecla altera seu binding; não altera implicitamente a posição física ou a ordem de bindings exigida pelo firmware.
- O objetivo inclui teclas, camadas, behaviors, combos, macros e configurações suportadas pelo dispositivo. Um catálogo inicial de presets não equivale a suporte completo a esses recursos.
- Não exigir acesso manual ao GitHub ou cópia manual de arquivos no fluxo principal da compilação local.
- Priorizar poucos passos e feedback claro. Recuperar erros sem obrigar o usuário a refazer a configuração ou uma compilação já concluída.

## 3. Regras de negócio

### 3.1 Edição, persistência e ações principais

Separar três conceitos: configuração em edição, última configuração salva e configuração usada por uma compilação específica.

| Ação | Comportamento esperado |
| --- | --- |
| Salvar | Persistir a configuração atual localmente, sem compilar nem alterar o teclado. |
| Compilar | Compilar a última configuração salva, sem incorporar silenciosamente alterações ainda não salvas. |
| Salvar e compilar | Persistir a configuração atual e iniciar a compilação dessa mesma revisão. |

- O salvamento deve sobreviver ao fechamento e à reabertura do aplicativo e incluir todas as abas configuradas, além da identificação do plugin e da variante de hardware.
- Informar se há alterações não salvas. Se não existir uma configuração salva, orientar o usuário a salvar ou usar “Salvar e compilar”.
- Se o salvamento falhar, “Salvar e compilar” não deve prosseguir como se tivesse salvo.
- Descartar alterações deve restaurar a última configuração salva integralmente. Esse recurso é diferente de um histórico de desfazer/refazer.
- Antes do primeiro salvamento, descartar restaura a configuração que foi aberta, inclusive em projetos importados. Distinguir “Ainda não salvo” de edições realmente pendentes; habilitar “Descartar” assim que houver alterações em relação a essa referência.
- Editar após salvar não pode modificar o snapshot salvo por referências compartilhadas.
- A configuração persistida no aplicativo deve ser a fonte para gerar o firmware, incluindo macros e behaviors. O fluxo principal não depende do ZMK Studio.

### 3.2 Compilação

- A primeira implementação deve usar um container Docker temporário, orquestrado pelo backend Go.
- O usuário não deve precisar executar comandos Docker ou montar manualmente o projeto ZMK.
- Validar configuração, plugin, variante e disponibilidade do ambiente antes de iniciar; apresentar erros acionáveis.
- Gerar os arquivos de configuração ZMK a partir de uma revisão salva e imutável. Associar logs e artefatos a essa revisão, ao plugin, ao hardware e aos alvos compilados.
- Mostrar etapas, andamento, conclusão e erros da compilação. A escolha entre uma tela bloqueante e execução em segundo plano permanece em aberto.
- Se a edição continuar durante o build, mudanças posteriores não podem alterar os arquivos daquela compilação. A interface deve distinguir o layout atual da revisão do firmware concluído.
- Remover o container temporário ao encerrar o trabalho, preservando os artefatos e os logs úteis.
- Evitar reconstruir o ambiente e baixar dependências a cada alteração quando um cache controlado puder reduzir o tempo. Container temporário não exige descartar todo o cache de compilação.
- Após sucesso, oferecer “Fazer flash” e exportação dos firmwares, identificados por metade/alvo. Compilar não inicia o flash automaticamente.
- Prever um provedor futuro de compilação por GitHub Actions, com o mesmo contrato de progresso e artefatos. Ele permitirá compilar sem Docker local, mas não integra a primeira implementação obrigatória.

### 3.3 Artefatos e flash

- Preservar o firmware compilado para uso posterior, independentemente de o usuário iniciar o flash naquele momento. A política de retenção e o local de armazenamento ainda precisam ser definidos.
- Oferecer exportação para uma pasta escolhida pelo usuário; em um aplicativo desktop, essa operação corresponde ao “baixar firmware” descrito no objetivo.
- Ao iniciar o flash, abrir um fluxo guiado com instruções para conectar uma metade em modo bootloader.
- Investigar entrada automática em bootloader somente quando houver suporte verificável no hardware e no firmware. Manter a entrada manual como caminho funcional.
- Tentar detectar volumes de bootloader montados no sistema operacional, usando informações de compatibilidade fornecidas pelo plugin/perfil de controladora.
- O usuário informa a metade conectada, pois detectar uma controladora não garante identificar se ela pertence ao lado esquerdo ou direito.
- Em caso de vários volumes candidatos, permitir escolher o destino. Se a detecção falhar, oferecer seleção manual do volume.
- Copiar o artefato compatível com a metade e a variante selecionadas, sem pedir ao usuário que descubra nomes internos de arquivos.
- Mostrar o resultado de cada etapa, lidar com desconexão/falha e permitir repetir a cópia sem recompilar.
- Não declarar firmware funcional no teclado apenas porque a cópia terminou. Distinguir envio concluído de confirmação do dispositivo quando esta estiver disponível.
- Orientar a conexão da outra metade e reutilizar a mesma compilação. Permitir encerrar e continuar depois ou apenas exportar os arquivos.
- A quantidade de alvos e quais metades precisam ser atualizadas vêm do plugin e do resultado do build. Validar as possibilidades de otimização no hardware real antes de omitir uma metade do fluxo.

## 4. Arquitetura pretendida: core e plugins

Esta seção define a direção arquitetural. O contrato mínimo v1 já está implementado; a seção 5 e `docs/plugins.md` descrevem sua cobertura atual.

### 4.1 Responsabilidades

| Área | Core | Plugin do teclado |
| --- | --- | --- |
| Editor | Componentes visuais reutilizáveis, drag and drop, estado e navegação. | Geometria física, posições, dimensões, rotações e representação dos recursos particulares. |
| Mapeamento | Aplicar bindings aos identificadores e validar referências. | Relacionar posições físicas, matriz/transform e ordem de bindings ZMK. |
| Configuração | Modelo compartilhado de camadas, behaviors, combos, macros e persistência. | Layout padrão, capacidades, restrições e configurações específicas. |
| Geração ZMK | Serialização dos recursos compartilhados e composição dos arquivos. | Dados/templates de hardware, shields, overlays, dependências e ajustes particulares. |
| Build | Orquestrar provedores, executar Docker, emitir progresso e armazenar resultados. | Declarar variantes, alvos e artefatos esperados. |
| Flash | Descobrir volumes por plataforma, conduzir a interface e copiar arquivos. | Declarar perfis compatíveis, formato de firmware e instruções de bootloader. |

O core não deve conter condições como “se o teclado é Sofle”, índices de encoder próprios do Sofle ou nomes fixos de shields. Ele consulta os dados e capacidades do plugin. A infraestrutura de sistema operacional pertence ao core; detalhes do teclado pertencem ao plugin, com perfis de controladora reutilizáveis quando fizer sentido.

O Sofle v2 deve ser tratado como o primeiro consumidor do contrato compartilhado. A organização inicial pode usar plugins incluídos no próprio build e registrados em um catálogo; carregamento dinâmico de binários ou uma loja de plugins não é requisito.

### 4.2 Contrato mínimo proposto

Definir e versionar um contrato que contemple:

1. **Identidade e compatibilidade:** ID estável, nome, versão do plugin, versão do contrato e variantes suportadas.
2. **Hardware:** modelo/revisão do teclado, controladoras compatíveis e configuração de cada metade. Não presumir que “Sofle v2” determina sozinho a board da SuperMini nRF52840.
3. **Geometria e mapeamento:** IDs físicos estáveis, coordenadas visuais, dimensões, ordem real de bindings, encoders e associação de seus cliques às teclas físicas.
4. **Capacidades:** recursos disponíveis e restrições de configuração, permitindo ao core apresentar apenas opções aplicáveis.
5. **Configuração inicial:** camadas e bindings padrão, com estrutura válida para a variante escolhida.
6. **Entradas de compilação:** revisão ZMK e dependências compatíveis, boards/shields por alvo, arquivos de hardware e configurações adicionais necessárias.
7. **Saídas e flash:** associação entre alvo/metade e artefato, extensão/formato, dados para reconhecer bootloaders e instruções ao usuário.
8. **Validação:** consistência de geometria, índices, referências, recursos e compatibilidade com o formato persistido.

Centralizar esses dados para que frontend e backend não mantenham versões independentes do mapeamento físico. Componentes React específicos podem ser extensões do plugin, caso necessários, consumindo o mesmo contrato.

Usar identificadores estáveis para camadas e ações referenciadas. A ordem visual das camadas pode mudar; os índices necessários ao ZMK devem ser resolvidos na geração. Reordenar ou excluir camadas precisa preservar referências válidas em layer-taps, combos, macros e outros behaviors, ou apontar os conflitos ao usuário.

Persistência, contrato de plugins e artefatos precisam de versões identificáveis para permitir detectar incompatibilidades e migrar configurações sem perder trabalho.

### 4.3 Evolução multiplataforma

- Separar descoberta de volumes, diretórios de dados/cache, acesso a arquivos e integrações de bootloader em serviços com implementações por plataforma.
- Usar APIs de caminhos do Go e diretórios apropriados ao sistema. Não espalhar caminhos como `/media`, `/run/media`, `/Volumes` ou letras de unidade pelo editor ou pelos plugins.
- Executar a cópia no backend; o frontend usa a ponte Wails e exibe resultados.
- Manter o contrato do provedor de compilação independente da plataforma e da interface gráfica.
- Wails já é a base do aplicativo e há arquivos de empacotamento para macOS/Windows no repositório. Isso não comprova funcionamento do build, da descoberta de volumes ou do flash nesses sistemas; validar cada plataforma quando entrar no escopo.

## 5. Estado implementado após a primeira evolução

Atualização de 29/10/2026. A análise inicial identificou salvamento em memória, snapshots compartilhados, referências numéricas frágeis e acoplamento do editor ao Sofle. Esses pontos foram substituídos pela implementação abaixo. As regras das seções anteriores continuam orientando o produto; o contrato descrito na seção 4 já possui uma primeira implementação.

### Estrutura

```text
app.go                         composição dos plugins e API Wails
main.go                        janela, assets e ciclo de vida desktop
internal/models/keyboard.go    projeto versionado e contrato de plugins
internal/devices/              registro e plugins incluídos no aplicativo
internal/project/              persistência e validação do projeto
internal/storage/              gravação JSON atômica e caminhos
internal/firmware/             geração ZMK, provedores, jobs e validação UF2
internal/flash/                descoberta de volumes e envio de arquivos
frontend/src/services/api.ts   adaptador da ponte Wails
frontend/src/store/            edição imutável e referências estáveis
frontend/src/components/       renderizador genérico, paleta e editores
frontend/src/types/            tipos derivados dos modelos Go gerados
frontend/wailsjs/              bindings gerados pelo Wails
docs/plugins.md                especificação do contrato e contribuição
```

### Funcionalidades existentes

- Projeto JSON com versão de schema, plugin, versão do plugin, variante, revisão de conteúdo, data e todas as configurações editáveis.
- Salvamento local atômico, carregamento na abertura e importação/exportação de projetos JSON e keymaps ZMK. O importador `.keymap` usa o plugin/variante selecionado e converte camadas, referências estáveis, macros, combos, hold-taps, tap-dances, encoders e overrides `&mt`/`&lt`; rejeita conteúdo fora do modelo sem alterar o editor. Exportação `.keymap` usa a edição atual e acompanha o header ABNT2 quando necessário. Arquivos incompatíveis ou corrompidos geram erro; o aplicativo não os substitui silenciosamente.
- Snapshots separados de edição e salvamento. Descartar restaura a configuração salva e uma camada ativa válida. Alterações feitas durante um salvamento permanecem no editor.
- Geometria e mapeamento fornecidos pelo backend via descriptor; o frontend não importa um componente Sofle. A composição em `app.go` é o local de registro dos plugins.
- O teclado abre com ajuste automático à largura e à altura disponíveis, em escala relativa de 100%, com zoom manual entre 80% e 160%. A paleta usa menos altura para priorizar o teclado; as teclas exibem seu behavior no canto superior esquerdo.
- Camadas com IDs estáveis, nomes editáveis, ordenação por drag and drop e referências resolvidas na geração. A exclusão de camadas ou recursos em uso é bloqueada.
- Paleta visual, busca, drop em teclas/encoders, troca de bindings entre teclas e construtor tap/hold com as camadas realmente existentes.
- As abas secundárias usam ações compactas, com legendas e ícones próprios para mouse, rolagem, camadas, Bluetooth e sistema. Tooltips preservam a descrição completa e o binding ZMK; a troca de abas reinicia a rolagem para manter os controles visíveis. O construtor tap/hold usa controles compactos, fixos no topo durante a rolagem.
- Macros com passos de tocar, pressionar, soltar e esperar; reordenação dos passos; combos por seleção de posições e restrição por camada.
- Criação e atribuição conectadas: cada macro e behavior oferece “Atribuir ao teclado”, que abre o layout com a ação selecionada. A paleta, os campos e as teclas aceitam atribuição por clique além do drag and drop; encerrar com Esc ou “Cancelar seleção”.
- A seleção de ações é transitória e não integra o projeto salvo. Escolher as posições de um combo ou hold-trigger preserva os bindings individuais. O combo recebe a ação em seu próprio campo e pode executar uma macro ou behavior.
- Hold-taps e tap-dances personalizados. Hold-taps incluem flavor, tapping term, quick tap, inatividade anterior e seleção de posições de hold-trigger.
- Configurações de layout US/ABNT2, OLED, ações de mouse, perfis Bluetooth e repouso. As ações já mapeadas mantêm seus códigos ao mudar o idioma da paleta.
- Geração determinística de keymap, Kconfig e manifest west, incluindo recursos específicos e módulos declarados pelo plugin. Prévia na interface.
- Salvar, Compilar e Salvar e compilar com semânticas distintas. Compilação em segundo plano a partir do snapshot salvo.
- Provedor Docker com container temporário, cache persistente, transferência via Docker API, logs, cancelamento e artefatos por alvo. A interface Provider permite evolução para GitHub Actions.
- Histórico de até 30 jobs na interface, preservação de fontes/logs/UF2 em disco e exportação de artefatos sem recompilar.
- Verificação de hash e estrutura/família UF2 antes do envio. Flash guiado que solicita a metade, detecta volumes e oferece seleção manual e repetição de envio.
- Descoberta de volumes com caminhos por sistema operacional. Linux usa mountinfo; macOS, volumes montados; Windows, unidades pelo PowerShell.

### Sofle e dados confirmados

O layout inicial passou a usar 60 bindings (58 teclas e dois cliques de encoder), conforme o matrix transform oficial; cliques são os índices 42 e 43. A ordem entre as metades foi corrigida e centralizada no plugin.

O autor forneceu https://github.com/Henriquex25/zmk-config. Seu `build.yaml` confirma `nice_nano@2.0.0//zmk`, `sofle_left` e `sofle_right`. O repositório também usa ABNT2, OLED, pointing e home-row mods posicionais. O aplicativo oferece esses parâmetros, mas não copia o layout pessoal para o template público.

O perfil atual fixa ZMK em `4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85` e imagem `zmkfirmware/zmk-build-arm:4.1`; o perfil legado usa `v0.3.0`, `nice_nano_v2` e imagem `:3.5`. O header ABNT2 é distribuído com sua licença original e foi obtido do repositório do autor.

### Evolução de compatibilidade ZMK — 09/11/2026

- Schema 2 com migração imutável de v1, revisão de conteúdo recalculada e manutenção dos padrões históricos de projetos antigos. Novos projetos usam configurações independentes de `&mt` e `&lt`.
- Correções de herança de overrides, preservação de defines/includes, espera exata de macros, validação de bindings expandidos e dimensionamento da fila incluindo macros compostas.
- Behaviors genéricos com parâmetros por uso, mod-morphs, sticky keys, Caps Word/Key Repeat personalizados, opções avançadas de hold-tap, combos com inatividade anterior e camadas condicionais com referências estáveis.
- Input processors por listener/camada, configurações de encoders e recursos de iluminação/soft off. Campos avançados preservam DTS, subnós e Kconfig de módulos.
- `Variant.features` declara suporte opcional específico da revisão (`layer-locking` no perfil atual; ausente no legado). Essa extensão é opcional e mantém o contrato de plugins v1.
- A API de importação recebe plugin/variante ativos. Exportação de keymap inclui Kconfig e header localizado, com confirmação de conflitos dos arquivos auxiliares.
- A auditoria anterior está em `docs/zmk-audit.md`; ela registra o estado anterior às correções. Novos testes verificam migração, composição, parâmetros, temporização gerada, reimportações e edição pela interface. A suíte Go com race detector, os 33 testes do frontend, go vet, formatação e o build desktop passaram nesta evolução. O executável foi atualizado em `build/bin/z-mapflow`. Na evolução inicial, a integração encontrou Docker inacessível; na continuação de 09/11, o Docker ficou acessível e a importação real do keymap do autor foi compilada nos dois alvos com Studio USB no central e herança de encoders. Os firmwares compilaram; não houve flash nem validação física.

## 6. Limites e próximas melhorias

- A importação aceita JSON, keymaps, o `.conf` de mesmo nome, headers locais `.h` com dependências e a matriz `include` explícita do `build.yaml` próximo. Defines de objetos, includes padrão e extensões Devicetree são preservados. Includes locais `.dtsi`, condicionais e defines com parâmetros no próprio keymap ainda requerem expansão prévia; repositórios completos não são importados. O JSON preserva a identidade de hardware; a exportação `.keymap` acompanha `.conf` e headers necessários.
- O layout padrão continua básico; não é uma migração automática das nove camadas do autor.
- A entrada em bootloader é manual. Envio de comandos de bootloader depende de suporte específico ainda não implementado.
- GitHub Actions é um provedor futuro; a implementação funcional usa Docker.
- O transporte atual é UF2 por volume. Outros formatos/protocolos precisam de adaptadores no core.
- O editor cobre macros parametrizadas, controles de pressão/liberação, hold-taps genéricos, tap-dances, mod-morphs, sticky behaviors, camadas condicionais, input processors e propriedades nativas. As opções dependem do suporte real do hardware e da revisão do perfil. Extensões sem formulário dedicado podem ser editadas nos campos ZMK avançados.
- O fluxo principal não depende do ZMK Studio. Ainda não há sincronização com configurações gravadas por ele.
- Builds e caches permanecem em disco; ainda não existe política de limpeza automática nem interface de gerenciamento de espaço.
- O core possui persistência de um projeto ativo e importação/exportação. Uma biblioteca de múltiplos projetos/perfis ainda não foi implementada.
- As implementações de descoberta para macOS/Windows existem, mas empacotamento e execução nesses sistemas ainda precisam de validação nativa.
- O flash físico, a pinagem da montagem e o funcionamento final do layout dependem de validação no teclado do autor. Cópia bem-sucedida não comprova o funcionamento do firmware no hardware.

## 7. Verificação e instruções para contribuições

Há testes Go de persistência, rejeição de dados inválidos, referências, geração, ciclo de vida dos jobs, integridade UF2, cópia em volume simulado e outro teclado usando o mesmo core. O frontend possui testes do store, dos três botões, da recuperação de carregamento e da escolha/repetição do envio por metade.

A integração Docker possui teste opt-in que compila os dois alvos reais, com macros, combo e behaviors. Foram concluídas compilações reais dos perfis atual e legado. O aplicativo desktop também foi compilado no Linux e a interface foi inspecionada em navegador com ponte simulada; isso não substitui um ensaio físico.

Comandos na raiz, com os assets do frontend disponíveis:

```sh
go test -race ./...
go vet ./...
wails generate module
wails dev
wails build
```

Comandos em `frontend/`:

```sh
npm test
npm run build
npm run format:check
```

Para a integração real (requer Docker e rede; não faz flash):

```sh
ZMAPFLOW_DOCKER_TEST=1 go test ./internal/firmware -run TestDockerIntegration -v -timeout 45m
```

O `README.md` documenta execução, armazenamento e limites. `docs/plugins.md` especifica o contrato v1, incluindo arquivos adicionais, módulos west, variantes e bindings próprios.

Ao alterar o código:

- Manter o core livre de índices, geometria, shields e condições específicas de um teclado; registrar implementações no ponto de composição.
- Atualizar modelos Go e regenerar `frontend/wailsjs`; os tipos TypeScript derivam desses modelos. Não editar bindings gerados manualmente.
- Preservar snapshots imutáveis, revisão de conteúdo e identidade do artefato. Novas edições não alteram jobs em andamento.
- Usar IDs estáveis ao referenciar camadas e recursos; resolver números somente ao gerar ZMK.
- Incrementar versões e definir migrações ao alterar contratos ou mapeamentos persistidos. Não reinterpretar layouts antigos silenciosamente.
- Executar os testes pertinentes à alteração. Testes de flash devem usar volumes simulados; ensaios no teclado real devem ser explícitos.
- Distinguir validade estrutural da configuração, compilação bem-sucedida, envio concluído e funcionamento confirmado no hardware.
- Atualizar este documento e as limitações públicas quando novas funcionalidades forem implementadas.

### Continuação: configuração e importação real — 09/11/2026

- Corrigida a exigência de quantidade exata de encoders por camada. Omissões preservam herança e continuam editáveis; encoder herdado antes de um configurado é gerado como sensor transparente.
- Importação real e ciclo exportar/reimportar validados com nove camadas, quatro macros, dezesseis behaviors e header ABNT2 do repositório local do autor. O conteúdo pessoal não foi incorporado ao template público.
- Flags Kconfig adicionais editáveis, snippets e argumentos CMake por alvo, importação/exportação de `build.yaml` e aplicação equivalente pelo Docker. Metadado opcional `Target.role` identifica central/periférico no plugin; preset Studio USB atua no central, mantendo o bloqueio de segurança.
- Headers `.h` locais são incluídos no projeto e nos arquivos gerados, com dependências confinadas à pasta da configuração. Interface permite importar/criar/editar headers; aliases entram na aba Idiomas da paleta.
- Teste opt-in da configuração pessoal: `ZMAPFLOW_KEYMAP_TEST=/caminho/config/sofle.keymap go test ./internal/keymap -run TestImportExternalProject -v`. Integração com Studio USB: `ZMAPFLOW_DOCKER_TEST=1 ZMAPFLOW_DOCKER_KEYMAP=/caminho/config/sofle.keymap go test ./internal/firmware -run '^TestDockerIntegration$' -v -timeout 45m`.

- Verificação final desta continuação: 43 testes do frontend, build TypeScript/Vite e formatação passaram; `go test -race ./...`, `go vet ./...`, importação real e integração Docker das duas metades também passaram.

### Correção de renderização e uso do espaço — 09/11/2026

- Reproduzida no navegador a tela vazia após importar o retorno real do keymap do autor: o behavior `&caps_word` chegava com `bindings: null`, e `behaviorAction` percorria esse valor. A leitura de bindings vazios agora retorna array Go inicializado, e o frontend normaliza listas nulas ao receber sessões novas e projetos anteriores.
- A normalização ocorre antes de substituir o estado. Uma importação sem camadas válidas gera erro e mantém a edição anterior. Um boundary de renderização fornece mensagem, exportação da edição atual e reabertura do editor em caso de outra falha de exibição.
- Abas de recursos foram movidas para uma barra lateral compacta. Cabeçalho e rodapé menores; camadas/nome/zoom na mesma linha; mensagens de sucesso no rodapé. Paleta com todas as linhas visíveis em 1366×768 e 1440×900, com divisória ajustável por mouse/teclado e restauração automática.
- A interface foi inspecionada no Chrome usando o JSON real retornado pela importação, incluindo a forma anterior com listas nulas. Foram percorridas as nove camadas, todas as abas de recursos e da paleta, e testado o arraste da divisória sem exceções JavaScript. Esse ensaio usa uma ponte simulada com payload real, além dos testes Go/React.

- Validação nativa adicional: o executável Wails/WebKit foi aberto em um display Xvfb com diretório de configuração temporário. A importação do `.keymap` real pelo seletor GTK concluiu e exibiu as nove camadas e a paleta, sem tela vazia. O perfil e os arquivos pessoais não foram alterados. Os 46 testes frontend, build TypeScript/Vite, formatação, Go com race detector e go vet passaram; o executável desktop foi recompilado.

### Tipografia, camadas e ações laterais — 09/11/2026

- Fira Sans regular/medium e Fira Sans Condensed medium foram incorporadas como assets locais com a licença SIL OFL original. Teclas usam fonte condensada, etiquetas menores e rótulos de behavior compactos; o layout não depende das fontes instaladas no sistema.
- Apresentação de bindings separada em `keyPresentation.ts`: hold-taps mostram seus parâmetros efetivos de toque/hold; tap-dances e mod-morphs mostram alternativas; aliases longos de ZMK/ABNT2 são reconhecidos na apresentação. Nomes, IDs, bindings e fonte persistida permanecem preservados. Há testes de parâmetros encaminhados a filhos sem argumentos, modificadores compostos e referências estáveis.
- `LayerSidebar` organiza camadas verticalmente e cria colunas com rolagem horizontal quando falta altura. A rolagem tem espaço reservado; botões permitem avançar/voltar. Seleção acompanha a camada ativa, e reordenação usa estratégia de retângulos para permitir movimento entre linhas/colunas.
- Ações de importar/exportar, descartar, salvar, compilar e salvar/compilar foram movidas para a sidebar direita com ícones, tooltips e os mesmos estados de habilitação. O nome da camada e zoom continuam acessíveis acima do teclado.
- Inspeção no Chrome com o retorno real da importação em 1366×768, 1440×900 e 1920×1080, além de 32 camadas: sem exceções, sem sobreposição da barra nas abas, seleção da última camada visível e arraste real para reordenar funcionando.
- Docker Desktop foi verificado pelo contexto CLI ativo `desktop-linux`. O workflow local do autor delega a `zmkfirmware/zmk/.github/workflows/build-user-config.yml@main`; a sequência west init/update/export/build foi conferida no workflow oficial. A integração do aplicativo com keymap importado e Studio USB compilou os dois UF2 em 88 s, usando a revisão/imagem fixadas pelo perfil. Não houve alteração do repositório pessoal nem flash.

- Validação final desta etapa: 54 testes frontend, TypeScript/Vite, formatação, `go test -race ./...` e `go vet ./...` passaram. A interface Wails/WebKit foi aberta com configuração temporária; o `.keymap` real foi importado pelo seletor GTK e a navegação foi conferida também com um projeto de 32 camadas. As fontes e sidebars renderizaram corretamente em 1366×768. Licenças de fontes anteriores foram preservadas, e a OFL da Fira é distribuída em `public/licenses/Fira-OFL.txt` para acompanhar o executável.

### Validação durante a edição — 09/11/2026

- Catálogo versionado em `internal/zmkdata` extraído dos headers oficiais ZMK, compartilhado por Go e TypeScript. Casos de aceitação/rejeição comuns verificam nomes, quantidade e tipos de parâmetros, funções, códigos de tecla, camadas, perfis Bluetooth e comandos com argumentos dependentes.
- Campos de ações e propriedades gerenciadas mantêm rascunhos locais, sinalizam erros e só atualizam o projeto com valores válidos. Rascunhos inválidos bloqueiam salvar/salvar e compilar, inclusive por atalho. Cancelar a edição descarta o rascunho. Backend repete a validação ao salvar/gerar.
- Cliques, arrastes, trocas entre teclas, encoders e composição validam antes de aplicar. Ações base de hold-tap/sticky aceitam zero ou um parâmetro; ciclos e quantidades incompatíveis são rejeitados. Bindings inválidos já presentes recebem indicação vermelha.
- Formulário da tecla com grid e largura maior, código avançado em textarea expansível. Interface traduzida para Comportamentos, tipos explicados e controles agrupados no cabeçalho dos cards. Digitar uma busca expande a paleta recolhida.
- Extensões de módulos e propriedades nativas sem esquema dedicado continuam dependendo da compilação para validar regras específicas da revisão/hardware. O catálogo possui atualização manual explícita e não faz downloads durante o uso.
- Validação: 106 testes frontend, TypeScript/Vite, formatação, `go test -race ./...`, `go vet ./...`, importação/exportação real (9 camadas, 4 macros, 16 comportamentos), inspeção no Chrome e importação nativa Wails/WebKit. O teste Docker com keymap real e Studio USB gerou os dois firmwares. Executável recompilado; não houve flash nem alteração do repositório pessoal.

### Comunidade, distribuição e atualizações — 09/11/2026

- Licença MIT escolhida pelo autor. Guias de contribuição e segurança, template de PR, formulários de bugs/melhorias/teclados e Dependabot para Go, frontend, docs e Actions preparados em `.github/`.
- Documentação de usuário e mantenedor em Markdown/VitePress, com busca local e base `/Z-MapFlow/`. `docs/package.json` mantém VitePress estável e override de Vite corrigido, validado pelo build e npm audit. Workflows separam CI de PRs, publicação Pages da branch principal e geração manual de drafts Linux, com versão estável derivada do VERSION na raiz e publicação manual após revisão.
- A primeira distribuição é Linux x86_64, construída no Ubuntu 22.04 com WebKitGTK 4.1. Script gera pacote de instalação por usuário, binário de atualização e checksums. Instalador confere o pacote e a execução de `--version`, cria atalho no menu e preserva o diretório de configuração. Windows/macOS continuam sem pacotes oficiais.
- Atualizador consulta a última release pública estável de `Henriquex25/Z-MapFlow` ao iniciar, sem token, e permite adiar. Antes de instalar, salva projetos editados ou importados ainda não persistidos; rascunhos inválidos, builds e flash ativos impedem a operação.
- Download tem origem fixa, limite, tamanho, SHA-256 e digest GitHub quando disponível. ELF, arquitetura, versão e bibliotecas de runtime são conferidos antes de instalar. Backup completo `.previous`, substituição atômica e restauração em falhas imediatas. Novo processo aguarda o anterior encerrar. Falhas posteriores de funcionamento da GUI exigem restauração manual; não há promessa de detectar todo problema após inicialização.
- Toast de exportação de firmware aparece apenas após sucesso, com pasta de destino e fechamento automático/manual. Cancelamento não é reportado como sucesso.
- `build/appicon.png` é a fonte do ícone (PNG quadrado, 1024px recomendado). Linux incorpora esse arquivo na janela e no pacote; documentação explica os derivados de outras plataformas.
- Os arquivos locais não alteram visibilidade do repositório nem publicam versões. O mantenedor precisa disponibilizar releases públicas, habilitar Pages com GitHub Actions e enviar uma tag para a primeira publicação.

- Verificação desta etapa: 116 testes frontend; Go com race detector e vet; dois testes do pacote/instalador com perfil temporário; actionlint nos três workflows; build VitePress e audit sem vulnerabilidades. Toast/pop-up e falha de integridade inspecionados no Chrome, com salvamento antes da atualização; abertura Wails/WebKit e consulta pública real conferidas em Xvfb. Build Linux/WebKitGTK 4.1, testes do atualizador, pacote versionado e checksums também passaram num container Ubuntu 22.04. Os workflows não foram enviados/executados no GitHub e nenhuma release foi publicada.

### Interface language, documentation and version source — 2026-11-09

- English is the default application language. Brazilian Portuguese is an application preference under Settings → Application, persisted separately from the firmware project. Changing it must never rewrite bindings, OS layout, names, IDs or saved snapshots.
- Shared UI/native dialog translations live in `internal/i18n/pt-BR.json`. English strings are canonical keys; numeric placeholders preserve user data. React components subscribe with `useLocale()` and translate static labels at render time. Keep enum values and internal tab IDs independent of display language. Native file dialogs receive the current language before opening.
- Native/retained errors are localized at display time, preserving filenames and codes. Error-slot metadata identifies nested reasons. Unknown compiler output remains verbatim; broad text/DOM replacement is not used.
- `VERSION` is the single application version source. Go embeds it for the CLI, `GetAppInfo`, header badge and updater. `scripts/project_version.py` reads it for packaging/tag checks. `scripts/wails.py` supplies derived native package metadata during build/dev/generation and restores configuration afterwards. Do not add an app version to frontend manifests or override it with linker flags. Schema, plugin and dependency versions remain separate concepts.
- Official build commands, CI and release workflows use the Wails wrapper. Release tags must match VERSION; packaging verifies the executable reports the same version. The header badge obtains its value from Go and works without GitHub/network access.
- User documentation and README default to English, with GitHub Pages links. Portuguese documentation is retained under `/pt-BR/`. The plugin guide walks through collecting hardware data, geometry, defaults, controller variants/roles, files/modules, registration, testing and PR submission. Plugins remain compiled into the app; no dynamic installer is implied.
- Built-in Sofle metadata now uses English labels; geometry, indices, target IDs and firmware revisions are unchanged. Saved user content is preserved and legacy common labels are localized only for display. The user-provided `build/appicon.png` was preserved.

- Validation: 124 frontend tests pass, including live language changes, preference restoration, preserving user content/project snapshots, native dialog language ordering and backend-supplied version display. Go race tests/vet, four packaging/build-wrapper tests, VitePress build and actionlint pass. Chrome verified English/Portuguese controls and the nine-step plugin guide without JS exceptions. Native Wails/WebKit verified English startup, switching to Portuguese, a Portuguese import dialog and restoration after restarting an isolated profile. The executable reports the central version through `--version`; the supplied app logo remains unchanged.

### Shared application logo — 2026-11-10

- `build/appicon.png` is imported directly by the in-app header and favicon, embedded for the Linux window, and copied into release packages. The supplied PNG is preserved without artwork changes. Windows `build/windows/icon.ico` was regenerated using the same converter/sizes as Wails (16–256px).
- `internal/desktopassets.RefreshIcon` refreshes the application-owned launcher image when the running executable matches the standard per-user Linux installation. It skips unrelated/custom executable paths and version-only probes. A binary update therefore updates the launcher image at the next GUI startup.
- Verified the header in native Wails/WebKit and a stale installed launcher image replaced byte-for-byte with the source PNG in an isolated profile. Frontend production build, 29 App tests, Go tests, four packaging tests and documentation build passed.

### Visual flash guide and final write confirmation — 2026-11-10

- The release scope remains Linux x86_64 only, as explicitly requested by the author. Wails supporting other desktop platforms does not mean this application has validated packages, installers or updates for them.
- README and English/Portuguese documentation lead with drag-and-drop editing, local builds and guided flashing in one app. The author-provided interface screenshot is shared from `docs/public/images/z-mapflow-layout.png`.
- The author reports a successful physical flash through the app on SuperMini nRF52840 despite a final `sync ...: input/output error`. This is user-reported hardware validation; automated checks continue to use simulated volumes.
- `flash.Copy` and the Wails `FlashFirmware` API return a structured result: `sent` after copy/sync/close succeed, or `unconfirmed` with the original technical error when a full copy succeeds but its final sync/close fails. Open, validation and interrupted-copy errors still reject the transfer. Never infer a successful reboot from a disappearing volume or retry automatically.
- `FlashModal` presents three illustrated steps with larger controls, controller-specific bootloader instructions and a selected target/volume. An unconfirmed transfer stays amber and cannot mark the target complete until the user explicitly confirms keyboard operation. User confirmation is labelled separately from a completed file transfer; reconnect/retry remains available. Detected volumes that disappear lose their selection, while manual choices are revalidated by the backend before copying.
- English/Portuguese copy explains the restart ambiguity in the modal, README, firmware guides and troubleshooting. UI checks covered both languages, confirmation/retry, multiple/manual volumes and blocked controls during a transfer. The frontend's 130 tests, Go race tests/vet, production frontend and documentation builds passed; browser checks found no horizontal overflow at 1366, 900 and 480px.
- The local desktop executable was rebuilt using the installed WebKitGTK 4.0 development libraries. The host lacks WebKitGTK 4.1/libsoup 3 development packages; official release builds continue to target WebKitGTK 4.1 in CI. No physical flash was performed during this change.

### Manual Linux release drafts and root VERSION — 2026-11-10

- The root `VERSION` is the only application version source, moved from the former internal package location at the author's request to match Tinkercraft's workflow. `main.go` embeds it and initializes `internal/version` before CLI, Wails API or updater use. Build/package scripts and native metadata read the same root file.
- CI still runs on pushes to `main` and PRs. The release workflow is named **Build Linux release draft**, triggered only by `workflow_dispatch` on `main`. Its preflight checks completed successful push CI for the exact commit/repository before building. All jobs check out that commit, even if main advances later.
- Linux packaging retains the updater executable, installation archive and SHA-256 checksums. The final job creates a complete draft with generated notes and a tag derived from VERSION; it never publishes or sets Latest automatically. Maintainers review and publish manually as Latest. Drafts/prereleases remain invisible to the existing updater.
- Retries can refresh assets only for an existing draft at the same commit, preserving its edited title/notes. Published releases and drafts at another commit are rejected. Downloaded build assets are checked before any draft modification. No tag push is needed to start a release.
- Maintainer docs, README, contribution instructions and the PR template describe the new version path and manual flow. These local changes do not trigger GitHub Actions or publish a release.
- Validation: Go race tests (including embedded root version → app info) and vet, 12 Python release/version/installer tests, actionlint on all workflows, desktop Linux build and VitePress build passed. The actual rebuilt executable reported the root version, and a temporary real package produced all three assets with matching checksums. No GitHub release operation was performed; the release CI runner's WebKitGTK 4.1 build remains an external check after pushing the changes.

### Flash wizard — 2026-11-11

- `FlashModal` now shows one step at a time: choose the target, connect/select its bootloader volume, review/send, then inspect the result. A numbered progress bar and previous/next actions keep the current stage clear. Focus follows the stage heading, and advancing requires the relevant target or volume selection.
- The connection scanner runs only during connection/review and pauses while a native dialog or transfer is active. Losing a detected volume during review returns to connection. Retrying preserves the selected target but clears the volume; starting the next target requires a fresh target selection. Completed target indicators remain visible across the session.
- Sending is explicit on the review screen and locks navigation until completion. Success, final-write uncertainty and interrupted copies remain separate result states. The send step uses warning/error icons rather than a completion check for unconfirmed/failed transfers. User confirmation never triggers another write, and the flow offers the next target or Finish once all targets were sent/confirmed.
- English/Brazilian Portuguese translations and both firmware guides describe the wizard. Validation: all 132 frontend tests passed; after the final layout adjustment, all 11 flash/build-panel tests, formatting and Go translation-placeholder checks passed again. Browser checks covered all stages, warnings/confirmation/retry, both languages, 1366/900/480px widths, visible navigation and no horizontal overflow. Desktop Linux and documentation builds passed. Transfers were simulated; no physical device was flashed during this change.

### Missing release runtime diagnostic — 2026-11-15

- The author downloaded release 0.1.0 on Pop!_OS 22.04 and passed the package checksums, but its executable could not load `libwebkit2gtk-4.1.so.0`. The host has WebKitGTK 4.0; official release binaries link to 4.1. The runtime package `libwebkit2gtk-4.1-0` is available in the host's configured repositories. Installing that system package and rerunning the downloaded installer resolves this missing dependency without rebuilding a release.
- `scripts/install.sh` now captures a failed version probe, preserves its original loader error and prints the runtime installation command for missing GTK/WebKitGTK 4.1/JavaScriptCore/libsoup libraries. Other failures retain a generic compatibility diagnostic. All failure paths stop before modifying an existing application or creating a first installation. The installer does not install system packages automatically.
- README and English/Portuguese installation guides put the one-time runtime setup before installation and explain this exact loader error. Thirteen release/script tests and the docs build passed. The real downloaded executable reproduced the failure in an isolated temporary copy with the revised installer, which printed the fix and created no user installation files. Neither the downloaded package nor system dependencies were modified.
- The author subsequently confirmed that installing the runtime resolved installation. Dedicated installation-problems sections now show the exact error, explain the difference between checksum success and runtime readiness, and provide the commands to install the dependency and retry. General troubleshooting links to these sections in both languages.
- Installer output labels three stages: package verification, desktop runtime dependencies and per-user installation. A failed dependency probe never prints installation success. README and both installation guides also highlight Docker Engine/Desktop as required, running and accessible for firmware compilation; layout editing, saving and keymap import/export remain available without it.
- Release drafts use only the version tag as their title (for example `v0.1.0`), as requested by the author. The application name remains part of asset filenames and the app's branding.
- The published `v0.1.0` release title was also changed to `v0.1.0` through the GitHub API; tag, notes, publication state and assets were verified unchanged. Eight release-workflow tests and the documentation build passed for the new default title.

### Responsive action palette and keyboard languages — 2026-11-15

- The Keys palette distributes its three clusters and keys across the available width while retaining per-key minimum widths and relative proportions. Narrow windows scroll within the palette; hardware geometry and keymap indices are unchanged. Numpad Enter has a wider minimum to keep its label readable.
- A shared keyboard-language selector is available in the palette and firmware settings. US/ANSI and Brazilian ABNT2 are included; other languages use imported ZMK headers. Selecting a language reveals its aliases in Languages, clears a previous palette selection/search and expands the palette. The UI language and host operating-system layout remain separate.
- Languages offers **Find languages** (opens the ZMK Locale Generator release page in the system browser) and **Add language (.h)** (uses the existing native header importer). Settings and palette share conflict checks and source registration. Only the active header and its local dependencies are listed, with cycle handling. No language header is downloaded automatically.
- The canonical bundled ABNT2 header is shared from `internal/firmware/keys_pt_abnt2.h` with the frontend through a raw import; Vite allows that source directory for development/tests while preserving filesystem restrictions. Header annotations such as `/* ñ */` and simple aliases can supply display glyphs, cached per header set. Unannotated codes retain their names; no arbitrary Unicode is inferred from HID positions. The actual binding remains symbolic.
- Language changes register and retain the previous and new header/includes so existing assignments stay usable, including legacy ABNT2 projects that relied on implicit generated headers. Saved snapshots remain immutable. Imported headers remain editable under Settings.
- Validation: 142 frontend tests, formatting, translation-placeholder checks, desktop Linux build and documentation build passed. Browser checks verified full available width/minimum sizes at 1920/1440/1366/1024, a real pointer drag of cedilla onto a key, Spanish header import/search by ñ, retained assignments/sources after language changes and Portuguese controls. Tests used an isolated mock session; no personal project or physical keyboard was modified.

### Flash wizard documentation image — 2026-11-15

- `docs/public/images/z-mapflow-flash-wizard.png` captures the actual React flash dialog at step 3 in English, using example left-half/NICENANO/UF2 data. It was captured at 2× resolution after fonts loaded, without image generation or artwork edits. No firmware transfer was attempted.
- README highlights the saved-layout → local Docker build → guided per-target flash flow beside the screenshot. English and Brazilian Portuguese firmware guides reuse the same image with localized captions and alternative text. The copy describes the workflow without unverified performance comparisons.

### Optional community support — 2026-11-15

- Header buttons **Star on GitHub** and **Buy me a coffee** remain visible, with labels and icons, in English and Brazilian Portuguese. They open only the official repository and `https://www.buymeacoffee.com/henriquemiranda` in the system browser. No GitHub authentication, automatic stars or in-app payment processing is involved. README, both getting-started guides and `.github/FUNDING.yml` include support links.
- `internal/community` persists schema-1 preferences in `community.json` under the app data directory, separately from keyboard projects. Native startup counts one launch; status queries, language switches and webview reloads do not. Active foreground use is checkpointed by minute, capped at 120 minutes and limited by the native clock; hidden, unfocused and idle time is excluded by the frontend. No counters or responses are sent to a server.
- Star invitation eligibility requires at least five launches and 30 active minutes. Donation eligibility requires ten launches, 120 active minutes, the star invitation already answered, and at least three additional launches since that answer. The frontend also waits the first minute of its session, shows at most one invitation kind after any response, and suppresses invitations during builds, drags, native file dialogs, flash, updates and other modals. The invitation is non-modal and does not move keyboard focus.
- Both positive and negative responses, the close button and the matching manual header action permanently dismiss that invitation locally. Atomic, dedicated writes prevent project or language saves from resetting responses. Failed response persistence is reported and never presented as a successful dismissal; manual links remain usable. Corrupt support preferences are preserved and disable invitations without blocking editing. Late status responses cannot bring back a dismissed invitation.
- Update status uses a header slot to avoid overlapping support actions, while retaining a floating fallback if the project cannot load. Wails bindings were regenerated from Go.
- Validation: frontend behavior/translation/API tests, Go race tests and vet, frontend formatting, VitePress build and native Linux/WebKitGTK 4.0 build passed. Browser checks covered English/Portuguese, eligible star/donation prompts, permanent header actions, simulated dismissal/reload and widths from 880 to 1920px without header overlap or JS exceptions. Two native launches with an isolated profile preserved responses and counters and wrote no keyboard project. Browser opening was simulated; no stars, donations or physical firmware operations were performed.

### Windows x64 initial support — 2026-11-16

- The author explicitly requested starting Windows support, superseding the earlier Linux-only distribution scope. Target Windows 10/11 x64 first; macOS and Windows ARM64 packages remain future work. Local cross-compilation is not native GUI, Docker Desktop or physical keyboard validation. Public documentation marks Windows builds as initial testing and notes that older releases may contain Linux assets only.
- Wails produces `z-mapflow.exe` with the embedded WebView2 bootstrapper and a per-user NSIS installer under `%LOCALAPPDATA%\Programs\Z-MapFlow`. The installer includes license notices and Start/desktop shortcuts, refuses installation/removal while the app's Windows mutex exists, and uninstalls only owned files while retaining configuration. Binaries are unsigned. `platform_windows.go` provides a stable `%APPDATA%\z-mapflow\webview2` data path across executable names/updates and a Windows single-instance lock. Root VERSION still supplies app/CLI/native metadata; no version was bumped for this work.
- `internal/hostcmd` hides console windows and resolves the standard machine/user Docker Desktop CLI locations if the GUI inherited a stale PATH. Firmware preflight requires a Linux-container daemon. Windows UF2 discovery now uses Win32 logical-drive APIs, limits probing to local fixed/removable drives and preserves manual drive selection. Core keymap geometry and firmware semantics are unchanged.
- Windows auto-update selects `z-mapflow_windows_amd64.exe`, verifies size, SHA-256/GitHub digest, PE architecture and CLI version. A copy of the current executable becomes a helper; the parent quits only after readiness. The helper validates its confined plan, opens a native handle to the exact parent executable, waits for exit, rechecks the staged file and replaces/restarts with `.previous` backup/rollback. Pre-handoff errors stay in the UI; post-exit failures receive a native message. Immediate failures are recoverable, but later GUI failures are not automatically detected. Old helper files are cleaned on later startups; no elevation or external updater service is used. Linux retains its atomic replacement flow.
- CI adds a Windows runner with native Go tests, a real locked-parent/helper/restart test, drive discovery and Docker lookup tests, app/NSIS build, payload/version/install/uninstall smoke checks and a downloadable temporary test artifact. The smoke test requires a clean account and uses a temporary installation directory; it does not open the app GUI or touch a keyboard.
- The release action is now **Build release draft**, still only `workflow_dispatch` on main, gated by successful push CI for that exact commit. Linux/Windows package jobs upload separate artifacts. All inputs are checked before merging four assets plus one combined `checksums.txt`; only then can the same draft-only publishing script run. Both-platform packaging must succeed; publishing remains manual. Existing Linux asset names and latest-release update behavior are preserved.
- Local validation: Go race tests/vet, Windows cross-build/vet and compiled Windows test binaries, 158 frontend tests, frontend formatting, 16 Python packaging/draft tests, actionlint, VitePress and actual Windows x64 executable/NSIS installer generation passed. The installer is a normal x86 NSIS launcher carrying the x64 app. Native Windows CI, GUI/installation execution, actual auto-update and Docker/UF2 hardware validation have not run in this Linux session. No GitHub workflow was triggered, no release published and no physical firmware flashed.

### Collapsed behaviors and sleep in minutes — 2026-11-16

- Each behavior starts collapsed, with its name/type, preview, assignment and delete controls visible. An accessible arrow button expands that card independently. Disclosure state is UI-only and does not dirty the project. Collapsed bodies are unmounted to avoid mounting every binding editor; collapsing an invalid draft is blocked and focuses its field rather than silently discarding validation. Applied changes remain in the project when a card is reopened.
- Settings → Bluetooth and power displays sleep timeout in minutes, including fractions. Existing JSON/imported configuration and generated ZMK retain `sleepTimeoutMs` / `CONFIG_ZMK_IDLE_SLEEP_TIMEOUT` in milliseconds, preserving imported precision and the one-second to 24-hour limits. `project.SleepTimeoutMilliseconds` performs finite/range checks and rounds to the nearest millisecond in Go; an exported Wails method supplies the conversion to the field. The app API bindings were regenerated; no project schema or VERSION change was needed.
- Async conversion keeps a `pending:sleep-timeout` validation marker in the store, so switching tabs does not enable saving before the validated edit completes. Import/discard cancels the marker, and older responses cannot overwrite a newer value/project. Discard removes pending async markers while leaving ordinary field draft validation under its component's ownership. Backend errors preserve the last valid project value.
- English and Portuguese getting-started/configuration guides describe disclosure controls and minute units. Tests cover collapsed header actions, independent expansion, retained edits/snapshots, invalid drafts, minute conversion/limits/imported precision, response ordering, tab changes and discard/import cancellation. Go generation tests confirm 2.5 minutes produces `CONFIG_ZMK_IDLE_SLEEP_TIMEOUT=150000`.
- Validation: relevant frontend suites, Go race tests/vet, TypeScript/Vite and VitePress builds passed. Browser checks with ten example behaviors confirmed collapsed rows of 70px at 1024–1920px, wrapping at 880px without document overflow. The actual Go conversion was exercised through a temporary local test bridge: editing 1.5 minutes saved 90000ms, including Portuguese display. Test harnesses were removed; no personal project, firmware build, physical keyboard or GitHub release was modified.

### Lily58 and both Silakka54 hardware families — 2026-11-16

- The author requested Lily58 and Silakka54 plugins and explicitly selected both wireless nRF52840 and original wired RP2040 Zero Silakka54 hardware. Startup registers Sofle first (preserving the default), then `lily58`, `silakka54_wireless` and `silakka54_wired`. No saved Sofle indices, schema or VERSION were changed. Shared controller profiles pin the new devices to ZMK `4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85`, build image 4.1.
- Lily58 follows upstream's 58-binding transform and physical-layout coordinates, including the two inner switches and rotated 1.5u thumbs. Its optional left EC11 uses upstream pins 21/20 and a rotation-only control. Do not guess a matrix click index; an installed encoder button remains a regular switch at its actual wiring position. The optional SSD1306 128×32 display uses the upstream shield; disable Display without matching hardware.
- Common wireless Silakka54 configurations reuse Lily58 wiring/shields and retain 58 slots, with no physical switch at 42/43/53/54. Optional `Position.hidden` preserves these slots while drawing/selecting only 54 switches. Defaults use `&none`; imports preserve even existing bindings in hidden slots. Filenames remain `lily58.keymap`/`.conf`; the profile disables the upstream encoder/sensor nodes. Drawing stagger and angled thumbs come from the original Silakka54 KiCad switch centres, mirrored across the halves.
- Original Silakka54 firmware uses RP2040 Zero, COL2ROW GP2–6 rows / GP7–12 columns, full-duplex UART GP0 TX / GP1 RX. The plugin embeds an independently written ZMK shield, 54-position transform and physical layout with fixed USB central left / peripheral right, UART interrupt mode and RP2040 UF2 family. This is an **experimental ZMK port**, replacing QMK/VIAL on both halves; it does not add QMK/VIAL import/build support. BOOT+USB opens RPI-RP2. Physical hardware validation is pending; labels, Settings, flash instructions and documentation explicitly say so. Disconnect both halves from power before connecting/disconnecting the split cable.
- Additive contract-v1 fields support `Position.hidden`, standalone sensor positions at index -1, sensor click index -1 with empty click code, and `Plugin.disableSleep` for controllers lacking Zephyr poweroff. Registry validation still requires exactly one real position per binding index; standalone sensor controls are extra and excluded from physical-position pickers. Import, binding validation, rendering and layer add/clear respect rotation-only sensors. Existing plugins keep prior sleep defaults. Wired RP2040 defaults to sleep off and omits unsupported idle timeout; the UI hides unsupported power/BT settings. Core/frontend reject `&bt` without the Bluetooth capability; the palette hides that category and excludes BT/output actions from search on USB-only profiles.
- Import additionally preserves trailing `reserved`/`disabled` Studio layer nodes as native DTS, without treating them as incomplete editable layers. Interleaved inactive slots are explicitly rejected instead of silently shifting native indices. External `.dtsi` includes still require incorporating definitions before import. Real upstream stock Lily58 and a community Silakka54 keymap each imported three 58-binding layers successfully.
- English/Portuguese supported-keyboard pages document exact controllers, optional resources, wireless slot compatibility and wired constraints; README, guide navigation, getting-started and plugin authoring documentation link/explain these additions. Wails model bindings were regenerated.
- Validation: all six actual Docker targets compiled successfully (Lily58 left/right, wireless Silakka54 left/right, wired Silakka54 left/right) and the manager checked UF2 structure, controller family and artifact hashes. An additional wireless build with a preserved Studio reservation also passed for both halves. Existing dependency trees were read from a cache without copying user configuration; each new plugin has its own build cache. Go race tests/vet, 177 frontend tests, TypeScript/Vite, VitePress, Windows cross-build and the native Linux/WebKitGTK 4.0 build passed. A temporary browser harness using real Go descriptors verified 58/54/54 visible switches, two Lily58 rotation controls, no invalid defaults or page overflow at 1366px and hidden unsupported wired settings. Header checks at 880–1920px in both languages passed with translated hardware labels and a bounded selector exposing the full name in its tooltip. Harnesses were removed. No physical keyboard was flashed, personal project edited or release published.

### Sofle USB dongle central and PR workflow — 2026-11-17

- The author requested using a third Pro Micro/nice!nano-compatible nRF52840 as a USB central for the existing Sofle v2, and adopted branches/PRs instead of feature commits directly on main. Work uses `feat/sofle-central-dongle`; no main merge or release publication is authorized. Contributor guides now document this workflow. Existing CI already runs on PRs, with main push CI retained for release gating. Branch protection is recommended but was not changed remotely.
- New optional Sofle variant `nice_nano_v2_dongle` preserves plugin version, 60 binding indices, saved layouts and the existing default/legacy variants. It pins the same modern ZMK/toolchain, declares dongle central plus two BLE peripheral halves and a shared nice!nano settings-reset artifact. Receiver uses the pinned upstream Sofle transform/physical layout, mock scanning and two disabled sensor placeholders; it has no physical GPIO/OLED/encoder drivers. Each half enables only its own upstream encoder. USB power prevents receiver deep sleep through ZMK's native activity guard.
- Additive contract-v1 fields: `Variant.files` merges files for the active variant; optional `Variant.overlay` inherits when absent and replaces (including empty) when present. `Target.kind` distinguishes operational keyboards/dongles from settings-reset artifacts. `Target.config` supplies required Kconfig values, applied consistently to Docker commands and exported build.yaml. Identical user arguments are deduplicated; contradictory target flags are rejected in UI/backend. Safe paths/generated-name protection and header collision checks include variant files. The generator reserves BLE connections/pairings for the number of declared peripherals plus host profiles (seven for this profile's default five hosts). Inactive sleep omits its timeout to avoid assigning an unavailable Kconfig value.
- Settings shows a generic topology diagram and managed settings. Changing the profile keeps the editable layout, filters settings for removed targets, removes redundant old managed flags, and moves the Studio USB preset to the new central (including an imported global Studio flag with its snippet). Unrelated target arguments remain. Studio settings and flags for a peripheral are blocked by the new profile. Returning to the original profile moves the preset back to the left central.
- Flash offers Keyboard firmware and an explicit Reset pairing first mode. Both use three physical-device selections; reset mode sends the shared reset artifact while recording each actual device separately from firmware progress. Clearing bonds/settings (including Studio changes) is described before Send and never happens automatically. Uncertain final writes may be acknowledged as a controller restart, without claiming settings erasure or keyboard operation; acknowledgement never resends. Review shows the actual reset artifact. Ordinary keymap updates do not reset pairing; after initial setup, users can usually flash only the dongle for central keymap changes. Changing topology requires resetting/reflashing devices. No physical flash was performed by the agent.
- Standard ZMK does not relay central active-layer/host-output state to peripheral displays at the pinned revision. With the optional status synchronization below disabled (the default), the profile disables those two widgets on the halves, retaining local battery/peripheral status. A bare receiver has no display support.
- English/Portuguese setup, migration/reversion and plugin-contract guides, navigation and README describe exact controller/UF2 compatibility and experimental physical-validation status. The guide's screenshot uses actual React components with sample data and simulated transfers. Temporary browser harnesses were removed. Wails bindings were regenerated; VERSION remains unchanged.
- Validation: actual Docker builds produced all four UF2 artifacts, validated by the manager for structure, family and hashes. Read-only inspection confirmed one central/two peripherals, two peripheral slots, seven BLE connections/pairings, no receiver OLED and reset-on-start firmware. Go race tests/vet, Windows cross-build, 183 full frontend tests plus the added uncertain-reset regression, 16 packaging tests, formatting, VitePress and native Linux/WebKitGTK 4.0 build passed. A first parallel frontend run hit an existing App test's five-second timeout under load; all tests passed with two workers, and relevant suites passed independently. Browser checks at 880–1920px verified the topology, three-device wizard, distinct reset/normal artifact routing and Portuguese labels without JS exceptions; transfers were simulated. Physical switches/encoders, pairing/reconnection and OLED behavior still require the author's hardware test.


### Optional dongle state synchronization — 2026-11-17

- The author requested an on/off switch for forwarding central active-layer and host-connection information to the halves. The Sofle dongle variant now advertises `peripheral-status-sync`; Settings shows a checkbox, off by default. `options.peripheralStatusSync` is persisted without a schema/VERSION change, supports undo/discard and clears when switching to an unsupported profile. Frontend/backend reject unsupported use and contradictory raw/per-target overrides of the owned Kconfig flag. A false field omitted by Go serialization compares equal to explicit false.
- A self-contained MIT firmware module under `internal/zmkmodules/statussync` is embedded in the active variant and exported under `zmapflow-status/` with `zephyr/module.yml`. No extra west source or ZMK fork is required. Off builds compile no sender, receiver service or custom screen. On builds use the existing encrypted split BLE links; the dongle discovers a dedicated service on both peripheral links, excludes host-role BLE connections, retries busy discovery/writes, sends an initial snapshot on reconnect and changes plus a five-second heartbeat on a dedicated low-priority queue. The fixed 20-byte packet fits minimum ATT MTU, validates version/ranges/UTF-8 and carries layer index/name, selected profile and ZMK's actual selected USB/BLE output. No typing/WPM stream is added.
- The receiver pins its secured connection owner, keeps a spinlocked coherent snapshot and clears stale state on disconnect or after fifteen seconds. Unchanged heartbeats do not redraw the screen or generate key activity. With Display enabled, the custom 128×32 screen shows layer and output/profile plus local battery, or Waiting for dongle / No sync when unavailable. Names are bounded to fourteen UTF-8 bytes; actual font glyph support and visibility need hardware testing. Display disabled still compiles the relay without OLED code. The label option and enum match the pinned LVGL 9.3.
- Toggling requires rebuilding/flashing all three operational devices, rather than a live setting. Once their synchronization options match, ordinary central keymap edits can still normally update only the dongle. Pairing-reset firmware remains separate. Imported generated `.conf` retains the option and recalculates generated display flags; generated BLE pairing slots now subtract the selected profile's actual peripheral count instead of assuming one.
- English/Portuguese dongle and plugin guides plus README describe the optional relay, meanings, stale state, update requirements and physical-validation limit. Temporary browser harnesses were removed. The feature extends the existing draft PR #5 on `feat/sofle-central-dongle`; no main merge or release publication is authorized.
- Validation: actual Docker builds passed for all four UF2 targets in each of synchronization on/display on, synchronization off/display on, synchronization on/Studio USB/display on and synchronization on/display off. Host C tests compile and exercise the actual protocol/sender/receiver with simulated Bluetooth for malformed packets, encryption, busy retries, both halves, host exclusion, freshness, ownership and reconnect. Go race/vet, Windows cross-build, 187 frontend tests, TypeScript/Vite, native Linux/WebKitGTK 4.0 and VitePress builds passed. Browser checks verified saving on/off (including Go's omitted false field), English/Portuguese and 880–1920px without document overflow or JS exceptions. Transfers and radio links were simulated in those tests; no physical flash, OLED, wake/reconnect or radio validation has been performed, and no personal project was edited.


### Imported display flags with dongle synchronization — 2026-11-17

- Hardware testing by the author found a duplicate `zmk_display_status_screen` symbol when enabling synchronization on an existing project. Read-only inspection confirmed retained `ExtraConfig` flags selected the built-in screen after the generated custom-screen choice; the original Docker fixtures lacked this migration case. No personal settings were edited.
- While synchronization is enabled, generation normalizes the owned display/screen/standard-widget flags, removes stale assignment/unset duplicates from the emitted `.conf`, explicitly disables the built-in screen and follows the Display control. The saved ExtraConfig remains intact, including unrelated flags/comments and the original choices when synchronization is disabled. Per-target overrides conflicting with these screen settings are rejected in Go and the frontend, whose managed-settings view displays the effective peripheral requirements. The module additionally stops configuration with an actionable error if an external build selects an incompatible display screen.
- Regression tests cover legacy JSON-style flags, disabled Display, unset/whitespace syntax, unchanged source configuration, unrelated settings and typed per-target overrides. The optional Docker integration test can now load an explicitly supplied project JSON through `ZMAPFLOW_DOCKER_PROJECT`, always saving/building an isolated copy rather than changing the supplied file. The English/Portuguese dongle guides explain display-setting precedence.
- Validation: an actual Docker build of an isolated copy of the author's saved project (including its retained built-in display flags, bindings and target settings) successfully generated all four UF2 artifacts. Go race tests/vet, the twelve relevant frontend tests, native Linux/WebKitGTK 4.0 build and VitePress build passed. No personal project or device firmware was modified.


### Peripheral screen startup and blocked UF2 final writes — 2026-11-17

- The author successfully reset all three controllers and flashed the dongle, but the halves stalled with keyboard firmware in both the app and a manual file-manager copy. Read-only Linux inspection showed a full 608768-byte source/destination position while the app's thread waited in `__sync_dirty_buffer` during final fsync; kernel logs contained USB descriptor timeouts/reset attempts. This establishes a pending OS write, not successful controller programming or a proven single root cause. The connected nice!nano-compatible bootloader reported 0.6.0. No bootloader/system-service changes or physical writes were performed by the agent.
- A separate, concrete firmware defect was reproduced: the custom peripheral OLED screen inherited a 2048-byte LVGL heap rather than the built-in screen's larger defaults. The actual screen failed to finish initialization on ARM QEMU using the pinned Zephyr/LVGL, 128×32 monochrome display and production assertion settings. With 8192 bytes it initialized/rendered correctly. Module Kconfig now defaults the peripheral custom display heap to 8192; module CMake rejects explicitly smaller pools. Screen creation checks root/label allocation and rendering checks all three labels. The fix does not change the status protocol or require another pairing reset by itself. Confirmation of the author's USB/radio/OLED behavior remains pending.
- `internal/zmkmodules/statussync/testdata/display` preserves a standalone QEMU Cortex-M3 regression app with real Zephyr/LVGL/allocator and actual `screen.c`; only ZMK events, remote snapshot and battery are simulated. It renders waiting state, 100 changes and stale state. Its README documents running with the pinned workspace, expected marker and limits. It is separate from embedded production files.
- Flash emits scoped stage/byte events for checking the volume, opening, OS copy, final sync and close. The UI displays these phases and OS-accepted bytes, explicitly without claiming physical programming. Thirty seconds without progress shows recovery guidance; the call remains pending until the OS returns. It never fabricates timeout success, starts an automatic retry or leaves a background write intentionally untracked. A backend TryLock rejects overlapping flash/update operations instead of queueing another write. The latest transfer's phases/outcome are recorded atomically under the app's config directory at `flash/latest.json`. Another manual copy while an OS write is blocked can also remain pending; cancel queued copies, disconnect/re-enter bootloader and wait for the previous call to return before retrying.
- English/Portuguese UI and firmware/dongle guides explain pending writes, diagnostics, display memory and retry versus reset. The active feature branch/draft PR remain the delivery path; VERSION is unchanged. Physical flash is always the author's explicit action.
- Validation: ARM QEMU with the corrected module defaults printed `POOL=8192 DISPLAY_READY=1` and `SCREEN_OK` after 100 updates. Actual Docker builds of an isolated copy of the author's saved project produced all four UF2 artifacts; read-only final Kconfig checks confirmed 8192-byte heaps on both halves. Go race/vet, Windows cross-build, API binding generation, VitePress and native Linux/WebKitGTK 4.0 builds passed. Frontend tests verify a pending final sync is not marked successful or retried and unrelated transfer events are ignored; Go tests block Sync deliberately and verify stage/byte reporting plus rejection of concurrent native flash requests. A full frontend run found one outdated BuildPanel API mock; its progress-subscription stub was corrected and the affected suites rerun. No user configuration or connected controller was modified.
- Subsequent author control test: restoring the pre-dongle JSON, rebuilding and flashing worked normally, narrowing the failure to the dongle-profile firmware/configuration rather than the desktop UI alone. The corrected firmware still needs a new physical test. All sixteen affected UI tests passed after the mock fix. A temporary browser harness verified the new pending-sync state, byte count and stall warning in Portuguese at 600–1366px without overflow/JS exceptions; it was removed. The freshly rebuilt local app includes the corrections.

### Required pairing reset when changing the central — 2026-11-17

- The author requested mandatory guidance when switching between a keyboard-half central and a USB-dongle central, in both directions. Sofle current/legacy two-half profiles now also build a shared settings-reset artifact. They declare explicit, managed split-role flags; importing their generated build.yaml deduplicates identical managed flags while contradictory overrides remain invalid. Registry validation checks the opt-in `pairing-migration` contract, roles, reset-on-start, board and UF2 compatibility. Other plugins retain their existing flow.
- A native `TopologyStore` records physical-device IDs/roles and migration progress separately from saved/imported project JSON and build snapshots. The first tracked use asks which setup is actually installed, since a bootloader volume cannot reveal that. Later changes derive from recorded sends rather than editor selections, imports or history. State is per keyboard plugin; external flashing, replacing controllers or using another physical keyboard must be reported with the explicit UI action. The uncertain-setup choice conservatively requests a full reset.
- Flash has two outer phases: reset every affected device, then install keyboard firmware. Changing the central locks the final phase in both UI and native APIs until each device's reset transfer has returned and the user acknowledges its restart. Returning to two halves includes the retired dongle in cleanup only, followed by disconnection. Reset warns about stored Bluetooth/Studio settings; the saved project remains intact. Ordinary keymap updates preserve pairing and still allow updating only the central.
- Receipts are persisted before USB writes and their outcomes are set by the native copy operation. Pending/interrupted copies cannot be acknowledged as completed. Closing/reopening resumes a returned transfer's acknowledgement without resending; compatible rebuilds preserve reset acknowledgements, while final-firmware progress belongs to its build. Changing the target after partial programming, manual reset, external flashing and a reset used to recover uncertain firmware conservatively require cleanup again. The wizard freezes its build/plugin snapshot. A reboot acknowledgement during migration does not claim that the partly flashed keyboard operates or that physical settings erasure was verified.
- English/Portuguese firmware, dongle and plugin-author guides plus README describe the required phases, first-use question, recovery and limits. New screenshots show actual UI with the Go workflow and simulated transfers. Temporary browser/HTTP harnesses were removed; no personal project, physical controller or bootloader was changed. VERSION is unchanged. Work remains on `feat/sofle-central-dongle` and draft PR #5 pending author hardware testing; do not merge or publish a release.
- Validation: Go race tests/vet, Windows cross-build, all 197 frontend tests, generated Wails bindings, TypeScript/Vite, VitePress and native Linux/WebKitGTK 4.0 build passed. Actual Docker builds produced all three UF2 artifacts for both current and legacy two-half profiles with the managed role flags; existing dongle firmware remains four targets. Native API tests reject both legacy/new firmware-send entry points before cleanup, using temporary simulated volumes. Browser testing with the real Go store verified all three reset acknowledgements, reload without resend, both migration directions and the retired dongle's reset-only role; English/Portuguese checks at 600–1366px had no overflow or JavaScript exceptions. Radio, USB programming, physical reboot/erasure and full keyboard operation still need the author's hardware validation.

### Dongle hardware confirmation and status/flash presentation — 2026-11-17

- The author confirmed successful reset and keyboard-firmware flashing on the dongle and both halves. Both peripheral screens waited for the dongle, then connected when it was powered and the keyboard worked. This supersedes the earlier pending initial pairing/typing validation for that specific three-controller Sofle setup. Extended reconnection, sleep/wake and other hardware combinations remain unverified.
- The author reported the synchronized OLED's reversed background and small type. The custom screen had forced black/white and lost the built-in screen's implied monochrome theme/font defaults. It now inherits the native theme, display inversion and configurable fonts, defaulting to Montserrat 16 for output/battery and the native small Montserrat 12 for the layer. Output and battery are at the upper left/right, with keyboard symbol/layer below; long layer names scroll and unnamed layers show the index. USB/Bluetooth/profile/bond status uses native LVGL symbols, with local USB-power charging status kept separate from the dongle's actual output. The packet format, pairing and transport are unchanged; this display-only update needs rebuilding/flashing the halves, without another reset or dongle update if synchronization is already enabled.
- The synchronization checkbox now has a fixed 18px nonshrinking box and a scalable check glyph with keyboard focus styling. The flash modal uses available viewport height and a wider tracked-profile layout. Required reset stays visible and enforced; explanatory text moves into expandable setup details. Compact phase/step indicators leave the remaining height to the instruction/volume panel, with navigation retained below.
- English/Portuguese guides and README record the author's hardware result and updated screen behavior. Flash screenshots were refreshed from actual components with simulated workflow/build data; captions disclose that simulation. The temporary browser harness and QEMU container were removed. VERSION and binding schema are unchanged; work stays on the feature branch/draft PR #5.
- Validation: all four real Docker UF2 targets passed with synchronization/display enabled. ARM QEMU with the actual pinned Zephyr/LVGL and screen checks native/inverted theme colors, font identity, USB/connected/disconnected/unpaired symbols, battery, nonoverlapping 128×32 placement, 100 changes and stale state at the retained 8192-byte pool. Go race/vet, 21 affected frontend tests, formatting, TypeScript/native Linux and VitePress builds passed. Browser checks with the real Sofle instruction text at 600–1366px found no horizontal overflow or JavaScript exceptions, and the entire volume selector stayed visible without scrolling; at 1024×768 the instruction panel is 378px high. Checkbox geometry/glyph and EN/PT rendering were checked. No controller or personal configuration was modified by the agent. The updated physical OLED appearance awaits the author's test.

### Resource disclosures, visual combo outputs and mixed-board dongle — 2026-11-18

- At the author's request, combos, macros and conditional-layer rules now share the behavior card disclosure, initially closed with header actions available. Padding/header geometry is constant; CSS grid animates only the content and respects reduced motion. Valid content unmounts after closing; closing content is immediately inert and its draggable/drop targets disabled so clipped bounds cannot accept invisible drops. Invalid unfinished fields keep their card open and focus the actual input. The fixed 18px SVG checkbox is shared across the app. The palette's keyboard-language selector is shown only on Languages.
- BindingDrop offers grouped built-in, macro, behavior and plugin-action selectors, followed by schema-derived parameters. Key parameters have a full key selector plus the existing validated shortcut input. Zero-parameter actions show no key field. Context/recursion validation is retained, unavailable feature actions are disabled, and command defaults honor their arity. Choice values distinguish plugin presets sharing one behavior; duplicate codes are removed and customized built-in definitions retain their own defaults. Sensor-only rotation and USB-only keyboard Bluetooth output choices are excluded from this selector. Macro steps and behavior children use the same controls; advanced code and palette drag/drop remain available.
- The author explicitly dropped stock TRRS-wired Sofle support after clarification; no wired conversion or additional non-BLE MCU profile was added. USB to the computer remains supported. The current Sofle adds an experimental XIAO nRF52840 dongle with nice!nano v2/SuperMini halves. This is a different controller board, not a different UF2 MCU family. The pin-free dongle shield no longer declares a Pro Micro interconnect requirement. The current half-central profile includes nice!nano and XIAO reset images for the return path; current dongle profiles build five artifacts (three operational, two reset). Legacy ZMK 0.3 still builds its original three and does not substitute its reset for a retired XIAO; use the current profile for that return.
- Target.Controller optionally declares stable reset compatibility, with registry validation requiring one reset per controller board in tracked profiles. Workflow signatures include controller identity; pre-existing signatures and pending receipts upgrade without a gratuitous pairing reset. The native API and UI resolve resets by the actual selected device, including retired dongles, instead of taking the first reset artifact. Historical builds missing a needed reset require rebuilding. Unknown retired controllers require explicit identification, including a single supported candidate; identification does not acknowledge a write. Local workflow remains separate from JSON/import/history. Wails bindings were regenerated; project schema and VERSION are unchanged.
- Dongle settings expose native peripheral battery fetching, Bluetooth battery proxying and split BLE interval presets (7.5/15/30 ms, converted to 6/12/24 units). Target Kconfig settings persist with the project; enabling proxying enables fetching, and disabling fetching disables proxying. These options apply to the dongle, independently of the OLED relay. English/Portuguese guides describe the controls, XIAO limits and matching resets, return migration and USB/TRRS distinction. Official ZMK reset documentation confirms that a direct bootloader key acts on its source half and a combo acts on the central; the dongle guide now gives a visual combo setup tip and physical recovery guidance.
- Validation: the full 205-test frontend suite passed; affected selector/preset and flash edge cases were rerun after final adjustments. Go race/vet and Windows cross-build passed, as did TypeScript, formatting, native Linux/WebKitGTK 4.0 and VitePress. Real Docker builds generated five UF2s for XIAO dongle + nice!nano halves with status synchronization, battery fetching/proxy and a 15ms interval, and four UF2s for the current two-half return profile. Browser checks at 600–1366px verified animated intermediate heights, identical header rectangles before/after disclosure, no document/editor horizontal overflow, complete 18px checkboxes, full key choices, macro/custom/bootloader outputs, language-selector visibility, reduced motion and the retired-XIAO reset preview. Browser transfer methods were disabled/simulated; temporary harness source/JSON and Chrome/Vite processes were removed. No personal project or physical controller was modified. XIAO pairing/flash, updated OLED appearance and extended reconnection/sleep remain pending hardware tests. Work remains on the existing feature branch/draft PR #5; do not merge or publish without explicit instruction.

### Compatibility visible before download — 2026-11-18

- The author requested upfront keyboard/controller compatibility so users can assess their hardware before installing. README now places a six-setup matrix before screenshots and installation: ordinary Sofle, nice!nano/SuperMini dongle, XIAO dongle, Lily58 and both Silakka54 families. It names controller boards/MCUs, inter-part links and the difference between the author's physical test and compilation-only validation.
- English/Portuguese keyboard guides now include the same setup matrix plus a controller-board/MCU/role table. XIAO is explicitly dongle-only for Sofle; RP2040 Zero is wired-Silakka-only. Existing geometry/wiring details and switch counts remain. Generic MCU names do not imply compatible boards, QMK/VIAL editing or stock TRRS Sofle support. Readers are directed to the README for their release tag to distinguish available packages from newer source profiles, and to support requests/plugin contributions for unlisted hardware.
- Both documentation home pages link compatibility beside installation, and installation guides link it before download steps. Their Windows wording now reflects the already-passed native CI while retaining the pending physical-keyboard limitation. Keep these tables and validation labels in sync when adding keyboard/controller profiles.
- Validation: profile contents and physical/build-test claims were checked against the included Go descriptors and recorded hardware/build results. VitePress and git diff whitespace checks passed. Documentation only: no application, hardware, saved project or VERSION changes. Work stays in the existing feature branch/draft PR #5; Pages deployment follows the existing main-branch workflow after an authorized merge.

### Editor responsiveness, searchable choices and OLED orientation — 2026-11-18

- The author requested smoother resource disclosures/scrolling and searchable behavior/parameter lists, then added a per-half OLED orientation control for USB dongle setups. BehaviorCard now measures its content once per transition and animates the outer wrapper with the Web Animations API for 180 ms, keeping the form out of flow during animation. Reversals capture the current height, finished closed content unmounts, headers retain their geometry, hidden content remains inert, and invalid drafts still block closing. Reduced motion and missing animation support use immediate transitions.
- SearchableSelect provides editable search, accent-insensitive name/code/group matching, keyboard navigation, explicit selection, disabled reasons, cancellation and viewport-bound portal menus. Only a small visible window of options is rendered. Behavior pickers, parameter lists, macro controls and the add-behavior picker use it; validated shortcut entry remains available. Large key catalogs load only when their selector opens and share formatted labels across fields for each immutable project/locale. Queries never become bindings on their own.
- Build polling retains the previous React snapshot when all fields, capped logs and artifact metadata are unchanged. Project validation/dirty checks and draggable validation are memoized; resource editors and the palette use narrower subscriptions and stable props. A simulated 16-behavior project no longer committed editor renders for unrelated draft-error pulses. Headless frame timings varied with the host load and do not establish a reliable FPS improvement on the author's display; do not claim a measured native GPU/frame-rate result.
- Linux no longer hardcodes software-only WebKit rendering. IMPORTANT: pinned Wails v2.15.0 has different Go/C enum ordering; public Go Always (numeric 1) selects native ON_DEMAND in window.c. The helper deliberately uses 1; revisit this mapping when upgrading Wails. ZMAPFLOW_DISABLE_GPU=1 keeps the software recovery path. Running build/bin directly uses the same desktop renderer. English/Portuguese troubleshooting documents the fallback and diagnostic limits.
- Sofle dongle variants advertise oled-rotate-180. Settings expose independent, initially off left/right checkboxes, editable with Display enabled. Target snippets preserve orientation through saved projects and build.yaml import/export without adding a project schema/API field or conditional directives to the shared keymap. The plugin-owned snippet deletes both segment-remap and com-invdir for the selected SSD1306 target, reversing hardware scan direction without changing theme/inversion, fonts or the horizontal screen layout. Validation rejects the snippet on unsupported/non-peripheral targets; changing to an unsupported profile removes it. Both stock and synchronized displays compile with it. No 90°/270° portrait renderer was added. Orientation alone does not change topology identity or require pairing reset; rebuild and flash the selected half. README and both language guides describe the controls and limits.
- Validation: full frontend suite passed (213 tests), with 13 affected selector/card tests rerun after the final controlled-input fallback. Go race tests, vet, Windows cross-build, formatting, TypeScript/native Linux build and VitePress passed. Two real Docker builds produced all five artifacts with right rotation, once with status synchronization on and once off. Read-only compiled-device-tree inspection confirmed both scan flags absent on the right, present on the left, and inversion unchanged. Browser checks covered full-list search/commit, menus at 600–1366 px, stable headers, translations and no JS exceptions; native WebKitGTK smoke checks covered disclosure and behavior search. Xvfb used software graphics, so this is functional validation rather than physical GPU/OLED validation. Temporary UI fixtures, baseline worktree and their browser/Vite processes were removed. No personal project or physical controller was modified. VERSION, project schema and Wails API remain unchanged. Keep the existing feature branch and draft PR #5; no merge or release is authorized.

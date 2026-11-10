# Z-MapFlow — contexto, regras de negócio e orientação de desenvolvimento

Este documento orienta a evolução do projeto. Reúne os requisitos informados pelo autor, a arquitetura e o estado da implementação em 29/10/2026. As seções 1–4 registram contexto, regras e direção arquitetural; as seções 5–7 descrevem a implementação, seus limites e a validação. Não considerar uma funcionalidade implementada apenas porque aparece como requisito neste arquivo.

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
- Documentação de usuário e mantenedor em Markdown/VitePress, com busca local e base `/Z-MapFlow/`. `docs/package.json` mantém VitePress estável e override de Vite corrigido, validado pelo build e npm audit. Workflows separam CI de PRs, publicação Pages da branch principal e releases por tags estáveis `vMAJOR.MINOR.PATCH`.
- A primeira distribuição é Linux x86_64, construída no Ubuntu 22.04 com WebKitGTK 4.1. Script gera pacote de instalação por usuário, binário de atualização e checksums. Instalador confere o pacote e a execução de `--version`, cria atalho no menu e preserva o diretório de configuração. Windows/macOS continuam sem pacotes oficiais.
- Atualizador consulta a última release pública estável de `Henriquex25/Z-MapFlow` ao iniciar, sem token, e permite adiar. Antes de instalar, salva projetos editados ou importados ainda não persistidos; rascunhos inválidos, builds e flash ativos impedem a operação.
- Download tem origem fixa, limite, tamanho, SHA-256 e digest GitHub quando disponível. ELF, arquitetura, versão e bibliotecas de runtime são conferidos antes de instalar. Backup completo `.previous`, substituição atômica e restauração em falhas imediatas. Novo processo aguarda o anterior encerrar. Falhas posteriores de funcionamento da GUI exigem restauração manual; não há promessa de detectar todo problema após inicialização.
- Toast de exportação de firmware aparece apenas após sucesso, com pasta de destino e fechamento automático/manual. Cancelamento não é reportado como sucesso.
- `build/appicon.png` é a fonte do ícone (PNG quadrado, 1024px recomendado). Linux incorpora esse arquivo na janela e no pacote; documentação explica os derivados de outras plataformas.
- Os arquivos locais não alteram visibilidade do repositório nem publicam versões. O mantenedor precisa disponibilizar releases públicas, habilitar Pages com GitHub Actions e enviar uma tag para a primeira publicação.

- Verificação desta etapa: 116 testes frontend; Go com race detector e vet; dois testes do pacote/instalador com perfil temporário; actionlint nos três workflows; build VitePress e audit sem vulnerabilidades. Toast/pop-up e falha de integridade inspecionados no Chrome, com salvamento antes da atualização; abertura Wails/WebKit e consulta pública real conferidas em Xvfb. Build Linux/WebKitGTK 4.1, testes do atualizador, pacote versionado e checksums também passaram num container Ubuntu 22.04. Os workflows não foram enviados/executados no GitHub e nenhuma release foi publicada.

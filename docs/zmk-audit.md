# Auditoria de compatibilidade com ZMK e Keymap Editor

**Estado histórico:** os achados abaixo descrevem o código antes da evolução de 09/11/2026. As correções e a cobertura atual estão no README e no AGENT.md. Foram implementadas correções de geração/importação, schema 2, composição de behaviors, macros parametrizadas, camadas condicionais, input processors e edição dos argumentos por tecla. A compilação física continua dependente da validação descrita nesses documentos.

Data: 08/11/2026. Escopo: comparação da implementação atual, incluindo o importador `.keymap` ainda não commitado, com documentação oficial. Auditoria estática; não houve alteração de firmware, teste físico ou correção funcional nesta etapa.

O Keymap Editor considerado é o de Nick Coutsos. Sua wiki descreve funcionalidades do editor, enquanto a documentação do ZMK define a semântica do firmware. Algumas páginas da wiki foram atualizadas em 2023; elas não constituem uma garantia de suporte completo ao ZMK atual. O projeto fixa dois perfis: `v0.3.0` e `4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85`. Recursos da documentação atual precisam ser habilitados de acordo com a revisão do perfil, especialmente os mais recentes.

## Diferenças que podem alterar o resultado

### 1. P1 — Mod-tap e layer-tap recebem os mesmos padrões

`internal/models/keyboard.go:14` possui um único conjunto de tapping term, quick tap e flavor. `internal/project/service.go:29` inicia flavor como `hold-preferred`. `internal/firmware/generate.go:138` escreve esse conjunto tanto em `&mt` quanto em `&lt`.

No ZMK, `&mt` usa `hold-preferred`, mas `&lt` usa `tap-preferred`. Aplicar o primeiro a ambos faz uma interrupção por outra tecla poder ativar uma camada quando o padrão nativo manteria a decisão de tap até o tempo limite. É uma configuração válida de ZMK, mas uma mudança implícita de comportamento.

Correção proposta: configurações independentes por behavior; preservar padrões nativos quando o usuário não os sobrescrever. Isso também exige migrar projetos antigos sem mudar silenciosamente sua configuração existente. Os padrões diferentes já existem no perfil legado: [mod-tap v0.3.0](https://github.com/zmkfirmware/zmk/blob/v0.3.0/app/dts/behaviors/mod_tap.dtsi) e [layer-tap v0.3.0](https://github.com/zmkfirmware/zmk/blob/v0.3.0/app/dts/behaviors/layer_tap.dtsi).

### 2. P1 — Importação de overrides não preserva a herança de layer-tap

Exemplo: um arquivo contém apenas `&lt { tapping-term-ms = <250>; };`, sem definir flavor. No ZMK ele mantém o flavor de seu behavior base. Em `internal/keymap/import.go:387`, `readBehavior` inicia qualquer override com `hold-preferred`; a conversão em behavior próprio materializa esse valor. O mesmo problema aparece ao tratar overrides parciais iguais de `&mt`/`&lt` como uma única configuração global.

Correção proposta: aplicar overrides sobre a definição efetiva de cada behavior da revisão usada, distinguindo propriedade ausente de valor informado. A sintaxe oficial mostra overrides parciais e padrões distintos em [Hold-Tap](https://zmk.dev/docs/keymaps/behaviors/hold-tap).

### 3. P1 — Defines que configuram headers podem desaparecer sem erro

O ZMK documenta a alteração de velocidade por um define anterior ao include:

```c
#define ZMK_POINTING_DEFAULT_MOVE_VAL 1500
#include <dt-bindings/zmk/pointing.h>
```

No importador, `internal/keymap/parser.go:171` aceita esse define e ignora o conteúdo do header. Uma ação como `&mmv MOVE_UP` permanece simbólica, mas o define não é persistido. A geração em `internal/firmware/generate.go:30` inclui novamente o header sem o ajuste. Por análise desse caminho, o resultado volta ao padrão do header, embora a importação tenha sido aceita.

Correção proposta: preservar defines/includes relevantes e sua ordem ou resolver seus efeitos com o ambiente correto. Até isso existir, rejeitar explicitamente configurações que não possam ser preservadas. O ajuste por define é um uso documentado de ZMK em [Mouse Emulation](https://zmk.dev/docs/keymaps/behaviors/mouse-emulation).

### 4. P1 — “Espera” em macros inclui um tempo extra de toque

`internal/firmware/generate.go:80` traduz a espera para `macro_wait_time`, seguido de `macro_tap &none`, e restaura o wait time. O motor ZMK agenda um evento de pressão com `tap-ms` e depois um de liberação com `wait-ms`. Portanto, o trecho que representa uma espera de 100 ms com `tap-ms = 20` agenda 120 ms, além dos intervalos dos passos adjacentes.

Correção proposta: representar os controles nativos na sequência ou gerar uma pausa equivalente com duração e modo tratados explicitamente. A diferença resulta da leitura do [motor de macros v0.3.0](https://github.com/zmkfirmware/zmk/blob/v0.3.0/app/src/behaviors/behavior_macro.c), também presente no [motor atual](https://github.com/zmkfirmware/zmk/blob/main/app/src/behaviors/behavior_macro.c). A conclusão é sobre o agendamento do firmware; não foi medida no teclado.

### 5. P1 — Limite de macros não considera eventos nem bindings gerados

`internal/project/validate.go:168` aceita até 512 passos. Cada ação recebe um controle de modo adicional; uma espera emite três bindings. O gerador não dimensiona a fila de behaviors. O limite do nosso modelo, portanto, não garante que a macro gerada caiba no firmware.

Correção proposta: validar o número de bindings após expansão, estimar eventos e oferecer configuração da fila quando necessária. A documentação informa fila padrão de 64 eventos, dois eventos por tap e limite de 256 bindings por lista. Macros longas podem falhar na compilação ou perder ações na execução. Ver [limites de macros](https://zmk.dev/docs/keymaps/behaviors/macros#behavior-queue-limit).

### 6. P2 — Validação de RGB rejeita sintaxe oficial

`internal/project/validate.go:13` não permite vírgulas em parâmetros; a tabela de aridades na linha 149 considera `rgb_ug` sempre com um parâmetro. Assim, o exemplo oficial `&rgb_ug RGB_COLOR_HSB(128,100,100)` é rejeitado. A forma explícita com comando de cor e segundo parâmetro também não passa pela aridade atual.

Correção proposta: descrever parâmetros por comando e aceitar expressões/macros válidas com estrutura conhecida, sem depender de uma única expressão regular. Ver [RGB Underglow](https://zmk.dev/docs/keymaps/behaviors/underglow).

### 7. P2 — Definição de hold-tap e parâmetros da tecla estão misturados na interface

`Behavior.Bindings` guarda ações completas, como `&kp LCTRL` e `&kp ESC`. Entretanto, `internal/firmware/generate.go:47` emite somente os nomes dos behaviors; os parâmetros ficam copiados no binding da tecla por `frontend/src/utils/resourceActions.ts:17`. Depois da atribuição, alterar ESC para SPACE no cartão muda o padrão para futuras atribuições, mas não os parâmetros das teclas já vinculadas.

Essa separação de parâmetros é válida no ZMK; a ambiguidade está na apresentação do recurso como se fosse uma ação totalmente vinculada. Na importação, os campos ainda recebem placeholders LSHFT/A em `internal/keymap/import.go:449`, mesmo que as teclas usem outros parâmetros.

Correção proposta: mostrar separadamente definição reutilizável, parâmetros de cada uso e eventual preset de atribuição. O encaminhamento de parâmetros pertence à instância do binding, conforme [Behavior Configuration](https://zmk.dev/docs/config/behaviors#hold-tap).

## Recursos ausentes ou apenas parcialmente acessíveis

| Recurso | Situação encontrada | Evolução necessária e referência |
| --- | --- | --- |
| Hold-taps genéricos | Validador, editor e importador limitam hold a `&kp`/`&mo` e tap a `&kp`. | Permitir composição com outros behaviors, inclusive ações sem parâmetros com argumento dummy. Ex.: hold `&mo`, tap `&tog`. [Hold-Tap](https://zmk.dev/docs/keymaps/behaviors/hold-tap#using-different-behavior-types-with-hold-taps). |
| Opções avançadas de hold-tap | Não há `retro-tap`, `hold-while-undecided` ou `hold-while-undecided-linger`. Valores de desativação como -1 não cabem na validação atual de quick tap/inatividade. | Representar propriedades opcionais e seus defaults, sem confundir ausência com zero. [Behavior Configuration](https://zmk.dev/docs/config/behaviors#hold-tap). |
| Macros parametrizadas e controles | Modelo fixa aridade zero e somente tap/press/release/wait. Não há pause-for-release, encaminhamento de parâmetros nem alteração arbitrária de tempos no meio da sequência. | Suportar macros com zero, um ou dois parâmetros e controles nativos como nós da sequência. O Keymap Editor documenta esse fluxo. [Guia de macros parametrizadas](https://github.com/nickcoutsos/keymap-editor/wiki/Using-Parameterized-Macros-in-Keymap-Editor). |
| Mod-morph | Não existe tipo no modelo; até o padrão `&gresc` está fora da tabela de behaviors aceitos. | Adicionar ações normal/alternativa, `mods` e `keep-mods`, com composição. [Mod-Morph](https://zmk.dev/docs/keymaps/behaviors/mod-morph). |
| Camadas condicionais | Não há modelo, editor, geração ou importação do nó correspondente. | Suportar `if-layers`/`then-layer`, referências estáveis e validação de prioridade/ativação. Ex.: Lower + Raise ativa Adjust. [Conditional Layers](https://zmk.dev/docs/keymaps/conditional-layers). |
| Combos com proteção durante digitação | Já há timeout, posições, camadas e slow-release; falta `require-prior-idle-ms`. | Adicionar o parâmetro ao modelo, UI, importador e gerador. Não confundir com o parâmetro homônimo de hold-tap. [Combo Configuration](https://zmk.dev/docs/config/combos). |
| Sticky keys/layers | `&sk`/`&sl` são aceitos pelo backend; apenas `&sl` aparece no catálogo de ações por camada. Não há configuração de sticky behaviors. | Oferecer sticky modifiers na paleta e opções como `release-after-ms`, `quick-release`, `lazy` e `ignore-modifiers`, conforme o tipo. [Sticky Key](https://zmk.dev/docs/keymaps/behaviors/sticky-key), [Sticky Layer](https://zmk.dev/docs/keymaps/behaviors/sticky-layer). |
| Caps Word e Key Repeat personalizados | Bindings padrão existem na paleta, mas overrides são rejeitados. | Expor continue-list/modificadores de Caps Word e usage-pages do repeat. [Caps Word](https://zmk.dev/docs/keymaps/behaviors/caps-word), [Key Repeat](https://zmk.dev/docs/keymaps/behaviors/key-repeat). |
| Bluetooth | `BT_DISC` é rejeitado pelo validador; `BT_CLR_ALL` é aceito, mas não aparece na paleta. | Separar suporte do modelo e disponibilidade visual, adicionando comandos conforme a revisão suportada. [Bluetooth Behavior](https://zmk.dev/docs/keymaps/behaviors/bluetooth). |
| Backlight e soft off | `&bl` e `&soft_off` não estão no catálogo nem na tabela padrão de validação. | Implementar com capacidades e pré-requisitos de hardware/firmware; não habilitar genericamente para qualquer plugin. [Behaviors Overview](https://zmk.dev/docs/keymaps/behaviors). |
| Mouse e input processors | Há botões/movimento/rolagem, mas não aceleração, delay, tempo até velocidade máxima, transformação/escala ou camadas temporárias por movimento. | Configuração por behavior e por dispositivo, respeitando capacidades. [Mouse Emulation](https://zmk.dev/docs/keymaps/behaviors/mouse-emulation), [Input Processors](https://zmk.dev/docs/keymaps/input-processors). |
| Encoders configuráveis | A ordem CW/CCW está correta e converter sensor variável em ações completas é válido. Faltam `tap-ms` e ajustes de `triggers-per-rotation`; overrides de sensores são rejeitados. | Diferenciar ação da rotação e configuração do sensor. [Sensor Rotation](https://zmk.dev/docs/keymaps/behaviors/sensor-rotate), [Encoder Configuration](https://zmk.dev/docs/config/encoders). |
| Configuração de layers | Bindings básicos existem; definições próprias de toggle-mode/locking não são representadas. | Adotar propriedades por tipo e controlar disponibilidade pela revisão. [Layer Behaviors](https://zmk.dev/docs/keymaps/behaviors/layers). |

As ausências podem ser conferidas em `internal/models/keyboard.go:46`, `internal/project/validate.go:149`, `frontend/src/components/ActionTray.tsx:197` e no dispatch de nós de `internal/keymap/import.go:37`. Não significam que os recursos básicos existentes gerem sintaxe inválida.

## Diferença arquitetural em relação ao Keymap Editor

O Keymap Editor trata o código original como parte central do projeto e documenta edição de behaviors baseada em schemas ZMK. Nosso importador converte um subconjunto para um modelo próprio, renomeia recursos e regenera o arquivo. Includes externos e recursos desconhecidos normalmente são rejeitados; comentários, nomes de defines e estrutura original não são preservados.

Isso é uma limitação de interoperabilidade, não uma violação do formato ZMK por si só. Porém, qualquer entrada aceita precisa manter a semântica, incluindo os defines do item 3. Uma evolução possível é preservar uma árvore de fonte com partes editáveis e partes opacas, ou explicitar uma importação com conversão e validação de perdas. A [wiki de Features](https://github.com/nickcoutsos/keymap-editor/wiki/Features) descreve a abordagem do outro editor.

Não se deve atribuir suporte completo a pré-processamento ao Keymap Editor: a própria [wiki de Preprocessor Support](https://github.com/nickcoutsos/keymap-editor/wiki/Preprocessor-Support) descreve limitações. Macros de pré-processador, como `AS(Q)`, são diferentes de macros de behavior, como `&minha_macro A`.

## Ordem proposta de trabalho

1. Preservar semântica: defaults/overrides independentes, defines relevantes, tempo real de espera e limites das macros.
2. Estruturar bindings: referência ao behavior, parâmetros tipados por uso, propriedades opcionais e schema compatível com a revisão do perfil. Planejar migração do projeto persistido.
3. Completar composição: macros parametrizadas, pausa até soltar, hold-taps genéricos, mod-morph e camadas condicionais.
4. Ampliar UI e configurações: sticky keys, idle de combos, comandos Bluetooth e configurações de encoders/mouse/iluminação.
5. Verificar cada etapa com importação → edição → geração, compilação nos perfis compatíveis e ensaios físicos explícitos para temporização/interação.

O uso de IDs estáveis para camadas, a ordem de bindings fornecida pelo plugin, a separação do clique do encoder em posição física e os campos básicos de combos estão coerentes com o modelo documentado do ZMK. As correções devem preservar essas propriedades.

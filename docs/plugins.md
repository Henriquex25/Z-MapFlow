# Contrato de plugins de teclado — versão 1

Os plugins são incluídos no build e registrados no ponto de composição em `app.go`. Não é necessário carregamento dinâmico. O core não conhece a geometria, os índices dos encoders ou os nomes dos shields de um teclado.

## Implementação

Implemente `devices.KeyboardDevice`:

```go
type KeyboardDevice interface {
    GetIdentifier() string
    GetName() string
    GetDefaultLayout() models.KeyboardLayout
    Descriptor() models.Plugin
}
```

Registre a implementação em `devices.NewRegistry(...)`, junto dos outros plugins. Use `internal/devices/soflev2` como referência. Um teclado diferente é exercitado por `internal/firmware/plugin_test.go`, incluindo arquivos de hardware e módulo externo.

## Descriptor

| Campo | Responsabilidade |
| --- | --- |
| `contractVersion` | Atualmente `1`. |
| `id`, `version`, `name` | Identidade permanente, versão do plugin e nome exibido. |
| `keymapName` | Prefixo dos arquivos `.keymap` e `.conf`, conforme esperado pelo shield. |
| `keyCount` | Número de posições do matrix transform, incluindo cliques de encoders. |
| `positions` | Uma posição por índice ZMK: ID físico, índice, x/y, largura/altura, rotação e sensor opcional. As dimensões usam unidades de tecla; a rotação é em graus. |
| `width`, `height` | Área total do desenho, nas mesmas unidades. |
| `sensors` | Ordem dos encoders no hardware, IDs estáveis e índice físico de cada clique. |
| `variants` | Perfis de controladora/firmware, alvos e instruções de bootloader. |
| `zmkRevision`, `buildImage` | Revisão e toolchain padrão; a variante pode sobrescrever ambos. Fixar uma revisão/tag e uma versão de imagem compatíveis. |
| `config`, `overlay` | Kconfig e devicetree específicos do dispositivo. O overlay é anexado ao keymap. |
| `files` | Arquivos de texto adicionais, relativos à pasta de configuração, como `boards/shields/...`. Caminhos devem usar `/`. Não sobrescrever arquivos gerados pelo core. |
| `modules` | Dependências west adicionais: nome, URL HTTPS, revisão e importação opcional do manifest. |
| `bindingArities` | Labels de behaviors específicos do plugin e número de parâmetros (0–2). Não redefinir os builtins. |
| `actions` | Ações extras expostas na paleta: nome e código. |
| `capabilities` | Recursos declarados: `layers`, `macros`, `combos`, `hold-tap`, `tap-dance`, `encoders`, `bluetooth`, `display`, `pointing`. |

Cada variante informa ID, nome, `targets`, `bootloaderBoards`, `uf2Family` e instruções. Cada alvo informa ID, nome da metade, board, shield e nome do artefato `.uf2`. IDs e nomes de arquivos devem ser estáveis. `bootloaderBoards` contém identificadores procurados no `INFO_UF2.TXT`; isso identifica uma controladora compatível, sem determinar automaticamente a metade.

O registro rejeita contratos incompatíveis, plugins duplicados, geometria incompleta, índices duplicados e arquivos fora da pasta de configuração. O projeto salvo identifica a versão do plugin e rejeita incompatibilidades. Ao mudar o contrato ou um mapeamento, defina uma migração antes de aceitar arquivos antigos; não reinterpretar seus índices silenciosamente.

## Bindings e referências

`KeyAction.keymapIndex` é o índice real no matrix transform, independentemente da ordem dos elementos no array ou da posição visual. O gerador ordena por esse índice. Cada camada precisa ter todos os bindings e os mesmos sensores declarados no plugin.

Camadas possuem IDs próprios. Uma referência interna como `&lt @{layer_id} SPACE` é resolvida para o índice ZMK somente na geração. A paleta cria essas referências; remover camadas em uso é bloqueado. Códigos numéricos de camada não são a representação recomendada do projeto.

Macros e behaviors criados pelo editor usam IDs com prefixo `zm_`. O prefixo `zm_sensor_` fica reservado ao gerador. A validação cobre quantidade de parâmetros, referências inexistentes, ciclos entre recursos, consistência de cliques e estrutura do projeto. A compilação real continua sendo a verificação dos códigos e das opções disponíveis na revisão ZMK escolhida.

Hold-taps personalizados aceitam hold de `&kp` ou `&mo` e tap de `&kp`. O node gerado tem dois parâmetros; a ação arrastável carrega os parâmetros configurados. Tap-dances e macros são bindings sem parâmetros. A rotação de cada encoder é composta em um behavior sensor-rotate próprio por camada, permitindo ações distintas para CW e CCW.

## Limites atuais e validação de uma contribuição

O transporte de firmware implementado é UF2 por volume montado. Um teclado que exige outro protocolo precisa de um novo transporte no core, com sua seleção declarada pelo plugin.

Teste geometria e índices, layout padrão, geração de arquivos e compilação de cada alvo. Confira se os arquivos exportados e as instruções correspondem às controladoras. Faça a validação física de bootloader e flash no teclado real; testes de cópia usam pastas simuladas.

Após mudanças na API Go, regenere os bindings com `wails generate module`. Os tipos do frontend são derivados desses modelos. Não criar outra definição da geometria em React.

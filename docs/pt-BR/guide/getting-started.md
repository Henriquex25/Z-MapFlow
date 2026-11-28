# Primeiros passos

1. Selecione seu teclado e a variante de controladora correspondente ao hardware.
2. Comece pelo layout padrão ou use **Importar projeto** para abrir um JSON do aplicativo ou um `.keymap`.
3. Escolha uma camada na lateral esquerda. Clique numa ação da paleta e depois numa tecla, ou arraste a ação para o layout.
4. Clique numa tecla sem uma ação selecionada para editar seus parâmetros. **Escape** cancela a seleção da paleta.
5. Use **Salvar** para persistir suas alterações localmente.

Consulte [Teclados compatíveis](./keyboards) para controladoras, encoders/displays opcionais e o port experimental do Silakka54 com fio.

## Layout e paleta

A paleta inferior reúne teclas, modificadores, tap/hold, camadas, Bluetooth, mouse, recursos e idiomas. A busca expande a paleta quando está recolhida. Arraste a divisória para distribuir o espaço entre a paleta e o layout; Home ou duplo clique restaura a distribuição automática.

Ações principais ficam na lateral direita, com ícones e tooltips. As camadas ficam à esquerda do teclado, com rolagem quando necessário.

A paleta de Teclas ocupa a largura disponível da janela, preservando a largura mínima das teclas. Em janelas menores, use a rolagem horizontal para alcançar as demais teclas. Selecione **Idioma das teclas** na paleta para acessar ABNT2 ou um idioma importado; veja [idiomas do teclado](./configuration#escolher-o-idioma-das-teclas).

## Comportamentos, macros e combos

**Comportamentos** combinam ações reutilizáveis: toque/segurar, sequência de toques, ação conforme modificador, entre outros. Cada uso pode ter seus próprios parâmetros. **Macros** executam sequências; **Combos** disparam uma ação ao pressionar várias posições simultaneamente.

O editor valida tipos e quantidades de parâmetros antes da atribuição. Rascunhos inválidos aparecem em vermelho, preservam o último valor válido e impedem salvar. Use **Descartar rascunho** na edição de tecla para fechar sem aplicar o texto inválido. A compilação verifica regras adicionais do hardware e de módulos avançados.

Os cartões de comportamentos iniciam recolhidos. Nome, tipo, prévia da ação e botões de atribuir/excluir continuam visíveis. Use a seta ao lado do comportamento para mostrar suas configurações; cada cartão abre de forma independente. Alterações aplicadas são preservadas ao recolher. Corrija rascunhos inválidos antes de fechar o cartão.

## Salvar e exportar

- **Salvar** persiste o projeto em edição sem compilar.
- **Compilar** usa a última revisão salva.
- **Salvar e compilar** salva e inicia o build dessa revisão.
- **Exportar projeto** cria um JSON com os dados editáveis.
- **Exportar keymap** gera os arquivos ZMK e seus acompanhantes necessários.

**Descartar** restaura o último projeto salvo ou o estado inicial do projeto importado.

## Apoiar o projeto

Os botões **Dar estrela no GitHub** e **Pague um café** ficam visíveis no cabeçalho e abrem suas respectivas páginas no navegador. Você também pode [dar uma estrela](https://github.com/Henriquex25/Z-MapFlow) ou [apoiar o desenvolvimento](https://www.buymeacoffee.com/henriquemiranda) por aqui. O apoio é opcional; todos os recursos continuam disponíveis.

Um pequeno convite, que não bloqueia a edição, pode aparecer após cinco aberturas e 30 minutos de uso ativo. O convite de doação é separado: exige dez aberturas, duas horas de uso ativo e pelo menos três aberturas após responder ao convite de estrela. Os convites aguardam o primeiro minuto da sessão e ficam ocultos durante compilações, flash e outras janelas de diálogo. Tempo em segundo plano ou sem interação não conta como uso ativo.

Aceitar, fechar ou escolher **Não, obrigado** dispensa aquele convite permanentemente neste computador. Usar o botão correspondente no cabeçalho também o dispensa. Os botões continuam disponíveis para quem quiser apoiar depois. Contadores e respostas ficam apenas neste computador, separados do projeto do teclado, e são preservados nas atualizações. O app não acessa sua conta do GitHub, não adiciona estrelas automaticamente e não processa pagamentos.

### Escolher ações e parâmetros

![Escolha da tecla de um passo de macro na paleta de ações compatíveis](/images/z-mapflow-contextual-palette.png)

Configurações oculta toda a paleta inferior. Macros, Comportamentos, Combos e Camadas condicionais começam com a paleta recolhida. Clicar em qualquer aba da paleta ou digitar uma busca a expande.

Escolha o tipo de ação no dropdown **Comportamento**. Para uma tecla, camada, perfil Bluetooth ou outro parâmetro de lista, clique no slot para abrir as opções compatíveis abaixo; depois clique em uma opção ou arraste-a para o slot. Um parâmetro de tecla aceita keycodes/atalhos, enquanto um campo de ação completa pode receber uma macro ou comportamento compatível. Macros e Comportamentos têm abas próprias na paleta; escolhas inválidas ou recursivas são filtradas. Valores numéricos mantêm seus inputs, e a entrada avançada de atalhos/código ZMK continua disponível.

Após escolher, o slot é preenchido e a seleção termina; a paleta permanece aberta. Esc encerra a seleção sem alterar o campo. Fechar um card ou trocar de tela limpa o destino. Na edição de tecla, a janela fica acima da paleta, permitindo clicar e arrastar sem atingir o teclado que está atrás.

O **Modo do passo** da macro define a execução: **Tocar** pressiona e solta, **Pressionar** mantém pressionado, **Soltar** libera e **Esperar** pausa. O dropdown **Comportamento** define a tecla/ação executada. Os controles para adicionar passos ficam antes da sequência, e os cards ficam alinhados em uma grade responsiva.

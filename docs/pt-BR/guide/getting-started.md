# Primeiros passos

1. Selecione seu teclado e a variante de controladora correspondente ao hardware.
2. Comece pelo layout padrão ou use **Importar projeto** para abrir um JSON do aplicativo ou um `.keymap`.
3. Escolha uma camada na lateral esquerda. Clique numa ação da paleta e depois numa tecla, ou arraste a ação para o layout.
4. Clique numa tecla sem uma ação selecionada para editar seus parâmetros. **Escape** cancela a seleção da paleta.
5. Use **Salvar** para persistir suas alterações localmente.

## Layout e paleta

A paleta inferior reúne teclas, modificadores, tap/hold, camadas, Bluetooth, mouse, recursos e idiomas. A busca expande a paleta quando está recolhida. Arraste a divisória para distribuir o espaço entre a paleta e o layout; Home ou duplo clique restaura a distribuição automática.

Ações principais ficam na lateral direita, com ícones e tooltips. As camadas ficam à esquerda do teclado, com rolagem quando necessário.

A paleta de Teclas ocupa a largura disponível da janela, preservando a largura mínima das teclas. Em janelas menores, use a rolagem horizontal para alcançar as demais teclas. Selecione **Idioma das teclas** na paleta para acessar ABNT2 ou um idioma importado; veja [idiomas do teclado](./configuration#escolher-o-idioma-das-teclas).

## Comportamentos, macros e combos

**Comportamentos** combinam ações reutilizáveis: toque/segurar, sequência de toques, ação conforme modificador, entre outros. Cada uso pode ter seus próprios parâmetros. **Macros** executam sequências; **Combos** disparam uma ação ao pressionar várias posições simultaneamente.

O editor valida tipos e quantidades de parâmetros antes da atribuição. Rascunhos inválidos aparecem em vermelho, preservam o último valor válido e impedem salvar. Use **Descartar rascunho** na edição de tecla para fechar sem aplicar o texto inválido. A compilação verifica regras adicionais do hardware e de módulos avançados.

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

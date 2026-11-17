# Configuração ZMK e idiomas

## Importar uma configuração

Selecione o teclado/variante e abra seu `.keymap`. O aplicativo procura também o `.conf` de mesmo nome, headers `.h` locais e o `build.yaml` próximo. A geometria e ordem física das teclas vêm do plugin.

Camadas, encoders, macros e comportamentos são carregados. Ausência de configurações de encoder em uma camada preserva a herança. O importador não muda seu repositório original.

Includes locais `.dtsi`, condicionais e defines com parâmetros no próprio keymap exigem expansão prévia. Não há importação integral de qualquer repositório ZMK. A edição avançada preserva propriedades e subnós que não possuem formulário dedicado, sujeitos à validação do compilador.

## Flags e transportes

Na aba **Configurações**, ajuste as opções disponíveis e as flags Kconfig adicionais, por exemplo `CONFIG_ZMK_STUDIO=y`. O preset Studio USB configura o alvo central e o snippet necessário; revise a compatibilidade da sua controladora.

Snippets e argumentos CMake pertencem a cada alvo da matriz de compilação. O USB para digitação e o transporte USB do Studio são recursos distintos; use as opções apropriadas à revisão ZMK e ao hardware. Consulte a [documentação oficial ZMK](https://zmk.dev/docs) para dependências específicas.

## Escolher o idioma das teclas

Use o seletor **Idioma das teclas** na paleta de ações. Escolha **US / ANSI**, **Português (Brasil) — ABNT2** ou um header importado anteriormente. A mesma seleção está em **Configurações → Layout do sistema operacional**.

Para ABNT2, selecione Português e a paleta abre **Idiomas** com os caracteres incluídos, como `Ç`. Arraste um caractere para uma tecla ou clique nele e depois no destino. A busca aceita caracteres ou nomes de aliases. As atribuições existentes mantêm seus códigos ao escolher outro idioma.

### Adicionar outro idioma

1. Abra **Idiomas → Encontrar idiomas**. O navegador abre os [headers do ZMK Locale Generator](https://github.com/joelspadin/zmk-locale-generator/releases/latest). Baixe o `.h` correspondente ao layout de teclado configurado no seu computador.
2. Use **Adicionar idioma (.h)** na paleta e selecione o arquivo. Mantenha eventuais headers locais dos quais ele depende na mesma pasta durante a importação.
3. O app seleciona o header importado e mostra seus aliases. Arraste-os ao teclado. Quando o header identifica explicitamente um caractere, o app pode exibir esse símbolo; caso contrário, exibe o nome do alias.

Os arquivos e includes ficam no projeto e acompanham a exportação do keymap e a compilação do firmware. **Configurações → Headers e idiomas** permite criar ou editar um header como opção avançada. Arquivos existentes com conteúdo diferente são recusados na importação.

Configure o mesmo layout de teclado no sistema operacional. O app não altera essa configuração: [o ZMK envia códigos interpretados pelo computador](https://zmk.dev/blog/2024/01/05/zmk-tools#zmk-locale-generator).

**O idioma da interface é independente:** inglês ou Português Brasil em **Configurações → Aplicativo** altera os controles do app. Ele não habilita ABNT2, não altera bindings e não traduz nomes de camadas ou macros criados pelo usuário.

## Bluetooth e energia

Em **Configurações → Bluetooth e energia**, **Inatividade para repouso (minutos)** define o tempo sem atividade antes do repouso automático. Por exemplo, `15` representa 15 minutos e `1.5` representa 90 segundos. O intervalo aceito continua sendo de um segundo a 24 horas, com suporte a frações de minuto.

O backend valida o valor e converte para milissegundos no projeto salvo e em `CONFIG_ZMK_IDLE_SLEEP_TIMEOUT` do ZMK. Abrir um projeto ou importar um `.conf` preserva o valor exato em milissegundos, mesmo quando ele não corresponde a minutos inteiros. Ative **Repouso automático** para usar esse tempo.

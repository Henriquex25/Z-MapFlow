# Problemas frequentes

## O aplicativo não abre

Confira a arquitetura e as bibliotecas GTK/WebKit indicadas na [instalação](./install). Execute o binário no terminal para obter a mensagem do sistema. Pacotes oficiais Linux usam WebKitGTK 4.1.

## Docker não é encontrado

Inicie Docker Desktop ou o serviço Docker e confira `docker info` e `docker context show` no terminal. O aplicativo precisa usar o mesmo contexto e ter acesso ao socket. Não execute o aplicativo inteiro como root.

## Um binding fica vermelho

Confira os parâmetros e o código informado. Cada ação aceita uma quantidade e tipos específicos: um código de tecla não é um texto arbitrário. Aliases personalizados devem existir em um header ou define do projeto. Corrija o rascunho ou descarte-o.

## A importação falha

Confira teclado/variante e o número de teclas. Inclua headers locais ao lado do keymap. Includes `.dtsi`, condicionais e macros de pré-processador com parâmetros no próprio keymap não são expandidos pelo importador. Uma falha mantém a edição anterior.

## A atualização não aparece ou falha

A consulta usa releases públicas estáveis e precisa de internet. Pré-releases são ignoradas. Um repositório privado, limite da API, ausência de pacote para sua arquitetura ou instalação sem permissão de escrita pode impedir a atualização. Use o pacote oficial instalado na pasta do usuário e tente novamente pelo cabeçalho.

Se a nova versão iniciar e apresentar um problema, feche o app e restaure `z-mapflow.previous` na pasta de instalação ou reinstale uma release anterior. Preserve uma exportação do seu projeto antes de voltar a uma versão com esquema de dados diferente.

## Reportar um problema

Abra uma [issue](https://github.com/Henriquex25/Z-MapFlow/issues/new/choose) com versão, sistema, teclado/variante, passos e logs. Remova informações pessoais antes de anexar sua configuração. Veja [como contribuir](../community/contributing).

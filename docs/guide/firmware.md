# Compilar, exportar e gravar firmware

## Compilação

Inicie o Docker e salve seu projeto. **Salvar e compilar** executa o fluxo completo; **Compilar** usa somente a revisão salva anteriormente. O container é temporário e utiliza cache para reduzir downloads posteriores.

Acompanhe a etapa e os logs no painel inferior. É possível editar enquanto uma compilação roda: o build continua associado à revisão original.

## Exportação

Após sucesso, use **Exportar firmware** e escolha uma pasta. Um toast confirma a exportação concluída e informa o destino. Cancelar o seletor não exibe sucesso.

O histórico permite recuperar firmwares de compilações anteriores. Confira a revisão e o alvo antes de gravar.

## Flash por UF2

1. Escolha **Fazer flash** e informe qual metade está conectada.
2. Conecte a controladora por USB em modo bootloader.
3. Selecione o volume detectado ou informe o volume manualmente.
4. Envie o firmware e repita para os demais alvos necessários.

O aplicativo escolhe o artefato do alvo informado. Uma cópia concluída confirma o envio, mas o funcionamento final deve ser verificado no teclado. O aplicativo não ativa automaticamente o bootloader.

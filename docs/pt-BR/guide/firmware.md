# Compilar, exportar e gravar firmware

## Compilação

Inicie o Docker e salve seu projeto. **Salvar e compilar** executa o fluxo completo; **Compilar** usa somente a revisão salva anteriormente. O container é temporário e utiliza cache para reduzir downloads posteriores.

Acompanhe a etapa e os logs no painel inferior. É possível editar enquanto uma compilação roda: o build continua associado à revisão original.

## Exportação

Após sucesso, use **Exportar firmware** e escolha uma pasta. Um toast confirma a exportação concluída e informa o destino. Cancelar o seletor não exibe sucesso.

O histórico permite recuperar firmwares de compilações anteriores. Confira a revisão e o alvo antes de gravar.

## Flash por UF2

Escolha **Fazer flash** para abrir o guia visual. Seus três cartões numerados orientam a conexão, a escolha da metade e a conferência do volume:

1. **Conecte por USB.** Conecte uma metade em modo bootloader. Abra **Como entrar no bootloader** para consultar as instruções da sua controladora.
2. **Escolha a metade conectada.** Selecione o botão da metade para o app usar o firmware correspondente.
3. **Confira o volume do bootloader.** Um único volume detectado é selecionado automaticamente. Se houver vários, escolha um ou use **Selecionar volume manualmente**.
4. Use **Enviar firmware**, espere a controladora reiniciar e teste o novo layout. Repita para os demais alvos necessários.

O aplicativo escolhe o artefato do alvo informado. Uma cópia concluída confirma o envio, mas o funcionamento final deve ser verificado no teclado. O aplicativo não ativa automaticamente o bootloader.

## Reinicialização e avisos de gravação final

Bootloaders UF2 podem reiniciar automaticamente após receber o firmware, removendo o volume USB antes de o sistema operacional terminar a confirmação final de gravação. Na SuperMini nRF52840, o autor do projeto confirmou que o teclado funcionou após o app informar:

```text
sync /media/usuario/NICENANO/sofle-right.uf2: input/output error
```

Isso também pode ocorrer ao copiar um UF2 pelo gerenciador de arquivos. O comportamento é compatível com uma reinicialização do bootloader, mas o erro sozinho não comprova sucesso. Bootloaders UF2 podem [reiniciar ao receber todos os blocos](https://github.com/microsoft/uf2#rationale).

Quando a cópia completa retorna sem erro, mas a sincronização ou o fechamento final falha, o app mostra **Envio não confirmado** em um painel amarelo. O erro original do sistema fica em **Detalhes técnicos**. A metade selecionada não é marcada automaticamente como enviada.

- Espere o teclado reiniciar, reconecte normalmente se necessário e teste o novo layout. Se funcionar, use **Teclado funcionando — confirmar**. A metade recebe a indicação **Confirmado por você**, e você pode continuar para a outra metade.
- Se não funcionar, use **Reconectar e tentar novamente**, entre em modo bootloader, confira a metade e o volume selecionados e envie novamente.
- Se a própria cópia for interrompida, o aplicativo informa um erro. Uma cópia incompleta não oferece a confirmação de gravação final.

O app não repete o envio nem declara o teclado funcional apenas porque o volume desapareceu.

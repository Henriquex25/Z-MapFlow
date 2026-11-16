# Compilar, exportar e gravar firmware

## Compilação

Inicie o Docker e salve seu projeto. **Salvar e compilar** executa o fluxo completo; **Compilar** usa somente a revisão salva anteriormente. O container é temporário e utiliza cache para reduzir downloads posteriores.

Acompanhe a etapa e os logs no painel inferior. É possível editar enquanto uma compilação roda: o build continua associado à revisão original.

## Exportação

Após sucesso, use **Exportar firmware** e escolha uma pasta. Um toast confirma a exportação concluída e informa o destino. Cancelar o seletor não exibe sucesso.

O histórico permite recuperar firmwares de compilações anteriores. Confira a revisão e o alvo antes de gravar.

## Flash por UF2

Escolha **Fazer flash** para abrir o assistente por etapas. A barra de progresso mostra a etapa atual, e **Voltar** permite conferir as escolhas anteriores antes do envio.

1. **Metade.** Escolha a metade que você vai conectar e use **Avançar**.
2. **Conexão.** Siga as instruções de bootloader da sua controladora. Um único volume detectado é selecionado automaticamente. Se houver vários, escolha um ou use **Selecionar volume manualmente**. Use **Avançar** quando houver um volume selecionado.
3. **Envio.** Confira a metade, o volume do bootloader e o nome do firmware. Use **Enviar firmware** para iniciar. A navegação fica bloqueada durante o envio; se um volume detectado desaparecer antes de enviar, o assistente retorna à conexão.
4. **Resultado.** Espere o teclado reiniciar e teste o novo layout. O resultado distingue arquivo enviado, gravação final não confirmada e cópia interrompida. Use **Gravar próxima metade** para iniciar a próxima metade ou **Concluir** após enviar todos os alvos.

Cada tela mostra somente os controles da etapa atual. Para avançar, selecione a metade ou o volume, conforme a etapa. O arquivo só é enviado ao usar **Enviar firmware** na tela de revisão.
O aplicativo escolhe o artefato do alvo informado. Uma cópia concluída confirma o envio, mas o funcionamento final deve ser verificado no teclado. O aplicativo não ativa automaticamente o bootloader.

![Assistente de flash do Z-MapFlow mostrando a metade esquerda, o volume do bootloader e o firmware UF2 correspondente antes do envio](/images/z-mapflow-flash-wizard.png)

*Exemplo da etapa 3: confira o alvo, o firmware e a revisão da compilação antes de usar Enviar firmware. A captura mostra a interface padrão em inglês.*

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


## Unidades USB no Windows

Coloque a metade conectada em bootloader e aguarde sua unidade UF2 aparecer no Explorador. O app descobre unidades locais pela API Win32 e confere `INFO_UF2.TXT` com a controladora selecionada. Se não aparecer, selecione manualmente a raiz da unidade, como `E:\`. Informe explicitamente a metade conectada: a unidade não identifica sozinha esquerda ou direita. A cópia é feita diretamente pelo aplicativo Windows, sem encaminhar USB para o Docker. A validação com teclado físico no Windows ainda está pendente.

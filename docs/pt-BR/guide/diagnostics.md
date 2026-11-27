# Diagnóstico do firmware e orientação de atualização

## Abas das configurações

**Configurações** tem três abas: **Teclado e firmware**, com opções do projeto/compilação; **Aplicativo**, com preferências locais; e **Diagnóstico**, com logs USB e captura serial. Habilitar logs altera o projeto: salve e recompile antes de gravar. Trocar de aba não salva, compila ou grava automaticamente.

## Capturar logs USB

1. Em **Configurações → Diagnóstico**, habilite **Logs USB** apenas no dispositivo investigado. O app adiciona <code>zmk-usb-logging</code> ao alvo preservando os demais snippets/flags. Flags de logging adicionadas manualmente são detectadas: remova-as em **Teclado e firmware** antes de usar os controles afetados.
2. Salve, compile e grave o firmware normal desse dispositivo. Habilitar logs não exige reset de pareamento por si só. O volume do bootloader não fornece logs.
3. Conecte o dispositivo por USB, atualize as portas e selecione a porta de logging (<code>/dev/ttyACM…</code> no Linux ou <code>COM…</code> no Windows). Não selecione a porta RPC do Studio.
4. Clique em **Iniciar captura**, reproduza o problema e depois **Parar captura** e **Exportar logs do firmware**. Escolha onde salvar o texto; cancelar o diálogo não exporta nada.
5. Após o diagnóstico, remova o snippet de logging, recompile e grave novamente. Logging aumenta o consumo e pode alterar os tempos do firmware; não deve permanecer ligado sem necessidade.

A captura apenas recebe dados a 115200 baud, com DTR habilitado para o console USB. Não envia comandos nem usa o reset de bootloader por 1200 baud. Só abre portas enumeradas pelo sistema. O buffer fica na memória, limitado aos últimos 256 KiB, até ser exportado; **Limpar logs** esvazia o buffer e uma nova captura começa vazia.

Trocar de aba mantém a captura. Ela para antes do flash/atualização do app, por desconexão/erro de leitura ou ao fechar o app. Reconectar exige iniciar outra captura; não há troca automática de porta. No Linux, confira as permissões do dispositivo serial (geralmente o grupo <code>dialout</code>) e feche outros monitores seriais. A ausência de portas pode indicar firmware sem logging ou dispositivo em bootloader. O texto já capturado continua disponível para exportação após um erro.

Logs podem conter identificadores e eventos de teclas: revise antes de compartilhar. Eles são diferentes dos logs de compilação do botão **Ver logs**. Consulte o [logging USB do ZMK](https://zmk.dev/docs/development/usb-logging).

## Quais dispositivos atualizar?

A seleção do guia de flash mostra uma recomendação por dispositivo de destino. Compara entradas da compilação imutável com os envios registrados neste computador; não lê o firmware do volume UF2 e não bloqueia dispositivos válidos.

- Sem histórico utilizável ou em builds antigos sem dados de comparação, recomenda todos.
- A migração de topologia continua exigindo limpeza e firmware em todos os dispositivos de destino; a exceção para dispositivos retirados continua disponível.
- Alterações apenas nos bindings/rótulos individuais das teclas e nomes das camadas podem manter as entradas dos periféricos iguais, recomendando só o central. Macros/comportamentos, sensores, hardware, energia, flags, headers, snippets e dependências ZMK são comparados de forma conservadora.
- Flags/logging específicos de um alvo afetam a recomendação desse alvo. Alterações nos fontes auxiliares gerados também invalidam a comparação.
- Envios com falha/interrompidos e resets invalidam o registro anterior do dispositivo. Uma escrita final incerta só é registrada após reconhecimento.
- Uma cópia concluída é um envio registrado, não uma confirmação de funcionamento físico.

Você ainda pode atualizar todos ou fechar o guia após atualizar só o central quando apropriado. Nenhum dispositivo é escondido pela recomendação. **Como funciona esta orientação → Esquecer envios registrados** limpa as comparações. Após trabalho externo, use **Fiz flash fora do app ou troquei as controladoras** no fluxo de topologia. O app não detecta essas ações nem distingue automaticamente dois teclados físicos do mesmo plugin. O histórico local não é incluído no JSON exportado.

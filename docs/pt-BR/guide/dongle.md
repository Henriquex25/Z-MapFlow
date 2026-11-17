# Sofle v2 com dongle USB

O perfil experimental **nice!nano v2 / SuperMini — dongle USB central** usa três controladoras nRF52840 compatíveis. As duas metades mantêm sua matriz e encoders; a terceira controladora, avulsa, funciona como receptor USB. A validação física ainda está pendente. Compilar não comprova a compatibilidade da controladora, bootloader ou comunicação sem fio.

| Dispositivo | Papel | Firmware |
| --- | --- | --- |
| Dongle USB | Central: keymap, comportamentos e saída USB | `sofle-dongle.uf2` |
| Metade esquerda | Periférico Bluetooth | `sofle-dongle-left.uf2` |
| Metade direita | Periférico Bluetooth | `sofle-dongle-right.uf2` |
| Os três, apenas na migração | Limpar pareamento e configurações ZMK armazenadas | `sofle-settings-reset.uf2` |

É um receptor BLE do ZMK. Não adiciona compatibilidade com dongles proprietários de 2,4 GHz. A pinagem e o bootloader precisam ser compatíveis com nice!nano v2/SuperMini; o nome “Pro Micro” sozinho não garante isso. O receptor usa alimentação USB e não precisa de teclas, encoders, OLED ou fiação de matriz.

![Assistente de flash com Dongle USB, Esquerda e Direita e modo separado para limpar pareamentos](/images/z-mapflow-dongle-flash.png)

Exemplo de seleção de dispositivo na interface real. Nenhum firmware foi enviado a um teclado físico para essa imagem.

Por padrão, as metades mostram bateria/status periférico local. A opção abaixo adiciona um módulo de firmware para transmitir o estado do central às duas metades; os widgets padrão do ZMK, sozinhos, não fazem esse envio.

## Primeira configuração

1. Exporte seu projeto como backup. Em **Configurações → Teclado e firmware → Variante de hardware**, escolha o perfil com dongle USB. Camadas, bindings, macros, combos e comportamentos permanecem no projeto. Se o preset Studio USB estava ativado, ele é movido ao novo central. Ajustes de alvos ausentes no perfil selecionado são removidos; os demais são preservados.
2. Ative ou desative **Display** conforme os OLEDs das metades. Os controles de display e repouso automático se aplicam às metades; o receptor não tem OLED/encoder local e permanece acordado. Os perfis Bluetooth reservam duas conexões/pareamentos adicionais para os periféricos.
3. Use **Salvar e compilar**. O app gera três firmwares de dispositivo e um de reset. Os papéis e os ajustes específicos do receptor são gerenciados pelo perfil; flags contraditórias por alvo são rejeitadas antes de salvar/compilar. O preset Studio USB se aplica ao dongle.
4. Abra **Gravar firmware → Limpar pareamento primeiro**. Para **cada** dispositivo — Dongle USB, Esquerda e Direita — conecte-o, pressione RESET duas vezes, selecione o volume UF2, revise e envie o firmware de reset. Aguarde o reinício e desconecte a controladora ou desligue a metade. O reset apaga os vínculos Bluetooth e as configurações ZMK armazenadas, incluindo alterações do Studio; mantém o bootloader e o projeto salvo no Z-MapFlow. Confirmar envio/reinício não comprova que as configurações foram apagadas.
5. Selecione **Continuar com firmware do teclado**. Entre novamente no bootloader de cada dispositivo e grave o firmware correspondente: dongle, esquerda, direita. Mantenha o receptor conectado por USB, ligue ambas as metades e teste teclas, rotação e clique dos encoders. O volume UF2 não identifica a metade: selecione o dispositivo realmente conectado.

O arquivo de reset é compartilhado porque esse perfil usa a mesma controladora/família UF2 nos três dispositivos. O assistente acompanha separadamente o progresso de reset e firmware. O envio sempre exige sua revisão e o botão **Enviar firmware**.

A controladora pode reiniciar antes de o sistema confirmar a última escrita. No reset, o assistente permite reconhecer o reinício sem declarar o teclado funcional. Entre novamente no bootloader e instale o firmware do teclado antes de testar teclas. Consulte [avisos na última escrita](./firmware#reinicializacao-e-avisos-de-gravacao-final).

## Sincronização opcional de camada e conexão

Em **Configurações → Teclado e firmware**, ative **Sincronizar camada e conexão com as metades**. A opção inicia **desativada**, é salva no projeto e aparece apenas nos perfis compatíveis. Alterá-la preserva o keymap. Selecionar um perfil incompatível a desativa. A importação/exportação da configuração Z-MapFlow preserva esse ajuste.

- **Desativada:** transmissor, serviço receptor e tela sincronizada não são compilados. As metades mantêm o status local normal.
- **Ativada:** o dongle envia índice/nome da camada ativa, perfil Bluetooth selecionado e a **saída efetivamente selecionada**, incluindo fallback USB/BLE do ZMK. Alimentação USB sozinha não significa saída USB ativa.
- Com **Display** ativado, cada OLED mostra camada recebida, saída/perfil e bateria local em duas linhas. `USB / B2` indica USB como saída ativa e perfil Bluetooth 2 selecionado; `BT 2 online` indica o perfil Bluetooth 2 como saída ativa. Ausência de saída aparece como offline. O nome da camada é limitado a 14 bytes UTF-8 e acompanhado pelo índice; os caracteres disponíveis dependem da fonte do firmware.
- Sem Display, a sincronização continua disponível, mas nenhuma tela OLED é compilada.

Após alterar a opção, **salve, recompile e grave o dongle e ambas as metades**. A sincronização é feita pelo firmware e funciona sem manter o Z-MapFlow aberto. Os três dispositivos operacionais precisam de firmware compatível. A opção é compilada, sem alteração instantânea por USB. Depois de alinhar o ajuste nos três dispositivos, mudanças comuns de keymap normalmente continuam exigindo apenas gravar o dongle.

O estado é enviado nas alterações, depois de conexão/criptografia/descoberta e em uma pequena confirmação de 20 bytes a cada cinco segundos. O módulo não transmite keycodes, WPM nem um fluxo contínuo de digitação. Utiliza os vínculos BLE pareados e criptografados existentes, sem outro pareamento. Confirmações sem mudanças não redesenham o OLED. O comportamento normal de inatividade/repouso das telas é mantido; essas confirmações não contam como atividade de teclas.

O receptor invalida o estado exibido quando reconhece a desconexão ou passa 15 segundos sem uma atualização válida. `Waiting for dongle` / `No sync` indica dados indisponíveis. Ao reconectar, recebe um estado inicial mesmo se a camada não mudou. Assim, informações antigas não são apresentadas como atuais. Reconexão, despertar e aparência real dos OLEDs ainda precisam de validação física.

Com a sincronização ativada, **Display** e a opção de sincronização também gerenciam a seleção de tela e os widgets padrão no firmware gerado. Flags antigas preservadas em um JSON/`.conf` importado são normalizadas durante a geração, sem apagar os ajustes avançados originais. Overrides conflitantes por alvo são rejeitados antes da compilação; a mesma seleção de tela vale para os arquivos exportados.

O controle gerencia `CONFIG_ZMAPFLOW_STATUS_SYNC`; use essa opção em vez de overrides contraditórios no `.conf` ou por alvo. A primeira mudança de topologia continua usando o reset descrito acima. Se firmwares anteriormente pareados não reconectarem depois de atualizar os três dispositivos, utilize o procedimento de reset/regravação.

## Uso diário e retorno ao perfil anterior

Para alterações comuns no keymap, escolha **Firmware do teclado**, mantendo os pareamentos. Bindings, camadas e a maioria dos comportamentos são processados pelo central; depois da configuração inicial, normalmente basta gravar o receptor e fechar o assistente. Mudanças em hardware, energia, encoders ou compatibilidade de firmware exigem atualizar as metades afetadas. O app continua compilando todos os alvos declarados.

As duas metades periféricas não digitam diretamente no computador sem o dongle. Para voltar à configuração comum, selecione o perfil nice!nano/SuperMini original, limpe o pareamento dos dispositivos com o UF2 de reset e grave os firmwares normais esquerdo/direito. O perfil original continua sendo o padrão; o uso do dongle é explícito. Se o preset Studio USB estava ativado, ele volta ao central esquerdo. Refaça os pareamentos Bluetooth com o computador se necessário.

## Referências técnicas

Os arquivos ficam em `internal/devices/soflev2/dongle/`. O receptor utiliza varredura simulada e o mesmo transform/layout físico Sofle da revisão ZMK fixada, com dois sensores locais desativados que preservam os índices dos sensores periféricos. Cada metade ativa apenas seu encoder definido pelo upstream. Papéis, reset e flags por alvo pertencem ao plugin, sem condições específicas do Sofle no core.

Consulte o [guia oficial de dongle ZMK](https://zmk.dev/docs/hardware-integration/dongle) e os [papéis em teclados split](https://zmk.dev/docs/features/split-keyboards). Outras combinações de teclado/controladora precisam de perfis verificados.

O módulo opcional acompanha os arquivos exportados em `zmapflow-status/` e `zephyr/module.yml`, sem outra dependência west ou fork ZMK. Fontes e simulações do protocolo/transporte ficam em `internal/zmkmodules/statussync`. Utiliza uma característica GATT criptografada e versionada, fila própria de transmissão, tentativas de descoberta/envio e cache coerente no receptor. É uma extensão experimental à revisão ZMK fixada, não um recurso do upstream.

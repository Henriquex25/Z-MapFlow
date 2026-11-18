# Sofle v2 com dongle USB

O perfil experimental **nice!nano v2 / SuperMini — dongle USB central** usa três controladoras nRF52840 compatíveis. As duas metades mantêm sua matriz e encoders; a terceira controladora, avulsa, funciona como receptor USB. O autor já testou o pareamento inicial e a digitação em um Sofle v2 com três controladoras nRF52840 compatíveis; outras combinações de hardware continuam sem validação. Compilar não comprova a compatibilidade da controladora, bootloader ou comunicação sem fio.

| Dispositivo | Papel | Firmware |
| --- | --- | --- |
| Dongle USB | Central: keymap, comportamentos e saída USB | `sofle-dongle.uf2` |
| Metade esquerda | Periférico Bluetooth | `sofle-dongle-left.uf2` |
| Metade direita | Periférico Bluetooth | `sofle-dongle-right.uf2` |
| Os três, apenas na migração | Limpar pareamento e configurações ZMK armazenadas | `sofle-settings-reset.uf2` |

É um receptor BLE do ZMK. Não adiciona compatibilidade com dongles proprietários de 2,4 GHz. A pinagem e o bootloader precisam ser compatíveis com nice!nano v2/SuperMini; o nome “Pro Micro” sozinho não garante isso. O receptor usa alimentação USB e não precisa de teclas, encoders, OLED ou fiação de matriz.

![Assistente de flash com Dongle USB, Esquerda e Direita na etapa obrigatória de limpeza](/images/z-mapflow-topology-reset-pt.png)

Exemplo da limpeza obrigatória ao mudar o central. A imagem usa a interface real com dados de compilação e fluxo simulados; nenhuma controladora física foi gravada.

Por padrão, as metades mostram bateria/status periférico local. A opção abaixo adiciona um módulo de firmware para transmitir o estado do central às duas metades; os widgets padrão do ZMK, sozinhos, não fazem esse envio.

## Outra controladora no dongle

Em Configurações, escolha **Dongle XIAO nRF52840 + metades nice!nano v2 / SuperMini** para usar um **Seeed Studio XIAO nRF52840** como receptor, mantendo as controladoras atuais das metades. O perfil atende ao XIAO nRF52840 original; não inclui XIAO RP2040, ESP32, variantes Plus ou placas arbitrárias de nome semelhante. O dongle não precisa de matriz ou OLED. A compilação foi validada; pareamento e flash dessa combinação ainda precisam de teste físico.

O receptor é compilado para `xiao_ble//zmk` e as metades para `nice_nano@2.0.0//zmk`. Cada dispositivo precisa do firmware e bootloader adequados. A mesma família UF2 não torna as placas intercambiáveis. O assistente seleciona `sofle-xiao-settings-reset.uf2` para limpar o XIAO e `sofle-settings-reset.uf2` para nice!nano/SuperMini; não envie todos os arquivos para todos os dispositivos.

Se a configuração instalada for desconhecida e houver um dongle retirado, informe sua controladora real na etapa de conexão do reset. O envio fica bloqueado até a identificação; selecionar a controladora não confirma nenhuma gravação. Informe substituições de controladora e gravações externas pela ação correspondente do assistente.

O [guia oficial do ZMK](https://zmk.dev/docs/hardware-integration/dongle) admite placas BLE suportadas. O XIAO é uma alternativa compacta com suporte no ZMK. Outros dongles precisam de perfis e protocolos de gravação verificados; o dongle USB nRF52840 da Nordic com bootloader de fábrica não é um volume UF2 genérico.

## Opções nativas do dongle

Em **Configurações → Teclado e firmware → Opções do dongle**:

- **Ler bateria das duas metades** ativa a leitura das baterias dos periféricos pelo central.
- **Informar baterias dos periféricos a hosts Bluetooth** ativa o serviço Bluetooth adicional e a leitura das baterias. Desativar a leitura também desativa o envio. Isso não adiciona bateria ao USB HID; o suporte a múltiplas baterias depende do host.
- **Intervalo da conexão Bluetooth entre as partes** oferece 7,5 ms (padrão), 15 ms e 30 ms. Intervalos maiores reduzem a frequência de eventos do rádio e aumentam o tempo de resposta. O app converte para unidades de 1,25 ms de `CONFIG_ZMK_SPLIT_BLE_PREF_INT`.

As opções ficam salvas como flags por alvo no projeto e no `build.yaml`. Recompile e grave o dongle ao alterá-las. São independentes da sincronização opcional de camada/conexão do OLED. A quantidade de perfis Bluetooth e o preset Studio USB também se aplicam ao central. Flags e snippets adicionais continuam disponíveis nos ajustes avançados; funções e quantidade de periféricos permanecem definidas pelo hardware. Veja [a configuração split do ZMK](https://zmk.dev/docs/config/split).

## Entrar no bootloader do dongle com um combo

Crie e expanda um combo, escolha duas posições deliberadas e selecione **Ação do combo → Comportamento → Entrar no bootloader (&bootloader)**. Não é necessário parâmetro. Salve, compile e grave esse keymap no dongle. Com ele conectado por USB e as metades funcionando, pressione o combo para abrir o bootloader UF2 **do dongle**; selecione esse dispositivo no assistente de flash.

Conforme a [documentação de reset do ZMK](https://zmk.dev/docs/keymaps/behaviors/reset#split-keyboards), uma tecla comum aciona a metade onde foi pressionada; um combo aciona o **central**, que nesse modo é o dongle. Em um teclado comum sem dongle, o combo aciona a metade central. A digitação para enquanto o dongle está no bootloader, até o firmware voltar a executar. Mantenha o RESET físico acessível para a primeira instalação ou recuperação quando não houver eventos do teclado.

## Primeira configuração

1. Exporte seu projeto como backup. Em **Configurações → Teclado e firmware → Variante de hardware**, escolha o perfil com dongle USB. Camadas, bindings, macros, combos e comportamentos permanecem no projeto. Se o preset Studio USB estava ativado, ele é movido ao novo central. Ajustes de alvos ausentes no perfil selecionado são removidos; os demais são preservados.
2. Ative ou desative **Display** conforme os OLEDs das metades. Os controles de display e repouso automático se aplicam às metades; o receptor não tem OLED/encoder local e permanece acordado. Os perfis Bluetooth reservam duas conexões/pareamentos adicionais para os periféricos.
3. Use **Salvar e compilar**. Os perfis atuais geram três firmwares de dispositivo e dois resets específicos por controladora. O assistente escolhe o reset adequado; não envie todos os arquivos para todos os dispositivos. Os papéis e os ajustes específicos do receptor são gerenciados pelo perfil; flags contraditórias por alvo são rejeitadas antes de salvar/compilar. O preset Studio USB se aplica ao dongle.
4. Abra **Gravar firmware**. No primeiro uso acompanhado, selecione a configuração **já instalada** (uma metade como central ao migrar do perfil comum) ou escolha **Não tenho certeza**. O assistente torna **1. Limpar todos os dispositivos** obrigatória antes de **2. Instalar firmware do teclado**. Para **cada** dispositivo — Dongle USB, Esquerda e Direita — conecte-o, pressione RESET duas vezes, selecione o volume UF2, revise e envie o firmware de reset. Aguarde o reinício, clique em **Controladora reiniciou — confirmar** e desconecte a controladora ou desligue a metade. Apenas enviar o arquivo não libera a próxima etapa. O reset apaga os vínculos Bluetooth e as configurações ZMK armazenadas, incluindo alterações do Studio; mantém o bootloader e o projeto salvo no Z-MapFlow. Confirmar envio/reinício não comprova que as configurações foram apagadas.
5. Selecione **Continuar com firmware do teclado**. Entre novamente no bootloader de cada dispositivo e grave o firmware correspondente: dongle, esquerda, direita. Mantenha o receptor conectado por USB, ligue ambas as metades e teste teclas, rotação e clique dos encoders. O volume UF2 não identifica a metade: selecione o dispositivo realmente conectado.

O reset nice!nano é compartilhado apenas entre controladoras nice!nano/SuperMini compatíveis. O XIAO exige seu próprio reset, mesmo usando a mesma família UF2 nRF52840. O assistente acompanha separadamente o progresso de reset e firmware. O envio sempre exige sua revisão e o botão **Enviar firmware**.

A controladora pode reiniciar antes de o sistema confirmar a última escrita. No reset, o assistente permite reconhecer o reinício sem declarar o teclado funcional. Entre novamente no bootloader e instale o firmware do teclado antes de testar teclas. Consulte [avisos na última escrita](./firmware#reinicializacao-e-avisos-de-gravacao-final).

## Girar o OLED de uma metade em 180°

Com um perfil de dongle USB selecionado, abra **Configurações → Teclado e firmware → Opções do dongle → Orientação do OLED**. Ative **Girar OLED Direita em 180°** para virar a tela direita na sua direção. Esquerda e direita são independentes e começam desativadas. **Display** deve estar habilitado para alterar esses controles.

Salve, recompile e grave a metade escolhida. Alterar somente a orientação **não** exige limpar o pareamento nem gravar o dongle. A opção é salva no projeto e na configuração de build exportada, e funciona com a sincronização ligada ou desligada. O layout horizontal, as cores, os tamanhos das fontes e as informações são preservados. Este perfil oferece 0° e 180°; não há layout vertical de 90°/270° nesta implementação.

O overlay SSD1306 do Sofle inverte as duas direções de varredura do hardware somente no alvo escolhido, pelas propriedades de segment-remap e direção COM. Veja o [binding SSD1306 da versão Zephyr usada](https://github.com/zephyrproject-rtos/zephyr/blob/v4.1.0/dts/bindings/display/solomon,ssd1306fb.yaml). Não há rotação dos pixels por software.

## Sincronização opcional de camada e conexão

Em **Configurações → Teclado e firmware**, ative **Sincronizar camada e conexão com as metades**. A opção inicia **desativada**, é salva no projeto e aparece apenas nos perfis compatíveis. Alterá-la preserva o keymap. Selecionar um perfil incompatível a desativa. A importação/exportação da configuração Z-MapFlow preserva esse ajuste.

- **Desativada:** transmissor, serviço receptor e tela sincronizada não são compilados. As metades mantêm o status local normal.
- **Ativada:** o dongle envia índice/nome da camada ativa, perfil Bluetooth selecionado e a **saída efetivamente selecionada**, incluindo fallback USB/BLE do ZMK. Alimentação USB sozinha não significa saída USB ativa.
- Com **Display** ativado, cada metade segue a aparência da tela padrão do ZMK: conexão no alto à esquerda, bateria local à direita e camada ativa com símbolo de teclado abaixo. A tela herda o tema monocromático e a inversão configurada no ZMK, com fontes padrão Montserrat 16 para o status e Montserrat 12 para a camada. A saída USB usa o símbolo USB; Bluetooth mostra o número do perfil e símbolos de conectado, desconectado ou sem pareamento. A bateria mostra o símbolo de carga quando a metade recebe alimentação USB. Uma camada sem nome mostra seu índice; nomes maiores rolam dentro da largura da tela. Os nomes continuam limitados a 14 bytes UTF-8 e os caracteres disponíveis dependem das fontes selecionadas no firmware.
- Sem Display, a sincronização continua disponível, mas nenhuma tela OLED é compilada.

Após alterar a opção, **salve, recompile e grave o dongle e ambas as metades**. A sincronização é feita pelo firmware e funciona sem manter o Z-MapFlow aberto. Os três dispositivos operacionais precisam de firmware compatível. A opção é compilada, sem alteração instantânea por USB. Depois de alinhar o ajuste nos três dispositivos, mudanças comuns de keymap normalmente continuam exigindo apenas gravar o dongle.

O estado é enviado nas alterações, depois de conexão/criptografia/descoberta e em uma pequena confirmação de 20 bytes a cada cinco segundos. O módulo não transmite keycodes, WPM nem um fluxo contínuo de digitação. Utiliza os vínculos BLE pareados e criptografados existentes, sem outro pareamento. Confirmações sem mudanças não redesenham o OLED. O comportamento normal de inatividade/repouso das telas é mantido; essas confirmações não contam como atividade de teclas.

O receptor invalida o estado exibido quando reconhece a desconexão ou passa 15 segundos sem uma atualização válida. `Waiting for dongle` e um símbolo de desconexão indicam dados indisponíveis. Ao reconectar, recebe um estado inicial mesmo se a camada não mudou. Assim, informações antigas não são apresentadas como atuais. O autor já testou a limpeza, gravação, conexão de ambas as metades e digitação com três controladoras nRF52840 compatíveis. Testes prolongados de reconexão/repouso e a aparência atualizada da tela ainda precisam de validação física.

Atualizar apenas a aparência dessa tela exige recompilar e gravar ambas as metades, sem outra limpeza de pareamento nem atualização do dongle. Alterar a opção de sincronização em si continua exigindo firmwares compatíveis nos três dispositivos.

Com a sincronização ativada, **Display** e a opção de sincronização também gerenciam a seleção de tela e os widgets padrão no firmware gerado. Flags antigas preservadas em um JSON/`.conf` importado são normalizadas durante a geração, sem apagar os ajustes avançados originais. Overrides conflitantes por alvo são rejeitados antes da compilação; a mesma seleção de tela vale para os arquivos exportados.

A tela sincronizada reserva 8192 bytes de memória LVGL nas metades. O padrão de 2048 bytes herdado por uma tela personalizada é insuficiente para inicializar; valores explicitamente menores são rejeitados na compilação do módulo. Essa correção altera a memória da tela, sem mudar o protocolo de pareamento ou o bootloader.

O controle gerencia `CONFIG_ZMAPFLOW_STATUS_SYNC`; use essa opção em vez de overrides contraditórios no `.conf` ou por alvo. A primeira mudança de topologia continua usando o reset descrito acima. Se firmwares anteriormente pareados não reconectarem depois de atualizar os três dispositivos, utilize o procedimento de reset/regravação.

## Migração obrigatória e retomada

O app acompanha o fluxo de flash localmente por plugin de teclado, separado do layout salvo e das compilações. Trocar o perfil ou importar um JSON não significa que uma controladora foi gravada. A pergunta inicial é necessária porque o volume UF2 não informa os papéis instalados. Selecione a configuração que está realmente instalada; **Não tenho certeza** exige a limpeza completa.

Quando o central muda, a etapa de firmware final fica bloqueada até todos os dispositivos listados receberem o reset e seus reinícios serem confirmados. O backend aplica o mesmo bloqueio para chamadas diretas e compilações do histórico. Cópias incompletas ou com falha não contam. Um aviso na escrita final permite confirmar após observar o reinício; isso não verifica, por si só, configurações apagadas ou funcionamento do teclado.

Fechar/reabrir o assistente ou o app mantém as confirmações de limpeza e uma confirmação pendente do último envio. Recompilar para a mesma organização mantém as limpezas concluídas e zera o progresso de firmware da nova compilação. Uma migração parcialmente gravada não pode ser pulada importando um backup ou selecionando uma compilação antiga. Compilações antigas sem firmware de limpeza pedem recompilação quando o reset ainda é necessário. Nenhum arquivo é enviado automaticamente.

Após um flash manual/externo, troca de controladoras ou uso de outro teclado físico do mesmo modelo, use **Fiz flash fora do app ou troquei as controladoras** para invalidar o estado registrado e iniciar a limpeza guiada. O app não observa operações externas. O progresso local não acompanha o JSON exportado do projeto.

## Uso diário e retorno ao perfil anterior

Para alterações comuns no keymap, escolha **Firmware do teclado**, mantendo os pareamentos. Bindings, camadas e a maioria dos comportamentos são processados pelo central; depois da configuração inicial, normalmente basta gravar o receptor e fechar o assistente. Mudanças em hardware, energia, encoders ou compatibilidade de firmware exigem atualizar as metades afetadas. O app continua compilando todos os alvos declarados.

As duas metades periféricas não digitam diretamente no computador sem o dongle. Para voltar à configuração comum, selecione o perfil nice!nano/SuperMini original, siga a limpeza obrigatória do dongle e das duas metades e grave os firmwares normais esquerdo/direito. Após limpar o dongle retirado, desconecte-o; ele não recebe firmware normal de metade. O perfil comum atual gera resets para nice!nano e XIAO, incluindo o dongle XIAO retirado. O legado ZMK 0.3 gera apenas o reset nice!nano; para voltar de um dongle XIAO, passe primeiro pelo perfil comum atual antes de selecionar o legado. O perfil original continua sendo o padrão; o uso do dongle é explícito. Se o preset Studio USB estava ativado, ele volta ao central esquerdo. Refaça os pareamentos Bluetooth com o computador se necessário.

## Referências técnicas

Os arquivos ficam em `internal/devices/soflev2/dongle/`. O receptor utiliza varredura simulada e o mesmo transform/layout físico Sofle da revisão ZMK fixada, com dois sensores locais desativados que preservam os índices dos sensores periféricos. Cada metade ativa apenas seu encoder definido pelo upstream. Papéis, reset e flags por alvo pertencem ao plugin, sem condições específicas do Sofle no core.

Consulte o [guia oficial de dongle ZMK](https://zmk.dev/docs/hardware-integration/dongle) e os [papéis em teclados split](https://zmk.dev/docs/features/split-keyboards). Outras combinações de teclado/controladora precisam de perfis verificados.

O módulo opcional acompanha os arquivos exportados em `zmapflow-status/` e `zephyr/module.yml`, sem outra dependência west ou fork ZMK. Fontes e simulações do protocolo/transporte ficam em `internal/zmkmodules/statussync`. Utiliza uma característica GATT criptografada e versionada, fila própria de transmissão, tentativas de descoberta/envio e cache coerente no receptor. É uma extensão experimental à revisão ZMK fixada, não um recurso do upstream.

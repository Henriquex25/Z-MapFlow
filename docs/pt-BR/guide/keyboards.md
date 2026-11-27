# Teclados compatíveis

**Confira esta tabela antes de baixar ou compilar.** Ela descreve os perfis implementados na revisão documentada aqui. Para um pacote baixado, confira o README da tag da release; uma versão anterior pode não incluir um perfil adicionado recentemente.

## Compatibilidade por teclado e configuração

| Teclado / configuração | Controladoras nas metades | Controladora do dongle | Ligação entre as partes | Validação |
| --- | --- | --- | --- | --- |
| Sofle v2 — duas metades | nice!nano v2 / SuperMini compatível | Sem dongle | Bluetooth | Testado no hardware SuperMini do autor |
| Sofle v2 — dongle nice!nano/SuperMini | nice!nano v2 / SuperMini compatível | nice!nano v2 / SuperMini compatível | Bluetooth | Pareamento inicial e digitação testados no setup do autor |
| Sofle v2 — dongle XIAO (experimental) | nice!nano v2 / SuperMini compatível | Seeed XIAO nRF52840 | Bluetooth | Compilação validada; teste físico pendente |
| Lily58 | nice!nano v2 / SuperMini compatível | Sem perfil de dongle incluído | Bluetooth | Compilação validada; teste físico pendente |
| Silakka54 Wireless — matriz compatível com Lily58 | nice!nano v2 / SuperMini compatível | Sem perfil de dongle incluído | Bluetooth | Compilação validada; teste físico pendente |
| Silakka54 Wired — port ZMK experimental | RP2040 Zero, fiação original | Sem dongle | UART full-duplex | Compilação validada; teste físico pendente |

**Testado no hardware** se refere à configuração específica Linux/Sofle do autor. Com dongle, inclui limpeza/gravação inicial, conexão de ambas as metades e digitação. Reconexão/repouso prolongados e a aparência atualizada do OLED ainda precisam de teste. Isso não representa validação física de todos os clones compatíveis.

**Compilação validada; teste físico pendente** indica que o firmware passou por compilação real no Docker e validação UF2, aguardando o teste de funcionamento naquela combinação. O perfil XIAO e o port Silakka54 com fio são experimentais.

Tamanho dos layouts: o Sofle v2 tem 58 switches e dois cliques de encoder, o Lily58 tem 58 switches e os dois perfis Silakka54 desenham 54 switches.

Selecione o teclado no cabeçalho e a variante exata em **Configurações**. Confira PCB, controladora, bootloader e fiação. Todos os perfis incluídos compilam **ZMK** e fazem flash por um volume de bootloader **UF2** montado.

## Controladoras e microcontroladores

| Placa controladora | Microcontrolador | Uso incluído no aplicativo |
| --- | --- | --- |
| nice!nano v2 | Nordic nRF52840 | Metades do Sofle v2, Lily58 e Silakka54 Wireless compatível com Lily58; dongle central do Sofle |
| SuperMini compatível com o perfil nice!nano v2 | Nordic nRF52840 | Os mesmos perfis, com pinagem e bootloader UF2 compatíveis; é a controladora usada no Sofle do autor |
| Seeed Studio XIAO nRF52840, modelo original | Nordic nRF52840 | **Somente dongle central do Sofle**, com nice!nano/SuperMini nas metades |
| RP2040 Zero | Raspberry Pi RP2040 | **Somente Silakka54 Wired**, com a fiação UART full-duplex documentada |

A família do microcontrolador não define um perfil de placa controladora. Um rótulo genérico “Pro Micro”, “nRF52840” ou “RP2040” não estabelece compatibilidade. O perfil de dongle XIAO não o torna uma substituição suportada para as controladoras das metades. Os perfis atuais não cobrem XIAO RP2040/ESP32/Plus, Pro Micro AVR ATmega32U4, Raspberry Pi Pico, outras placas RP2040 ou controladoras nRF52840 arbitrárias. Placas que exigem outro protocolo de gravação também precisam de suporte além do fluxo UF2 atual.

Nas configurações sem fio, o central pode usar USB até o computador enquanto as partes se comunicam por Bluetooth. No [Sofle com dongle USB](./dongle), ambas as metades são periféricas; use o perfil listado e o reset correspondente. O Sofle original com TRRS está fora dos perfis incluídos; veja [USB e cabo entre as metades](#sofle-usb-e-cabo-entre-as-metades).

Para uma combinação ainda não incluída, [solicite suporte](https://github.com/Henriquex25/Z-MapFlow/issues/new?template=keyboard.yml) ou [contribua com um plugin](../plugins). Importar um keymap usa o perfil selecionado, sem acrescentar compatibilidade de hardware.

## Lily58

O desenho segue o [layout físico oficial do ZMK](https://github.com/zmkfirmware/zmk/blob/4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85/app/dts/layouts/kata0510/lily58.dtsi), incluindo as duas teclas internas e os polegares de 1,5u inclinados. Os índices seguem o [matrix transform do shield](https://github.com/zmkfirmware/zmk/blob/4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85/app/boards/shields/lily58/lily58.dtsi).

O encoder esquerdo opcional usa os pinos Pro Micro 21/20 definidos pelo upstream. Os controles de rotação aparecem separados e não presumem uma tecla para o clique. Se o botão do encoder estiver ligado à matriz, configure a tecla física correspondente. O import aceita `.keymap` com 58 bindings, com ou sem `sensor-bindings`. Sem encoder instalado, os controles de rotação não têm efeito.

O shield aceita OLED SSD1306 opcional de 128×32 no endereço I²C `0x3c`. Desative **Display** se o teclado não tiver essa tela. Outros displays precisam de uma definição de hardware compatível.

## Silakka54 Wireless

O perfil cobre as montagens nRF52840/SuperMini com fiação compatível com Lily58 documentadas em [ickc/Silakka54-ZMK](https://github.com/ickc/Silakka54-ZMK) e [vandermey/silakka54-zmk-config](https://github.com/vandermey/silakka54-zmk-config). Usa os shields `lily58_left` e `lily58_right` do ZMK.

Essas configurações mantêm **58 posições de binding para 54 teclas físicas**. As posições `42`, `43`, `53` e `54` não têm switch: o editor as oculta, inicia com `&none` e preserva seus índices e bindings importados. A exportação continua usando `lily58.keymap` / `lily58.conf`. Não remova essas posições nem desloque os bindings seguintes.

Não há encoder declarado. O OLED opcional segue a especificação do shield Lily58; desative Display se não houver uma tela compatível. O desenho segue o escalonamento das colunas e os polegares inclinados do Silakka54 original. Confira o formato e a matriz da sua versão sem fio.

Camadas finais do Studio com `status = "reserved"` ou `"disabled"` são preservadas como código nativo. Reservas intercaladas são rejeitadas para evitar deslocar IDs de camada. Includes externos `.dtsi` precisam ser incorporados ao keymap antes da importação.

## Silakka54 Wired: port ZMK experimental

O [Silakka54 original](https://github.com/Squalius-cephalus/silakka54) utiliza QMK/VIAL. O Z-MapFlow fornece um port independente para **ZMK**, considerando o hardware documentado:

- Duas controladoras RP2040 Zero, matriz COL2ROW, linhas GP2–GP6 e colunas GP7–GP12.
- UART full-duplex entre as metades: GP0 TX / GP1 RX, conforme a [configuração original](https://github.com/Squalius-cephalus/silakka54/blob/main/firmware/config.h).
- USB conectado à metade **esquerda**, com a direita como periférico.

O [transporte split com fio do ZMK](https://zmk.dev/docs/features/split-keyboards) é destinado a testes iniciais. Este port é experimental até a validação no hardware. Ele substitui QMK/VIAL: **grave ambas as metades** com os respectivos arquivos ZMK. JSON, código-fonte e firmware QMK/VIAL não são importados como keymaps ZMK. Guarde seu firmware original caso queira restaurá-lo.

Desligue **ambas** as metades antes de conectar ou desconectar o cabo entre elas. Segure **BOOT** ao conectar uma metade por USB, aguarde **RPI-RP2** e selecione a metade correspondente no assistente. Reconecte as metades sem alimentação e só então ligue o USB à esquerda.

Esse perfil não oferece Bluetooth, OLED ou encoder. O repouso profundo do RP2040 não está disponível na configuração Zephyr fixada, portanto os ajustes de repouso ficam desabilitados. A geometria segue os centros dos switches e os ângulos dos polegares da PCB KiCad original; os 54 bindings correspondem à matriz.

## Contribuir com outra revisão

O app utiliza plugins, sem deduzir o hardware de um `.keymap` importado. Consulte [Criar plugins](../plugins) para geometria, transforms, variantes, compilação Docker e validação física.

## Sofle: USB e cabo entre as metades

O Sofle sem fio suportado pode usar **USB entre o central e o computador**, mantendo Bluetooth entre as metades. Também é assim no dongle USB. Se necessário, selecione a saída USB pela paleta.

O Sofle original com TRRS entre as metades não é um perfil incluído no Z-MapFlow. Muitas dessas montagens usam QMK/Vial. O transporte com fio da revisão ZMK usada exige UART full-duplex e uma definição de hardware compatível; ativar uma flag não converte o TRRS original do Sofle. Não foi adicionada conversão com fio do Sofle. Veja [os transportes split do ZMK](https://zmk.dev/docs/features/split-keyboards).

Além das três controladoras nice!nano/SuperMini, há um perfil experimental com **XIAO nRF52840 no dongle e nice!nano/SuperMini nas metades**. Consulte [a escolha da controladora e os resets adequados](./dongle).

O desenho dos polegares do Sofle segue o [PCB oficial v2](https://github.com/josefadamcik/SofleKeyboard/blob/master/Sofle_v2/PCB/SofleKeyboard.kicad_pcb), com teclas inclinadas e espelhadas e a tecla mais interna de cada metade alongada para 1,5u. O espaçamento do editor reserva espaço para os controles dos encoders; a geometria visual não altera a ordem dos bindings do firmware.

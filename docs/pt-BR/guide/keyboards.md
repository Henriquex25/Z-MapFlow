# Teclados compatíveis

Selecione o teclado no cabeçalho e a controladora em **Configurações**. Confira a PCB, a controladora e a fiação antes de compilar. Um gabinete parecido ou a mesma quantidade de teclas não garante compatibilidade de firmware.

| Teclado | Controladora e firmware | Teclas físicas | Compilação / flash |
| --- | --- | --- | --- |
| Sofle v2 | nice!nano v2 / SuperMini compatível, ZMK | 58 + 2 cliques de encoder | UF2 nRF52840 esquerdo e direito |
| Lily58 | nice!nano v2 / SuperMini compatível, ZMK | 58 | UF2 nRF52840 esquerdo e direito |
| Silakka54 Wireless | nRF52840 com matriz compatível com Lily58, ZMK | 54 | UF2 nRF52840 esquerdo e direito |
| Silakka54 Wired (experimental) | Fiação original RP2040 Zero, port ZMK | 54 | UF2 RP2040 esquerdo e direito |

Os novos perfis Lily58 e Silakka54 precisam ser validados nos respectivos teclados físicos. Compilar verifica a configuração do firmware, sem comprovar a fiação ou o funcionamento das teclas. AVR Pro Micro, conversões Lily58 com RP2040 e clones arbitrários do Silakka54 não estão cobertos por esses alvos.

O Sofle v2 também oferece um [perfil experimental com dongle USB central](./dongle) para três controladoras nRF52840 compatíveis com nice!nano v2. O perfil comum de duas metades continua sendo o padrão.

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

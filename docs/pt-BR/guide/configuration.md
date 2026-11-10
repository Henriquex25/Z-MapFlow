# Configuração ZMK e idiomas

## Importar uma configuração

Selecione o teclado/variante e abra seu `.keymap`. O aplicativo procura também o `.conf` de mesmo nome, headers `.h` locais e o `build.yaml` próximo. A geometria e ordem física das teclas vêm do plugin.

Camadas, encoders, macros e comportamentos são carregados. Ausência de configurações de encoder em uma camada preserva a herança. O importador não muda seu repositório original.

Includes locais `.dtsi`, condicionais e defines com parâmetros no próprio keymap exigem expansão prévia. Não há importação integral de qualquer repositório ZMK. A edição avançada preserva propriedades e subnós que não possuem formulário dedicado, sujeitos à validação do compilador.

## Flags e transportes

Na aba **Configurações**, ajuste as opções disponíveis e as flags Kconfig adicionais, por exemplo `CONFIG_ZMK_STUDIO=y`. O preset Studio USB configura o alvo central e o snippet necessário; revise a compatibilidade da sua controladora.

Snippets e argumentos CMake pertencem a cada alvo da matriz de compilação. O USB para digitação e o transporte USB do Studio são recursos distintos; use as opções apropriadas à revisão ZMK e ao hardware. Consulte a [documentação oficial ZMK](https://zmk.dev/docs) para dependências específicas.

## Outros idiomas

Importe ou crie headers locais, por exemplo `keys_pt_abnt2.h`, e adicione o include correspondente quando necessário. Os aliases definidos entram na aba **Idiomas** da paleta. Os arquivos acompanham a exportação e a geração do firmware.

O layout do sistema operacional também precisa corresponder aos códigos enviados pelo teclado. Alterar o idioma da paleta não converte bindings já atribuídos.

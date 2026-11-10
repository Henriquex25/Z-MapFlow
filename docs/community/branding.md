# Logo e ícones

Coloque a logo principal em **`build/appicon.png`**, substituindo a imagem padrão. Use PNG quadrado, preferencialmente **1024 × 1024 pixels**, com margem interna e transparência quando apropriado.

Esse arquivo é incorporado ao ícone da janela Linux e acompanha o instalador. O Wails também o usa como fonte para os ícones de outras plataformas quando os derivados não existem. Um build novo incorpora a imagem nova.

O repositório contém um `build/windows/icon.ico` padrão. Ao preparar um build Windows com outra logo, remova/regere esse derivado para impedir o uso do ícone antigo. Esse cuidado também vale para derivados `.icns` existentes no bundle macOS.

Se possuir um SVG original, preserve uma cópia em `assets/branding/logo.svg`; exporte a versão PNG para `build/appicon.png`. Não é necessário converter a logo com ferramentas de IA. A documentação pode reutilizar o SVG quando ele estiver disponível.

Só contribua com imagens que possam ser distribuídas junto ao projeto e registre os direitos de terceiros quando existirem.

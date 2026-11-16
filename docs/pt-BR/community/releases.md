# Publicar versões

## Preparação do repositório

O mantenedor deve habilitar **Settings → Pages → Source: GitHub Actions** e disponibilizar o repositório publicamente para que documentação, releases e consulta anônima sejam acessíveis à comunidade. O código de atualização não contém tokens. A alteração de visibilidade não é feita por nenhum script deste projeto.

Opcionalmente, configure proteção da branch principal exigindo o CI. Ative **Private vulnerability reporting** para receber relatos de segurança privados.

## Gerar um draft de release

1. Integre na `main` as mudanças que deseja distribuir.
2. Atualize o arquivo `VERSION` na raiz, por exemplo para `0.1.1`, faça commit e push para `main`.
3. Aguarde o workflow **CI** concluir com sucesso para esse commit exato, incluindo os jobs do app e da documentação.
4. Abra **GitHub → Actions → Build release draft → Run workflow**, selecione **main** e execute.
5. Aguarde a conclusão. O workflow valida a versão e o CI anterior, compila Linux e Windows x64, confere os checksums e cria uma release **draft** chamada `v0.1.1`, com todos os assets e notas geradas automaticamente.

O workflow precisa estar na branch padrão para o botão de execução manual aparecer. Veja as [instruções oficiais do GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

A execução é somente manual. Você não precisa criar nem enviar uma tag: o draft usa `v` seguido do conteúdo de `VERSION` e aponta para o commit selecionado ao iniciar o workflow, mesmo se a `main` avançar durante o build. O workflow nunca publica automaticamente.

Se o CI desse commit estiver em andamento ou tiver falhado, a geração para antes do build. Uma falha de compilação não cria release. Uma falha de upload pode deixar um draft incompleto: mantenha-o sem publicar e execute novamente após corrigir o problema. Uma nova execução pode atualizar os assets de um draft do mesmo commit, preservando título e notas. Drafts de outro commit são rejeitados; remova o draft anterior ou aumente `VERSION`. Releases já publicadas não podem ser sobrescritas pelo workflow.

## Revisar e publicar manualmente

1. Abra **GitHub → Releases** e edite o draft gerado.
2. Confira versão, título, descrição e os cinco assets abaixo. Baixe e teste o pacote de instalação antes de publicar. Resolva falhas de upload antes de publicar um draft incompleto.
3. Mantenha como versão estável, marque **Set as the latest release** e use **Publish release**.

Drafts e pré-releases ficam fora do atualizador. Depois da publicação como **Latest**, os apps consultam a versão ao iniciar e oferecem atualização quando ela é maior que a versão embutida. Um app que já está em `0.1.0` não oferece atualização para `0.1.0`; use uma versão superior para as próximas mudanças.

Não reutilize uma versão publicada nem mova sua tag. Para corrigir um pacote, publique uma versão nova. Esse fluxo aceita somente versões estáveis `MAJOR.MINOR.PATCH`.

## Assets

- `z-mapflow_VERSAO_linux_amd64.tar.gz`: instalação inicial, ícone, licença e script.
- `z-mapflow_linux_amd64`: executável usado pelo atualizador.
- `z-mapflow_VERSAO_windows_amd64_setup.exe`: instalador Windows por usuário, atalhos, bootstrapper WebView2 e licenças.
- `z-mapflow_windows_amd64.exe`: executável Windows usado pelo atualizador.
- `checksums.txt`: SHA-256 combinado dos quatro arquivos acima.

Os nomes fazem parte do contrato com o atualizador. O download é sempre do repositório fixo `Henriquex25/Z-MapFlow`. O aplicativo compara versão estável, sistema e arquitetura; revalida a release ao instalar e confere os bytes e executa o novo binário com `--version` antes da troca, verificando também dependências de runtime.

A versão anterior é preservada, e falhas de substituição/execução imediata fazem rollback. Isso não detecta automaticamente todos os problemas de funcionamento após a nova GUI iniciar; é necessário testar a release com o pacote instalado.

## Validação antes de anunciar

Baixe os assets do draft, instale num perfil temporário e confirme abertura, versão, importação, compilação e fluxo de atualização de uma versão anterior. As verificações de CI não confirmam o funcionamento físico no teclado. O CI inclui testes nativos do atualizador e instalação/desinstalação no Windows e disponibiliza um pacote temporário para testes. O workflow de release aguarda ambos os sistemas e verifica os dois manifests antes de criar o draft. Os executáveis Windows iniciais não têm assinatura digital; macOS e assinatura permanecem como trabalho futuro. A interface e o teclado físico no Windows ainda precisam de validação.

## Fonte única da versão

Altere apenas `VERSION` na raiz. A entrada do aplicativo incorpora esse arquivo; CLI, versão no cabeçalho, atualizador, metadados nativos e empacotamento leem esse valor. O workflow deriva a tag desse arquivo e deixa a publicação para revisão manual. Use `python3 scripts/wails.py build -tags webkit2_41` para gerar os metadados nativos a partir da versão central.

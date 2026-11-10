# Publicar versões

## Preparação do repositório

O mantenedor deve habilitar **Settings → Pages → Source: GitHub Actions** e disponibilizar o repositório publicamente para que documentação, releases e consulta anônima sejam acessíveis à comunidade. O código de atualização não contém tokens. A alteração de visibilidade não é feita por nenhum script deste projeto.

Opcionalmente, configure proteção da branch principal exigindo o CI. Ative **Private vulnerability reporting** para receber relatos de segurança privados.

## Fluxo

1. Integre as mudanças na branch principal e confira o CI.
2. Crie uma tag SemVer estável, por exemplo `v0.1.0`, no commit desejado e envie-a:

```sh
git tag v0.1.0
git push origin v0.1.0
```

O workflow `release.yml` executa o CI, compila o aplicativo Linux, injeta versão/commit, monta o pacote e os checksums e cria uma release em rascunho. Só publica depois que todos os assets foram enviados. Uma falha deixa o rascunho fora do atualizador.

Tags publicadas não devem ser reutilizadas. Para corrigir um pacote, publique uma versão nova. Pré-releases e versões com sufixos não são distribuídas por esse workflow inicial.

## Assets

- `z-mapflow_VERSAO_linux_amd64.tar.gz`: instalação inicial, ícone, licença e script.
- `z-mapflow_linux_amd64`: executável usado pelo atualizador.
- `checksums.txt`: SHA-256 de todos os assets acima.

Os nomes fazem parte do contrato com o atualizador. O download é sempre do repositório fixo `Henriquex25/Z-MapFlow`. O aplicativo compara versão estável, sistema e arquitetura; revalida a release ao instalar e confere os bytes e executa o novo binário com `--version` antes da troca, verificando também dependências de runtime.

A versão anterior é preservada, e falhas de substituição/execução imediata fazem rollback. Isso não detecta automaticamente todos os problemas de funcionamento após a nova GUI iniciar; é necessário testar a release com o pacote instalado.

## Validação antes de anunciar

Baixe a release publicada, instale num perfil temporário e confirme abertura, versão, importação, compilação e fluxo de atualização de uma versão anterior. As verificações de CI não confirmam o funcionamento físico no teclado. Não há assinatura de código de macOS/Windows nem distribuição oficial para esses sistemas nesta etapa.

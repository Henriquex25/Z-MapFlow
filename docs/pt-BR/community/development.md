# Desenvolvimento

## Ambiente

- Go conforme `go.mod`.
- Node 24 e npm; os lockfiles são versionados.
- Wails CLI na mesma versão do módulo Go (`v2.15.0` atualmente).
- Linux: GCC, `pkg-config`, GTK 3 e WebKitGTK 4.1 para a distribuição oficial.

```sh
sudo apt install build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
npm ci --prefix frontend
python3 scripts/wails.py dev -tags webkit2_41
```

Docker só é necessário para compilar firmware e executar a integração opt-in.

## Verificações

```sh
npm run format:check --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
go test -race -tags webkit2_41 ./...
go vet -tags webkit2_41 ./...
python3 scripts/wails.py build -tags webkit2_41
```

Quando alterar modelos ou métodos exportados, regenere a ponte Wails com `python3 scripts/wails.py generate module -tags webkit2_41`; não edite seus tipos manualmente. Preserve snapshots, IDs estáveis e o contrato entre core e plugins.

## Documentação

```sh
npm ci --prefix docs
npm run dev --prefix docs
npm run build --prefix docs
```

A documentação usa [VitePress](https://vitepress.dev/), busca local e conteúdo em Markdown. O workflow Pages publica somente a branch principal; PRs apenas validam o build. A configuração inclui o prefixo `/Z-MapFlow/` do GitHub Pages.

O catálogo de validação ZMK é compartilhado entre Go e TypeScript em `internal/zmkdata`. Atualizações são manuais e devem acompanhar testes dos códigos afetados.

## Integração com firmware

```sh
ZMAPFLOW_DOCKER_TEST=1 go test ./internal/firmware -run '^TestDockerIntegration$' -v -timeout 45m
```

Esse teste baixa dependências e compila os alvos; não faz flash. Nunca utilize um volume pessoal como destino de testes automatizados de gravação.

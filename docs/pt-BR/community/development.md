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

## Desenvolvimento e validação no Windows

Use Windows x64, Go conforme `go.mod`, Node 24, Wails na versão do módulo, Microsoft WebView2 e NSIS no PATH. Não use as tags WebKit do Linux:

```powershell
npm ci --prefix frontend
npm run build --prefix frontend
go test ./...
go vet ./...
python scripts/wails.py build -platform windows/amd64 -webview2 embed -nsis -installscope user -skipbindings -m -nosyncgomod
python scripts/package_windows.py
```

O job Windows do CI executa esses passos e testa instalação/desinstalação com `python scripts/windows_install_smoke.py` na conta temporária do runner. Esse teste confere payload, versão e licenças numa pasta com espaços e preserva a configuração. Não o execute em uma conta com o aplicativo já instalado. O teste do atualizador usa processos simulados, sem teclado físico.

No Linux, o mesmo comando Wails permite compilar o `.exe` e o instalador quando NSIS está instalado. O empacotador Windows precisa executar o `.exe` para conferir a versão e deve rodar no Windows. A compilação cruzada não valida WebView2, Docker Desktop ou o flash físico.

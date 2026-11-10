# Contribuir com o Z-MapFlow

Obrigado por ajudar a melhorar a edição de teclados ZMK. Contribuições de código, documentação, usabilidade e novos teclados são bem-vindas.

- [Guia da comunidade](docs/community/contributing.md)
- [Ambiente e verificações](docs/community/development.md)
- [Contrato de plugins](docs/plugins.md)
- [Publicação de versões](docs/community/releases.md)

Use os formulários de issues para bugs, sugestões e suporte a teclados. Antes de mudanças grandes, discuta a proposta em uma issue. PRs devem explicar o problema, a mudança e a validação feita, com imagens quando a interface mudar.

Leia `AGENT.md`. Mantenha regras de hardware nos plugins, snapshots imutáveis e compatibilidade de projetos salvos. Teste o comportamento relevante sem usar volumes/dispositivos reais em testes automatizados de flash.

Execute os testes pertinentes e atualize a documentação. Ao mudar os modelos Go ou a API Wails, regenere `frontend/wailsjs`. Nunca inclua credenciais nem arquivos pessoais.

O projeto é MIT. Suas contribuições são disponibilizadas sob a mesma licença. Preserve avisos de dependências e assets de terceiros. Respeito é obrigatório em issues, PRs e revisões; ataques pessoais, discriminação e assédio não são aceitos.

import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'pt-BR',
  title: 'Z-MapFlow',
  description: 'Configure seu teclado ZMK, compile o firmware e contribua com a comunidade.',
  base: '/Z-MapFlow/',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['zmk-audit.md', 'README.md'],
  head: [['meta', { name: 'theme-color', content: '#101115' }]],
  themeConfig: {
    nav: [{ text: 'Guia', link: '/guide/install' }, { text: 'Contribuir', link: '/community/contributing' }, { text: 'Releases', link: 'https://github.com/Henriquex25/Z-MapFlow/releases' }],
    sidebar: [
      { text: 'Usar o aplicativo', items: [
        { text: 'Instalação e atualização', link: '/guide/install' },
        { text: 'Primeiros passos', link: '/guide/getting-started' },
        { text: 'Configuração ZMK e idiomas', link: '/guide/configuration' },
        { text: 'Compilação e flash', link: '/guide/firmware' },
        { text: 'Problemas frequentes', link: '/guide/troubleshooting' },
      ]},
      { text: 'Comunidade', items: [
        { text: 'Como contribuir', link: '/community/contributing' },
        { text: 'Desenvolvimento', link: '/community/development' },
        { text: 'Criar plugins', link: '/plugins' },
        { text: 'Publicar versões', link: '/community/releases' },
        { text: 'Logo e ícones', link: '/community/branding' },
      ]},
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Henriquex25/Z-MapFlow' }],
    search: { provider: 'local' },
    editLink: { pattern: 'https://github.com/Henriquex25/Z-MapFlow/edit/main/docs/:path', text: 'Editar esta página' },
    outline: { label: 'Nesta página' },
    docFooter: { prev: 'Página anterior', next: 'Próxima página' },
    lastUpdated: { text: 'Atualizado em' },
    footer: { message: 'Distribuído sob a licença MIT.', copyright: 'Z-MapFlow e contribuidores' },
  },
})

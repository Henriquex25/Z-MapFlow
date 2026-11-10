import { defineConfig } from 'vitepress'

const repository = 'https://github.com/Henriquex25/Z-MapFlow'
const english = {
  nav: [{ text: 'Guide', link: '/guide/install' }, { text: 'Contribute', link: '/community/contributing' }, { text: 'Releases', link: `${repository}/releases` }],
  sidebar: [
    { text: 'Use the app', items: [
      { text: 'Installation and updates', link: '/guide/install' },
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'ZMK configuration and languages', link: '/guide/configuration' },
      { text: 'Build and flash firmware', link: '/guide/firmware' },
      { text: 'Troubleshooting', link: '/guide/troubleshooting' },
    ]},
    { text: 'Community', items: [
      { text: 'Contributing', link: '/community/contributing' },
      { text: 'Development', link: '/community/development' },
      { text: 'Create keyboard plugins', link: '/plugins' },
      { text: 'Publish releases', link: '/community/releases' },
      { text: 'Logo and icons', link: '/community/branding' },
    ]},
  ],
  editLink: { pattern: `${repository}/edit/main/docs/:path`, text: 'Edit this page' },
  footer: { message: 'Released under the MIT license.', copyright: 'Z-MapFlow contributors' },
}
const portuguese = {
  nav: [{ text: 'Guia', link: '/pt-BR/guide/install' }, { text: 'Contribuir', link: '/pt-BR/community/contributing' }, { text: 'Releases', link: `${repository}/releases` }],
  sidebar: [
    { text: 'Usar o aplicativo', items: [
      { text: 'Instalação e atualização', link: '/pt-BR/guide/install' },
      { text: 'Primeiros passos', link: '/pt-BR/guide/getting-started' },
      { text: 'Configuração ZMK e idiomas', link: '/pt-BR/guide/configuration' },
      { text: 'Compilação e flash', link: '/pt-BR/guide/firmware' },
      { text: 'Problemas frequentes', link: '/pt-BR/guide/troubleshooting' },
    ]},
    { text: 'Comunidade', items: [
      { text: 'Como contribuir', link: '/pt-BR/community/contributing' },
      { text: 'Desenvolvimento', link: '/pt-BR/community/development' },
      { text: 'Criar plugins', link: '/pt-BR/plugins' },
      { text: 'Publicar versões', link: '/pt-BR/community/releases' },
      { text: 'Logo e ícones', link: '/pt-BR/community/branding' },
    ]},
  ],
  editLink: { pattern: `${repository}/edit/main/docs/:path`, text: 'Editar esta página' },
  outline: { label: 'Nesta página' },
  docFooter: { prev: 'Página anterior', next: 'Próxima página' },
  lastUpdated: { text: 'Atualizado em' },
  footer: { message: 'Distribuído sob a licença MIT.', copyright: 'Z-MapFlow e contribuidores' },
}
export default defineConfig({
  lang: 'en-US', title: 'Z-MapFlow',
  description: 'Configure ZMK keyboards, build firmware and contribute keyboard plugins.',
  base: '/Z-MapFlow/', cleanUrls: true, lastUpdated: true,
  srcExclude: ['**/zmk-audit.md', '**/README.md'],
  head: [['meta', { name: 'theme-color', content: '#101115' }]],
  locales: {
    root: { label: 'English', lang: 'en-US', themeConfig: english },
    'pt-BR': { label: 'Português (Brasil)', lang: 'pt-BR', description: 'Configure teclados ZMK e contribua com plugins.', themeConfig: portuguese },
  },
  themeConfig: {
    socialLinks: [{ icon: 'github', link: repository }],
    search: { provider: 'local' },
  },
})

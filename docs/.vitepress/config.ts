import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'
import { haloDark, haloLight } from './shiki'

// Read the VS Code TextMate grammar for Halo
const haloGrammarPath = path.resolve(__dirname, '../../editors/vscode/syntaxes/halo.tmLanguage.json')
const haloGrammar = JSON.parse(fs.readFileSync(haloGrammarPath, 'utf-8'))

// Ensure the grammar name matches the markdown code block identifier (```halo)
haloGrammar.name = 'halo'

// A page per example, written by site/build.ts (bun site/build.ts --generate).
const examplesSidebarPath = path.resolve(__dirname, 'generated/examples-sidebar.json')
const examplesSidebar = fs.existsSync(examplesSidebarPath) ? JSON.parse(fs.readFileSync(examplesSidebarPath, 'utf-8')) : []
const version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')).version

export default defineConfig({
  title: "Halo",
  description: "A language for AI pipelines: agents, tools, and the policies the runtime enforces on every call.",
  cleanUrls: true,
  // Served next to the docs, but not pages: the installers, the package registry, release downloads.
  ignoreDeadLinks: [/^\/install\.(sh|ps1)$/, /^\/registry\//, /^\/dl\//],
  appearance: 'dark',
  lastUpdated: false,
  sitemap: { hostname: 'https://halolang.com' },
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#0d1016' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap' }],
    ['meta', { property: 'og:title', content: 'Halo · a language for AI pipelines' }],
    ['meta', { property: 'og:description', content: 'Agents, tools, and the policies the runtime enforces on every call. Plan a run before it starts; replay it after.' }],
    ['meta', { property: 'og:url', content: 'https://halolang.com/' }],
    ['meta', { property: 'og:image', content: 'https://halolang.com/video/halo-showcase.jpg' }],
    ['meta', { property: 'og:video', content: 'https://halolang.com/video/halo-showcase.mp4' }],
  ],
  markdown: {
    theme: {
      light: haloLight,
      dark: haloDark
    },
    languages: [
      haloGrammar
    ],
    // Halo templates look like Vue interpolation ({{name}}): keep inline code literal.
    config: (md) => {
      const render = md.renderer.rules.code_inline!
      md.renderer.rules.code_inline = (...args) => render(...args).replace(/^<code/, '<code v-pre')
    }
  },
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'halo',
    search: { provider: 'local' },
    nav: [
      { text: 'Guide', link: '/guide/quickstart', activeMatch: '^/(guide|dx|stdlib)/' },
      { text: 'Reference', link: '/guide/reference', activeMatch: '^/(reference/|spec|dictionary)' },
      { text: 'Examples', link: '/examples/', activeMatch: '^/examples/' },
      { text: 'Playground', link: '/playground' },
      { text: 'Packages', link: '/packages' },
      { text: `v${version}`, items: [{ text: 'Install', link: '/guide/quickstart#_1-install' }, { text: 'Upgrade: halo upgrade', link: '/reference/cli' }] },
    ],

    outline: { level: [2, 3] },
    footer: { message: 'curl -fsSL https://halolang.com/install.sh | sh' },

    sidebar: {
      // One group per section of examples/ (examples/catalog.ts), all but Learn collapsed.
      '/examples/': [{ text: 'All examples', link: '/examples/' }, ...examplesSidebar],
      '/': [
      {
        text: 'Introduction',
        items: [
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Core Concepts', link: '/guide/concepts' },
          { text: 'Language Overview', link: '/guide/reference' },
          { text: 'CLI', link: '/reference/cli' },
          { text: 'Using Halo as a Library', link: '/guide/sdk' },
        ]
      },
      {
        text: 'Language Reference',
        items: [
          { text: 'Types & Schemas', link: '/reference/types' },
          { text: 'Context & Scope', link: '/reference/context-and-scope' },
          { text: 'Pipe Operators', link: '/reference/operators' },
          { text: 'Directives', link: '/reference/compiler-directives' },
          { text: 'Tool Providers', link: '/reference/providers' },
        ]
      },
      {
        text: 'Standard Library',
        items: [
          { text: 'Built-in Tools', link: '/stdlib/tools' },
          { text: 'Chrome', link: '/stdlib/chrome' },
          { text: 'Local Tools', link: '/stdlib/local-tools' },
          { text: 'SQLite', link: '/stdlib/sqlite' },
          { text: 'Utility Tools', link: '/stdlib/utility-tools' },
          { text: 'Remote Computers', link: '/stdlib/remote' },
          { text: 'Agent Presets', link: '/stdlib/agent-presets' },
          { text: 'Skills', link: '/stdlib/skills' },
          { text: 'Policies', link: '/stdlib/policies' },
          { text: 'Stores', link: '/stdlib/stores' },
          { text: 'Embeddings', link: '/stdlib/embeddings' },
        ]
      },
      {
        text: 'Agents & Tools',
        items: [
          { text: 'Agents with Tools', link: '/guide/agents-with-tools' },
          { text: 'Tool Packages', link: '/guide/tool-packages' },
          { text: 'Package Registry', link: '/packages' },
          { text: 'Plan and Replay', link: '/guide/plan-and-replay' },
          { text: 'Thread State', link: '/guide/thread-state' },
        ]
      },
      {
        text: 'Architecture Patterns',
        items: [
          { text: 'Human-in-the-Loop', link: '/guide/architecture/human-in-the-loop' },
          { text: 'Multi-Agent Pipelines', link: '/guide/architecture/multi-agent-swarms' },
          { text: 'Guardrails & Safety', link: '/guide/architecture/guardrails-and-safety' },
        ]
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Custom Tools', link: '/guide/integrations/custom-tools' },
          { text: 'MCP', link: '/guide/integrations/mcp' },
          { text: 'Telemetry & Tracing', link: '/guide/integrations/telemetry-and-tracing' },
        ]
      },
      {
        text: 'Production',
        items: [
          { text: 'Serving pipelines', link: '/guide/production/serving' },
          { text: 'Deploying', link: '/guide/production/deploying' },
          { text: 'Blueprints', link: '/guide/production/blueprints' },
        ]
      },
      {
        text: 'Developer Experience (DX)',
        items: [
          { text: 'Testing & Mocks', link: '/dx/testing-and-mocks' },
          { text: 'Editor Support', link: '/dx/editor-support' },
        ]
      },
      {
        text: 'Design Specs',
        items: [
          { text: 'Language Spec', link: '/spec' },
          { text: 'Dictionary', link: '/dictionary' },
        ]
      }
    ]},

    socialLinks: [{ icon: 'github', link: 'https://github.com/cmjio/halo' }],
    editLink: { pattern: 'https://github.com/cmjio/halo/edit/main/docs/:path', text: 'Edit this page on GitHub' }
  }
})

import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

// Read the VS Code TextMate grammar for Halo
const haloGrammarPath = path.resolve(__dirname, '../../editors/vscode/syntaxes/halo.tmLanguage.json')
const haloGrammar = JSON.parse(fs.readFileSync(haloGrammarPath, 'utf-8'))

// Ensure the grammar name matches the markdown code block identifier (```halo)
haloGrammar.name = 'halo'

export default defineConfig({
  // The showcase site serves the docs under /docs/ (site/build.ts sets DOCS_BASE).
  base: process.env.DOCS_BASE || '/',
  title: "Halo",
  description: "A small language for AI workflows",
  markdown: {
    theme: {
      light: 'light-plus',
      dark: 'dark-plus'
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
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/quickstart' },
      { text: 'Agents & Tools', link: '/guide/agents-with-tools' },
      { text: 'Reference', link: '/guide/reference' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Core Concepts', link: '/guide/concepts' },
          { text: 'Language Overview', link: '/guide/reference' },
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
        ]
      },
      {
        text: 'Standard Library',
        items: [
          { text: 'Built-in Tools', link: '/stdlib/tools' },
          { text: 'Chrome', link: '/stdlib/chrome' },
          { text: 'Local Tools', link: '/stdlib/local-tools' },
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
          { text: 'Plan and Replay', link: '/guide/plan-and-replay' },
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
    ],

    socialLinks: []
  }
})

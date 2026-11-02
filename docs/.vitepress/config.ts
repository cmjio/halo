import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

// Read the VS Code TextMate grammar for Halo
const haloGrammarPath = path.resolve(__dirname, '../../editors/vscode/syntaxes/halo.tmLanguage.json')
const haloGrammar = JSON.parse(fs.readFileSync(haloGrammarPath, 'utf-8'))

// Ensure the grammar name matches the markdown code block identifier (```halo)
haloGrammar.name = 'halo'

export default defineConfig({
  title: "Halo",
  description: "Infrastructure as Code for AI Agents",
  markdown: {
    theme: {
      light: 'light-plus',
      dark: 'dark-plus'
    },
    languages: [
      haloGrammar
    ]
  },
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/quickstart' },
      { text: 'Reference', link: '/guide/reference' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Core Concepts', link: '/guide/concepts' },
        ]
      },
      {
        text: 'Language Reference',
        items: [
          { text: 'Types & Schemas', link: '/reference/types' },
          { text: 'Context & Scope', link: '/reference/context-and-scope' },
          { text: 'Pipe Operators', link: '/reference/operators' },
          { text: 'Compiler Directives', link: '/reference/compiler-directives' },
        ]
      },
      {
        text: 'Standard Library',
        items: [
          { text: 'Built-in Tools', link: '/stdlib/tools' },
          { text: 'Policies & Guardrails', link: '/stdlib/policies' },
          { text: 'Stores (Vector/DB)', link: '/stdlib/stores' },
        ]
      },
      {
        text: 'Architecture Patterns',
        items: [
          { text: 'Human-in-the-Loop', link: '/guide/architecture/human-in-the-loop' },
          { text: 'Multi-Agent Swarms', link: '/guide/architecture/multi-agent-swarms' },
          { text: 'Guardrails & Safety', link: '/guide/architecture/guardrails-and-safety' },
        ]
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Custom Tools', link: '/guide/integrations/custom-tools' },
          { text: 'Telemetry & Tracing', link: '/guide/integrations/telemetry-and-tracing' },
        ]
      },
      {
        text: 'Production Deployment',
        items: [
          { text: 'Deploying to Next.js', link: '/guide/production/deploy-nextjs' },
          { text: 'Deploying to Serverless', link: '/guide/production/deploy-serverless' },
        ]
      },
      {
        text: 'Developer Experience (DX)',
        items: [
          { text: 'Testing & TDD', link: '/dx/testing-and-mocks' },
          { text: 'Editor Support (LSP)', link: '/dx/editor-support' },
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

    socialLinks: [
      { icon: 'github', link: 'https://github.com/halo-lang/halo' }
    ]
  }
})

import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// Vercel preview deployments (and APP_SANDBOX=1 local builds) are test sandboxes: utils/sandbox.ts
const SANDBOX = process.env.VERCEL_ENV === "preview" || process.env.APP_SANDBOX === "1"

// a sandbox build has no Google Tag Manager (no analytics or conversions from tests)
function stripTagManagerInSandbox() {
  return {
    name: 'strip-gtm-in-sandbox',
    transformIndexHtml(html: string) {
      if (!SANDBOX) return html
      return html
        .replace(/<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/, '<!-- GTM omitted: sandbox build -->')
        .replace(/<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/, '')
    },
  }
}

export default defineConfig({
  // the commit of this build, shown next to the version (App.tsx)
  define: {
    __APP_SANDBOX__: JSON.stringify(SANDBOX),
    __APP_COMMIT__: JSON.stringify(String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_COMMIT || "local").slice(0, 7)),
  },
  plugins: [
    stripTagManagerInSandbox(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})

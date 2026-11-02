// Vite config — Public Rent a Car
// - htmlPartials(): lets index.html pull section partials with
//   `<!-- @include sections/hero.html -->` so parallel authors own separate files.
// - manualChunks: three / gsap / lenis get their own long-cacheable chunks.
// - {{DOBRACINA_NO}}: the Dobracina street number is not confirmed (brief 11.2). The token may appear in any HTML partial, JS
//   module or i18n JSON; it renders as process.env.DOBRACINA_NO ?? '' (empty), so setting the env var at build time fills every
//   occurrence at once. HTML via the partials step, JS/JSON via transform (dev + build), final chunks via renderChunk.
import { defineConfig } from 'vite'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'

const INCLUDE_RE = /<!--\s*@include\s+([^\s]+)\s*-->/g

function inlinePartials(html, baseDir, root, depth = 0) {
  if (depth > 5) throw new Error('[html-partials] include nesting deeper than 5')
  return html.replace(INCLUDE_RE, (_, rel) => {
    const file = resolve(baseDir, rel)
    if (!existsSync(file)) throw new Error(`[html-partials] include not found: ${rel} (resolved ${file})`)
    const content = readFileSync(file, 'utf8')
    const label = relative(root, file).replace(/\\/g, '/')
    return `<!-- begin ${label} -->\n${inlinePartials(content, dirname(file), root, depth + 1)}\n<!-- end ${label} -->`
  })
}

const DOBRACINA_NO = process.env.DOBRACINA_NO ?? ''
const fillNo = (code) => (code.includes('{{DOBRACINA_NO}}') ? code.replaceAll('{{DOBRACINA_NO}}', DOBRACINA_NO) : null)

function htmlPartials() {
  const root = process.cwd()
  return {
    name: 'prc-html-partials',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const full = inlinePartials(html, root, root)
        return fillNo(full) ?? full
      },
    },
    transform(code, id) {
      if (id.includes('node_modules') || !/\.(js|json|css)(\?|$)/.test(id)) return null
      const out = fillNo(code)
      return out === null ? null : { code: out, map: null }
    },
    renderChunk(code) {
      const out = fillNo(code)
      return out === null ? null : { code: out, map: null }
    },
    // dev server: editing a partial reloads the page
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.html') && /[\\/]sections[\\/]/.test(file)) {
        server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }
}

// Build-only HTML post-processing: strip authoring comments (CLIENT-CONFIRM notes, partial begin/end markers) from the served
// document and add a hero image preload derived from the cover <img> (same srcset/sizes, so no double download).
function htmlShip() {
  let isBuild = false
  return {
    name: 'prc-html-ship',
    configResolved(cfg) { isBuild = cfg.command === 'build' },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!isBuild) return html
        let out = html
        const m = out.match(/<img[^>]*class="cover__img"[^>]*>/)
        if (m) {
          const srcset = (m[0].match(/\ssrcset="([^"]+)"/) || [])[1]
          const sizes = (m[0].match(/\ssizes="([^"]+)"/) || [])[1]
          if (srcset) {
            const mobileSource = out.match(/<source[^>]*data-hero-mobile[^>]*>/)
            const mobileSrc = mobileSource && (mobileSource[0].match(/\ssrcset="([^"]+)"/) || [])[1]
            const tag = `<link rel="preload" as="image"${mobileSrc ? ' media="(min-width:701px)"' : ''} imagesrcset="${srcset}"${sizes ? ` imagesizes="${sizes}"` : ''} fetchpriority="high">` +
              (mobileSrc ? `\n<link rel="preload" as="image" media="(max-width:700px)" href="${mobileSrc}" fetchpriority="high">` : '')
            out = out.replace('</head>', `  ${tag}
</head>`)
          }
        }
        // SITE_URL: the public origin is not decided (docs/DECISIONS.md D-3); the stand-in origin is swapped at build time when it is set.
        const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '')
        if (/^https?:\/\/[^\s"<>]+$/.test(siteUrl)) out = out.replaceAll('https://publicrentacar.rs', siteUrl)
        // keep conditional comments (none today) and strip everything else
        return out.replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      },
    },
  }
}

// The clean public source snapshot carries its provenance at the root.
// Private builds without that file keep their existing output unchanged.
function publicSourceManifest() {
  let manifestFile
  return {
    name: 'prc-public-source-manifest',
    apply: 'build',
    configResolved(config) { manifestFile = resolve(config.root, 'public-source-manifest.json') },
    generateBundle() {
      if (existsSync(manifestFile)) this.emitFile({ type: 'asset', fileName: 'public-source-manifest.json', source: readFileSync(manifestFile) })
    },
  }
}

export default defineConfig({
  plugins: [htmlPartials(), htmlShip(), publicSourceManifest()],
  define: {
    __TERMS_PDF_URL__: JSON.stringify(process.env.TERMS_PDF_URL || ''),
  },
  server: { port: 5177, host: '127.0.0.1' },
  preview: { port: 4177, host: '127.0.0.1', strictPort: true },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    sourcemap: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/gsap')) return 'gsap'
          if (id.includes('node_modules/lenis')) return 'lenis'
        },
      },
    },
  },
})

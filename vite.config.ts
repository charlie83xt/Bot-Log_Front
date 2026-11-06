import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

// Fills %SITE_URL% in index.html at build time from SITE_URL or content/site.json, so link
// previews on X get an absolute image address.
function siteUrlPlugin(): Plugin {
  let site = process.env.SITE_URL || '';
  try {
    site ||= JSON.parse(fs.readFileSync(path.resolve(__dirname, 'content/site.json'), 'utf8')).site_url || '';
  } catch {}
  site = /^https:\/\/[^\s"'<>]+$/.test(site) ? site.replace(/\/+$/, '') : '';
  return {name: 'site-url', transformIndexHtml: (html) => (site ? html.replaceAll('%SITE_URL%', site) : html)};
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), siteUrlPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

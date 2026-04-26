import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from '@samrum/vite-plugin-web-extension'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: {
        manifest_version: 3,
        name: 'Sandman Focus',
        version: '1.0',
        permissions: ['storage', 'activeTab', 'scripting', 'notifications', 'tabs', 'alarms', 'idle', 'identity'],
        host_permissions: ['<all_urls>'],
        action: {
          default_popup: 'index.html',
          default_title: 'Sandman'
        },
        background: {
          scripts: ['src/background/index.ts'],
          type: 'module'
        },
        content_scripts: [
          {
            matches: ['<all_urls>'],
            js: ['src/content/index.ts']
          }
        ],
        web_accessible_resources: [
          {
            resources: ['auth.html', 'audio/start.mp3', 'audio/end.mp3'],
            matches: ['<all_urls>']
          }
        ],
        browser_specific_settings: {
          gecko: {
            id: 'sandman@example.com'
          },
          chrome: {
            permissions: ['offscreen']
          }
        }
      }
    })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        auth: 'auth.html',
        offscreen: 'offscreen.html'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})

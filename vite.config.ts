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
        permissions: ['storage', 'activeTab', 'scripting', 'notifications', 'tabs', 'alarms'],
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
        browser_specific_settings: {
          gecko: {
            id: 'sandman@example.com'
          }
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})

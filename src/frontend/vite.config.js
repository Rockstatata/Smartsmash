import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { networkInterfaces } from 'node:os'

function getDefaultProxyTarget() {
  const interfaces = networkInterfaces()

  for (const entries of Object.values(interfaces)) {
    if (!entries) {
      continue
    }

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return `http://${entry.address}:8000`
      }
    }
  }

  return 'http://127.0.0.1:8000'
}

const proxyTarget = process.env.VITE_DEV_PROXY_TARGET || getDefaultProxyTarget()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})

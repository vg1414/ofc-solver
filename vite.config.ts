import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// base: GitHub Pages serverar appen under /ofc-solver/ — lokalt körs den på /
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ofc-solver/' : '/',
  plugins: [react(), tailwindcss()],
}))

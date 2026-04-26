import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use the repo name as the base path when building for GitHub Pages
  base: process.env.NODE_ENV === 'production' ? '/The-Darklands-Dungeons/' : '/',
})

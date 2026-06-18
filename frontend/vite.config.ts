import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@context': path.resolve(__dirname, './src/context'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  build: {
    sourcemap: false, // No source map exposure in production
    chunkSizeWarningLimit: 600, // Suppress warnings for reasonably sized chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — rarely changes, cached long-term by CloudFront
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Form libraries — changes with feature work
          forms: ['react-hook-form', '@hookform/resolvers', 'yup'],
          // Utilities — changes occasionally
          utils: ['axios', 'date-fns', 'react-hot-toast'],
        },
      },
    },
  },
})

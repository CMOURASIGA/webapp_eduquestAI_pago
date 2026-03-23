import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Injeta as variáveis do Vercel no bundle do navegador
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env.SPECIAL_STUDENT_NAME': JSON.stringify(process.env.SPECIAL_STUDENT_NAME),
    'process.env.SPECIAL_PROFESSOR_NAME': JSON.stringify(process.env.SPECIAL_PROFESSOR_NAME)
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    // Aumenta o limite para 1600kb para silenciar o aviso do SDK do Gemini
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          gemini: ['@google/genai']
        }
      }
    }
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.VITE_API_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // lets you open the app from your phone on the same Wi-Fi
    port: 5173,
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
});

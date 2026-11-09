import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], server: { host: '0.0.0.0', port: 8080, proxy: { '/api/posts': { target: 'http://post-service:8000', rewrite: p => p.replace(/^\/api/, '') }, '/api/auth': { target: 'http://post-service:8000', rewrite: p => p.replace(/^\/api/, '') }, '/api/media': { target: 'http://media-service:8001', rewrite: p => p.replace(/^\/api/, '') } } } });

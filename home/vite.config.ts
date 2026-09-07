import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  if (mode === 'android-production') {
    const apiBaseUrl = (env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
    if (!/^https:\/\/[^\s/]+(?:\/.*)?$/i.test(apiBaseUrl) || /localhost|127\.0\.0\.1/i.test(apiBaseUrl)) {
      throw new Error('ANDROID_PRODUCTION_BUILD_REQUIRES_REAL_HTTPS_VITE_API_BASE_URL');
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'motion',
        'lucide-react',
        '@capacitor/app',
        '@capacitor/core',
        '@capacitor-community/bluetooth-le',
        'pdfkit',
      ],
      alias: {
        '@': path.resolve(__dirname, '.'),
        'pdfkit-browser-entry': path.resolve(__dirname, 'node_modules/pdfkit/js/pdfkit.browser.js'),
      },
    },
    server: {
      port: 3000,
      fs: { allow: [path.resolve(__dirname, '..')] },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR === 'true' ? false : { port: 24680 },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

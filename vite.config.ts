import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Keep the unfinished restaurant available in Vite dev/test servers only.
  define: {
    __SUSHI_GAME_ENABLED__: JSON.stringify(command === 'serve'),
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
}));

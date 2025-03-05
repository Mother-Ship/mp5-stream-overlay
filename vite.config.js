import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                site1: 'MP5_BAN_PICK/index.html',
                site2: 'MP5_PLAYING/index.html',
                site3: 'MP5_SHOWCASE_INFO/index.html',
                site4: 'MP5_SHOWCASE_PLAYING/index.html'
            },
            output: {
                dir: 'dist',
                format: 'es',
                entryFileNames: '[name]/bundle.js',
                chunkFileNames: '[name]/[name]-[hash].js',
                assetFileNames: '[name]/[name]-[hash][extname]'
            }
        }
    }
});
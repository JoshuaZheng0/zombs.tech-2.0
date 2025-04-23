import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Set the root to the client directory
  root: path.resolve(__dirname, 'src/client'),
  // Adjust the base URL if needed, usually '/' is fine
  base: '/',
  // Configure the server options
  server: {
    // Proxy API requests to your backend server during development if needed
    // proxy: {
    //   '/api': 'http://localhost:3000', // Example proxy
    // },
    port: 5173, // Default Vite port
    open: true, // Automatically open in browser
  },
  // Configure the build process
  build: {
    // Output directory relative to the project root
    outDir: path.resolve(__dirname, 'dist'),
    // Empty the output directory before building
    emptyOutDir: true,
    // Specify the entry point HTML file relative to the `root` option
    rollupOptions: {
      input: path.resolve(__dirname, 'src/client/index.html') // Point to client's index.html
    }
  },
  resolve: {
    alias: {
      // Set up aliases for easier importing
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
}); 
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

// Ensure valid standard PNG icons exist for Chrome/Android PWA criteria
function ensurePngIcon(filePath: string, width: number, height: number) {
  if (fs.existsSync(filePath)) return;
  const rowBytes = width * 4;
  const rawData = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const offset = y * (rowBytes + 1);
    rawData[offset] = 0;
    for (let x = 0; x < width; x++) {
      const p = offset + 1 + x * 4;
      rawData[p] = 19;     // R (#135D43)
      rawData[p + 1] = 93; // G
      rawData[p + 2] = 67; // B
      rawData[p + 3] = 255;// A
    }
  }

  function crc32(buf: Buffer): number {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    return (crc ^ -1) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.concat([typeBuf, data]);
    const crcOut = Buffer.alloc(4);
    crcOut.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, typeBuf, data, crcOut]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', zlib.deflateSync(rawData));
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]));
}

const publicDir = path.resolve(__dirname, 'public');
try {
  ensurePngIcon(path.join(publicDir, 'pwa-192x192.png'), 192, 192);
  ensurePngIcon(path.join(publicDir, 'pwa-512x512.png'), 512, 512);

  const imagesDir = path.join(publicDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const macbookSrc = 'C:/Users/milan/.gemini/antigravity/brain/11a18f4a-8ae0-44da-abc3-95c93277f714/.user_uploaded/media_1793786296691_3a0ddd58.png';
  if (fs.existsSync(macbookSrc) && !fs.existsSync(path.join(imagesDir, 'macbook-frame.png'))) {
    fs.copyFileSync(macbookSrc, path.join(imagesDir, 'macbook-frame.png'));
  }
} catch (e: any) {
  console.warn('Icon/mockup auto-generation notice:', e);
}

// https://vitejs.dev/config/
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: [
        'favicon.ico',
        'masked-icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-192x192.svg',
        'pwa-512x512.svg',
      ],
      manifest: {
        name: 'ANIVERA — Digital Animal Health Platform',
        short_name: 'ANIVERA',
        description: 'ANIVERA Livestock Vaccination Tracking & Disease Surveillance PWA',
        theme_color: '#135D43',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days offline
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  }
});

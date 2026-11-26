import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

// Distance from point to line segment utility for crisp geometric icon rendering
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Ensure valid standard PNG icons exist with ANIVERA emerald & monogram branding
function ensurePngIcon(filePath: string, width: number, height: number, force = true) {
  if (fs.existsSync(filePath) && !force) return;
  const rowBytes = width * 4;
  const rawData = Buffer.alloc((rowBytes + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const innerR = width * 0.333;
  const dotX = width * 0.72;
  const dotY = height * 0.28;
  const dotR = width * 0.043;
  const s = width / 192;
  const strokeW = Math.max(2, 9 * s);

  // Letter A stroke coordinates
  const aApexX = 70 * s, aApexY = 66 * s;
  const aLeftX = 46 * s, aLeftY = 126 * s;
  const aRightX = 94 * s, aRightY = 126 * s;
  const aBarLeftX = 57 * s, aBarLeftY = 104 * s;
  const aBarRightX = 83 * s, aBarRightY = 104 * s;

  // Letter V stroke coordinates
  const vLeftX = 102 * s, vLeftY = 66 * s;
  const vApexX = 125 * s, vApexY = 126 * s;
  const vRightX = 148 * s, vRightY = 66 * s;

  for (let y = 0; y < height; y++) {
    const offset = y * (rowBytes + 1);
    rawData[offset] = 0;
    for (let x = 0; x < width; x++) {
      const p = offset + 1 + x * 4;

      // Base background: #135D43
      let r = 19, g = 93, b = 67, a = 255;

      // Inner circle: #0F4C37
      const dCenter = Math.hypot(x - cx, y - cy);
      if (dCenter <= innerR) {
        r = 15; g = 76; b = 55;
      }

      // Notification dot: #10B981
      const dDot = Math.hypot(x - dotX, y - dotY);
      if (dDot <= dotR) {
        r = 16; g = 185; b = 129;
      }

      // Letter A strokes
      const dA1 = distToSegment(x, y, aLeftX, aLeftY, aApexX, aApexY);
      const dA2 = distToSegment(x, y, aRightX, aRightY, aApexX, aApexY);
      const dABar = distToSegment(x, y, aBarLeftX, aBarLeftY, aBarRightX, aBarRightY);

      // Letter V strokes
      const dV1 = distToSegment(x, y, vLeftX, vLeftY, vApexX, vApexY);
      const dV2 = distToSegment(x, y, vRightX, vRightY, vApexX, vApexY);

      if (Math.min(dA1, dA2, dABar, dV1, dV2) <= strokeW / 2) {
        r = 255; g = 255; b = 255; // White monogram
      }

      rawData[p] = r;
      rawData[p + 1] = g;
      rawData[p + 2] = b;
      rawData[p + 3] = a;
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
  ensurePngIcon(path.join(publicDir, 'pwa-192x192.png'), 192, 192, true);
  ensurePngIcon(path.join(publicDir, 'pwa-512x512.png'), 512, 512, true);

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
        'manifest.webmanifest',
      ],
      manifest: {
        name: 'ANIVERA — Digital Animal Health Platform',
        short_name: 'ANIVERA',
        description: 'ANIVERA Livestock Vaccination Tracking & Disease Surveillance Platform (ડિજિટલ પશુ સ્વાસ્થ્ય અને રસીકરણ પ્રણાલી)',
        theme_color: '#135D43',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['productivity', 'utilities', 'government'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/masked-icon.svg',
            sizes: '100x100',
            type: 'image/svg+xml',
            purpose: 'maskable'
          },
          {
            src: '/favicon.ico',
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
            // Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            // Google Fonts webfont files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            // Static GeoJSON maps in /data/
            urlPattern: /\/data\/.*\.geojson$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'geojson-boundaries-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
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

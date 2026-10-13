import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';

const hashWasmVersion = JSON.parse(
  readFileSync(new URL('./node_modules/hash-wasm/package.json', import.meta.url), 'utf8'),
).version as string;

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_HASH_WASM_VERSION: hashWasmVersion,
  },
};

export default nextConfig;

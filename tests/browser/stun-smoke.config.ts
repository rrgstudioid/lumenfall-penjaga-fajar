import { mergeConfig, defineConfig } from 'vite';
import base from './vite.config';
export default mergeConfig(base,defineConfig({cacheDir:'../../node_modules/.vite-stun-smoke',server:{port:3004,host:'127.0.0.1',strictPort:true,hmr:false}}));

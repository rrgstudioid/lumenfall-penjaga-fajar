import {mergeConfig} from 'vite';
import base from './kingdom-city-kit.vite.config';
export default mergeConfig(base,{server:{port:3006,strictPort:true},build:{copyPublicDir:false,outDir:'dev-assets/kingdom-city-pilot-a3/viewer-build',emptyOutDir:false,rollupOptions:{input:'tests/browser/kingdom-pilot.html'}}});

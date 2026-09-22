import { mergeConfig } from 'vite';
import base from './vite.config';
import { fileURLToPath } from 'node:url';
export default mergeConfig(base,{publicDir:fileURLToPath(new URL('../../public',import.meta.url)),server:{port:3004,strictPort:true}});

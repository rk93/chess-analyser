import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['scripts/lit-entry.js'],bundle:true,format:'esm',minify:true,target:'es2020',legalComments:'inline',write:false});
const output=result.outputFiles[0].text,path='js/vendor/lit.js';
if(process.argv.includes('--check')){
  if(await readFile(path,'utf8')!==output)throw Error('The committed Lit bundle is stale. Run npm run build:ui.');
}else{await mkdir('js/vendor',{recursive:true});await writeFile(path,output)}

// Legacy entry points use the shared import controller; no competing importer.
import {syncPersonal} from './game-import.js';
function bind(){const button=document.getElementById('sync');if(!button)return;button.addEventListener('click',()=>void syncPersonal({username:document.getElementById('user')?.value,range:document.getElementById('importRange')?.value||'month'}));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();

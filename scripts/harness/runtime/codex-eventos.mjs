import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function reciboEventos(texto) {
  const ids = new Set();
  let tokens = null;
  for (const linha of texto.split('\n')) {
    let v; try { v=JSON.parse(linha); } catch { continue; }
    if (v.type === 'thread.started' && typeof v.thread_id === 'string') ids.add(v.thread_id);
    if (v.type === 'turn.completed' && v.usage &&
        Number.isFinite(v.usage.input_tokens) && Number.isFinite(v.usage.output_tokens)) {
      tokens = (tokens || 0) + v.usage.input_tokens + v.usage.output_tokens;
    }
  }
  // A process exposing multiple thread starts does not identify one trial.
  return {session_id:ids.size === 1 ? [...ids][0] : null,tokens:ids.size===1 ? tokens : null};
}

export function confirmarModelo(root, id, modelo, effort) {
  if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) return false;
  for (let i=0;i<2;i++) {
    const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10).replaceAll('-','/');
    let nomes;try{nomes=readdirSync(join(root,d));}catch{continue;}
    for(const nome of nomes.filter(n=>n.endsWith(`${id}.jsonl`))) {
      const registros=readFileSync(join(root,d,nome),'utf8').split('\n').flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}});
      const meta=registros.find(r=>r.type==='session_meta')?.payload;
      if((meta?.id || meta?.session_id)!==id)continue;
      const contextos=registros.filter(r=>r.type==='turn_context').map(r=>r.payload);
      return contextos.length>0 && contextos.every(c=>c.model===modelo && c.effort===effort);
    }
  }
  return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (process.argv[2] === 'confirmar') console.log(confirmarModelo(...process.argv.slice(3))?'true':'false');
  else if (process.argv[2] === 'recibo') console.log(JSON.stringify(reciboEventos(readFileSync(process.argv[3],'utf8'))));
  else {
    const linhas=createInterface({input:process.stdin});
    for await (const line of linhas) {
      if (process.argv[3] === '1') { console.log(line); continue; }
      try {
        const v=JSON.parse(line);
        if (v.type==='item.completed' && v.item?.type==='agent_message') console.log(v.item.text);
      } catch { console.log(line); }
    }
  }
}

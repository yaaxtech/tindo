import test from 'node:test';
import assert from 'node:assert/strict';
import { extrairArena } from './arena-benchmark.mjs';
test('reads Arena score and million-output-token units, preserving missing data',()=>{
 const value={snapshot:{rows:[{contenderName:'x',model:'Example (Max)',modelOrganization:'Example',avgScore:{value:0.1,ci:0.02},sessions:10}]},costStats:{entries:[{contenderName:'x',outputMtokPerTask:{medianMtok:0.05,tokenedSampleCount:9}}]}};
 const flight='1:'+JSON.stringify(value)+'\n';
 const html='<script>self.__next_f.push([1,'+JSON.stringify(flight)+'])</script>';
 const result=extrairArena(html,'2026-09-15T00:00:00Z');
 assert.equal(result.modelos[0].output_tokens_mediana,50000);
 assert.equal(result.modelos[0].amostra_tokens,9);
 assert.throws(()=>extrairArena('<html>schema changed</html>'),/mudou o formato/);
});

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const sample = read('test/fixtures/confidence-human-sample.json');
const calibration = read('test/fixtures/confidence-calibration.json');
const holdout = read('test/fixtures/confidence-holdout.json');
const byId = new Map([...calibration.cases, ...holdout.cases].map((item) => [item.id, item]));
const cases = sample.cases.map((item) => ({
  id: item.caseId,
  partition: item.partition,
  scenario: byId.get(item.caseId)?.scenario || '',
  matrix: byId.get(item.caseId)?.matrix || {},
}));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Module 2 Confidence Review</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17211d;background:#f5f6f3;line-height:1.45}*{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #d9ddd8;padding:14px 20px}main{max-width:980px;margin:auto;padding:28px 20px 80px}h1{font-size:20px;margin:0 0 4px}h2{font-size:18px;margin:0 0 8px}h3{font-size:14px;margin:20px 0 6px}p{margin:4px 0 12px}.case{background:#fff;border:1px solid #d9ddd8;border-radius:6px;padding:22px;margin:0 0 18px}.meta{font-size:12px;color:#5b665f}.selected{background:#eef5ef;padding:10px 12px;border-left:4px solid #3d6f50}.alternatives{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.alternative{border:1px solid #dde1dc;padding:12px;border-radius:4px}.alternative strong{display:block;margin-bottom:6px}.small{font-size:12px;color:#47524b}.bands{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 10px}.bands label{border:1px solid #aeb7b0;border-radius:4px;padding:8px 12px;background:#fff;cursor:pointer}.bands label:has(input:checked){background:#17211d;color:#fff;border-color:#17211d}textarea{width:100%;min-height:64px;border:1px solid #aeb7b0;border-radius:4px;padding:9px;font:inherit}select,button{font:inherit;border:1px solid #8f9992;border-radius:4px;background:#fff;padding:8px 10px}button{background:#17211d;color:#fff;border-color:#17211d;cursor:pointer}.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.count{margin-left:auto;font-size:13px;color:#47524b}@media(max-width:720px){.alternatives{grid-template-columns:1fr}.count{width:100%;margin:0}}
  </style>
</head>
<body>
  <header>
    <div class="toolbar">
      <div><h1>Confidence review</h1><div class="meta">Robustness of the recommendation's position, not likelihood of success.</div></div>
      <label>Reviewer <select id="reviewer"><option value="">Choose</option><option value="dhruv">Dhruv</option><option value="gopika">Gopika</option></select></label>
      <button id="export" type="button">Export labels</button>
      <span class="count" id="count">0 / ${cases.length}</span>
    </div>
  </header>
  <main id="cases"></main>
  <script>
    const CASES=${JSON.stringify(cases)};
    const root=document.getElementById('cases');
    const reviewer=document.getElementById('reviewer');
    reviewer.value=localStorage.getItem('confidence-reviewer')||'';
    reviewer.addEventListener('change',()=>{localStorage.setItem('confidence-reviewer',reviewer.value);render()});
    const key=(id)=>'confidence-label-v2:'+reviewer.value+':'+id;
    const load=(id)=>JSON.parse(localStorage.getItem(key(id))||'{"band":"","notes":""}');
    function render(){root.innerHTML='';for(const item of CASES){const saved=load(item.id);const section=document.createElement('section');section.className='case';section.innerHTML=caseHtml(item,saved);section.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>save(item.id,section)));section.querySelector('textarea').addEventListener('input',()=>save(item.id,section));root.appendChild(section)}updateCount()}
    function save(id,section){if(!reviewer.value)return;const checked=section.querySelector('input:checked');localStorage.setItem(key(id),JSON.stringify({band:checked?.value||'',notes:section.querySelector('textarea').value}));updateCount()}
    function caseHtml(item,saved){const matrix=item.matrix;return '<div class="meta">'+escapeHtml(item.id)+'</div><h2>'+escapeHtml(item.scenario)+'</h2><p class="selected"><strong>Selected: '+escapeHtml(matrix.selectedBetId)+'</strong><br>'+hardStops(matrix)+'<br>'+flags(matrix)+'</p><div class="small">Criterion weights: '+matrix.criteria.map(x=>escapeHtml(x.id)+' '+Number(x.weight).toFixed(2)+' ('+escapeHtml(x.basisType)+')').join(' · ')+'</div><h3>Decision field</h3><div class="alternatives">'+matrix.alternatives.filter(x=>x.liveStatus==='live').map(bet=>alternativeHtml(bet,matrix.selectedBetId)).join('')+'</div><div class="bands">'+['Low','Moderate','High','NoScore'].map(b=>'<label><input type="radio" name="'+item.id+'" value="'+b+'" '+(saved.band===b?'checked':'')+'> '+(b==='NoScore'?'No score':b)+'</label>').join('')+'</div><textarea placeholder="Brief reason for the band">'+escapeHtml(saved.notes||'')+'</textarea>'}
    function alternativeHtml(bet,selectedId){return '<div class="alternative"><strong>'+escapeHtml(bet.id)+(bet.id===selectedId?' · selected':'')+'</strong><div class="small">Origin: '+escapeHtml(bet.origin)+' · support traces: '+bet.groundedSupportTraceIds.length+'</div><p>'+bet.criterionScores.map(x=>escapeHtml(x.criterion)+': '+Number(x.score).toFixed(2)).join('<br>')+'</p><div class="small">Against: '+bet.evidenceAgainst.map(x=>escapeHtml(x.severity+' '+x.criterion+' '+x.sourceType)).join('; ')+'<br>Fog: '+bet.fogDependencies.map(x=>escapeHtml(x.status+' '+x.influence+(x.critical?' critical':''))).join('; ')+'<br>Failures: '+bet.failureModes.map(x=>escapeHtml(x.severity+' '+x.testStatus)).join('; ')+'</div></div>'}
    function hardStops(matrix){const unresolved=Object.entries(matrix.hardStops).filter(([,v])=>v!==true).map(([k])=>k);return unresolved.length?'Unresolved: '+unresolved.join(', '):'All decision gates resolved.'}
    function flags(matrix){const active=Object.entries(matrix.flags||{}).filter(([,v])=>v===true).map(([k])=>k);return active.length?'Caps in force: '+active.join(', '):'No comparison-field cap declared.'}
    function updateCount(){const done=reviewer.value?CASES.filter(x=>load(x.id).band).length:0;document.getElementById('count').textContent=done+' / '+CASES.length}
    document.getElementById('export').addEventListener('click',()=>{if(!reviewer.value){alert('Choose the reviewer first.');return}const labels=CASES.map(x=>({caseId:x.id,...load(x.id)}));if(labels.some(x=>!x.band)){alert('Label all 18 cases before export.');return}const blob=new Blob([JSON.stringify({version:1,reviewer:reviewer.value,cases:labels},null,2)+'\\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='confidence-human-labels-'+reviewer.value+'.json';a.click();URL.revokeObjectURL(a.href)});
    function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
    render();
  </script>
</body>
</html>`;

writeFileSync(resolve(root, 'calibration/human-review.html'), html);
console.log('Wrote calibration/human-review.html');

function read(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

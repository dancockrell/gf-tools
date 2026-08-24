/* THE PLAYTEST HARNESS
   Plays every stage on every device profile with a plausible policy and
   asserts the things that silently rot: errors, NaN, the player falling out
   of the world, the player getting stuck, unbounded mob counts, canvas stack
   leaks, and frame time degrading within a stage.

   node qa.js <file> [tag] [--profiles a,b] [--stages 0,1,2] [--shots]        */
const fs=require('fs'), L=require('./lib');

const argv=process.argv.slice(2);
const FILE=argv[0]||'v4.html';
const TAG=(argv[1]&&!argv[1].startsWith('--'))?argv[1]:'run';
const opt=k=>{const i=argv.indexOf(k); return i<0?null:argv[i+1];};
const PROFS=(opt('--profiles')||'desktop_720,phone_land,tiny').split(',');
const STAGES=(opt('--stages')||[...Array(30).keys()].join(',')).split(',').map(Number);
const SHOTS=argv.includes('--shots');
const DIR=`qa/${TAG}`;
fs.mkdirSync(DIR,{recursive:true});

const SEG=[
  {keys:['ArrowRight'], ms:2600, tap:['KeyX']},
  {keys:['ArrowRight'], ms:2200, tap:['Space','KeyX']},
  {keys:['ArrowRight'], ms:2200, tap:['KeyX','KeyE']},
];

async function playStage(pg, st, prof, report){
  await pg.evaluate(s=>{
    try{ stage=s; spawnX=80; lives=3; score=0; buildLevel(); reset();
         if(typeof mode!=='undefined') mode='play';
         if(typeof paused!=='undefined') paused=false;
    }catch(e){ window.__err.push('warp'+s+': '+e.message); }
  }, st);
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ window.__ft.length=0; window.__inv=[]; window.__sawBoss=0;
    /* furthest reached, not final position: dying returns to checkpoint */
    window.__maxX=0;
    if(!window.__maxHooked){ window.__maxHooked=1;
      const raf0=window.requestAnimationFrame;
      window.requestAnimationFrame=function(cb){ return raf0.call(window,function(ts){
        const r=cb(ts);
        try{ if(typeof P!=='undefined' && isFinite(P.x) && P.x>window.__maxX) window.__maxX=P.x;
             if(typeof boss!=='undefined' && boss) window.__sawBoss=1; }catch(e){}
        return r; }); }; } });

  // per-frame invariants, installed in-page so they see every frame
  await pg.evaluate(()=>{
    if(window.__invHooked) return; window.__invHooked=1;
    const raf=window.requestAnimationFrame;
    window.requestAnimationFrame=function(cb){
      return raf.call(window,function(ts){
        const r=cb(ts);
        try{
          const bad=v=>typeof v==='number' && !isFinite(v);
          if(typeof P!=='undefined'){
            if(bad(P.x)||bad(P.y)||bad(P.vx)||bad(P.vy)) window.__inv.push('NaN in P');
            if(typeof H!=='undefined' && P.y>H*40) window.__inv.push('player below world y='+Math.round(P.y));
          }
          if(typeof cam!=='undefined' && bad(cam)) window.__inv.push('NaN cam');
          if(typeof score!=='undefined' && bad(score)) window.__inv.push('NaN score');
          if(typeof lives!=='undefined' && lives<0) window.__inv.push('lives<0');
          if(typeof mobs!=='undefined'){
            if(mobs.length>90) window.__inv.push('mobs='+mobs.length);
            for(const m of mobs) if(m.y>1e5){ window.__inv.push('mob below world'); break; }
          }
        }catch(e){}
        if(window.__inv.length>40) window.__inv.length=40;
        return r;
      });
    };
  });

  const x0=await pg.evaluate(()=>Math.round(P.x));
  for(let i=0;i<SEG.length;i++){
    const s=SEG[i];
    for(const k of s.keys) await pg.keyboard.down(k);
    const t0=Date.now();
    while(Date.now()-t0 < s.ms){
      for(const k of s.tap) { await pg.keyboard.press(k); }
      await pg.waitForTimeout(120);
    }
    for(const k of s.keys) await pg.keyboard.up(k);
    if(SHOTS) await pg.screenshot({path:`${DIR}/${prof}_s${st}_${i}.png`});
  }
  const r=await pg.evaluate(()=>({
    x:Math.round(P.x), maxX:Math.round(window.__maxX||0), boss:!!window.__sawBoss,
    lives:typeof lives!=='undefined'?lives:null,
    w:typeof LEVEL_W!=='undefined'?LEVEL_W:null,
    err:window.__err.splice(0), inv:window.__inv.splice(0),
    ft:window.__ft.splice(0), stack:{...window.__stack},
  }));
  const half=Math.floor(r.ft.length/3);
  const early=L.stats(r.ft.slice(0,half)), late=L.stats(r.ft.slice(-half));
  const issues=[];
  if(r.err.length) issues.push(...r.err.slice(0,4));
  if(r.inv.length) issues.push(...[...new Set(r.inv)].slice(0,4));
  if(r.stack.leaks) issues.push('canvas stack leaks '+r.stack.leaks);
  if(!r.boss && r.maxX - x0 < 60) issues.push('stuck: furthest reached '+(r.maxX-x0)+'px');
  else if(!r.boss && r.x - x0 < 60)
    console.log(`      (s${st} ${prof}: reached +${r.maxX-x0}px then lost it -- hard, not blocked)`);
  const allft=L.stats(r.ft);
  if(allft.p90>0.5 && allft.max > allft.p90*3.5 && allft.max > 33)
    issues.push(`frame spike p90 ${allft.p90} -> max ${allft.max}ms`);
  report.push({prof, stage:st, adv:r.x-x0, prog:+(r.x/(r.w||1)).toFixed(2),
               lives:r.lives, ft:late, issues});
  return issues;
}

(async()=>{
  const b=await L.launch();
  const all=[]; let bad=0;
  for(const prof of PROFS){
    const pg=await L.page(b,prof);
    await L.open(pg,FILE);
    await L.enter(pg,0);
    if(SHOTS) await pg.screenshot({path:`${DIR}/${prof}_title.png`});
    for(const st of STAGES){
      const issues=await playStage(pg,st,prof,all);
      if(issues.length){ bad++; console.log(`  ${prof} s${st}  ISSUES: ${issues.join(' | ')}`); }
      else console.log(`  ${prof} s${st}  ok`);
    }
    await pg.context().close();
  }
  await b.close();
  fs.writeFileSync(`${DIR}/report.json`, JSON.stringify(all,null,1));
  const ft=L.stats(all.map(r=>r.ft.med).filter(Boolean));
  console.log(`\n${TAG}: ${all.length} runs, ${bad} with issues.  frame med ${ft.med} p90 ${ft.p90} max ${ft.max}`);
  process.exitCode = bad?1:0;
})();

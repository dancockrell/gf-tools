#!/usr/bin/env node
const path=require('path'), L=require(path.join(__dirname,'..','lib'));
(async()=>{
  const b=await L.launch(); const pg=await L.page(b,'desktop_720');
  await L.open(pg,process.argv[2]||'v4.html'); await L.enter(pg,0);
  const bad=[];
  for(const s of [0,2,7,13,19,25,28,29]){
    await pg.evaluate(x=>{ stage=x; spawnX=80; lives=3; buildLevel(); reset(); mode='play'; },s);
    await pg.waitForTimeout(200);
    await pg.keyboard.down('ArrowRight');
    for(let k=0;k<6;k++){ await pg.keyboard.press('Space'); await pg.keyboard.press('KeyX');
                          await pg.waitForTimeout(300); }
    await pg.keyboard.up('ArrowRight');
    const e=await pg.evaluate(()=>({err:window.__err.slice(0,4), st:window.__stack.leaks,
      x:Math.round(P.x), nan:!isFinite(P.x)||!isFinite(P.y)||!isFinite(cam)}));
    console.log(`s${String(s).padStart(2)} x${e.x} leaks${e.st}`+(e.nan?' NAN':'')+(e.err.length?' '+JSON.stringify(e.err):''));
    if(e.err.length||e.nan||e.st) bad.push(s);
  }
  console.log(bad.length?'FAIL '+bad:'ALL CLEAN'); await b.close();
  process.exit(bad.length?1:0);
})();

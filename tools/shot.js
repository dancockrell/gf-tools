#!/usr/bin/env node
/* node tools/shot.js [file] [profile] [stage] [x] [out.png] [HIGH|LOW] */
const path=require('path'), L=require(path.join(__dirname,'..','lib'));
(async()=>{
  const [file='v4.html',prof='desktop_720',st='0',px='1400',out='shot.png',q='HIGH']=process.argv.slice(2);
  const b=await L.launch(); const pg=await L.page(b,prof);
  await L.open(pg,file); await L.enter(pg,0);
  await pg.evaluate(x=>{ stage=x; spawnX=80; lives=99; buildLevel(); reset(); mode='play'; },Number(st));
  await pg.evaluate(g=>{ OPT.qual=g; gradeQuality(); },q);
  await pg.evaluate(v=>{ P.x=Math.min(LEVEL_W-W-40,v); cam=Math.max(0,P.x-W*0.4); P.invuln=999; },Number(px));
  await pg.waitForTimeout(1100);
  await pg.screenshot({path:out}); console.log(out);
  await b.close();
})();

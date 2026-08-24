/* Ledge-camp test: warp to a boss stage, stand on the highest platform near
   the arena, hold still, and count how often the boss actually reaches us.
   Usage: node /tmp/camp.js <stage> */
const L=require('/root/gf/lib.js');
(async()=>{
  const stageN=+(process.argv[2]||2);
  const b=await L.launch(); const pg=await L.page(b,'desktop_720');
  await L.open(pg,'/root/gf/v4.html'); await L.enter(pg,stageN);
  // walk player to arena, spawn boss, mount highest plat near boss
  const setup=await pg.evaluate(()=>{
    try{
      P.x=LEVEL_W-700; P.y=groundAt(P.x)-40; camX=P.x-200;
      for(let i=0;i<600 && !boss;i++) step(1/60);
      if(!boss) return {err:'no boss spawned'};
      if(typeof dlg!=='undefined') dlg=null;
      if(typeof bossIntro!=='undefined') bossIntro=0;
      // highest platform within 900 of boss; if none is a real perch
      // (a band+ above the boss floor), synthesize one like the ones
      // players camp on, so the volley answer gets a fair exam.
      let best=null;
      for(const pl of PLATS){ if(Math.abs((pl.x+pl.w/2)-boss.x)<900){ if(!best||pl.y<best.y) best=pl; } }
      const bfl=groundAt(boss.x+9*SC);
      window.__dbg={bfl, lvu13:LVU(13), lvu16:LVU(16), bestY:best?best.y:null, PH, SC};
      if(!best || best.y > bfl-LVU(14)){
        best={x:boss.x-420, y:bfl-LVU(16), w:120, h:10, synth:1};
        PLATS.push(best);
      }
      window.__perch=best;
      P.x=best.x+best.w/2; P.y=best.y-PH-1; P.vx=0; P.vy=0; P.hp=P.maxHp||P.hp;
      window.__hp0=P.hp; window.__hits=0; window.__prevHp=P.hp;
      window.__deckHits=0; window.__mounted=0;
      return {ok:1, platY:best.y, bossKind:boss.kind, bossY:boss.y, py:P.y, hp:P.hp};
    }catch(e){ return {err:e.message}; }
  });
  console.log('setup', JSON.stringify(setup));
  if(setup.err){ await b.close(); process.exit(1); }
  // simulate 40s standing still; refill hp so we never die, count drops
  const res=await pg.evaluate(()=>{
    const perch=window.__perch; const platY=perch.y;
    let hits=0, projNearDeck=0, bossOnDeck=0, volleys=0, campedF=0, groundedF=0;
    let prev=P.hp; const kinds={};
    for(let f=0;f<40*60;f++){
      let d=1/60;
      if(hitstop>0){ hitstop=Math.max(0,hitstop-d); d*=0.12; } // frameBody's job
      timeLeft=90;                                             // clock is not the exam
      if(P.dead){ hits++; P.dead=false; P.respawning=0; P.hp=window.__hp0; P.vy=0; }
      step(d);
      if(!boss) break;
      if(P.hp<prev){ hits++; P.hp=window.__hp0; } prev=P.hp;
      // keep the player parked on the perch
      P.vx=0;
      if(Math.abs(P.x-(perch.x+perch.w/2))>30 || P.y+PH>platY+40){ P.x=perch.x+perch.w/2; P.y=platY-PH-1; P.vy=0; }
      if(P.onGround) groundedF++;
      if(boss.campT>0) campedF++;
      kinds['st:'+boss.st]=(kinds['st:'+boss.st]||0)+1;
      if(boss.st==='open') kinds[boss.vuln>0?'open:vuln':'open:closed']=(kinds[boss.vuln>0?'open:vuln':'open:closed']||0)+1;
      if(boss.st==='open'&&boss.vuln<=0&&!kinds['snap']) kinds['snap']=JSON.stringify({cd:+boss.cd.toFixed(2),hooked:boss.hooked,camping:boss.camping,f});
      if(f%300===0) kinds['t'+(f/60)]=boss.st+','+(+boss.vuln.toFixed(2))+','+(+boss.cd.toFixed(1))+','+(boss.vcap|0)+','+(hitstop?'HS':'')+','+(typeof dlg!=='undefined'&&dlg?'DLG':'');
      if(boss.y<platY+30 && Math.abs(boss.x-P.x)<200) bossOnDeck++;
      if(typeof bones!=='undefined') for(const o of bones){ kinds[o.kind]=(kinds[o.kind]||0)+1; if(Math.abs(o.y-platY)<40 && Math.abs(o.x-P.x)<160) projNearDeck++; }
      if(boss.camping) volleys++;
    }
    return {hits, projNearDeckFrames:projNearDeck, bossOnDeckFrames:bossOnDeck,
            campingFrames:volleys, campTFrames:campedF, groundedF,
            dbg:window.__dbg, perch:{x:perch.x,y:perch.y,synth:perch.synth||0},
            bossHp:boss?boss.hp:'dead', kinds,
            bstat:(typeof BSTAT!=='undefined'&&BSTAT)?BSTAT.mv:null};
  });
  console.log('result', JSON.stringify(res,null,1));
  const errs=await pg.evaluate(()=>window.__err.slice(0,5));
  if(errs.length) console.log('ERRS', errs);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});

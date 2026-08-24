/* Shared harness helpers. One launcher, one set of device profiles, one
   in-page instrumentation payload -- so every tool in this project measures
   the same game the same way. */
const {chromium}=require('playwright');
const path=require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* The profiles are not arbitrary. They bracket the two things this engine is
   actually sensitive to: the SC scale clamp (2..5), which changes the jump
   envelope in world units, and the aspect ratio, which changes how much of a
   level you can see and therefore how much warning you get. */
const PROFILES = {
  desktop_1080:  {width:1920, height:1080, dpr:1,   label:'desktop 1080p'},
  desktop_720:   {width:1280, height:720,  dpr:1,   label:'desktop 720p'},
  laptop_small:  {width:1024, height:640,  dpr:1,   label:'small laptop'},
  tablet_land:   {width:1180, height:820,  dpr:2,   label:'tablet landscape', touch:true},
  phone_land:    {width:844,  height:390,  dpr:3,   label:'phone landscape',  touch:true},
  phone_port:    {width:390,  height:844,  dpr:3,   label:'phone portrait',   touch:true},
  ultrawide:     {width:2560, height:1080, dpr:1,   label:'ultrawide'},
  tiny:          {width:800,  height:480,  dpr:1,   label:'minimum'},
};

async function launch(){
  return chromium.launch({executablePath:EXE, args:[
    '--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader',
    '--disable-features=CalculateNativeWinOcclusion']});
}

async function page(browser, prof){
  const p = typeof prof==='string' ? PROFILES[prof] : prof;
  const ctx = await browser.newContext({
    viewport:{width:p.width, height:p.height},
    deviceScaleFactor:p.dpr,
    hasTouch:!!p.touch, isMobile:!!p.touch,
  });
  const pg = await ctx.newPage();
  pg.__prof = p;
  return pg;
}

/* Everything a harness needs to see, injected before the game runs so it
   catches load-time failures too. */
const INSTRUMENT = () => {
  window.__err = []; window.__warn = [];
  window.addEventListener('error', e => window.__err.push('error: '+(e.message||'')+' @'+(e.filename||'')+':'+(e.lineno||'')));
  window.addEventListener('unhandledrejection', e => window.__err.push('reject: '+(e.reason&&e.reason.message||e.reason)));
  const ce = console.error, cw = console.warn;
  console.error = function(){ window.__err.push('console: '+[].slice.call(arguments).join(' ').slice(0,300)); return ce.apply(console,arguments); };
  console.warn  = function(){ window.__warn.push([].slice.call(arguments).join(' ').slice(0,300)); return cw.apply(console,arguments); };
  /* frame timing + canvas stack balance, the two things that silently rot */
  window.__ft = []; window.__stack = {max:0,min:0,cur:0,leaks:0};
  const raf = window.requestAnimationFrame;
  let last = 0;
  window.requestAnimationFrame = function(cb){
    return raf.call(window, function(ts){
      const t0 = performance.now();
      const r = cb(ts);
      const d = performance.now() - t0;
      window.__ft.push(d);
      if (window.__ft.length > 4000) window.__ft.shift();
      if (window.__stack.cur !== 0) { window.__stack.leaks++; window.__stack.cur = 0; }
      last = ts;
      return r;
    });
  };
  const proto = CanvasRenderingContext2D.prototype;
  const os = proto.save, orst = proto.restore;
  proto.save = function(){ window.__stack.cur++; if(window.__stack.cur>window.__stack.max) window.__stack.max=window.__stack.cur; return os.call(this); };
  proto.restore = function(){ window.__stack.cur--; if(window.__stack.cur<window.__stack.min) window.__stack.min=window.__stack.cur; return orst.call(this); };
};

async function open(pg, file){
  await pg.addInitScript(INSTRUMENT);
  await pg.goto('file://'+path.resolve(file));
  await pg.waitForTimeout(3200);
}

/* Get past the title into play, on a named stage, deterministically. */
async function enter(pg, stage=0){
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(1800);
  if (stage) {
    await pg.evaluate(s=>{ try{ stage=s; spawnX=80; buildLevel(); reset(); }catch(e){ window.__err.push('warp: '+e.message); } }, stage);
    await pg.waitForTimeout(600);
  }
  return pg.evaluate(()=>({mode:typeof mode!=='undefined'?mode:null, stage:typeof stage!=='undefined'?stage:null}));
}

const stats = a => {
  if(!a.length) return {n:0};
  const s=[...a].sort((x,y)=>x-y);
  const q=p=>s[Math.min(s.length-1, Math.floor(s.length*p))];
  return {n:s.length, med:+q(.5).toFixed(2), p90:+q(.9).toFixed(2),
          p99:+q(.99).toFixed(2), max:+s[s.length-1].toFixed(2),
          mean:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2)};
};

module.exports = {PROFILES, launch, page, open, enter, stats, EXE};

# Ghost Front — how this project is worked on

One game file, one harness, one audit command. Everything else is temporary
and gets deleted at the end of the round that created it.

## RECOVERY (read first after a container loss)
The sandbox is ephemeral and HAS BEEN RECLAIMED TWICE mid-session. The only
durable copies are in C:\Users\Admin\Downloads. To recover:
1. stage the newest ghostfront_vNN.html from Downloads -> /root/gf/v4.html
2. stage Downloads/gf-tools/* -> /root/gf/{lib.js,qa.js,tools/,PROCESS.md}
3. `cd /root/gf && npm i playwright && node tools/probe.js`
Ship every version AND every tool change back to Downloads/gf-tools.

## The files that stay
| path | what it is |
|---|---|
| v4.html | the game. ~12MB, one file, art embedded. |
| lib.js | harness: 8 device profiles, launch/page/open/enter/stats, instrumentation |
| qa.js | regression sweep across stages/profiles |
| tools/probe.js | 30-second smoke test, run after every edit |
| tools/shot.js | one screenshot: file profile stage x out quality |
| PROCESS.md | this file |

## The loop
1. MEASURE FIRST - find the instrument, or write the number down by hand.
2. Change one thing, with the before-number in the comment beside it.
3. node --check the extracted script, then tools/probe.js.
4. qa.js before shipping.
5. Ship: copy to ghostfront_vNN.html, SendUserFile, commit to Downloads,
   AND PUSH TO ITCH: `tools/push.sh NN` -> dancockrell/ghost-front:html
   (butler binary lives at tools/butler; creds staged from
   Downloads/gf-tools/butler_creds into ~/.config/itch/butler_creds --
   never print the key). Every version pushes; --if-changed makes
   re-pushes free.
6. Delete scaffolding.

## Hard-won facts
- Run browsers ONE AT A TIME (2 cores; parallel runs invent frame faults).
- 95% of a frame is rasterisation, not JS. Optimise painted pixels.
- The sim is not reproducible (rnd unseeded); prove refactors by text.
- P.armour is the tier variable, not P.kit. Tiers 2/3 have combat plates
  only; locomotion borrows tier 1 (see PLOCO in pmodelPose).
- Sheets authored facing LEFT: KNOCHEN, CHIMAERE, TRUEMMER (lf:1 in ARTBOSS).
- MANY STRIPS ARE MISCUT AT SOURCE (figures overlap cell borders). No code
  fix exists; ARTCLEAN in v4.html folds display onto the clean frames.
  Re-export list for ComfyUI: HAWKEA death/hit/crouchattack/throw,
  HAWKE_death, SCHUETZE aim/attack/death/hit, STOSS death/hit/recover,
  GRENADIER_death, SCHLURFER_walk+rise, WERWOLF death/pounce,
  plus every single-frame sheet (MGTEAM, PANZER, PENDEL, TRUEMMER,
  DIREKTOR1/2, EISFRESSER) and death plates for KNOCHEN/CHIMAERE/EISWITWE.
- Props with words carry txt:1 in EPROP and never mirror. New props go on
  the contact sheet (tools: /tmp/plates.js pattern) before they ship.
- A boss state chain must have ONE branch per state. stepBones had two
  `else if(st==='open')` branches; the first (sag) shadowed the second
  (the exit), so the boss froze in his punish window forever — measured
  one move per 40s. v20 merged them. When adding flavor to a state,
  add it INSIDE the existing branch.
- Harness loops that call step() directly must also do frameBody's
  bookkeeping: decay `hitstop` (and scale dt*0.12 while it runs) and pin
  `timeLeft`, or the sim freezes / the clock kills the test subject.
  See /tmp/camp.js (mirrored in gf-tools) for the pattern.

## THE FULL DEFECT LIST (sprite sweep, all sheets viewed frame by frame)
CODE-FIXED (display folds onto clean frames, see ARTCLEAN in v4.html):
  HAWKE_death, HAWKEA death/hit/crouchattack/throw, SCHUETZE aim/attack/
  death/hit, STOSS death/hit/recover, GRENADIER_death, SCHLURFER_walk,
  WERWOLF death/pounce, FLAMM_death, OFFIZIER attack(f0 is a WRONG INSERT:
  black-coat palette variant spliced in)/hit, REVENANT_death, SANI_death,
  KRIECHER_death, RISS_hit(f3 is body-less lightning), SECHZEHN_death,
  UHRSOLDAT_death, EISWITWE_attack, STAHLWALKER attack(muzzle line bleeds
  across cells)/death.
ART-ONLY (needs re-export via ComfyUI; specs in the v4.html work order):
  - single-frame sheets: MGTEAM(all), PANZER(all), PENDEL(all),
    TRUEMMER(all, and _hit is on an OPAQUE field), DIREKTOR1/2,
    EISFRESSER, SCHLURFER idle/attack/hit/death
  - missing death plates: KNOCHEN, CHIMAERE, EISWITWE, TRUEMMER, PENDEL
  - HAWKEB needs real idle(4)/run(6)/jump(6)/crouch/reload
  - HAWKEA/HAWKEP need locomotion (currently borrow tier 1)
  - CHIMAERE head0-4 plates unused (five heads authored, never drawn)
  - SMITH/SMITHA/SMITHB: full second playable character, cut and unused
CLEAN SHEETS (verified): HAWKE(rest), GRENADIER(rest), WERWOLF(rest),
  STOSS(rest), SCHUETZE walk/idle/alert, FLAMM attack/hit/idle/walk,
  OFFIZIER order/death/idle/walk, REVENANT(rest), SANI(rest), AMPULLE,
  KRIECHER(rest), PUPPE, RISS(rest), SECHZEHN(rest), UHRSOLDAT(rest),
  SPENDER, STATIST, BELLCARRIER, EISWITWE(rest), STAHLWALKER idle/walk.

## THE ART PIPELINE (v21) — proven end to end
- Generate on the user's machine: Downloads\gf-art\gen_gf_roundN.py +
  RUN-GF-ARTN.bat (anaconda python, ComfyUI Desktop port 8188/8000).
  I can run it myself: computer-use → double-click Comfy Desktop icon,
  pick the ComfyUI instance card, then double-click the bat in Explorer.
- WHAT WORKS: img2img den .40-.50 + ONE seed per character = identity
  locked, but poses barely move (jumps come out as walks — SDXL will not
  break the init pose). den .55+ = poses move but identity shatters.
  Collapse/death sequences: generate upright, ROTATE in the cut pass
  (buckle / tilt -24 / lying -78) — the classic sprite trick, reads fine.
  Quadrupeds by t2i need "four-legged/quadruped/all four paws" AND
  negatives "bipedal, human, dog-headed man" or you get dog-headed men.
- Cut pass (tools/cut.py, mirrored): rembg isnet-general-use lifts the
  figure (border flood fails on scenic bgs AND dark-on-dark); islands
  <6% of the largest are dropped (kills inset thumbnails); one scale per
  strip (tallest frame), bottom-registered, .rec = ready ARTDATA record.
- Embedded in v21: HAWKEA idle/walk/run (tier2 armored locomotion — use
  only clean frames, walk_1/run_1 had blob legs), HAWKEB_run, boss deaths
  KNOCHEN/CHIMAERE/EISWITWE/TRUEMMER/PENDEL (BCORPSE picks *_death up
  automatically), MGTEAM fire(2)+reload, PANZER walk(2)+attack.
- NEW ENEMIES: D=PANZERHUND (wolf AI on a faster clock, aimed leap),
  J=JAEGER (band 430, drawn scope line that locks+strobes, aimed shot
  kind:'shot' with vy). Both painted, in ARTMOB/MOB/GAIT/TELLOFKIND,
  dealt into pools ch1/2/4/5/7. Constructor lines in spawnMob (cd MUST
  be initialized or the kind never attacks).
- Warping P.x in a harness WIPES all mobs (room cull uses `cam`, not
  camX — camX does not exist). Spawn near P instead, and set `cam`.

## COMBINED ARMS (v19)
Chapter pools re-dealt so every tier fields gun+rush, second tier adds
arc (h/x) and lane (m/G): grenadiers from stage 0, flammenwerfer in
Normandy III and Berlin I, guards in the labs. The cluster catalogue
(13 shapes, CLUSTERS in buildLevel) can now staff its problems from the
first road. The nest prefers an MG on the ledge.

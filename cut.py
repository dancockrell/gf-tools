#!/usr/bin/env python3
r"""GHOST FRONT -- the cutting pass. Generated plates -> ARTDATA strips.

For each frame: lift the figure off its painted background (border-seeded
flood fill on the modal border colour), crop to content, then register
into uniform cells by the house rules:

  standing human   figh 124-126, foot 1-2
  kneeling         figh 79-83
  prone / death    figh 86-89
  bosses           their own idle figh; death cells at 0.72x, frames
                   uniformly scaled so the tallest frame fills the cell

Every frame of a set shares ONE scale factor (tallest frame defines it),
so a collapsing pose actually collapses instead of being re-inflated.

Usage: python3 cut.py <spec.json>
spec: [{out, files:[...], figh, foot, flip} ...]  -> out.png + out.rec
"""
import sys, json, base64, io
from PIL import Image, ImageFilter

_SESSION=None
def lift_ml(im):
    """rembg (isnet-general-use): the lift that actually works on painted
    scenic backgrounds and dark-on-dark figures. Falls back to flood."""
    global _SESSION
    from rembg import remove, new_session
    if _SESSION is None: _SESSION=new_session("isnet-general-use")
    out=remove(im.convert("RGBA"), session=_SESSION)
    # hard floor on the matte so wisps of background do not survive
    a=out.split()[3].point(lambda v: 0 if v<30 else v)
    out.putalpha(a)
    return keep_main(out)

def keep_main(im, keep_frac=0.06):
    """Drop disconnected opaque islands smaller than keep_frac of the
    biggest one (inset thumbnails, stray card corners). Muzzle flash and
    smoke that touch the figure survive because they are connected."""
    w,h=im.size; a=im.split()[3].load(); px=im.load()
    lab=[0]*(w*h); nlab=0; sizes=[0]
    for y0 in range(h):
        for x0 in range(w):
            i0=y0*w+x0
            if a[x0,y0]>0 and lab[i0]==0:
                nlab+=1; sizes.append(0); stack=[(x0,y0)]
                lab[i0]=nlab
                while stack:
                    x,y=stack.pop(); sizes[nlab]+=1
                    for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                        if 0<=nx<w and 0<=ny<h:
                            j=ny*w+nx
                            if a[nx,ny]>0 and lab[j]==0:
                                lab[j]=nlab; stack.append((nx,ny))
    if nlab<=1: return im
    big=max(sizes)
    kill={i for i,s in enumerate(sizes) if i>0 and s<big*keep_frac}
    if kill:
        for y in range(h):
            for x in range(w):
                if lab[y*w+x] in kill:
                    c=px[x,y]; px[x,y]=(c[0],c[1],c[2],0)
    return im

def lift(im, tol=42):
    """Border-seeded flood removal of the painted background."""
    im = im.convert("RGBA")
    w,h = im.size
    px = im.load()
    # modal border colour (coarse, 8-bit buckets)
    from collections import Counter
    cnt = Counter()
    for x in range(0,w,3):
        for y in (0,1,2,h-3,h-2,h-1): cnt[px[x,y][:3]] += 1
    for y in range(0,h,3):
        for x in (0,1,2,w-3,w-2,w-1): cnt[px[x,y][:3]] += 1
    bg = cnt.most_common(1)[0][0]
    def near(c):
        return abs(c[0]-bg[0])+abs(c[1]-bg[1])+abs(c[2]-bg[2]) <= tol*3
    # BFS from every border pixel that matches
    seen = bytearray(w*h)
    stack = []
    for x in range(w):
        for y in (0,h-1):
            if near(px[x,y][:3]): stack.append((x,y))
    for y in range(h):
        for x in (0,w-1):
            if near(px[x,y][:3]): stack.append((x,y))
    while stack:
        x,y = stack.pop()
        i = y*w+x
        if seen[i]: continue
        seen[i] = 1
        c = px[x,y]
        if not near(c[:3]): continue
        px[x,y] = (c[0],c[1],c[2],0)
        if x>0: stack.append((x-1,y))
        if x<w-1: stack.append((x+1,y))
        if y>0: stack.append((x,y-1))
        if y<h-1: stack.append((x,y+1))
    # soften the cut edge one pixel
    a = im.split()[3].filter(ImageFilter.MinFilter(3))
    im.putalpha(a)
    return im

def content(im):
    bb = im.split()[3].getbbox()
    return im.crop(bb) if bb else im

def build(spec):
    frames = []
    for f in spec["files"]:
        rot = 0
        if isinstance(f, list): f, rot = f
        im = lift_ml(Image.open(f))
        im = content(im)
        if rot: im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
        im = content(im)
        if spec.get("flip"): im = im.transpose(Image.FLIP_LEFT_RIGHT)
        if spec.get("grade")=="charcoal":
            # pull the round-1 field-green armour down to the tier's black
            from PIL import ImageEnhance
            a2=im.split()[3]
            im=ImageEnhance.Color(im.convert("RGB")).enhance(0.45)
            im=ImageEnhance.Brightness(im).enhance(0.70).convert("RGBA")
            im.putalpha(a2)
        frames.append(im)
    figh = spec["figh"]; foot = spec.get("foot",1)
    tall = max(f.size[1] for f in frames)
    s = figh / tall
    frames = [f.resize((max(1,round(f.size[0]*s)), max(1,round(f.size[1]*s))), Image.LANCZOS) for f in frames]
    fw = max(f.size[0] for f in frames) + 4
    fh = figh + foot + 1
    strip = Image.new("RGBA",(fw*len(frames), fh),(0,0,0,0))
    for i,f in enumerate(frames):
        x = i*fw + (fw-f.size[0])//2
        y = fh - foot - f.size[1]
        strip.paste(f,(x,y),f)
    out = spec["out"]
    strip.save(out+".png")
    buf = io.BytesIO(); strip.save(buf,"PNG",optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    rec = "%s:[%d,%d,%d,%d,%d,\"data:image/png;base64,%s\"]," % (
        spec["name"], len(frames), fw, fh, figh, foot, b64)
    open(out+".rec","w").write(rec)
    print("%-24s %d frames  cell %dx%d  figh %d  %dkB" % (
        spec["name"], len(frames), fw, fh, figh, len(b64)//1024))

if __name__=="__main__":
    for spec in json.load(open(sys.argv[1])):
        build(spec)

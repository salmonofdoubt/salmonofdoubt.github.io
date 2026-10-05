from __future__ import annotations

import asyncio
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8000/demos/david-light-lab/"
OUT = Path("demos/david-light-lab/social-card.jpg")
TMP = Path("/tmp/david-social-source.png")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={"width": 1440, "height": 1000}, service_workers="block")
        page = await context.new_page()
        await page.goto(URL, wait_until="domcontentloaded", timeout=60_000)
        await page.wait_for_function(
            "() => document.querySelector('#loadingCard')?.classList.contains('is-hidden')",
            timeout=60_000,
        )
        await page.evaluate("""() => {
          const set=(id,v)=>{const el=document.getElementById(id); if(!el)return; el.value=v; el.dispatchEvent(new Event('input',{bubbles:true}));};
          set('ry','24'); set('zoom','1.10'); set('az','38'); set('el','34');
          set('key','1.15'); set('fill','0.24'); set('soft','0.58'); set('tone','0.84');
        }""")
        await page.wait_for_timeout(700)
        await page.locator("#gl").screenshot(path=str(TMP))
        await context.close()
        await browser.close()

    src=Image.open(TMP).convert("RGB")
    W,H=1200,630
    card=Image.new("RGB",(W,H),(4,10,15))

    # Crop the rendered sculpture and place it on the right.
    sw,sh=src.size
    crop=src.crop((int(sw*.12), int(sh*.04), int(sw*.94), int(sh*.96)))
    scale=max(H/crop.height, 720/crop.width)
    crop=crop.resize((int(crop.width*scale),int(crop.height*scale)),Image.Resampling.LANCZOS)
    card.paste(crop,(W-crop.width+70,(H-crop.height)//2))

    # Dark left-to-right overlay for readable social-card text.
    overlay=Image.new("RGBA",(W,H),(0,0,0,0))
    px=overlay.load()
    for x in range(W):
        alpha=max(0,min(245,int(245*(1-x/760)))) if x<760 else 0
        for y in range(H):
            px[x,y]=(4,10,15,alpha)
    card=Image.alpha_composite(card.convert("RGBA"),overlay)

    draw=ImageDraw.Draw(card)
    bold="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    regular="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    accent=(156,248,255,255); white=(237,250,250,255); muted=(176,199,200,255); warm=(228,207,135,255)
    draw.text((66,92),"ARTIST REFERENCE INSTRUMENT",font=ImageFont.truetype(bold,22),fill=accent)
    draw.text((62,135),"David Light Lab",font=ImageFont.truetype(bold,58),fill=white)
    draw.multiline_text((66,220),"Turn the sculpture.\nMove the light.\nStudy the form.",font=ImageFont.truetype(regular,27),fill=white,spacing=8)
    draw.multiline_text((66,355),"A live 3D reference for drawing,\npainting, composition and value studies.",font=ImageFont.truetype(regular,27),fill=muted,spacing=8)
    urlfont=ImageFont.truetype(bold,20)
    label="salmonofdoubt.github.io"
    bbox=draw.textbbox((0,0),label,font=urlfont)
    draw.rounded_rectangle((62,508,62+(bbox[2]-bbox[0])+34,550),radius=20,outline=accent,width=2,fill=(7,18,28,220))
    draw.text((79,518),label,font=urlfont,fill=white)
    draw.text((66,578),"DAVID LIGHT LAB",font=ImageFont.truetype(bold,16),fill=warm)

    OUT.parent.mkdir(parents=True,exist_ok=True)
    card.convert("RGB").save(OUT,quality=76,optimize=True,progressive=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size/1024:.1f} KB)")

if __name__ == "__main__":
    asyncio.run(main())

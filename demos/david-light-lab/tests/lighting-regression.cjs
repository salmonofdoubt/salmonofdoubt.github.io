// Run against a local site server: NODE_PATH=<playwright installation> node tests/lighting-regression.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.DAVID_TEST_URL || 'http://127.0.0.1:8090/demos/david-light-lab/';
// A receiver at z=0 and a small blocker at z=0.5 give a known, camera-visible cast shadow.
function fixture() {
  const positions = [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0, .2,-.2,.5, .6,-.2,.5, .6,.2,.5, .2,.2,.5];
  const normals = Array.from({length:8},()=>[0,0,1]).flat();
  const indices = [0,1,2,0,2,3,4,5,6,4,6,7];
  const data = Buffer.alloc(12+positions.length*8+indices.length*4);
  data.write('DLB1'); data.writeUInt32LE(8,4); data.writeUInt32LE(indices.length,8);
  let offset=12;
  for(const value of [...positions,...normals]){data.writeFloatLE(value,offset);offset+=4;}
  for(const value of indices){data.writeUInt32LE(value,offset);offset+=4;}
  return data;
}
async function change(page,values){
  await page.evaluate(values=>{for(const [id,value]of Object.entries(values)){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}},values);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function sample(page,x,zoom=1){
  return page.evaluate(({x,zoom})=>{
    const c=document.getElementById('gl'),g=c.getContext('webgl2');g.finish();
    const fov=Number(document.getElementById('fov').value)*Math.PI/180;
    const px=Math.round(c.width/2+x*zoom*c.height/(2*3.05*Math.tan(fov/2)));
    const pixel=new Uint8Array(4);g.readPixels(px,Math.floor(c.height/2),1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);
    if(g.getError())throw Error('WebGL error');return pixel[0];
  },{x,zoom});
}
(async()=>{
  const options={headless:true};
  if(process.env.CHROMIUM_EXECUTABLE) options.executablePath=process.env.CHROMIUM_EXECUTABLE;
  if(process.env.CHROMIUM_ARGS) options.args=JSON.parse(process.env.CHROMIUM_ARGS);
  const browser=await chromium.launch(options);
  try{
    const page=await browser.newPage({viewport:{width:1000,height:800},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**',route=>route.abort());
    await page.route('**/assets/david-head.dlb?*',route=>route.fulfill({body:fixture(),contentType:'application/octet-stream'}));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('loadingCard').classList.contains('is-hidden'));
    await change(page,{rx:0,ry:0,rz:0,az:45,el:0,dist:2.2,key:2,fill:0,soft:0,zoom:1,valueMode:'grayscale'});
    const blocked=await sample(page,-.15);
    await change(page,{az:-45});
    const exposed=await sample(page,-.15);
    assert(blocked<8,`Blocked receiver should be dark, got ${blocked}`);
    assert(exposed>80,`Unblocked receiver should be lit, got ${exposed}`);
    await change(page,{zoom:2});
    const zoomed=await sample(page,-.15,2);
    assert(Math.abs(zoomed-exposed)<=3,`Zoom changed lighting: ${exposed} -> ${zoomed}`);
    await change(page,{az:45,fill:.15});
    const ambient=await sample(page,-.15,2);
    assert(ambient>8&&ambient<exposed,`Fill should reveal shadow without direct light: ${ambient}`);
    assert.deepEqual(errors,[]);
    assert.equal(await page.locator('.art-return').getAttribute('href'),'/art/');
    console.log({blocked,exposed,zoomed,ambient});
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

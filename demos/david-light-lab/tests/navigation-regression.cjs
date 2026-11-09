// Run with local server at :8090 and Playwright installed:
// node demos/david-light-lab/tests/navigation-regression.cjs
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const url=process.env.DAVID_TEST_URL||'http://127.0.0.1:8090/demos/david-light-lab/';

function fixture(){
  const positions=[-1,-1,0,1,-1,0,1,1,0,-1,1,0];
  const normals=Array.from({length:4},()=>[0,0,1]).flat();
  const indices=[0,1,2,0,2,3];
  const bytes=Buffer.alloc(12+positions.length*8+indices.length*4);
  bytes.write('DLB1');bytes.writeUInt32LE(4,4);bytes.writeUInt32LE(indices.length,8);
  let offset=12;
  for(const value of [...positions,...normals]){bytes.writeFloatLE(value,offset);offset+=4;}
  for(const value of indices){bytes.writeUInt32LE(value,offset);offset+=4;}
  return bytes;
}
async function saved(page){
  await page.locator('#saveStudy').click();
  return page.evaluate(()=>JSON.parse(localStorage.getItem('david-light-lab:study:v1')));
}
(async()=>{
  const options={headless:true};
  if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
  if(process.env.CHROMIUM_ARGS)options.args=JSON.parse(process.env.CHROMIUM_ARGS);
  const browser=await chromium.launch(options);
  try{
    const page=await browser.newPage({viewport:{width:1160,height:820},serviceWorkers:'block'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**',route=>route.abort());
    await page.route('**/assets/david-head.dlb?*',route=>route.fulfill({
      body:fixture(),contentType:'application/octet-stream'
    }));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#loadingCard').classList.contains('is-hidden'));
    assert.equal(await page.locator('[data-focus]').count(),7);

    const before=await saved(page);
    await page.locator('[data-focus="nose"]').click();
    await page.waitForTimeout(380);
    assert.equal(Number(await page.locator('#zoom').inputValue()),11);
    const closeUp=await saved(page);
    assert.deepEqual(closeUp.headQuat,before.headQuat,'Feature shortcuts cannot move David');
    assert.equal(closeUp.controls.az,before.controls.az,'Feature shortcuts cannot move lamp');
    assert.equal(closeUp.pan.length,3,'New target has depth');
    assert.notDeepEqual(closeUp.pan,before.pan,'Feature shortcut centres a new target');

    await page.locator('#fitView').click();
    assert.equal(Number(await page.locator('#zoom').inputValue()),1);
    const fitted=await saved(page);
    assert.deepEqual(fitted.pan,[0,0,0]);

    const box=await page.locator('#gl').boundingBox();
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);
    await page.mouse.wheel(0,-450);
    assert(Number(await page.locator('#zoom').inputValue())>1,'Wheel zooms in');
    const p1=(await saved(page)).pan;
    await page.mouse.move(x,y);
    await page.mouse.down({button:'right'});
    await page.mouse.move(x+60,y+30,{steps:4});
    await page.mouse.up({button:'right'});
    const p2=(await saved(page)).pan;
    assert.notDeepEqual(p1,p2,'Right drag pans the camera');

    await page.locator('[data-focus="eyes"]').click();
    await page.waitForTimeout(380);
    // Double-click picks the actual triangle and records a calibrated point.
    await page.mouse.dblclick(x,y,{delay:90});
    await page.waitForTimeout(380);
    const calibrated=await page.evaluate(()=>JSON.parse(
      localStorage.getItem('david-light-lab:feature-focus:v1')||'{}'
    ));
    assert(Array.isArray(calibrated.eyes)&&calibrated.eyes.length===3);

    await page.locator('#lockHead').click();
    const lockedHead=(await saved(page)).headQuat;
    await page.locator('[data-focus="rightEar"]').click();
    await page.waitForTimeout(380);
    assert.deepEqual((await saved(page)).headQuat,lockedHead,'Head lock remains respected');

    await page.locator('#lockCamera').click();
    const lockedPOV=await saved(page);
    await page.locator('[data-focus="mouth"]').click();
    const afterLock=await saved(page);
    assert.deepEqual(afterLock.cameraQuat,lockedPOV.cameraQuat,'Camera lock blocks shortcuts');
    assert.equal(afterLock.controls.zoom,lockedPOV.controls.zoom,'Camera lock blocks zoom');

    await page.locator('#lockCamera').click();
    const legacy={...afterLock,pan:[.15,-.11],v:1};
    await page.evaluate(data=>{
      localStorage.setItem('david-light-lab:study:v1',JSON.stringify(data));
      document.getElementById('restoreStudy').click();
    },legacy);
    assert.deepEqual((await saved(page)).pan,[.15,-.11,0],'Legacy 2D pans still restore');

    assert.deepEqual(errors,[],'No browser exceptions');
    assert.equal(await page.locator('.art-return').getAttribute('href'),'/art/');
    console.log('David anatomical navigation regression: PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

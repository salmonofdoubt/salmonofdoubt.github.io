"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const script = fs.readFileSync("art/assets/art-related.js","utf8");
const css = fs.readFileSync("art/assets/art-related.css","utf8");
const built = fs.readFileSync("art/oil-paintings/index.html","utf8");

function createElement(kind){
  return {
    kind, dataset:{}, listeners:{}, children:[],
    classList:{contains(){return false}, add(){}, remove(){}},
    addEventListener(event,cb){this.listeners[event]=cb;},
    appendChild(item){this.children.push(item);},
    insertBefore(item){this.children.push(item);},
    focus(){},
    setAttribute(name,value){this[name]=value;},
  };
}
async function runScenario(desktop){
  let trigger=null,dialog=null;
  const opens=[];
  const parent=createElement("parent");
  const link=createElement("a");
  link.dataset.artworkId="work-one";
  link.parentNode=parent;
  const doc={
    body:{appendChild(item){if(item.kind==="dialog")dialog=item;}},
    getElementById(id){return id==="related-public-dialog"?dialog:null;},
    createElement(kind){
      const el=createElement(kind);
      if(kind==="dialog"){
        const close=createElement("button");
        const heading=createElement("h2");
        const frame=createElement("frame");
        frame.images=[];
        Object.defineProperty(frame,"innerHTML",{
          set(value){
            this.html=value;
            this.images=[...value.matchAll(/<img src="([^"]+)"/g)].map(match=>{
              const image=createElement("img");
              image.src=match[1];
              image.currentSrc="";
              image.alt="Original painting";
              image.tabIndex=-1;
              return image;
            });
          },
          get(){return this.html||"";}
        });
        frame.querySelectorAll=selector=>selector===".related-public-media img"?frame.images:[];
        el.querySelector=selector=>({
          ".related-public-close":close,
          "#relatedPublicTitle":heading,
          "#relatedPublicFrame":frame
        })[selector];
        el.showModal=function(){this.open=true;};
        el.close=function(){this.open=false;};
        el.frame=frame;
      }
      const originalAppend=el.appendChild;
      el.appendChild=function(item){
        originalAppend.call(this,item);
        if(item.className==="related-public-trigger")trigger=item;
      };
      return el;
    },
    querySelectorAll(selector){
      if(selector===".work-card[data-artwork-id], .lead-link[data-artwork-id]")return [link];
      return [];
    }
  };
  const sets=[{
    id:"related-one",title:"Studies for painting",
    members:[
      {kind:"artwork",id:"work-one",title:"Original painting",image:"https://example.org/art/full-image.jpg"},
      {kind:"reference",id:"ref-one",title:"Private reference made public",visibility:"public",
       image:"https://example.org/art/reference.jpg"},
      {kind:"studio",id:"asset-one",title:"Studio image",mediaKind:"image",
       image:"https://example.org/art/studio.jpg"}
    ]
  }];
  const sandbox={
    document:doc,
    window:{
      matchMedia(query){
        assert.equal(query,"(hover: hover) and (pointer: fine)");
        return {matches:desktop};
      },
      open(...args){opens.push(args);}
    },
    fetch:async url=>({ok:true,json:async()=>url.includes("related-public.json")?{sets}:{sets:[]}}),
    escapeHtml:v=>String(v??"").replaceAll("&","&amp;").replaceAll('"',"&quot;"),
    console,
    Date,
  };
  vm.runInNewContext(script,sandbox,{filename:"art-related.js"});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(trigger,"Related group trigger created");
  trigger.listeners.click({preventDefault(){},stopPropagation(){}});
  assert.ok(dialog?.open,"Related dialog opens");
  assert.equal(dialog.frame.images.length,3,"All three image types appear");
  assert.doesNotMatch(dialog.frame.html,/Open original ·/,
    "Images already open by clicking, so redundant original links are hidden");
  for(const image of dialog.frame.images){
    if(desktop){
      assert.equal(image.dataset.openOriginal,"true");
      assert.equal(image.role,"link");
      assert.equal(image.tabIndex,0);
      assert.equal(typeof image.listeners.click,"function");
      assert.equal(typeof image.listeners.keydown,"function");
      image.listeners.click();
    }else{
      assert.equal(image.dataset.openOriginal,undefined);
      assert.equal(image.role,undefined);
      assert.equal(image.tabIndex,-1);
      assert.equal(image.listeners.click,undefined,"Do not intercept mobile image tap");
      assert.equal(image.listeners.keydown,undefined);
    }
    assert.equal(image.listeners.touchstart,undefined,"No pinch-zoom event interception");
    assert.equal(image.listeners.touchmove,undefined,"No pinch-zoom event interception");
  }
  if(desktop){
    assert.equal(opens.length,3,"Each image opens its original independently");
    assert.equal(opens[0][0],"https://example.org/art/full-image.jpg");
    assert.equal(opens[1][0],"https://example.org/art/reference.jpg");
    assert.equal(opens[2][0],"https://example.org/art/studio.jpg");
    assert.ok(opens.every(args=>args[1]==="_blank"&&args[2]==="noopener,noreferrer"),
      "Full originals open securely in a fresh native browser tab");
    const event={key:"Enter",prevented:false,preventDefault(){this.prevented=true;}};
    dialog.frame.images[0].listeners.keydown(event);
    assert.equal(event.prevented,true,"Keyboard Enter works");
    assert.equal(opens.length,4);
  }else assert.equal(opens.length,0,"Mobile pinch behaviour remains untouched");
}
(async()=>{
  assert.match(css,/@media \(hover: hover\) and \(pointer: fine\)/,"Zoom cursor is desktop only");
  assert.match(css,/cursor: zoom-in/,"Desktop image communicates the click-to-open affordance");
  assert.match(built,/art-related\.js\?v=20261116-original-click-1/,"Room loads current interaction");
  assert.match(built,/art-related\.css\?v=20261116-original-click-1/,"Room loads current desktop style");
  assert.doesNotMatch(script,/touchstart|touchmove|gesturestart|preventDefault\(\).*pinch/,
    "No mobile touch zoom interception introduced");
  await runScenario(true);
  await runScenario(false);
  console.log("PASS: desktop related images open full originals on click/Enter; mobile pinch stays untouched.");
})().catch(error=>{console.error(error);process.exitCode=1;});

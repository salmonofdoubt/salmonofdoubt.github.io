(() => {
  'use strict';

  const MODEL_URL = './assets/david-head.dlb?v=20261005-1630';
  const STORAGE_KEY = 'david-light-lab:study:v1';

  const $ = (id) => document.getElementById(id);
  const canvas = $('gl');
  const viewerShell = $('viewerShell');
  const panel = $('controlPanel');
  const loadingCard = $('loadingCard');
  const loadingTitle = $('loadingTitle');
  const loadingText = $('loadingText');
  const progressBar = $('progressBar');
  const referenceLock = $('referenceLock');
  const modePill = $('modePill');
  const lightMarker = $('lightMarker');
  const cropLayer = $('cropLayer');
  const cropFrame = $('cropFrame');
  const formatBadge = $('formatBadge');
  const timerDisplay = $('timerDisplay');

  const controls = {};
  [
    'rx','ry','rz','zoom','fov','az','el','dist','key','fill','soft',
    'tone','shine','bg','guideOpacity','format','valueMode','timerSelect'
  ].forEach(id => controls[id] = $(id));

  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) {
    loadingTitle.textContent = 'WebGL 2 required';
    loadingText.textContent = 'Use a current version of Chrome, Safari, Firefox or Edge.';
    return;
  }

  const state = {
    loaded: false,
    mode: 'explore',
    projection: 'perspective',
    orientation: 'portrait',
    lightSpace: 'world',
    cropVisible: true,
    markerVisible: true,
    locks: { camera:false, head:false, light:false, crop:false, guides:false, all:false },
    guides: { halves:true, thirds:true, diagonals:false },
    headQuat: [0,0,0,1],
    frontQuat: [0,0,0,1],
    cameraQuat: [0,0,0,1],
    pan: [0,0],
    timerEnd: 0,
    timerHandle: null,
    wakeLock: null
  };

  // ---------- Matrix and quaternion helpers ----------
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const rad = d => d * Math.PI / 180;

  function qNorm(q){
    const l = Math.hypot(q[0],q[1],q[2],q[3]) || 1;
    return [q[0]/l,q[1]/l,q[2]/l,q[3]/l];
  }
  function qMul(a,b){
    return qNorm([
      a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
      a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
      a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
      a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
    ]);
  }
  function qConj(q){ return [-q[0],-q[1],-q[2],q[3]]; }
  function qAxis(axis,a){
    const h=a/2,s=Math.sin(h);
    return qNorm([axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(h)]);
  }
  function qEuler(x,y,z){
    return qMul(qAxis([0,0,1],rad(z)), qMul(qAxis([0,1,0],rad(y)), qAxis([1,0,0],rad(x))));
  }
  function qMat(q){
    const [x,y,z,w]=qNorm(q), xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
    return new Float32Array([
      1-2*(yy+zz),2*(xy+wz),2*(xz-wy),0,
      2*(xy-wz),1-2*(xx+zz),2*(yz+wx),0,
      2*(xz+wy),2*(yz-wx),1-2*(xx+yy),0,
      0,0,0,1
    ]);
  }
  function I(){ return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
  function mul(a,b){
    const o=new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++)
      o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return o;
  }
  function tr(x,y,z){ const m=I();m[12]=x;m[13]=y;m[14]=z;return m; }
  function scale(s){ return new Float32Array([s,0,0,0,0,s,0,0,0,0,s,0,0,0,0,1]); }
  function perspective(fovy,aspect,n,f){
    const q=1/Math.tan(fovy/2),nf=1/(n-f);
    return new Float32Array([q/aspect,0,0,0,0,q,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0]);
  }
  function ortho(l,r,b,t,n,f){
    return new Float32Array([
      2/(r-l),0,0,0,
      0,2/(t-b),0,0,
      0,0,-2/(f-n),0,
      -(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1
    ]);
  }

  // ---------- WebGL ----------
  const vs = `#version 300 es
  in vec3 aPos;
  in vec3 aNormal;
  uniform mat4 uModel;
  uniform mat4 uMVP;
  out vec3 vPos;
  out vec3 vNormal;
  void main(){
    vec4 p=uModel*vec4(aPos,1.0);
    vPos=p.xyz;
    vNormal=normalize(mat3(uModel)*aNormal);
    gl_Position=uMVP*vec4(aPos,1.0);
  }`;

  const fs = `#version 300 es
  precision highp float;
  in vec3 vPos;
  in vec3 vNormal;
  uniform vec3 uLight;
  uniform float uKey;
  uniform float uFill;
  uniform float uTone;
  uniform float uShine;
  uniform float uSoft;
  uniform int uValueMode;
  out vec4 outColor;

  void main(){
    vec3 V=normalize(-vPos);
    vec3 N=normalize(vNormal);
    if(!gl_FrontFacing) N=-N;
    vec3 L=normalize(uLight-vPos);
    vec3 H=normalize(L+V);

    float ndl=dot(N,L);
    float raw=max(ndl,0.0);
    float wrapped=clamp((ndl+0.34)/1.34,0.0,1.0);
    float diffuse=mix(raw,wrapped,uSoft*0.72);

    float dist=length(uLight-vPos);
    float att=1.0/(1.0+0.085*dist*dist);
    float lit=diffuse*uKey*att;

    float shine=max(8.0,uShine);
    float spec=pow(max(dot(N,H),0.0),shine);
    float rim=pow(1.0-max(dot(N,V),0.0),2.5);

    vec3 base=vec3(uTone,uTone*0.992,uTone*0.968);
    vec3 col=base*(uFill+lit)
      +vec3(1.0)*spec*uKey*0.018*(1.0-uSoft*0.7)
      +base*rim*0.018;
    col=clamp(col,0.0,1.0);

    float lum=dot(col,vec3(0.2126,0.7152,0.0722));
    if(uValueMode==1){
      col=vec3(lum);
    }else if(uValueMode==2){
      float q=floor(clamp(lum,0.0,0.999)*5.0)/4.0;
      col=vec3(q);
    }else if(uValueMode==3){
      float q=lum<0.34?0.14:(lum<0.67?0.52:0.92);
      col=vec3(q);
    }else if(uValueMode==4){
      col=vec3(0.03);
    }
    outColor=vec4(col,1.0);
  }`;

  function compile(type,src){
    const s=gl.createShader(type);
    gl.shaderSource(s,src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program=gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

  const loc={
    pos:gl.getAttribLocation(program,'aPos'),
    normal:gl.getAttribLocation(program,'aNormal'),
    model:gl.getUniformLocation(program,'uModel'),
    mvp:gl.getUniformLocation(program,'uMVP'),
    light:gl.getUniformLocation(program,'uLight'),
    key:gl.getUniformLocation(program,'uKey'),
    fill:gl.getUniformLocation(program,'uFill'),
    tone:gl.getUniformLocation(program,'uTone'),
    shine:gl.getUniformLocation(program,'uShine'),
    soft:gl.getUniformLocation(program,'uSoft'),
    valueMode:gl.getUniformLocation(program,'uValueMode')
  };

  let posBuf=null,normBuf=null,indexBuf=null,vertexCount=0,indexCount=0,indexed=false;
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  // ---------- STL loading ----------
  const worker = new Worker('./stl-worker.js?v=20261005-1640');

  worker.onmessage = (event) => {
    const msg=event.data;
    if(msg.type==='progress'){
      loadingText.textContent=msg.text;
      progressBar.style.width=msg.percent+'%';
      return;
    }
    if(msg.type==='error'){
      showLoadError(msg.error);
      return;
    }
    if(msg.type==='mesh'){
      uploadRawMesh(new Float32Array(msg.positions),msg.triangleCount,msg.info);
    }
  };

  async function loadRemote(){
    loadingCard.classList.remove('is-hidden');
    loadingTitle.textContent='Loading David';
    loadingText.textContent='Loading the cleaned artist mesh.';
    progressBar.style.width='4%';
    try{
      const response=await fetch(MODEL_URL,{cache:'force-cache'});
      if(!response.ok) throw new Error('HTTP '+response.status);
      const total=Number(response.headers.get('content-length'))||0;
      const reader=response.body?.getReader();
      let buffer;
      if(!reader){
        buffer=await response.arrayBuffer();
      }else{
        let received=0;
        let merged=total?new Uint8Array(total):null;
        const chunks=total?null:[];
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          if(merged) merged.set(value,received); else chunks.push(value);
          received+=value.byteLength;
          if(total){
            progressBar.style.width=Math.min(88,Math.round(received/total*88))+'%';
            loadingText.textContent='Loading cleaned mesh · '+(received/1048576).toFixed(1)+' / '+(total/1048576).toFixed(1)+' MB';
          }
        }
        if(!merged){
          merged=new Uint8Array(received);
          let off=0;for(const c of chunks){merged.set(c,off);off+=c.byteLength;}
        }
        buffer=merged.buffer;
      }
      parseDLB(buffer);
    }catch(err){
      showLoadError(err.message);
    }
  }

  function parseDLB(buffer){
    const bytes=new Uint8Array(buffer,0,4);
    if(bytes[0]!==68||bytes[1]!==76||bytes[2]!==66||bytes[3]!==49) throw new Error('Invalid David mesh header');
    const dv=new DataView(buffer);
    const vertices=dv.getUint32(4,true);
    const indices=dv.getUint32(8,true);
    const posOff=12;
    const norOff=posOff+vertices*3*4;
    const idxOff=norOff+vertices*3*4;
    const expected=idxOff+indices*4;
    if(expected!==buffer.byteLength) throw new Error('David mesh is truncated');
    uploadIndexedMesh(
      new Float32Array(buffer,posOff,vertices*3),
      new Float32Array(buffer,norOff,vertices*3),
      new Uint32Array(buffer,idxOff,indices)
    );
  }

  function clearMeshBuffers(){
    if(posBuf)gl.deleteBuffer(posBuf);
    if(normBuf)gl.deleteBuffer(normBuf);
    if(indexBuf)gl.deleteBuffer(indexBuf);
    posBuf=normBuf=indexBuf=null;
  }

  function uploadIndexedMesh(positions,normals,indices){
    clearMeshBuffers();
    posBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,posBuf);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);
    normBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,normBuf);gl.bufferData(gl.ARRAY_BUFFER,normals,gl.STATIC_DRAW);
    indexBuf=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuf);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    vertexCount=positions.length/3;indexCount=indices.length;indexed=true;
    state.loaded=true;
    loadingCard.classList.add('is-hidden');
    progressBar.style.width='100%';
    setStatus('Clean artist mesh loaded · '+Math.round(indexCount/3).toLocaleString()+' triangles');
    applyHashState();updateAllUI();
  }

  function uploadRawMesh(positions,count,info){
    clearMeshBuffers();
    const normals=new Float32Array(positions.length);
    for(let i=0;i<positions.length;i+=9){
      const ax=positions[i],ay=positions[i+1],az=positions[i+2];
      const bx=positions[i+3],by=positions[i+4],bz=positions[i+5];
      const cx=positions[i+6],cy=positions[i+7],cz=positions[i+8];
      const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
      for(let v=0;v<3;v++){const o=i+v*3;normals[o]=nx;normals[o+1]=ny;normals[o+2]=nz;}
    }
    posBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,posBuf);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);
    normBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,normBuf);gl.bufferData(gl.ARRAY_BUFFER,normals,gl.STATIC_DRAW);
    vertexCount=positions.length/3;indexCount=0;indexed=false;
    state.loaded=true;loadingCard.classList.add('is-hidden');
    setStatus('Local STL loaded · '+Number(count).toLocaleString()+' triangles');
    applyHashState();updateAllUI();
  }

  function showLoadError(message){
    loadingTitle.textContent='Could not load the cleaned David mesh';
    loadingText.textContent='The built-in mesh failed ('+message+'). Retry, or use Open local STL as a fallback.';
    progressBar.style.width='0%';
  }

  async function loadLocal(file){
    if(!file)return;
    loadingCard.classList.remove('is-hidden');
    loadingTitle.textContent='Opening local STL';
    loadingText.textContent='Reading '+file.name+'…';
    progressBar.style.width='15%';
    try{
      const buffer=await file.arrayBuffer();
      worker.postMessage({type:'parse',buffer,cropTop:false},[buffer]);
    }catch(err){ showLoadError(err.message); }
  }

  $('retryLoad').addEventListener('click',loadRemote);
  $('localStl').addEventListener('change',e=>loadLocal(e.target.files[0]));

  // ---------- Rendering ----------
  function resize(){
    const mobile=window.matchMedia('(max-width: 780px)').matches;
    const dpr=mobile?1:Math.min(devicePixelRatio||1,2);
    const w=Math.max(1,Math.floor(canvas.clientWidth*dpr));
    const h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);
  }

  function buildView(){
    const cameraR=qMat(qConj(state.cameraQuat));
    const pan=tr(-state.pan[0],-state.pan[1],0);
    const dist=3.05;
    return mul(tr(0,0,-dist),mul(cameraR,pan));
  }

  function buildProjection(){
    const aspect=canvas.width/canvas.height;
    const zoom=+controls.zoom.value;
    if(state.projection==='orthographic'){
      const half=1.25/zoom;
      return ortho(-half*aspect,half*aspect,-half,half,0.1,100);
    }
    const fov=rad(+controls.fov.value);
    const p=perspective(fov,aspect,0.1,100);
    // perspective zoom is model scale so crop remains intuitive
    return p;
  }

  function worldLight(modelQuat){
    const az=rad(+controls.az.value),el=rad(+controls.el.value),d=+controls.dist.value;
    let v=[d*Math.cos(el)*Math.sin(az),d*Math.sin(el),d*Math.cos(el)*Math.cos(az)];
    if(state.lightSpace==='head'){
      const m=qMat(modelQuat);
      const x=m[0]*v[0]+m[4]*v[1]+m[8]*v[2];
      const y=m[1]*v[0]+m[5]*v[1]+m[9]*v[2];
      const z=m[2]*v[0]+m[6]*v[1]+m[10]*v[2];
      v=[x,y,z];
    }
    return v;
  }

  function valueModeIndex(){
    return {plaster:0,grayscale:1,five:2,three:3,silhouette:4}[controls.valueMode.value]||0;
  }

  function projectPoint(p,mvp){
    const x=p[0],y=p[1],z=p[2];
    const cx=mvp[0]*x+mvp[4]*y+mvp[8]*z+mvp[12];
    const cy=mvp[1]*x+mvp[5]*y+mvp[9]*z+mvp[13];
    const cw=mvp[3]*x+mvp[7]*y+mvp[11]*z+mvp[15];
    if(cw<=0)return null;
    const nx=cx/cw,ny=cy/cw,r=canvas.getBoundingClientRect();
    return {x:(nx*.5+.5)*r.width,y:(1-(ny*.5+.5))*r.height};
  }

  function render(){
    resize();
    const bg=+controls.bg.value;
    gl.clearColor(bg,bg,bg*1.02,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    if(state.loaded){
      const zoom=state.projection==='perspective'?+controls.zoom.value:1;
      const model=mul(qMat(state.headQuat),scale(zoom));
      const view=buildView();
      const proj=buildProjection();
      const vp=mul(proj,view);
      const mvp=mul(vp,model);
      const light=worldLight(state.headQuat);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER,posBuf);
      gl.enableVertexAttribArray(loc.pos);
      gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,normBuf);
      gl.enableVertexAttribArray(loc.normal);
      gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);
      gl.uniformMatrix4fv(loc.model,false,model);
      gl.uniformMatrix4fv(loc.mvp,false,mvp);
      gl.uniform3f(loc.light,light[0],light[1],light[2]);
      gl.uniform1f(loc.key,+controls.key.value);
      gl.uniform1f(loc.fill,+controls.fill.value);
      gl.uniform1f(loc.tone,+controls.tone.value);
      gl.uniform1f(loc.shine,+controls.shine.value);
      gl.uniform1f(loc.soft,+controls.soft.value);
      gl.uniform1i(loc.valueMode,valueModeIndex());
      if(indexed){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuf);gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_INT,0);}else{gl.drawArrays(gl.TRIANGLES,0,vertexCount);}

      if(state.markerVisible && state.mode!=='paint'){
        const sp=projectPoint(light,vp);
        if(sp){
          lightMarker.hidden=false;
          lightMarker.style.left=sp.x+'px';
          lightMarker.style.top=sp.y+'px';
        }else lightMarker.hidden=true;
      }else lightMarker.hidden=true;
    }

    requestAnimationFrame(render);
  }

  // ---------- Interaction ----------
  let dragging=false,lastX=0,lastY=0,dragButton=0;

  canvas.addEventListener('pointerdown',e=>{
    if(!state.loaded)return;
    dragging=true;lastX=e.clientX;lastY=e.clientY;dragButton=e.button;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove',e=>{
    if(!dragging || state.locks.all)return;
    const dx=e.clientX-lastX,dy=e.clientY-lastY;
    const cameraGesture=e.altKey||e.metaKey||dragButton===1;
    const panGesture=dragButton===2;

    if(panGesture && !state.locks.camera){
      state.pan[0]+=dx*0.0026;
      state.pan[1]-=dy*0.0026;
    }else if(cameraGesture && !state.locks.camera){
      state.cameraQuat=qMul(qAxis([0,1,0],-dx*.008),qMul(qAxis([1,0,0],-dy*.008),state.cameraQuat));
    }else if(!state.locks.head){
      if(e.shiftKey) state.headQuat=qMul(qAxis([0,0,1],dx*.008),state.headQuat);
      else state.headQuat=qMul(qAxis([0,1,0],dx*.008),qMul(qAxis([1,0,0],dy*.008),state.headQuat));
      syncEulerFromGesture();
    }
    lastX=e.clientX;lastY=e.clientY;
  });

  canvas.addEventListener('pointerup',()=>dragging=false);
  canvas.addEventListener('pointercancel',()=>dragging=false);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());

  canvas.addEventListener('wheel',e=>{
    if(!state.loaded || state.locks.camera || state.locks.all)return;
    e.preventDefault();
    controls.zoom.value=clamp((+controls.zoom.value)*Math.exp(-e.deltaY*.001),.45,2.8).toFixed(2);
    updateOutputs();
  },{passive:false});

  let touchDistance=0;
  canvas.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      touchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    }
  },{passive:true});
  canvas.addEventListener('touchmove',e=>{
    if(e.touches.length===2 && !state.locks.camera && !state.locks.all){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      if(touchDistance){
        controls.zoom.value=clamp(+controls.zoom.value*(d/touchDistance),.45,2.8).toFixed(2);
        updateOutputs();
      }
      touchDistance=d;
    }
  },{passive:true});

  function syncEulerFromGesture(){
    // Gesture quaternions are not decomposed back to Euler because sliders are an exact pose tool.
    // Mark sliders as free/manual after direct manipulation.
    ['rxOut','ryOut','rzOut'].forEach(id=>$(id).textContent='free');
  }

  ['rx','ry','rz'].forEach(id=>{
    controls[id].addEventListener('input',()=>{
      if(state.locks.head||state.locks.all)return;
      state.headQuat=qMul(state.frontQuat,qEuler(+controls.rx.value,+controls.ry.value,+controls.rz.value));
      updateOutputs();
    });
  });

  ['zoom','fov','az','el','dist','key','fill','soft','tone','shine','bg','guideOpacity'].forEach(id=>{
    controls[id].addEventListener('input',()=>{
      if(['az','el','dist','key','fill','soft'].includes(id)&&(state.locks.light||state.locks.all))return;
      if(id==='zoom'||id==='fov'){
        if(state.locks.camera||state.locks.all)return;
      }
      updateOutputs();
      if(id==='guideOpacity')updateGuides();
    });
  });

  // ---------- Presets ----------
  const views={
    front:[0,0,0],
    threeLeft:[0,-45,0],
    profileLeft:[0,-90,0],
    threeRight:[0,45,0],
    profileRight:[0,90,0],
    back:[0,180,0]
  };

  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{
    if(state.locks.head||state.locks.all)return;
    const e=views[btn.dataset.view];
    controls.rx.value=e[0];controls.ry.value=e[1];controls.rz.value=e[2];
    state.headQuat=qMul(state.frontQuat,qEuler(...e));
    updateOutputs();
  }));

  $('setFront').addEventListener('click',()=>{
    if(state.locks.head||state.locks.all)return;
    state.frontQuat=state.headQuat.slice();
    controls.rx.value=controls.ry.value=controls.rz.value=0;
    updateOutputs();
    setStatus('Current orientation saved as anatomical front.');
  });

  $('resetPose').addEventListener('click',()=>{
    if(state.locks.head||state.locks.all)return;
    controls.rx.value=controls.ry.value=controls.rz.value=0;
    state.headQuat=state.frontQuat.slice();
    updateOutputs();
  });

  document.querySelectorAll('[data-projection]').forEach(btn=>btn.addEventListener('click',()=>{
    if(state.locks.camera||state.locks.all)return;
    state.projection=btn.dataset.projection;
    updateSegmented('#projectionControl','data-projection',state.projection);
    updateOutputs();
  }));

  $('fitView').addEventListener('click',()=>{
    if(state.locks.camera||state.locks.all)return;
    controls.zoom.value=1;state.pan=[0,0];state.cameraQuat=[0,0,0,1];updateOutputs();
  });

  const lightPresets={
    front:[0,12,2.2,1.15,.28],
    three:[42,30,2.2,1.35,.18],
    side:[82,20,2.3,1.4,.14],
    top:[18,70,2.2,1.35,.15],
    under:[15,-55,2.0,1.35,.10],
    rim:[155,25,2.4,1.5,.10],
    flat:[0,8,3.0,.95,.42],
    dramatic:[68,48,1.8,1.7,.06]
  };
  document.querySelectorAll('[data-light]').forEach(btn=>btn.addEventListener('click',()=>{
    if(state.locks.light||state.locks.all)return;
    const p=lightPresets[btn.dataset.light];
    controls.az.value=p[0];controls.el.value=p[1];controls.dist.value=p[2];controls.key.value=p[3];controls.fill.value=p[4];
    updateOutputs();
  }));

  document.querySelectorAll('[data-light-space]').forEach(btn=>btn.addEventListener('click',()=>{
    if(state.locks.light||state.locks.all)return;
    state.lightSpace=btn.dataset.lightSpace;
    updateSegmented('#lightSpaceControl','data-light-space',state.lightSpace);
  }));

  // ---------- Formats and guides ----------
  const formats={
    A5:{w:148,h:210,label:'A5',unit:'mm'},
    A4:{w:210,h:297,label:'A4',unit:'mm'},
    A3:{w:297,h:420,label:'A3',unit:'mm'},
    A2:{w:420,h:594,label:'A2',unit:'mm'},
    A1:{w:594,h:841,label:'A1',unit:'mm'},
    '1:1':{w:1,h:1,label:'Square',unit:''},
    '2:3':{w:2,h:3,label:'2:3',unit:''},
    '3:4':{w:3,h:4,label:'3:4',unit:''},
    '4:5':{w:4,h:5,label:'4:5',unit:''},
    '5:7':{w:5,h:7,label:'5:7',unit:''},
    '16:9':{w:16,h:9,label:'16:9',unit:''},
    letter:{w:8.5,h:11,label:'US Letter',unit:'in'}
  };

  controls.format.addEventListener('change',()=>{ if(!state.locks.crop&&!state.locks.all)updateCrop(); });
  document.querySelectorAll('[data-orientation]').forEach(btn=>btn.addEventListener('click',()=>{
    if(state.locks.crop||state.locks.all)return;
    state.orientation=btn.dataset.orientation;
    updateSegmented('#orientationControl','data-orientation',state.orientation);
    updateCrop();
  }));

  $('toggleCrop').addEventListener('click',()=>{
    if(state.locks.crop||state.locks.all)return;
    state.cropVisible=!state.cropVisible;updateCrop();
  });

  ['guideHalves','guideThirds','guideDiagonals'].forEach(id=>{
    $(id).addEventListener('change',()=>{
      if(state.locks.guides||state.locks.all)return;
      state.guides.halves=$('guideHalves').checked;
      state.guides.thirds=$('guideThirds').checked;
      state.guides.diagonals=$('guideDiagonals').checked;
      updateGuides();
    });
  });

  function updateCrop(){
    cropLayer.hidden=!state.cropVisible;
    $('toggleCrop').classList.toggle('is-active',state.cropVisible);
    if(!state.cropVisible)return;
    const f=formats[controls.format.value]||formats.A3;
    let w=f.w,h=f.h;
    if(state.orientation==='landscape' && h>w)[w,h]=[h,w];
    if(state.orientation==='portrait' && w>h)[w,h]=[h,w];
    const ratio=w/h;
    const r=viewerShell.getBoundingClientRect();
    const maxW=r.width*.82,maxH=r.height*.82;
    let fw=maxW,fh=fw/ratio;
    if(fh>maxH){fh=maxH;fw=fh*ratio;}
    cropFrame.style.width=fw+'px';
    cropFrame.style.height=fh+'px';
    const dims=f.unit?(' · '+w+' × '+h+' '+f.unit):'';
    formatBadge.textContent=f.label+' '+capitalize(state.orientation)+dims;
    updateGuides();
  }

  function updateGuides(){
    const opacity=+controls.guideOpacity.value;
    document.querySelectorAll('[data-guide]').forEach(g=>{
      const type=g.dataset.guide;
      const show=state.guides[type];
      g.style.display=show?'block':'none';
      g.style.opacity=String(opacity);
    });
  }

  // ---------- Locks ----------
  function setLock(name,value){
    state.locks[name]=value;
    if(name==='all'){
      Object.keys(state.locks).forEach(k=>state.locks[k]=value);
    }
    updateLocks();
  }

  document.querySelectorAll('[data-lock]').forEach(btn=>btn.addEventListener('click',()=>{
    const name=btn.dataset.lock;
    setLock(name,!state.locks[name]);
  }));

  $('freezeStudy').addEventListener('click',()=>setLock('all',!state.locks.all));

  function updateLocks(){
    const map={camera:'lockCamera',head:'lockHead',light:'lockLight',crop:'lockCrop',guides:'lockGuides'};
    Object.entries(map).forEach(([k,id])=>{
      const b=$(id);
      b.classList.toggle('is-locked',state.locks[k]||state.locks.all);
      const label=k==='camera'?'POV':k;
      b.textContent=(state.locks[k]||state.locks.all)?('Unlock '+label):('Lock '+label);
    });
    $('freezeStudy').classList.toggle('is-locked',state.locks.all);
    $('freezeStudy').textContent=state.locks.all?'Unlock everything':'Lock everything';
    referenceLock.hidden=!(state.locks.all||state.mode==='paint');
  }

  // ---------- Modes ----------
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.mode)));

  async function setMode(mode){
    state.mode=mode;
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.mode===mode));
    modePill.textContent=mode.toUpperCase();
    viewerShell.classList.toggle('paint-mode',mode==='paint');
    document.body.classList.toggle('paint-mode',mode==='paint');
    if(mode==='paint'){
      setLock('all',true);
      await requestWakeLock();
    }else{
      if(state.wakeLock){ try{await state.wakeLock.release();}catch(e){} state.wakeLock=null; }
    }
    updateCrop();
  }

  async function requestWakeLock(){
    if(!('wakeLock' in navigator))return;
    try{ state.wakeLock=await navigator.wakeLock.request('screen'); }catch(e){}
  }

  // ---------- Random study and timer ----------
  $('randomStudy').addEventListener('click',()=>{
    if(state.locks.all)return;
    const r=(a,b)=>a+Math.random()*(b-a);
    controls.rx.value=Math.round(r(-18,16));
    controls.ry.value=Math.round(r(-72,72));
    controls.rz.value=Math.round(r(-9,9));
    state.headQuat=qMul(state.frontQuat,qEuler(+controls.rx.value,+controls.ry.value,+controls.rz.value));
    controls.az.value=Math.round(r(-100,100));
    controls.el.value=Math.round(r(12,68));
    controls.dist.value=r(1.7,3.0).toFixed(2);
    controls.key.value=r(1.05,1.75).toFixed(2);
    controls.fill.value=r(.06,.28).toFixed(2);
    controls.soft.value=r(.12,.7).toFixed(2);
    updateOutputs();
  });

  controls.timerSelect.addEventListener('change',startTimer);

  function startTimer(){
    clearInterval(state.timerHandle);
    const seconds=+controls.timerSelect.value;
    if(!seconds){state.timerEnd=0;timerDisplay.textContent='00:00';return;}
    state.timerEnd=Date.now()+seconds*1000;
    tickTimer();
    state.timerHandle=setInterval(tickTimer,250);
  }

  function tickTimer(){
    const remain=Math.max(0,Math.ceil((state.timerEnd-Date.now())/1000));
    const m=Math.floor(remain/60),s=remain%60;
    timerDisplay.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    if(remain<=0){clearInterval(state.timerHandle);state.timerHandle=null;}
  }

  // ---------- Persistence / share ----------
  function snapshot(){
    return {
      v:1,
      controls:Object.fromEntries(Object.entries(controls).filter(([k])=>k!=='timerSelect').map(([k,el])=>[k,el.value])),
      projection:state.projection,
      orientation:state.orientation,
      lightSpace:state.lightSpace,
      cropVisible:state.cropVisible,
      markerVisible:state.markerVisible,
      guides:{...state.guides},
      headQuat:state.headQuat,
      frontQuat:state.frontQuat,
      cameraQuat:state.cameraQuat,
      pan:state.pan
    };
  }

  function restore(data){
    if(!data||data.v!==1)return false;
    if(data.controls)Object.entries(data.controls).forEach(([k,v])=>{if(controls[k])controls[k].value=v;});
    state.projection=data.projection||'perspective';
    state.orientation=data.orientation||'portrait';
    state.lightSpace=data.lightSpace||'world';
    state.cropVisible=data.cropVisible!==false;
    state.markerVisible=data.markerVisible!==false;
    state.guides=Object.assign(state.guides,data.guides||{});
    if(Array.isArray(data.headQuat))state.headQuat=data.headQuat;
    if(Array.isArray(data.frontQuat))state.frontQuat=data.frontQuat;
    if(Array.isArray(data.cameraQuat))state.cameraQuat=data.cameraQuat;
    if(Array.isArray(data.pan))state.pan=data.pan;
    $('guideHalves').checked=state.guides.halves;
    $('guideThirds').checked=state.guides.thirds;
    $('guideDiagonals').checked=state.guides.diagonals;
    updateAllUI();
    return true;
  }

  $('saveStudy').addEventListener('click',()=>{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot()));
    setStatus('Study saved on this device.');
  });
  $('restoreStudy').addEventListener('click',()=>{
    try{
      const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      setStatus(restore(d)?'Last saved study restored.':'No saved study found.');
    }catch(e){setStatus('Saved study could not be read.');}
  });
  $('copyStudy').addEventListener('click',async()=>{
    const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(snapshot()))));
    const url=location.href.split('#')[0]+'#s='+encoded;
    try{await navigator.clipboard.writeText(url);setStatus('Study link copied.');}
    catch(e){location.hash='s='+encoded;setStatus('Study state placed in the URL.');}
  });

  function applyHashState(){
    if(!location.hash.startsWith('#s='))return;
    try{
      const json=decodeURIComponent(escape(atob(location.hash.slice(3))));
      restore(JSON.parse(json));
      setStatus('Shared study restored.');
    }catch(e){setStatus('Shared study link could not be decoded.');}
  }

  // ---------- Export ----------
  $('exportPng').addEventListener('click',()=>{
    if(!state.loaded)return;
    canvas.toBlob(blob=>{
      if(!blob)return;
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='david-light-lab.png';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    },'image/png');
  });

  // ---------- Marker, panel, keyboard ----------
  $('toggleLightMarker').addEventListener('click',()=>{
    state.markerVisible=!state.markerVisible;
    $('toggleLightMarker').textContent=state.markerVisible?'Hide marker':'Show marker';
  });

  $('togglePanel').addEventListener('click',()=>{
    const hidden=panel.classList.toggle('is-hidden');
    $('togglePanel').setAttribute('aria-expanded',String(!hidden));
  });

  document.addEventListener('keydown',e=>{
    const tag=(document.activeElement&&document.activeElement.tagName)||'';
    if(['INPUT','SELECT','TEXTAREA'].includes(tag))return;
    if(e.code==='Space'){e.preventDefault();setMode(state.mode==='paint'?'compose':'paint');return;}
    if(e.key==='Escape'&&state.mode==='paint'){setMode('compose');return;}
    if(e.key.toLowerCase()==='o'&&!state.locks.camera){state.projection=state.projection==='perspective'?'orthographic':'perspective';updateAllUI();}
    if(e.key.toLowerCase()==='g'){state.cropVisible=!state.cropVisible;updateCrop();}
    if(e.key.toLowerCase()==='l'){setLock('all',!state.locks.all);}
    if(e.key.toLowerCase()==='f'&&!state.locks.head){
      controls.rx.value=controls.ry.value=controls.rz.value=0;
      state.headQuat=state.frontQuat.slice();updateOutputs();
    }
  });

  // ---------- UI ----------
  function updateSegmented(selector,attr,value){
    document.querySelectorAll(selector+' button').forEach(b=>b.classList.toggle('is-active',b.getAttribute(attr)===value));
  }
  function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}
  function updateOutputs(){
    const pairs={
      rx:'rxOut',ry:'ryOut',rz:'rzOut',zoom:'zoomOut',fov:'fovOut',
      az:'azOut',el:'elOut',dist:'distOut',key:'keyOut',fill:'fillOut',
      soft:'softOut',tone:'toneOut',shine:'shineOut',bg:'bgOut',guideOpacity:'guideOpacityOut'
    };
    Object.entries(pairs).forEach(([k,id])=>{
      const v=controls[k].value;
      let text=v;
      if(['rx','ry','rz','az','el','fov'].includes(k))text=v+'°';
      if(k==='zoom')text=(+v).toFixed(2)+'×';
      if(['dist','key','fill','soft','tone','bg'].includes(k))text=(+v).toFixed(2);
      if(k==='guideOpacity')text=Math.round(+v*100)+'%';
      $(id).textContent=text;
    });
  }
  function updateAllUI(){
    updateOutputs();
    updateSegmented('#projectionControl','data-projection',state.projection);
    updateSegmented('#orientationControl','data-orientation',state.orientation);
    updateSegmented('#lightSpaceControl','data-light-space',state.lightSpace);
    updateLocks();
    updateCrop();
    updateGuides();
    $('toggleLightMarker').textContent=state.markerVisible?'Hide marker':'Show marker';
  }
  function setStatus(text){
    const el=$('viewerHelp');
    const old=el.textContent;
    el.textContent=text;
    clearTimeout(setStatus.t);
    setStatus.t=setTimeout(()=>{el.textContent='Drag to turn · Alt/Option-drag = orbit camera · right-drag = pan · Shift-drag = roll';},3500);
  }

  if(window.matchMedia('(max-width: 780px)').matches){
    panel.classList.add('is-hidden');
    $('togglePanel').setAttribute('aria-expanded','false');
  }

  window.addEventListener('resize',updateCrop);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&state.mode==='paint')requestWakeLock();
  });

  // ---------- Install / PWA ----------
  let deferredInstallPrompt=null;
  const installButton=$('installApp');
  const installDialog=$('installDialog');
  const installInstructions=$('installInstructions');

  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  }
  function showInstallInstructions(){
    const ua=navigator.userAgent||'';
    const apple=/iphone|ipad|ipod/i.test(ua);
    const android=/android/i.test(ua);
    installInstructions.innerHTML=apple
      ? '<p>In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p>'
      : android
        ? '<p>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>'
        : '<p>Use the install icon in the browser address bar, or the browser menu and choose <strong>Install app</strong>.</p>';
    if(typeof installDialog.showModal==='function')installDialog.showModal();
  }
  installButton.addEventListener('click',async()=>{
    if(!deferredInstallPrompt){showInstallInstructions();return;}
    const p=deferredInstallPrompt;deferredInstallPrompt=null;p.prompt();await p.userChoice;
  });
  if(isStandalone())installButton.hidden=true;
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();deferredInstallPrompt=e;installButton.hidden=false;installButton.classList.add('is-ready');
  });
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;installButton.hidden=true;});

  if('serviceWorker' in navigator && location.protocol!=='file:'){
    navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});
  }

  // ---------- DOI ----------
  const cfg=window.DAVID_LIGHT_LAB_CONFIG||{doi:'10.5281/zenodo.0000000',doiUrl:'https://zenodo.org/records/0000000'};
  $('doiText').textContent=cfg.doi;
  $('doiPill').href=cfg.doiUrl;
  $('doiPill').classList.toggle('is-placeholder',cfg.doi.includes('0000000'));

  updateAllUI();
  render();
  loadRemote();
})();
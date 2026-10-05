self.onmessage = (event) => {
  const msg = event.data || {};
  if (msg.type !== 'parse' || !msg.buffer) return;
  try {
    const cropTop = !!msg.cropTop;
    const buffer = msg.buffer;
    const binary = isBinarySTL(buffer);
    postProgress(76, binary ? 'Reading sculpture geometry…' : 'Parsing ASCII STL…');
    const mesh = binary ? parseBinary(buffer, cropTop) : parseASCII(buffer, cropTop);
    postProgress(99, 'Finalising smooth plaster surface…');
    self.postMessage({
      type: 'mesh',
      positions: mesh.positions.buffer,
      triangleCount: mesh.triangleCount,
      info: mesh.info
    }, [mesh.positions.buffer]);
  } catch (error) {
    self.postMessage({ type:'error', error:error && error.message ? error.message : String(error) });
  }
};

function postProgress(percent,text){
  self.postMessage({type:'progress',percent,text});
}

function isBinarySTL(buffer){
  if (buffer.byteLength < 84) return false;
  const dv = new DataView(buffer);
  const n = dv.getUint32(80,true);
  return 84 + n * 50 === buffer.byteLength;
}

function binaryVertex(dv, tri, vertex){
  const o = 84 + tri * 50 + 12 + vertex * 12;
  return [dv.getFloat32(o,true),dv.getFloat32(o+4,true),dv.getFloat32(o+8,true)];
}

function parseBinary(buffer,cropTop){
  const dv=new DataView(buffer);
  const count=dv.getUint32(80,true);
  if(!count || 84+count*50>buffer.byteLength) throw new Error('Invalid binary STL.');

  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],sum=[0,0,0],samples=0;
  for(let i=0;i<count;i++){
    for(let v=0;v<3;v++){
      const p=binaryVertex(dv,i,v);
      for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a]);sum[a]+=p[a];}
      samples++;
    }
    if(i && i%250000===0) postProgress(78,'Scanning '+i.toLocaleString()+' triangles…');
  }

  const ext=[max[0]-min[0],max[1]-min[1],max[2]-min[2]];
  const order=[0,1,2].sort((a,b)=>ext[b]-ext[a]);
  const yAxis=order[0],xAxis=order[1],zAxis=order[2];
  const center=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2];
  const wholeScale=2.10/(ext[yAxis]||1);
  const cutY=cropTop?0.42:-Infinity;

  let selected=0, zMin=Infinity,zMax=-Infinity,zSum=0,zSamples=0;
  for(let i=0;i<count;i++){
    let cy=0;
    const tri=[];
    for(let v=0;v<3;v++){
      const p=binaryVertex(dv,i,v);tri.push(p);
      cy+=(p[yAxis]-center[yAxis])*wholeScale;
    }
    cy/=3;
    if(cy<cutY)continue;
    selected++;
    for(const p of tri){
      const z=p[zAxis];
      zMin=Math.min(zMin,z);zMax=Math.max(zMax,z);zSum+=z;zSamples++;
    }
  }
  if(!selected)throw new Error('No triangles remained after head extraction.');

  const zCenter=(zMin+zMax)/2;
  const zMean=zSum/Math.max(1,zSamples);
  const zSign=(zMean-zCenter)>0?-1:1;

  const positions=new Float32Array(selected*9);
  let out=0;
  let sMin=[Infinity,Infinity,Infinity],sMax=[-Infinity,-Infinity,-Infinity];

  for(let i=0;i<count;i++){
    let cy=0;
    const tri=[];
    for(let v=0;v<3;v++){
      const p=binaryVertex(dv,i,v);tri.push(p);
      cy+=(p[yAxis]-center[yAxis])*wholeScale;
    }
    cy/=3;
    if(cy<cutY)continue;

    for(const p of tri){
      const mapped=[
        (p[xAxis]-center[xAxis])*wholeScale,
        (p[yAxis]-center[yAxis])*wholeScale,
        (p[zAxis]-zCenter)*wholeScale*zSign
      ];
      for(let a=0;a<3;a++){sMin[a]=Math.min(sMin[a],mapped[a]);sMax[a]=Math.max(sMax[a],mapped[a]);}
      positions[out++]=mapped[0];positions[out++]=mapped[1];positions[out++]=mapped[2];
    }
  }

  // Refit only the retained head/bust so it fills the artist viewport.
  const fitCenter=[(sMin[0]+sMax[0])/2,(sMin[1]+sMax[1])/2,(sMin[2]+sMax[2])/2];
  const fitExtent=Math.max(sMax[0]-sMin[0],sMax[1]-sMin[1],sMax[2]-sMin[2])||1;
  const fitScale=2.02/fitExtent;
  for(let i=0;i<positions.length;i+=3){
    positions[i]=(positions[i]-fitCenter[0])*fitScale;
    positions[i+1]=(positions[i+1]-fitCenter[1])*fitScale;
    positions[i+2]=(positions[i+2]-fitCenter[2])*fitScale;
  }

  postProgress(94,'Preparing sculpture surface…');
  return {
    positions,triangleCount:selected,
    info:{sourceAxes:{x:xAxis,y:yAxis,z:zAxis},zSign,cropped:cropTop,sourceTriangles:count}
  };
}

function parseASCII(buffer,cropTop){
  const text=new TextDecoder().decode(buffer);
  const verts=[];
  const re=/vertex\s+([+\-\deE.]+)\s+([+\-\deE.]+)\s+([+\-\deE.]+)/g;
  let m,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  while((m=re.exec(text))){
    const p=[+m[1],+m[2],+m[3]];
    verts.push(...p);
    for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a]);}
  }
  if(verts.length<9||verts.length%9!==0)throw new Error('No valid STL triangles found.');
  const raw=new Float32Array(verts);
  const ext=[max[0]-min[0],max[1]-min[1],max[2]-min[2]];
  const order=[0,1,2].sort((a,b)=>ext[b]-ext[a]);
  const yAxis=order[0],xAxis=order[1],zAxis=order[2];
  const center=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2];
  const wholeScale=2.10/(ext[yAxis]||1);
  const cutY=cropTop?0.42:-Infinity;

  const selected=[];
  let zMin=Infinity,zMax=-Infinity,zSum=0,zSamples=0;
  for(let i=0;i<raw.length;i+=9){
    let cy=0;
    for(let v=0;v<3;v++)cy+=(raw[i+v*3+yAxis]-center[yAxis])*wholeScale;
    cy/=3;if(cy<cutY)continue;
    for(let v=0;v<3;v++){
      const b=i+v*3;
      selected.push(raw[b],raw[b+1],raw[b+2]);
      const z=raw[b+zAxis];zMin=Math.min(zMin,z);zMax=Math.max(zMax,z);zSum+=z;zSamples++;
    }
  }
  if(!selected.length)throw new Error('No triangles remained after head extraction.');
  const zCenter=(zMin+zMax)/2,zMean=zSum/Math.max(1,zSamples),zSign=(zMean-zCenter)>0?-1:1;
  const positions=new Float32Array(selected.length);
  let sMin=[Infinity,Infinity,Infinity],sMax=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<selected.length;i+=3){
    const p=[selected[i],selected[i+1],selected[i+2]];
    const mapped=[(p[xAxis]-center[xAxis])*wholeScale,(p[yAxis]-center[yAxis])*wholeScale,(p[zAxis]-zCenter)*wholeScale*zSign];
    positions[i]=mapped[0];positions[i+1]=mapped[1];positions[i+2]=mapped[2];
    for(let a=0;a<3;a++){sMin[a]=Math.min(sMin[a],mapped[a]);sMax[a]=Math.max(sMax[a],mapped[a]);}
  }
  const fc=[(sMin[0]+sMax[0])/2,(sMin[1]+sMax[1])/2,(sMin[2]+sMax[2])/2];
  const fe=Math.max(sMax[0]-sMin[0],sMax[1]-sMin[1],sMax[2]-sMin[2])||1;
  const fs=2.02/fe;
  for(let i=0;i<positions.length;i+=3){
    positions[i]=(positions[i]-fc[0])*fs;positions[i+1]=(positions[i+1]-fc[1])*fs;positions[i+2]=(positions[i+2]-fc[2])*fs;
  }
  return {positions,triangleCount:positions.length/9,info:{sourceAxes:{x:xAxis,y:yAxis,z:zAxis},zSign,cropped:cropTop}};
}

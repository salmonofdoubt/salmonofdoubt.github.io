self.onmessage = (event) => {
  const msg = event.data || {};
  if (msg.type !== 'parse' || !msg.buffer) return;
  try {
    const buffer = msg.buffer;
    const binary = isBinarySTL(buffer);
    postProgress(76, binary ? 'Parsing binary STL…' : 'Parsing ASCII STL…');
    const mesh = binary ? parseBinary(buffer) : parseASCII(buffer);
    postProgress(98, 'Finalising mesh…');
    self.postMessage({
      type: 'mesh',
      positions: mesh.positions.buffer,
      normals: mesh.normals.buffer,
      triangleCount: mesh.triangleCount,
      info: mesh.info
    }, [mesh.positions.buffer, mesh.normals.buffer]);
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

function parseBinary(buffer){
  const dv = new DataView(buffer);
  const count = dv.getUint32(80,true);
  if (!count || 84 + count*50 > buffer.byteLength) throw new Error('Invalid binary STL.');
  const raw = new Float32Array(count*9);

  let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  let sums=[0,0,0], samples=0;
  let off=84, p=0;

  for(let i=0;i<count;i++){
    off += 12; // source normal
    for(let j=0;j<3;j++){
      const x=dv.getFloat32(off,true), y=dv.getFloat32(off+4,true), z=dv.getFloat32(off+8,true);
      off += 12;
      raw[p++]=x; raw[p++]=y; raw[p++]=z;
      min[0]=Math.min(min[0],x); min[1]=Math.min(min[1],y); min[2]=Math.min(min[2],z);
      max[0]=Math.max(max[0],x); max[1]=Math.max(max[1],y); max[2]=Math.max(max[2],z);
      sums[0]+=x; sums[1]+=y; sums[2]+=z; samples++;
    }
    off += 2;
    if(i && i%200000===0) postProgress(76+Math.min(12,Math.round(i/count*12)),'Reading '+i.toLocaleString()+' triangles…');
  }

  return orientAndNormalise(raw,count,min,max,sums.map(s=>s/samples));
}

function parseASCII(buffer){
  const text = new TextDecoder().decode(buffer);
  const verts=[];
  const re=/vertex\s+([+\-\deE.]+)\s+([+\-\deE.]+)\s+([+\-\deE.]+)/g;
  let m, min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity], sums=[0,0,0], samples=0;
  while((m=re.exec(text))){
    const x=+m[1],y=+m[2],z=+m[3];
    verts.push(x,y,z);
    min[0]=Math.min(min[0],x); min[1]=Math.min(min[1],y); min[2]=Math.min(min[2],z);
    max[0]=Math.max(max[0],x); max[1]=Math.max(max[1],y); max[2]=Math.max(max[2],z);
    sums[0]+=x;sums[1]+=y;sums[2]+=z;samples++;
  }
  if(verts.length<9 || verts.length%9!==0) throw new Error('No valid STL triangles found.');
  return orientAndNormalise(new Float32Array(verts),verts.length/9,min,max,sums.map(s=>s/samples));
}

function orientAndNormalise(raw,triangleCount,min,max,mean){
  const ext=[max[0]-min[0],max[1]-min[1],max[2]-min[2]];
  const order=[0,1,2].sort((a,b)=>ext[b]-ext[a]);
  const yAxis=order[0];       // longest: physical height
  const xAxis=order[1];       // next: width
  const zAxis=order[2];       // shortest: depth

  const center=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2];
  const longest=ext[yAxis] || Math.max(...ext) || 1;
  const scale=2.10/longest;

  // Heuristic: the front/nose tends to be the sparse projection from the bulk.
  // Choose +Z so the mean of the bulk lies slightly behind the bbox centre.
  const mappedMeanZ=(mean[zAxis]-center[zAxis])*scale;
  const zSign=mappedMeanZ>0?-1:1;

  const positions=new Float32Array(raw.length);
  const normals=new Float32Array(raw.length);

  for(let i=0;i<raw.length;i+=9){
    const tri=[];
    for(let v=0;v<3;v++){
      const base=i+v*3;
      const src=[raw[base],raw[base+1],raw[base+2]];
      const x=(src[xAxis]-center[xAxis])*scale;
      const y=(src[yAxis]-center[yAxis])*scale;
      const z=(src[zAxis]-center[zAxis])*scale*zSign;
      tri.push([x,y,z]);
      positions[base]=x;positions[base+1]=y;positions[base+2]=z;
    }

    const a=tri[0],b=tri[1],c=tri[2];
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
    const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    let len=Math.hypot(nx,ny,nz)||1;
    nx/=len;ny/=len;nz/=len;

    // Prefer outward-facing normal relative to the model centre.
    const cx=(a[0]+b[0]+c[0])/3,cy=(a[1]+b[1]+c[1])/3,cz=(a[2]+b[2]+c[2])/3;
    if(nx*cx+ny*cy+nz*cz<0){nx=-nx;ny=-ny;nz=-nz;}

    for(let v=0;v<3;v++){
      const base=i+v*3;
      normals[base]=nx;normals[base+1]=ny;normals[base+2]=nz;
    }
  }

  return {
    positions,
    normals,
    triangleCount,
    info:{sourceAxes:{x:xAxis,y:yAxis,z:zAxis},zSign}
  };
}

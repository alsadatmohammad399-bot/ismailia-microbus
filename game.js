import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const $=id=>document.getElementById(id);
const canvas=$('c');
const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,preserveDrawingBuffer:!!location.search.includes('shot')});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.5:2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.95;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(60,1,0.5,900);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
const pm=new THREE.PMREMGenerator(renderer);
scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;scene.environmentIntensity=0.5;
{const c=document.createElement('canvas');c.width=16;c.height=512;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,512);
 gr.addColorStop(0,'#3f7fc4');gr.addColorStop(0.55,'#9ec3e6');gr.addColorStop(0.85,'#f3dcb8');gr.addColorStop(1,'#f6e7cf');g.fillStyle=gr;g.fillRect(0,0,16,512);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;scene.background=t;}
scene.fog=new THREE.Fog(0xe9d9bd,120,520);
const sun=new THREE.DirectionalLight(0xfff0d8,3.0);
sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:140});sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.04;
scene.add(sun,sun.target);scene.add(new THREE.HemisphereLight(0xbcd6f5,0x8a7a62,0.8));

function rnd(seed){let s=seed%2147483647;if(s<=0)s+=2147483646;return()=>{s=s*16807%2147483647;return(s-1)/2147483646}}
function ctex(w,h,fn,rep,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);return t}
function noise(g,w,h,n,a,seed){const r=rnd(seed);for(let i=0;i<n;i++){const v=Math.floor(r()*255);g.fillStyle=`rgba(${v},${v},${v},${a})`;g.fillRect(r()*w,r()*h,1+r()*2,1+r()*2)}}

// ---------------- data ----------------
const data=await (await fetch('d_rest.json')).json();data.roads=[].concat(...await Promise.all([0,1,2,3].map(async i=>(await fetch('d_roads'+i+'.json')).json())));
const BOUND={x0:-3000,x1:4200,z0:-3300,z1:3300};
const inB=p=>p[0]>BOUND.x0&&p[0]<BOUND.x1&&p[1]>BOUND.z0&&p[1]<BOUND.z1;
// split ways at out-of-bounds points
const ways=[];
for(const r of data.roads){let cur=[];for(const p of r.p){if(inB(p))cur.push(p);else{if(cur.length>1)ways.push({...r,p:cur});cur=[]}}if(cur.length>1)ways.push({...r,p:cur})}
// spatial grid of segments
const CELL=60;const segGrid=new Map();const key=(i,j)=>i*100003+j;
const segs=[];
function addSegToGrid(a,b,hw,wi){const id=segs.length;segs.push([a[0],a[1],b[0],b[1],hw,wi]);
 const x0=Math.floor((Math.min(a[0],b[0])-hw)/CELL),x1=Math.floor((Math.max(a[0],b[0])+hw)/CELL),z0=Math.floor((Math.min(a[1],b[1])-hw)/CELL),z1=Math.floor((Math.max(a[1],b[1])+hw)/CELL);
 for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const k=key(i,j);let l=segGrid.get(k);if(!l)segGrid.set(k,l=[]);l.push(id)}}
ways.forEach((r,wi)=>{for(let i=0;i<r.p.length-1;i++)addSegToGrid(r.p[i],r.p[i+1],r.w/2,wi)});
function distSeg(px,pz,s){const dx=s[2]-s[0],dz=s[3]-s[1];const l2=dx*dx+dz*dz;let t=l2>0?((px-s[0])*dx+(pz-s[1])*dz)/l2:0;t=Math.max(0,Math.min(1,t));const x=s[0]+t*dx,z=s[1]+t*dz;return Math.hypot(px-x,pz-z)}
// returns {d: distance beyond road edge (<=0 on road), wi, h}
function roadAt(px,pz,rad=0){let best=1e9,bi=-1;const ci=Math.floor(px/CELL),cj=Math.floor(pz/CELL);
 for(let i=ci-1;i<=ci+1;i++)for(let j=cj-1;j<=cj+1;j++){const l=segGrid.get(key(i,j));if(!l)continue;for(const id of l){const s=segs[id];const d=distSeg(px,pz,s)-s[4];if(d<best){best=d;bi=id}}}
 return{d:best,seg:bi>=0?segs[bi]:null}}

// ---------------- ground & roads ----------------
const groundT=ctex(512,512,(g,w,h)=>{g.fillStyle='#b9a888';g.fillRect(0,0,w,h);noise(g,w,h,30000,0.10,4);const r=rnd(8);for(let i=0;i<60;i++){g.fillStyle=`rgba(90,100,60,${0.05+r()*0.08})`;g.beginPath();g.ellipse(r()*w,r()*h,10+r()*40,6+r()*20,0,0,7);g.fill()}},[120,120]);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(14000,14000),new THREE.MeshStandardMaterial({map:groundT,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.set(600,-0.06,0);ground.receiveShadow=true;scene.add(ground);

const asphalt=ctex(256,256,(g,w,h)=>{g.fillStyle='#4b4c50';g.fillRect(0,0,w,h);noise(g,w,h,9000,0.14,7);const r=rnd(5);for(let i=0;i<5;i++){g.strokeStyle='rgba(20,20,20,.25)';g.lineWidth=1+r()*2;g.beginPath();let x=r()*w,y=r()*h;g.moveTo(x,y);for(let k=0;k<4;k++){x+=r()*60-30;y+=r()*60-30;g.lineTo(x,y)}g.stroke()}},null);
const asphaltM=ctex(256,256,(g,w,h)=>{g.fillStyle='#4b4c50';g.fillRect(0,0,w,h);noise(g,w,h,9000,0.14,9);
 g.fillStyle='#e8e4d4';g.fillRect(w/2-3,0,6,h*0.45);g.fillStyle='rgba(235,230,210,.85)';g.fillRect(6,0,3,h);g.fillRect(w-9,0,3,h)},null);
const walkT=ctex(128,128,(g,w,h)=>{g.fillStyle='#b4ad9d';g.fillRect(0,0,w,h);noise(g,w,h,4000,0.1,5);g.strokeStyle='rgba(60,55,45,.5)';g.lineWidth=2;g.strokeRect(0,0,w,h)},null);
function ribbons(list,widthFn,y,uvScale){const pos=[],uv=[],idx=[];let vc=0;
 for(const r of list){const p=r.p;const w=widthFn(r);let acc=0;const n=p.length;
  const L=[],R=[];
  for(let i=0;i<n;i++){let dx,dz;if(i===0){dx=p[1][0]-p[0][0];dz=p[1][1]-p[0][1]}else if(i===n-1){dx=p[i][0]-p[i-1][0];dz=p[i][1]-p[i-1][1]}else{dx=p[i+1][0]-p[i-1][0];dz=p[i+1][1]-p[i-1][1]}
   const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const nx=-dz,nz=dx;
   if(i>0)acc+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
   pos.push(p[i][0]+nx*w/2,y,p[i][1]+nz*w/2,p[i][0]-nx*w/2,y,p[i][1]-nz*w/2);uv.push(0,acc/uvScale,1,acc/uvScale)}
  for(let i=0;i<n-1;i++){const a=vc+i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}vc+=n*2}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
const flipUp=g=>{const n=g.attributes.normal;for(let i=0;i<n.count;i++){if(n.getY(i)<0)n.setXYZ(i,-n.getX(i),-n.getY(i),-n.getZ(i))}};
const mk=(g,mat,order)=>{const m=new THREE.Mesh(g,mat);m.receiveShadow=true;m.renderOrder=order;scene.add(m);return m};
const bigRoads=ways.filter(r=>r.w>=8.5&&!r.t),smallRoads=ways.filter(r=>r.w<8.5&&!r.t);
const sideRoads=ways.filter(r=>r.w>=6&&!r.t);
function mat(map,po){return new THREE.MeshStandardMaterial({map,roughness:0.92,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:po,polygonOffsetUnits:po})}
{const g=ribbons(sideRoads,r=>r.w+5,0.0,8);mk(g,mat(walkT,-1),1)}
{const g=ribbons(smallRoads,r=>r.w,0.0,8);mk(g,mat(asphalt,-3),2)}
{const g=ribbons(bigRoads,r=>r.w,0.0,16);mk(g,mat(asphaltM,-4),3)}
asphalt.repeat.set(1/ (1),1);

// ---------------- buildings ----------------
const bayT=ctex(128,128,(g,w,h)=>{g.fillStyle='#f2efe8';g.fillRect(0,0,w,h);noise(g,w,h,2500,0.05,3);
 g.fillStyle='#8f8878';g.fillRect(0,0,w,6);g.fillRect(0,h-4,w,4);
 g.fillStyle='#2b3138';g.fillRect(30,24,68,74);g.fillStyle='#7f9db5';g.fillRect(33,27,62,68);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(33,27,28,68);
 g.fillStyle='#d9d4c6';g.fillRect(24,18,80,6);g.fillRect(24,98,80,7);g.fillStyle='#3a3a3a';g.fillRect(20,70,88,5);for(let i=0;i<9;i++)g.fillRect(22+i*9.5,46,2,26)},[1,1]);
const bMat=new THREE.MeshStandardMaterial({map:bayT,vertexColors:true,roughness:0.9});
const palette=[0xe8d9b8,0xd9c9a6,0xefe3c8,0xcfbb97,0xe4cfae,0xf0e6d2,0xd6c4a1,0xc9b79a,0xe1d3bb,0xb8a98a].map(c=>new THREE.Color(c));
const bGrid=new Map();const BC=40;const bkey=(i,j)=>i*100003+j;const blds=[];
const R=rnd(2026);
function roadClear(x,z,pad){const r=roadAt(x,z);return r.d>pad}
const cells=new Map();// merged chunk buffers
const CH=250;
function pushBox(cx,cz,hw,hd,ang,floors,col){const h=floors*3.1+0.8;const c=Math.cos(ang),s=Math.sin(ang);
 const ck=Math.floor(cx/CH)+','+Math.floor(cz/CH);let b=cells.get(ck);if(!b){b={pos:[],nor:[],uv:[],col:[],idx:[],cx:(Math.floor(cx/CH)+.5)*CH,cz:(Math.floor(cz/CH)+.5)*CH};cells.set(ck,b)}
 const corners=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([x,z])=>[cx+x*c-z*s,cz+x*s+z*c]);
 const faces=[[0,1],[1,2],[2,3],[3,0]];
 for(const [a,bb] of faces){const A=corners[a],B=corners[bb];const len=Math.hypot(B[0]-A[0],B[1]-A[1]);const nx=(B[1]-A[1])/len,nz=-(B[0]-A[0])/len;
  const base=b.pos.length/3;const bays=Math.max(1,Math.round(len/3.4));
  b.pos.push(A[0],0,A[1],B[0],0,B[1],B[0],h,B[1],A[0],h,A[1]);for(let k=0;k<4;k++){b.nor.push(nx,0,nz);b.col.push(col.r,col.g,col.b)}
  b.uv.push(0,0,bays,0,bays,floors,0,floors);b.idx.push(base,base+1,base+2,base,base+2,base+3)}
 const base=b.pos.length/3;for(const C of corners){b.pos.push(C[0],h,C[1]);b.nor.push(0,1,0);b.col.push(col.r*0.7,col.g*0.7,col.b*0.7);b.uv.push(0.05,0.5)}
 b.idx.push(base,base+2,base+1,base,base+3,base+2);
 const o={x:cx,z:cz,hw,hd,c,s};blds.push(o);const bi=Math.floor(cx/BC),bj=Math.floor(cz/BC);const k=bkey(bi,bj);let l=bGrid.get(k);if(!l)bGrid.set(k,l=[]);l.push(o)}
function nearBld(x,z,r){const bi=Math.floor(x/BC),bj=Math.floor(z/BC);const out=[];for(let i=bi-1;i<=bi+1;i++)for(let j=bj-1;j<=bj+1;j++){const l=bGrid.get(bkey(i,j));if(l)out.push(...l)}return out}
for(const h of data.hubs){let best=1e9,bp=h.p;for(const s of segs){const d=distSeg(h.p[0],h.p[1],s);if(d<best){best=d;const dx=s[2]-s[0],dz=s[3]-s[1];const l2=dx*dx+dz*dz;let t=l2?((h.p[0]-s[0])*dx+(h.p[1]-s[1])*dz)/l2:0;t=Math.max(0,Math.min(1,t));bp=[s[0]+t*dx,s[1]+t*dz]}}h.pos=bp}
let placed=0;const MAXB=26000;
for(const r of ways){if(r.w<6.5||r.t||placed>MAXB)continue;const p=r.p;let carry=R()*10;
 for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;const dx=(b[0]-a[0])/L,dz=(b[1]-a[1])/L,nx=-dz,nz=dx;
  for(let t=carry;t<L;t+=0+(11+R()*7)){const px=a[0]+dx*t,pz=a[1]+dz*t;
   if(Math.hypot(px-data.hubs[0].pos[0],pz-data.hubs[0].pos[1])<85)continue;
   for(const side of [-1,1]){const depth=9+R()*7,wid=10+R()*6,off=r.w/2+(r.w>=6.5?2.5:0)+3.2+depth/2+R()*1.5;
    const cx=px+nx*side*off,cz=pz+nz*side*off;const ang=Math.atan2(dz,dx);
    const rad=Math.hypot(wid,depth)/2;
    // clear of other roads: sample center and corners
    let ok=roadAt(cx,cz).d>rad*0.55+1.5;
    if(ok){for(const [qx,qz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const x=cx+dx*qx*wid/2+nx*qz*depth/2,z=cz+dz*qx*wid/2+nz*qz*depth/2;if(roadAt(x,z).d<2.2){ok=false;break}}}
    if(!ok)continue;
    for(const o of nearBld(cx,cz,rad)){if(Math.hypot(o.x-cx,o.z-cz)<(rad+Math.hypot(o.hw,o.hd))*0.82){ok=false;break}}
    if(!ok)continue;
    const major=r.w>=10;const floors=Math.round((major?4:3)+R()*(major?6:5));
    pushBox(cx,cz,wid/2,depth/2,ang,floors,palette[Math.floor(R()*palette.length)]);placed++}
  }carry=(carry+Math.ceil((L-carry)/14)*14)-L;if(carry<0)carry=0}}
const chunkMeshes=[];
for(const [k,b] of cells){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(b.col,3));g.setIndex(b.idx);g.computeBoundingSphere();
 const m=new THREE.Mesh(g,bMat);m.castShadow=true;m.receiveShadow=true;scene.add(m);chunkMeshes.push({m,cx:b.cx,cz:b.cz})}
console.log('buildings',placed,'chunks',chunkMeshes.length,'roads',ways.length);

// ---------------- POI signs, hubs ----------------
function signTex(text,bg,fg){return ctex(512,128,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=6;g.strokeRect(5,5,w-10,h-10);g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';let fs=56;g.font=`bold ${fs}px "Noto Kufi Arabic",Tahoma,sans-serif`;while(g.measureText(text).width>w-40&&fs>20){fs-=3;g.font=`bold ${fs}px "Noto Kufi Arabic",Tahoma,sans-serif`}g.fillText(text,w/2,h/2+4)},null)}
const signCols=[['#0b7a3b','#fff'],['#1c3f8f','#fff'],['#6b1f1f','#ffe6b0'],['#c45a10','#fff'],['#0f4d6b','#fff']];
data.pois.forEach((p,i)=>{const [bg,fg]=signCols[i%signCols.length];const m=new THREE.Mesh(new THREE.PlaneGeometry(7,1.75),new THREE.MeshBasicMaterial({map:signTex(p.n,bg,fg),toneMapped:false,side:THREE.DoubleSide}));
 const rd=roadAt(p.p[0],p.p[1]);let ang=0;if(rd.seg){ang=Math.atan2(rd.seg[3]-rd.seg[1],rd.seg[2]-rd.seg[0])}
 m.position.set(p.p[0],4.2,p.p[1]);m.rotation.y=-ang;scene.add(m);
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,4,6),new THREE.MeshStandardMaterial({color:0x333333}));pole.position.set(p.p[0],2,p.p[1]);scene.add(pole)});
// snap hubs to road
const hubSign=(h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(9,2.25),new THREE.MeshBasicMaterial({map:signTex(h.n,'#ffc107','#2d1b4e'),toneMapped:false,side:THREE.DoubleSide}));m.material.side=THREE.FrontSide;m.position.set(h.pos[0],6.5,h.pos[1]);scene.add(m);{const m2=new THREE.Mesh(m.geometry,m.material);m2.position.copy(m.position);m2.position.z-=0.04;m2.rotation.y=Math.PI;scene.add(m2)}
 const pl=[[-4,0],[4,0]];for(const [x] of pl){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,6.5,6),new THREE.MeshStandardMaterial({color:0x222222}));p.position.set(h.pos[0]+x,3.2,h.pos[1]);scene.add(p)}
 return m};
data.hubs.slice(1).forEach(hubSign);


// ---------------- crowd: Quaternius CC0 low-poly humans (instanced) ----------------
const crowd=(()=>{
 const TYPES=['male_casual','male_long_sleeve','male_shirt','male_suit','female_casual','female_dress','female_tank_top'];
 const persons=[];const parts=[];let ready=false;let loaded=0;
 const skin=[0xe0b48f,0xc99468,0xa87650,0x8d5f3d].map(c=>new THREE.Color(c));
 const cloth=[0xf2f2ee,0x2b3a55,0x6b2b2b,0x3d5a3d,0xc9b48a,0x222222,0x8a8a8a,0x9fb7cc,0xb5543a,0x5a4a7a,0xd9c27a,0x1f5f7a].map(c=>new THREE.Color(c));
 const pants=[0x1c2230,0x2d3340,0x40382e,0x222222,0x3a4a66,0x58503f].map(c=>new THREE.Color(c));
 const hair=[0x111111,0x1a1410,0x2a1c12,0x3a2a1a].map(c=>new THREE.Color(c));
 const dummy=new THREE.Object3D();
 function add(){const p={x:0,z:0,h:0,walk:0,ph:Math.random()*6.28,type:Math.floor(Math.random()*TYPES.length),idx:0,col:{}};p.col={Skin:skin[Math.floor(Math.random()*skin.length)],Hair:hair[Math.floor(Math.random()*hair.length)],Shirt:cloth[Math.floor(Math.random()*cloth.length)],Dress:cloth[Math.floor(Math.random()*cloth.length)],Pants:pants[Math.floor(Math.random()*pants.length)]};persons.push(p);return p}
 function build(){const cnt=TYPES.map(()=>0);for(const p of persons){p.idx=cnt[p.type]++}
  const L=new GLTFLoader();
  TYPES.forEach((tn,ti)=>L.load('https://cdn.jsdelivr.net/gh/Papyszoo/CC0-Public-Domain-Models@main/packs/'+(tn.startsWith('male')?'quaternius-animatedmen':'quaternius-animatedwomen')+'/models/'+tn+'/'+tn+'.glb',g=>{const o=g.scene;o.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(o);const sc=1.74/(bb.max.y-bb.min.y);const cx=(bb.max.x+bb.min.x)/2,cz=(bb.max.z+bb.min.z)/2;
    const N=Math.max(1,cnt[ti]);
    o.traverse(m=>{if(!m.isMesh)return;const geo=m.geometry.clone();geo.applyMatrix4(m.matrixWorld);geo.translate(-cx,-bb.min.y,-cz);geo.scale(sc,sc,sc);
     const mat=m.material.clone();mat.color=new THREE.Color(0xffffff);mat.map=null;mat.roughness=0.85;mat.metalness=0;
     const im=new THREE.InstancedMesh(geo,mat,N);im.frustumCulled=false;im.castShadow=false;im.count=cnt[ti];
     const nm=m.material.name;const base=m.material.color?m.material.color.clone():new THREE.Color(0x888888);
     parts.push({im,ti,nm,base});scene.add(im)});
    if(++loaded===TYPES.length){for(const q of parts){for(const p of persons)if(p.type===q.ti){const c=p.col[q.nm]||q.base;q.im.setColorAt(p.idx,c)}if(q.im.instanceColor)q.im.instanceColor.needsUpdate=true}ready=true}},undefined,e=>console.log('crowd load fail',tn,e.message)))}
 function flush(t){if(!ready)return;
  for(const q of parts){const im=q.im;for(const p of persons)if(p.type===q.ti){const bob=p.walk?Math.abs(Math.sin(t*6+p.ph))*0.045:0;const lean=p.walk?Math.sin(t*6+p.ph)*0.05:0;
    dummy.position.set(p.x,bob,p.z);dummy.rotation.set(p.walk?0.06:0,p.h,lean,'YXZ');dummy.scale.set(1,1,1);dummy.updateMatrix();im.setMatrixAt(p.idx,dummy.matrix)}im.instanceMatrix.needsUpdate=true}}
 return {add,build,flush,persons}})();

// ---------------- الموقف الكبير: full terminal yard ----------------
const terminal=(()=>{
 const h0=data.hubs[0];const rd=roadAt(h0.pos[0],h0.pos[1]);const sg=rd.seg||[0,0,1,0];
 let ux=sg[2]-sg[0],uz=sg[3]-sg[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
 let nx=-uz,nz=ux;const DEP=22,WID=70;
 const test=sd=>{const cx=h0.pos[0]+nx*sd*(DEP/2+9),cz=h0.pos[1]+nz*sd*(DEP/2+9);return roadAt(cx,cz).d};
 const sd=test(1)>=test(-1)?1:-1;nx*=sd;nz*=sd;
 const C=[h0.pos[0]+nx*(DEP/2+9),h0.pos[1]+nz*(DEP/2+9)];
 h0.road=[h0.pos[0],h0.pos[1]];const L=(a,b)=>[C[0]+ux*a+nx*b,C[1]+uz*a+nz*b]; // a along road, b toward lot depth(+ away from road)
 // ground
 const gm=new THREE.Mesh(new THREE.PlaneGeometry(WID+6,DEP+6),new THREE.MeshStandardMaterial({color:0x4a4b4d,roughness:0.95}));
 gm.rotation.x=-Math.PI/2;gm.rotation.z=Math.atan2(uz,ux)*1;gm.position.set(C[0],0.06,C[1]);
 // plane rotated: make by basis instead
 const m4=new THREE.Matrix4().makeBasis(new THREE.Vector3(ux,0,uz),new THREE.Vector3(0,1,0),new THREE.Vector3(-uz,0,ux));
 gm.rotation.set(0,0,0);gm.quaternion.setFromRotationMatrix(m4);gm.rotateX(-Math.PI/2);gm.position.set(C[0],0.07,C[1]);scene.add(gm);
 // entrance link to the road
 const lk=new THREE.Mesh(new THREE.PlaneGeometry(18,12),new THREE.MeshStandardMaterial({color:0x4a4b4d,roughness:0.95}));lk.quaternion.copy(gm.quaternion);lk.position.set(h0.pos[0]+nx*4,0.075,h0.pos[1]+nz*4);scene.add(lk);
 // lane markings between columns
 const COLS=[];const names=['إسكندرية','طنطا','القاهرة','بورسعيد','السويس','المنصورة','الزقازيق','دمياط','شرم الشيخ','العريش','المنيا','أسيوط','الفيوم','بنها','كفر الشيخ','بني سويف'];
 const colW=3.5;const aisle=10;const perBlk=8;
 for(let blk=0;blk<2;blk++)for(let i=0;i<perBlk;i++){const a=(blk?aisle/2+colW/2:-aisle/2-colW/2-(perBlk-1)*colW)+i*colW;COLS.push(a)}
 // vans
 const N=COLS.length*3;
 const tpl=makeVan();tpl.updateMatrixWorld(true);const parts=[];
 tpl.traverse(o=>{if(o.isMesh){const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);parts.push({g,m:o.material})}});
 const ims=parts.map(p=>{const im=new THREE.InstancedMesh(p.g,p.m,N);im.castShadow=false;return im});
 const dummy=new THREE.Object3D();const ang2=Math.atan2(nz,-nx);let k=0;const col=new THREE.Color();
 COLS.forEach((a,ci)=>{for(let r=0;r<3;r++){const b=-DEP/2+4.2+r*6.6+(R()-0.5)*0.4;const p=L(a,b+DEP/2);
   dummy.position.set(p[0],0,p[1]);dummy.rotation.set(0,ang2,0);dummy.scale.set(1,1,1);dummy.updateMatrix();for(const im of ims)im.setMatrixAt(k,dummy.matrix);k++;
   const o={x:p[0],z:p[1],hw:2.75,hd:0.95,c:nx,s:nz};blds.push(o);const bi=Math.floor(p[0]/BC),bj=Math.floor(p[1]/BC);const kk=bkey(bi,bj);let l=bGrid.get(kk);if(!l)bGrid.set(kk,l=[]);l.push(o)}});
 for(const im of ims){im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;scene.add(im)}
 // destination signs on poles at the front of each column
 const sMat=new THREE.MeshStandardMaterial({color:0x222222});
 COLS.forEach((a,ci)=>{const nm=names[ci%names.length];const p=L(a,DEP/2-1.2);const sp=L(a,-0.2+DEP/2-DEP/2);
   const q=L(a,0.6);
   const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,3.3,6),sMat);pole.position.set(q[0],1.65,q[1]);scene.add(pole);
   const pl=new THREE.Mesh(new THREE.PlaneGeometry(3.2,0.8),new THREE.MeshBasicMaterial({map:signTex(nm,'#1f5fb5','#ffffff'),toneMapped:false,side:THREE.DoubleSide}));
   pl.position.set(q[0],3.5,q[1]);pl.rotation.y=Math.atan2(ux,uz)+Math.PI/2*0;pl.material.side=THREE.FrontSide;pl.rotation.y=Math.atan2(nx,nz)+Math.PI;scene.add(pl);{const p2=new THREE.Mesh(pl.geometry,pl.material);p2.position.copy(pl.position).addScaledVector(new THREE.Vector3(nx,0,nz),0.04);p2.rotation.y=Math.atan2(nx,nz);scene.add(p2)}});
 // big terminal gate sign
 const gs=L(0,-2);const big=new THREE.Mesh(new THREE.PlaneGeometry(12,3),new THREE.MeshBasicMaterial({map:signTex('الموقف الكبير - الإسماعيلية','#ffc107','#2d1b4e'),toneMapped:false,side:THREE.DoubleSide}));
 big.material.side=THREE.FrontSide;big.position.set(h0.pos[0]+nx*2,8.5,h0.pos[1]+nz*2);big.rotation.y=Math.atan2(nx,nz)+Math.PI;scene.add(big);
 const big2=new THREE.Mesh(big.geometry,new THREE.MeshBasicMaterial({map:big.material.map,toneMapped:false,side:THREE.FrontSide}));big2.position.copy(big.position).addScaledVector(new THREE.Vector3(nx,0,nz),0.05);big2.rotation.y=Math.atan2(nx,nz);scene.add(big2);
 // passengers
 const people=[];
 for(let i=0;i<48;i++){const a=(R()-0.5)*(WID-8),b=1+R()*(DEP-2);people.push({a,b,ta:a,tb:b,sp:0.9+R()*0.6,w:R()*3,c:crowd.add()})}
 function update(t,dt){for(const q of people){const da=q.ta-q.a,db=q.tb-q.b,d=Math.hypot(da,db);const P=q.c;
   if(d<0.5||q.w>0){q.w-=dt;P.walk=0;if(d<0.5&&q.w<=0){q.ta=(R()-0.5)*(WID-8);q.tb=1+R()*(DEP-2);q.w=R()*4}}else{q.a+=da/d*q.sp*dt;q.b+=db/d*q.sp*dt;P.walk=1;const wx=(da*ux+db*nx)/d,wz=(da*uz+db*nz)/d;P.h=Math.atan2(wx,wz)}
   const p=L(q.a,q.b);P.x=p[0];P.z=p[1]}}
 h0.pos=[C[0],C[1]];
 return {C,update,ux,uz,nx,nz}})();

// street pedestrians: walk along sidewalks near the car
const streetPeds=[];
for(let i=0;i<34;i++){const c=crowd.add();streetPeds.push({c,seg:null,t:0,dir:1,side:1,sp:1.0+Math.random()*0.5})}
function placePed(q,near){for(let k=0;k<60;k++){const sg=segs[Math.floor(Math.random()*segs.length)];const w=ways[sg[5]];if(!w||w.w<5)continue;const mx=(sg[0]+sg[2])/2,mz=(sg[1]+sg[3])/2;const d=Math.hypot(mx-car.x,mz-car.z);if(d<(near?15:70)||d>150)continue;q.seg=sg;q.t=Math.random();q.dir=Math.random()<.5?1:-1;q.side=Math.random()<.5?1:-1;q.off=w.w/2+1.3+Math.random()*0.8;return}q.seg=null}
function updatePeds(dt){for(const q of streetPeds){const P=q.c;if(!q.seg){placePed(q,true);P.x=1e5;P.z=1e5;continue}
  const sg=q.seg;const dx=sg[2]-sg[0],dz=sg[3]-sg[1],L=Math.hypot(dx,dz)||1;q.t+=q.dir*q.sp*dt/L;if(q.t<0||q.t>1){q.dir*=-1;q.t=Math.max(0,Math.min(1,q.t))}
  const ux2=dx/L,uz2=dz/L;P.x=sg[0]+dx*q.t-uz2*q.side*q.off;P.z=sg[1]+dz*q.t+ux2*q.side*q.off;P.walk=1;P.h=Math.atan2(ux2*q.dir,uz2*q.dir);
  if(Math.hypot(P.x-car.x,P.z-car.z)>170)placePed(q,false)}}
crowd.build();

// ---------------- van ----------------
function makeVan(){const van=new THREE.Group();
 const paint=new THREE.MeshPhysicalMaterial({color:0xf2f1ec,roughness:0.32,metalness:0.1,clearcoat:1,clearcoatRoughness:0.12});
 const glass=new THREE.MeshPhysicalMaterial({color:0x0d1519,roughness:0.05,clearcoat:1,envMapIntensity:2.2});
 const black=new THREE.MeshStandardMaterial({color:0x18191b,roughness:0.6,metalness:0.2});
 const chrome=new THREE.MeshStandardMaterial({color:0xcfd3d6,roughness:0.15,metalness:1});
 const s=new THREE.Shape();const P=[[-2.62,0.36],[-2.69,0.55],[-2.70,1.15],[-2.66,1.72],[-2.52,1.93],[-2.3,1.98],[0.95,1.99],[1.2,1.95],[1.78,1.30],[1.95,1.20],[2.55,1.10],[2.68,1.00],[2.71,0.62],[2.66,0.40]];
 s.moveTo(P[0][0],P[0][1]);for(let i=1;i<P.length;i++)s.lineTo(P[i][0],P[i][1]);
 const arch=cx=>{s.lineTo(cx+0.46,0.36);s.absarc(cx,0.34,0.46,0,Math.PI,false)};arch(1.45);arch(-1.1);s.lineTo(P[0][0],P[0][1]);
 const bg=new THREE.ExtrudeGeometry(s,{depth:1.74,bevelEnabled:true,bevelThickness:0.07,bevelSize:0.07,bevelSegments:4,curveSegments:16});bg.translate(0,0,-0.87);
 const body=new THREE.Mesh(bg,paint);body.castShadow=true;van.add(body);
 const under=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.45,1.5),black);under.position.set(0,0.42,0);van.add(under);
 const bump=new THREE.MeshStandardMaterial({color:0x8d9195,roughness:0.5,metalness:0.3});const HZ=0.944;const pane=(pts,z,flip)=>{const sh=new THREE.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)sh.lineTo(pts[i][0],pts[i][1]);const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),glass);m.position.z=flip?-z:z;if(flip)m.rotation.y=Math.PI;return m};
 const wins=[[[-2.35,1.12],[-2.35,1.72],[-1.45,1.72],[-1.45,1.12]],[[-1.35,1.12],[-1.35,1.72],[-0.3,1.72],[-0.3,1.12]],[[-0.2,1.12],[-0.2,1.72],[0.75,1.72],[0.75,1.12]],[[1.0,1.14],[1.0,1.78],[1.58,1.38],[1.58,1.14]]];
 for(const w of wins){van.add(pane(w,HZ,false));van.add(pane(w.map(p=>[-p[0],p[1]]).map(p=>[-p[0],p[1]]),HZ,true))}
 {const m=new THREE.Mesh(new THREE.PlaneGeometry(1.25,0.62),glass);m.position.set(-2.785,1.55,0);m.rotation.y=-Math.PI/2;van.add(m)}
 {const A=[1.30,1.90],B=[1.82,1.33];const pos=new Float32Array([A[0],A[1],-0.74,A[0],A[1],0.74,B[0]+0.04,B[1],0.78,A[0],A[1],-0.74,B[0]+0.04,B[1],0.78,B[0]+0.04,B[1],-0.78]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.computeVertexNormals();
  van.add(new THREE.Mesh(g,new THREE.MeshPhysicalMaterial({color:0x0d1519,roughness:0.05,clearcoat:1,envMapIntensity:2.2,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2})))}
 const seam=new THREE.MeshStandardMaterial({color:0x2b2b2b});
 for(const sd of [-1,1]){for(const x of [0.82,-0.28]){const m=new THREE.Mesh(new THREE.BoxGeometry(0.014,1.35,0.01),seam);m.position.set(x,1.12,sd*(HZ+0.004));van.add(m)}
  const h=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.03,0.03),chrome);h.position.set(0.55,1.08,sd*(HZ+0.02));van.add(h);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.26),black);arm.position.set(1.72,1.38,sd*1.0);van.add(arm);
  const mir=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.2,0.05),black);mir.position.set(1.72,1.45,sd*1.14);van.add(mir);
  const hl=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.17,0.3),new THREE.MeshStandardMaterial({color:0xfff6dc,emissive:0xfff0c8,emissiveIntensity:0.9}));hl.position.set(2.79,0.84,sd*0.65);van.add(hl);
  const tl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.42,0.14),new THREE.MeshStandardMaterial({color:0xb30d12,emissive:0x8a0508,emissiveIntensity:0.7}));tl.position.set(-2.8,1.0,sd*0.8);van.add(tl)}
 const grille=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.14,0.8),black);grille.position.set(2.795,0.82,0);van.add(grille);
 for(const x of [2.78,-2.8]){const b=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.26,1.9),bump);b.position.set(x,0.52,0);b.castShadow=true;van.add(b)}
 const plate=()=>{const t=ctex(512,128,(g,w,h)=>{g.fillStyle='#f4f1e6';g.fillRect(0,0,w,h);g.strokeStyle='#1c3f8f';g.lineWidth=8;g.strokeRect(6,6,w-12,h-12);g.fillStyle='#1c3f8f';g.fillRect(8,8,w-16,34);g.fillStyle='#fff';g.font='bold 26px "Noto Kufi Arabic",Tahoma';g.textAlign='center';g.fillText('مصر',w/2,36);g.fillStyle='#111';g.font='bold 54px "Noto Kufi Arabic",Tahoma';g.fillText('٥٢٣  ص ق ب',w/2,100)},null);return new THREE.Mesh(new THREE.PlaneGeometry(0.52,0.13),new THREE.MeshStandardMaterial({map:t}))};
 const pf=plate();pf.position.set(2.85,0.46,0);pf.rotation.y=Math.PI/2;van.add(pf);const pr=plate();pr.position.set(-2.84,0.48,0);pr.rotation.y=-Math.PI/2;van.add(pr);
 const stripe=ctex(1024,128,(g,w,h)=>{g.fillStyle='#e0a21b';g.fillRect(0,0,w,h);g.fillStyle='#14305e';g.fillRect(0,h-26,w,26);g.font='bold 78px "Noto Kufi Arabic",Tahoma';g.textAlign='center';g.fillText('الإسماعيلية',w/2,84)},null);
 for(const sd of [-1,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(2.7,0.3),new THREE.MeshStandardMaterial({map:stripe,roughness:0.4}));m.position.set(sd<0?0.5:-0.4,0.9,sd*(HZ+0.003));if(sd<0)m.rotation.y=Math.PI;van.add(m)}
 const tire=new THREE.MeshStandardMaterial({color:0x111111,roughness:0.9}),rim=new THREE.MeshStandardMaterial({color:0xb9bdc0,roughness:0.3,metalness:0.9});
 const wheels=[];
 for(const [x,z] of [[1.45,0.78],[1.45,-0.78],[-1.1,0.78],[-1.1,-0.78]]){const pivot=new THREE.Group();pivot.position.set(x,0.34,z);const g=new THREE.Group();
  const t=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.22,28),tire);t.rotation.x=Math.PI/2;g.add(t);const r=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.23,24),rim);r.rotation.x=Math.PI/2;g.add(r);
  for(let i=0;i<5;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.25,6),chrome);b.rotation.x=Math.PI/2;b.position.set(Math.cos(i*1.2566)*0.13,Math.sin(i*1.2566)*0.13,0);g.add(b)}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true});pivot.add(g);van.add(pivot);wheels.push({pivot,g,front:x>0})}
 for(const z of [-0.7,0.7]){const r=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.04,0.04),black);r.position.set(-0.8,2.1,z);van.add(r)}
 van.userData.wheels=wheels;return van}
const van=makeVan();scene.add(van);

// markers
const beamMat=c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.35,depthWrite:false,side:THREE.DoubleSide,fog:false});
function beam(c){const g=new THREE.Group();const cy=new THREE.Mesh(new THREE.CylinderGeometry(7,7,90,24,1,true),beamMat(c));cy.position.y=45;g.add(cy);const ring=new THREE.Mesh(new THREE.RingGeometry(6,9,40),beamMat(c));ring.rotation.x=-Math.PI/2;ring.position.y=0.15;g.add(ring);g.visible=false;scene.add(g);return g}
const pickBeam=beam(0xffd54a),dropBeam=beam(0x35e0ff);

// ---------------- game state ----------------
const car={x:0,z:0,h:0,v:0,steer:0,spin:0};
const startHub=data.hubs[0];
function spawn(){const sp=startHub.road||startHub.pos;car.x=sp[0];car.z=sp[1];const rd=roadAt(car.x,car.z);car.h=rd.seg?-Math.atan2(rd.seg[3]-rd.seg[1],rd.seg[2]-rd.seg[0]):0;car.v=0}
spawn();
const G={money:0,rides:0,state:'toHub',hub:null,dest:null,fare:0,t:0,limit:0,started:false,lastHub:-1,best:+(localStorage.getItem('best')||0)};
const dests=[];
data.hubs.forEach(h=>dests.push({n:h.n,x:h.pos[0],z:h.pos[1],say:'وصلني '+h.n}));
data.pois.forEach(p=>dests.push({n:p.n,x:p.p[0],z:p.p[1],say:'عايز أروح '+p.n}));
data.streets.forEach(s=>dests.push({n:'شارع '+s.n.replace(/^شارع\s*/,''),x:s.p[0],z:s.p[1],say:'نزلني في '+(s.n.startsWith('شارع')?s.n:'شارع '+s.n)}));
function say(t){$('say').textContent=t}
function msg(t,ms=2200){const m=$('msg');m.textContent=t;m.style.opacity=1;clearTimeout(msg.t);msg.t=setTimeout(()=>m.style.opacity=0,ms)}
function nextHub(){let i;do{i=Math.floor(Math.random()*data.hubs.length)}while(i===G.lastHub&&data.hubs.length>1);G.lastHub=i;G.hub=data.hubs[i];pickBeam.position.set(G.hub.pos[0],0,G.hub.pos[1]);pickBeam.visible=true;dropBeam.visible=false;G.state='toHub';say('روح '+G.hub.n+' واستنى راكب')}
function board(){const hx=G.hub.pos[0],hz=G.hub.pos[1];let c=dests.filter(d=>{const dd=Math.hypot(d.x-hx,d.z-hz);return dd>500&&dd<3200&&!(d.x===hx&&d.z===hz)});if(!c.length)c=dests;G.dest=c[Math.floor(Math.random()*c.length)];
 const dist=Math.hypot(G.dest.x-hx,G.dest.z-hz);G.fare=Math.round(5+dist/90);G.limit=dist*1.35/10+45;G.t=G.limit;G.state='toDest';pickBeam.visible=false;dropBeam.position.set(G.dest.x,0,G.dest.z);dropBeam.visible=true;say(G.dest.say);msg('ركب! '+G.dest.say)}
function arrive(){const late=G.t<0;const pay=late?Math.ceil(G.fare/2):G.fare;G.money+=pay;G.rides++;if(G.money>G.best){G.best=G.money;localStorage.setItem('best',G.best)}msg((late?'اتأخرت شوية\n':'برافو!\n')+'الأجرة '+pay+' ج');dropBeam.visible=false;nextHub()}
nextHub();

// ---------------- input ----------------
const keys={};addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=1});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0});
const touch={l:0,r:0,g:0,b:0};
for(const [id,k] of [['bl','l'],['br','r'],['gas','g'],['brk','b']]){const el=$(id);const on=e=>{touch[k]=1;el.classList.add('on');e.preventDefault()},off=e=>{touch[k]=0;el.classList.remove('on');e.preventDefault()};el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('pointerleave',off)}
$('go').onclick=()=>{$('start').style.display='none';G.started=true};

// ---------------- physics ----------------
function step(dt,inp){
 const thr=(inp.up?1:0)-(inp.down?1:0),str=(inp.left?1:0)-(inp.right?1:0);
 const rd=roadAt(car.x,car.z);const off=rd.d>1.0;
 const vmax=off?10:26;
 let a=0;if(thr>0){a=car.v<0?16:(car.v<vmax?7.5*(1-car.v/(vmax*1.15)):-6)}else if(thr<0){a=car.v>0.5?-16:-4}else a=-Math.sign(car.v)*Math.min(Math.abs(car.v)/dt,2.2+Math.abs(car.v)*0.08);
 if(off&&car.v>vmax)a-=10;
 car.v+=a*dt;if(car.v<-6)car.v=-6;
 car.steer+=(str-car.steer)*Math.min(1,dt*7);
 const sa=car.steer*0.55/(1+Math.abs(car.v)*0.07);
 car.h+=car.v/3.4*Math.tan(sa)*dt;
 car.x+=Math.cos(car.h)*car.v*dt;car.z+=-Math.sin(car.h)*car.v*dt;
 // collisions: two circles
 for(const off2 of [1.7,-1.7]){const cx=car.x+Math.cos(car.h)*off2,cz=car.z-Math.sin(car.h)*off2;
  for(const b of nearBld(cx,cz)){const lx=(cx-b.x)*b.c+(cz-b.z)*b.s,lz=-(cx-b.x)*b.s+(cz-b.z)*b.c;
   const qx=Math.max(-b.hw,Math.min(b.hw,lx)),qz=Math.max(-b.hd,Math.min(b.hd,lz));let dx=lx-qx,dz=lz-qz;let d=Math.hypot(dx,dz);const R0=1.15;
   if(d<R0){let nx,nz;if(d<1e-4){nx=1;nz=0;d=0}else{nx=dx/d;nz=dz/d}const push=R0-d;const wx=nx*b.c-nz*b.s,wz=nx*b.s+nz*b.c;car.x+=wx*push;car.z+=wz*push;car.v*=0.55;if(Math.abs(car.v)>6)shake=0.5}}}
 car.spin+=car.v*dt/0.34;
 // game logic
 if(G.started){
  if(G.state==='toHub'){const d=Math.hypot(car.x-G.hub.pos[0],car.z-G.hub.pos[1]);if(d<11&&Math.abs(car.v)<6)board()}
  else if(G.state==='toDest'){G.t-=dt;const d=Math.hypot(car.x-G.dest.x,car.z-G.dest.z);if(d<14&&Math.abs(car.v)<6)arrive()}}
}
let shake=0;

// ---------------- minimap ----------------
const mapC=document.createElement('canvas');const MS=0.12;const mx0=BOUND.x0,mz0=BOUND.z0;mapC.width=(BOUND.x1-BOUND.x0)*MS;mapC.height=(BOUND.z1-BOUND.z0)*MS;
{const g=mapC.getContext('2d');g.fillStyle='#d8cdb2';g.fillRect(0,0,mapC.width,mapC.height);g.lineCap='round';g.lineJoin='round';
 const order=[...ways].sort((a,b)=>a.w-b.w);for(const r of order){g.strokeStyle=r.w>=10?'#ffffff':(r.w>=8?'#f4ead2':'#fbf6e8');g.lineWidth=Math.max(1.4,r.w*MS*1.3);g.beginPath();r.p.forEach((p,i)=>{const x=(p[0]-mx0)*MS,y=(p[1]-mz0)*MS;i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()}}
const mini=$('mini'),mg=mini.getContext('2d');
function drawMini(){const S=264,sc=0.35;mg.save();mg.clearRect(0,0,S,S);mg.translate(S/2,S/2);mg.rotate(car.h-Math.PI/2+0*0);mg.scale(sc/MS,sc/MS);
 // rotation: car heading h (ccw from +x toward -z). map up should be car forward.
 mg.drawImage(mapC,-(car.x-mx0)*MS,-(car.z-mz0)*MS);
 const mark=(x,z,c,r)=>{mg.fillStyle=c;mg.strokeStyle='#000';mg.lineWidth=1.5/(sc/MS);mg.beginPath();mg.arc((x-car.x)*MS,(z-car.z)*MS,r/(sc/MS)*1,0,7);mg.fill();mg.stroke()};
 const tgt=G.state==='toHub'?[G.hub.pos[0],G.hub.pos[1],'#ffd54a']:[G.dest.x,G.dest.z,'#35e0ff'];
 let tx=(tgt[0]-car.x)*MS,tz=(tgt[1]-car.z)*MS;const lim=(S/2-14)/(sc/MS);const dl=Math.hypot(tx,tz);if(dl>lim){tx*=lim/dl;tz*=lim/dl}
 mg.fillStyle=tgt[2];mg.strokeStyle='#000';mg.lineWidth=2/(sc/MS);mg.beginPath();mg.arc(tx,tz,9/(sc/MS),0,7);mg.fill();mg.stroke();
 for(const h of data.hubs)if(h!==G.hub){mg.fillStyle='rgba(255,193,7,.55)';mg.beginPath();mg.arc((h.pos[0]-car.x)*MS,(h.pos[1]-car.z)*MS,5/(sc/MS),0,7);mg.fill()}
 mg.restore();
 mg.save();mg.translate(S/2,S/2);mg.fillStyle='#e53935';mg.strokeStyle='#fff';mg.lineWidth=2;mg.beginPath();mg.moveTo(0,-14);mg.lineTo(9,10);mg.lineTo(-9,10);mg.closePath();mg.fill();mg.stroke();mg.restore()}

// ---------------- loop ----------------
let last=performance.now(),acc=0;const camPos=new THREE.Vector3(),camLook=new THREE.Vector3();let camInit=false;
function placeCamera(dt){const fx=Math.cos(car.h),fz=-Math.sin(car.h);const back=9.5+Math.min(Math.abs(car.v),26)*0.12,height=4.6;
 const tx=car.x-fx*back,tz=car.z-fz*back;const k=camInit?Math.min(1,dt*5):1;camPos.x+=(tx-camPos.x)*k;camPos.z+=(tz-camPos.z)*k;camPos.y+=(height-camPos.y)*k;camInit=true;
 camera.position.copy(camPos);if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake*=0.85}
 camLook.set(car.x+fx*8,1.6,car.z+fz*8);camera.lookAt(camLook);if(window.__cam){camera.position.set(...window.__cam.p);camera.lookAt(...window.__cam.l)}}
function frame(now){requestAnimationFrame(frame);let dt=Math.min(0.05,(now-last)/1000);last=now;
 const inp={up:keys.arrowup||keys.w||touch.g,down:keys.arrowdown||keys.s||touch.b,left:keys.arrowleft||keys.a||touch.l,right:keys.arrowright||keys.d||touch.r};
 step(dt,inp);render(dt)}
let hudT=0;
function render(dt){
 van.position.set(car.x,0,car.z);van.rotation.y=car.h;van.rotation.z=0;
 for(const w of van.userData.wheels){w.g.rotation.z=-car.spin;if(w.front)w.pivot.rotation.y=-car.steer*0.45}
 sun.position.set(car.x-30,48,car.z+36);sun.target.position.set(car.x,0,car.z);sun.target.updateMatrixWorld();
 placeCamera(dt);{const tt=performance.now()/1000;terminal.update(tt,dt);updatePeds(dt);crowd.flush(tt)}
 for(const c of chunkMeshes){c.m.visible=Math.hypot(c.cx-car.x,c.cz-car.z)<620}
 const t=performance.now()/1000;for(const b of [pickBeam,dropBeam])if(b.visible){b.rotation.y=t*0.5;b.children[1].scale.setScalar(1+0.08*Math.sin(t*4))}
 hudT+=dt;if(hudT>0.1){hudT=0;$('money').textContent=G.money+' ج  ·  '+G.rides+' راكب';$('speed').textContent=Math.round(Math.abs(car.v)*3.6)+' كم/س';
  $('timer').textContent=G.state==='toDest'?('الأجرة '+G.fare+' ج · '+Math.max(0,Math.ceil(G.t))+' ث'):'';
  const rd=roadAt(car.x,car.z);$('street').textContent=rd.seg&&ways[rd.seg[5]].n?ways[rd.seg[5]].n:'';$('street').style.display=rd.seg&&ways[rd.seg[5]].n?'block':'none';drawMini()}
 renderer.render(scene,camera)}
window.__g={terminal,car,G,step,render,ways,data,spawn,camPos,setCar:(x,z,h)=>{car.x=x;car.z=z;car.h=h;camInit=false},start:()=>{$('start').style.display='none';G.started=true},roadAt};
requestAnimationFrame(frame);
window.READY=true;

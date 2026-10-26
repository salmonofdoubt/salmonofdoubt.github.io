/* MetaForma · Metaphysical Kineticism
   Art-only exhibition: approved painted masters for Blocks I and II, with provisional vector studies for later blocks.
   This scalable preview does not use low-resolution crops of the source poster. */
(() => {
"use strict";
const PALETTES = [
  {id:"original",name:"Metaphysical Original",swatch:"#c6a16d",sky:"#a7a38d",light:"#edd6a9",ground:"#94725f",deep:"#273e41",shade:"#7e4a36",bright:"#d9aa6d",line:"#f4e2bc"},
  {id:"nocturne",name:"Nocturne",swatch:"#304e72",sky:"#344b64",light:"#9fb8bd",ground:"#25344a",deep:"#111d35",shade:"#3c6b7c",bright:"#ccae79",line:"#d9d6ca"},
  {id:"venetian",name:"Venetian Light",swatch:"#c98d84",sky:"#d6b2a5",light:"#fae4d0",ground:"#b78b85",deep:"#557a7c",shade:"#cb7771",bright:"#e3b982",line:"#fff3d8"},
  {id:"botanical",name:"Botanical Silence",swatch:"#6c795c",sky:"#9ca891",light:"#e3dec0",ground:"#78856a",deep:"#324b42",shade:"#637555",bright:"#c7aa7c",line:"#ece6cc"},
  {id:"chromatic",name:"Chromatic Modernism",swatch:"#c8372f",sky:"#bcb6a1",light:"#edcf80",ground:"#ab5547",deep:"#193a58",shade:"#c23530",bright:"#e9a824",line:"#f7e6b1"}
];
const PAINTED_MASTERS = [
  '01-the-hundred',
  '02-roll-up',
  '03-roll-over',
  '04-single-leg-circles',
  '05-rolling-like-a-ball',
  '06-single-leg-stretch',
  '07-double-leg-stretch',
  '08-spine-stretch-forward',
  '09-open-leg-rocker'
];
function isPainted(item) { return item.number >= 1 && item.number <= PAINTED_MASTERS.length; }
function pngFilename(item, p) {
  if (!isPainted(item)) return '';
  const paletteName = p.id === 'original' ? 'metaphysical-original' : p.id;
  return './art/' + PAINTED_MASTERS[item.number - 1] + '-' + paletteName + '.png';
}
function webFilename(item, p) {
  if (!isPainted(item)) return '';
  const paletteName = p.id === 'original' ? 'metaphysical-original' : p.id;
  return './art/' + PAINTED_MASTERS[item.number - 1] + '-' + paletteName + '.webp';
}
function artworkMarkup(item, p, uid) {
  if (isPainted(item)) {
    return '<img src="' + webFilename(item,p) + '" width="1448" height="1086" loading="' +
      (uid.startsWith('viewer-') ? 'eager' : 'lazy') + '" decoding="async" alt="' +
      esc(item.title) + ' — ' + esc(p.name) + ', metaphysical abstract painting" />';
  }
  return painting(item,p,uid);
}
const COLLECTIONS=["All works","I · Emergence","II · Suspension","III · Rotation","IV · Tension","V · Equilibrium","VI · Release"];
const titles=[
  "The Hundred",
  "Roll Up",
  "Roll Over",
  "Single Leg Circles",
  "Rolling Like a Ball",
  "Single Leg Stretch",
  "Double Leg Stretch",
  "Spine Stretch Forward",
  "Open Leg Rocker",
  "Corkscrew",
  "Saw",
  "Swan Dive",
  "Single Leg Kick",
  "Double Leg Kick",
  "Neck Pull",
  "High Scissors",
  "High Bicycle",
  "Shoulder Bridge",
  "Spine Twist",
  "Jackknife",
  "Side Kicks",
  "Teaser",
  "Hip Circles / Twist",
  "Swimming",
  "Leg Pull Front",
  "Leg Pull Back",
  "Kneeling Side Kicks",
  "Side Bend",
  "Boomerang",
  "Seal",
  "Crab",
  "Rocking",
  "Control Balance",
  "Push-Ups"
];
const descriptions=[
"A rhythmic interruption of an otherwise empty architectural space.","A suspended climb through light, mass and disappearance.",
"A wheel implied through fragments rather than a continuous circumference.","Opposing volumes establish an improbable yet serene balance.",
"Two separate horizons create the illusion of a single expanding body.","A solitary line finds its counterpart in a translucent plane.",
"The distance between forms becomes more important than the forms themselves.","Diagonal fields cross without touching.",
"A curve leans into open space and seems to continue beyond it.","A shallow vessel holds nothing but light.",
"An orbital gesture traces an invisible centre.","A quiet gap becomes the essential object.",
"A form held together by the breadth of one sweeping curve.","Two gestures sharing a moment, never a surface.",
"Planes turn inward until direction becomes ambiguous.","A crescent floats between architectural thresholds.",
"Geometry approaches flight without escaping its own weight.","A bridge joins distant points without a visible path.",
"An axis survives the scattering of its surrounding structures.","A memory of water expressed in two suspended bands.",
"A partial circle suggests an entire celestial body.","A column divides, rather than supports, the space around it.",
"The eye searches for the absent point of contact.","Movement reduced to its smallest surviving trace.",
"Three gestures enter a fleeting state of equilibrium.","A pivot without a visible centre of rotation.",
"A chromatic pause between form and its shadow.","Two opposing motions momentarily make one sculpture.",
"An arc that refuses to end where its material disappears.",
"A flat plane gathers traces of an unheard gesture.","The entire composition seems to emerge from a fold.",
"An axis becomes visible only through the marks made around it.","A final orbit, incomplete but entirely resolved.","What remains in space after every gesture has passed."
];
const WORKS=titles.map((title,i)=>({number:i+1,title,description:descriptions[i],collection:i<4?1:i<9?2:i<14?3:i<20?4:i<26?5:6,motif:i%17,variation:Math.floor(i/17)}));
let palette=PALETTES[0],group=0,current=24;
const el=id=>document.getElementById(id);
const titleCase=n=>String(n).padStart(2,"0");
const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
function shape(d,fill,opacity=1,stroke="none",width=1){return '<path d="'+d+'" fill="'+fill+'" fill-opacity="'+opacity+'" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linejoin="round"/>'}
function circle(cx,cy,r,fill,opacity=1){return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+fill+'" opacity="'+opacity+'"/>'}
function motif(kind,g,h,p){
  const a='url(#'+g+')',b='url(#'+h+')',L=p.line,D=p.deep;
  switch(kind){
  case 0:return shape("M-278 170 Q-90 -305 118 -211 Q196 -171 192 -60 Q73 -144 10 -25 Q-30 49 45 222 Q-157 159 -278 170Z",a,.92)+shape("M-138 250 Q-4 32 250 -205 L176 128 Q51 206 -138 250Z",b,.66)+shape("M-240 204 Q-27 -177 223 -158","none",1,L,3);
  case 1:return shape("M-210 233 Q-284 -44 -45 -244 Q-117 12 65 201 Q-53 252 -210 233Z",a,.91)+shape("M40 256 Q82 58 230 -223 Q120 -52 281 167 Q157 253 40 256Z",b,.74)+circle(37,-88,31,D,.65);
  case 2:return shape("M-257 181 Q-280 -134 -25 -236 Q202 -322 253 -10 Q149 -139 10 -106 Q-115 -73 -87 187Z",a,.95)+shape("M-145 194 Q23 21 205 -174 Q183 55 231 216 Q53 140 -145 194Z",b,.74)+circle(25,-18,85,"none",1).replace('fill="none"','fill="none" stroke="'+L+'" stroke-width="2"');
  case 3:return shape("M-246 -87 L230 -170 Q90 15 205 215 L-35 160 Q-71 -32 -246 -87Z",a,.87)+shape("M-141 234 Q-218 15 90 -259 Q12 -38 245 49 Q91 81 -141 234Z",b,.82)+shape("M-260 120 L240 -112","none",1,L,2);
  case 4:return shape("M-246 -243 Q-116 -44 162 232 Q-8 210 -98 92 Q-223 -30 -246 -243Z",a,.98)+shape("M240 -240 Q102 -102 -120 258 Q-11 7 240 -240Z",b,.83)+circle(3,9,54,D,.45);
  case 5:return shape("M-250 141 Q-57 -239 142 -171 Q264 -100 126 77 Q26 183 171 239 Q-26 270 -115 121 Q-148 55 -73 14 Q45 -46 24 -130 Q-104 -116 -250 141Z",a,.92)+shape("M-198 236 Q-54 45 247 -217 Q159 43 -1 167 Q-99 242 -198 236Z",b,.64);
  case 6:return shape("M-226 240 L-93 -206 L53 110 L230 -247 L259 234 L99 201 L33 -22 L-65 256Z",a,.86)+shape("M-292 79 L-16 -67 L220 180 L145 250 L-32 73Z",b,.8)+shape("M-268 240 L235 -248","none",1,L,2);
  case 7:return shape("M-279 218 Q-144 -148 -34 -228 Q20 -75 58 50 Q-94 122 -279 218Z",a,.94)+shape("M-12 -229 Q236 -188 267 240 Q91 89 -12 -229Z",b,.84)+shape("M-260 205 Q70 -45 240 160","none",1,L,3);
  case 8:return '<ellipse cx="0" cy="0" rx="209" ry="155" transform="rotate(-32)" fill="none" stroke="'+a+'" stroke-width="105" opacity=".88"/>'+shape("M-190 -233 Q-13 -87 197 239 L104 260 Q-14 56 -190 -233Z",b,.7)+circle(58,-48,30,p.bright,.82);
  case 9:return shape("M-296 107 Q-32 -289 269 61 L224 223 Q-52 -88 -220 196Z",a,.94)+shape("M-103 -220 L65 -213 Q-67 87 221 251 Q-15 212 -103 -220Z",b,.67)+shape("M-268 207 Q-43 -189 269 78","none",1,L,3);
  case 10:return shape("M-255 240 Q-131 -115 -24 -230 L56 230Z",a,.91)+shape("M-35 -236 Q141 -99 239 245 L67 207Z",b,.73)+shape("M-230 182 Q29 -68 253 -71","none",1,L,2);
  case 11:return shape("M-282 -154 Q-130 -278 44 -156 Q222 -37 275 198 Q26 61 -124 162 Q-183 22 -282 -154Z",a,.91)+shape("M-250 233 Q-48 -21 250 -179 L205 107 Q8 155 -250 233Z",b,.74)+circle(22,-73,66,D,.45);
  case 12:return shape("M-278 178 Q-144 -235 68 -147 Q174 -65 160 150 Q12 1 -111 230Z",a,.93)+shape("M-23 -183 Q134 -290 275 157 L192 242 Q94 22 -23 -183Z",b,.72)+circle(-5,31,32,p.bright,.70);
  case 13:return shape("M-261 245 Q-190 -94 61 -250 Q249 -219 170 12 Q133 122 -37 52 Q-137 6 -77 -64 Q5 -105 44 -40 Q-29 -52 -28 2 Q44 34 92 -11 Q192 -173 45 -160 Q-126 -126 -261 245Z",a,.89)+shape("M-101 250 Q54 65 255 -235 L202 75 Q63 202 -101 250Z",b,.59);
  case 14:return shape("M-231 -253 Q-139 6 -158 257 Q-41 154 43 -16 Q81 -149 158 -255Z",a,.96)+shape("M-42 -251 Q105 -19 249 232 L129 258 Q17 77 -42 -251Z",b,.77)+shape("M-231 206 Q20 -94 256 -92","none",1,L,2);
  case 15:return shape("M-284 -204 L282 237 L131 252 L-194 -49Z",a,.90)+shape("M-268 228 L243 -224 L190 37 L-89 262Z",b,.85)+circle(-9,11,68,D,.5);
  default:return shape("M-256 184 Q-211 -219 15 -250 Q238 -178 196 95 Q128 225 -79 240 Q-31 63 77 71 Q155 -4 69 -118 Q-52 -132 -107 80Z",a,.90)+shape("M-92 238 Q-42 -45 254 -161 Q179 127 70 240Z",b,.73)+circle(39,-12,30,p.deep,.64);
  }
}
function architecture(item,p){
 const k=item.number, side=k%2===0, doorx=side?30:550, x=side?135:665, block=k%5, groundY=532+(k%3)*19;
 let out='<path d="M0 '+groundY+' L800 '+(groundY-32)+' L800 800 L0 800Z" fill="'+p.ground+'" opacity=".59"/>';
 out+='<path d="M0 '+(groundY+112)+' L800 '+(groundY+78)+'" fill="none" stroke="'+p.deep+'" stroke-width="2" opacity=".35"/>';
 if(block===0||block===3){out+='<path d="M'+doorx+' 520 V240 Q'+(doorx+90)+' 78 '+(doorx+180)+' 240 V520Z" fill="'+p.deep+'" opacity=".27"/>';out+='<path d="M'+(doorx-24)+' 542 V221 Q'+(doorx+90)+' 29 '+(doorx+204)+' 221 V542" fill="none" stroke="'+p.line+'" stroke-width="15" opacity=".42"/>';}
 if(block===1){out+='<rect x="'+(side?55:636)+'" y="123" width="84" height="440" fill="'+p.light+'" opacity=".40"/><rect x="'+(side?35:612)+'" y="111" width="126" height="25" fill="'+p.deep+'" opacity=".39"/><rect x="'+(side?37:613)+'" y="562" width="122" height="24" fill="'+p.deep+'" opacity=".36"/>';}
 if(block===2){out+='<path d="M'+(side?0:490)+' 522 V340 Q'+(side?142:632)+' 104 '+(side?284:774)+' 340 V522" fill="none" stroke="'+p.deep+'" stroke-width="32" opacity=".38"/>';}
 if(block===4){out+='<path d="M'+(side?0:620)+' 95 H'+(side?180:800)+' V525 H'+(side?0:620)+'Z" fill="'+p.deep+'" opacity=".22"/><path d="M'+(side?202:595)+' 70 V530" stroke="'+p.light+'" stroke-width="14" opacity=".4"/>';}
 out+='<path d="M0 661 Q420 605 800 659" fill="none" stroke="'+p.light+'" stroke-width="1" opacity=".35"/>';
 return out;
}
function painting(item,p,uid){
 const g='grad-'+uid,h='side-'+uid,sky='sky-'+uid;
 const k=item.number,rot=(k*13)%31-15,shift=((k*37)%125)-62,sc=0.91+((k*7)%15)/100;
 const sunx=130+(k*127)%540,suny=125+(k*29)%205,sunr=34+(k*11)%56;
 const geom=motif(item.motif,g,h,p);
 const title=esc(item.title);
 const top='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+title+', an abstract sculptural study">';
 const defs='<defs><linearGradient id="'+g+'" x1="0%" y1="0%" x2="100%" y2="80%"><stop offset="0%" stop-color="'+p.light+'" stop-opacity=".97"/><stop offset="45%" stop-color="'+p.bright+'" stop-opacity=".74"/><stop offset="100%" stop-color="'+p.shade+'" stop-opacity=".88"/></linearGradient><linearGradient id="'+h+'" x1="80%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="'+p.line+'" stop-opacity=".9"/><stop offset="53%" stop-color="'+p.shade+'" stop-opacity=".58"/><stop offset="100%" stop-color="'+p.deep+'" stop-opacity=".89"/></linearGradient><linearGradient id="'+sky+'" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="'+p.sky+'"/><stop offset="100%" stop-color="'+p.deep+'"/></linearGradient></defs>';
 const skyRect='<rect width="800" height="800" fill="url(#'+sky+')"/><rect width="800" height="800" fill="'+p.light+'" opacity=".23"/>';
 const sun=circle(sunx,suny,sunr,p.light,.72)+circle(sunx+sunr/3,suny-sunr/3,sunr*.55,p.line,.22);
 const set='<g transform="translate('+(400+shift)+' '+(398+(k%5)*12)+') rotate('+rot+') scale('+sc+')">'+geom+'</g>';
 const shadows='<ellipse cx="'+(385+shift)+'" cy="'+(656+(k%3)*9)+'" rx="'+(182+(k%3)*24)+'" ry="16" fill="'+p.deep+'" opacity=".29"/>';
 const details='<path d="M'+(83+k%7*11)+' '+(720-k%5*13)+' L'+(683-k%6*7)+' '+(702-k%5*13)+'" stroke="'+p.line+'" stroke-width="1" opacity=".30"/><rect x="14" y="14" width="772" height="772" stroke="'+p.line+'" stroke-width="1" fill="none" opacity=".21"/>';
 return top+defs+skyRect+sun+architecture(item,p)+shadows+set+details+'</svg>';
}
function palettes(container){
 container.replaceChildren();
 PALETTES.forEach(p=>{const b=document.createElement("button");b.type="button";b.className="palette-swatch";b.style.background=p.swatch;b.title=p.name;b.setAttribute("aria-label",p.name);b.setAttribute("aria-pressed",String(palette.id===p.id));b.onclick=()=>{palette=p;render();if(el("viewer").open)showWork(current,false)};container.append(b)});
}
function render(){
 el("heroArt").innerHTML=painting(WORKS[21],palette,"hero-"+palette.id);
 const bar=el("collections");bar.replaceChildren();
 COLLECTIONS.forEach((name,i)=>{const b=document.createElement("button");b.type="button";b.textContent=name;b.setAttribute("aria-pressed",String(group===i));b.onclick=()=>{group=i;render()};bar.append(b)});
 palettes(el("globalPalettes"));
 const g=el("gallery");g.replaceChildren();
 WORKS.filter(w=>group===0||w.collection===group).forEach(w=>{
   const fig=document.createElement("figure");fig.className="art-card";
   const btn=document.createElement("button");btn.type="button";btn.setAttribute("aria-label","Open "+w.title);
   const frame=document.createElement("div");frame.className="art-frame";frame.innerHTML=artworkMarkup(w,palette,"tile-"+w.number+"-"+palette.id);if(isPainted(w))frame.classList.add('raster');
   const meta=document.createElement("div");meta.className="art-meta";meta.innerHTML='<span class="art-title">'+esc(w.title)+'</span><span class="art-number">'+titleCase(w.number)+'</span>';
   const series=document.createElement("div");series.className="art-series";series.textContent=COLLECTIONS[w.collection].split(" · ")[1];
   btn.append(frame,meta,series);btn.onclick=()=>showWork(w.number-1,true);fig.append(btn);g.append(fig);
 });
}
function showWork(i,openDialog){
 current=(i+WORKS.length)%WORKS.length;
 const item=WORKS[current],dialog=el("viewer");
 el("viewerNumber").textContent="STUDY "+titleCase(item.number)+" / 34";
 el("viewerTitle").textContent=item.title;el("viewerDescription").textContent=item.description;
 el("viewerCollection").textContent=COLLECTIONS[item.collection];
 el("viewerArt").innerHTML=artworkMarkup(item,palette,"viewer-"+item.number+"-"+palette.id);
 const artArea=el("viewerArt");artArea.classList.remove("raster");if(isPainted(item))artArea.classList.add("raster");
 const download=el("saveSVG");download.textContent=isPainted(item)?"SAVE PNG ARTWORK ↓":"SAVE SVG ARTWORK ↓";
 el("viewerSmall").textContent=isPainted(item)?"Original-resolution PNG · colour editions preserve the original 4:3 composition":"Vector edition · retains original proportions at every display size";
 palettes(el("viewerPalettes"));
 if(openDialog&&!dialog.open){dialog.showModal();document.body.classList.add("viewer-open")}
}
function close(){el("viewer").close();document.body.classList.remove("viewer-open")}
el("closeViewer").onclick=close;
el("viewer").addEventListener("close",()=>document.body.classList.remove("viewer-open"));
el("previous").onclick=()=>showWork(current-1,false);
el("next").onclick=()=>showWork(current+1,false);
document.addEventListener("keydown",e=>{if(!el("viewer").open)return;if(e.key==="ArrowLeft")showWork(current-1,false);if(e.key==="ArrowRight")showWork(current+1,false)});
el("saveSVG").onclick=()=>{
 const item=WORKS[current];
 if(isPainted(item)){
   const a=document.createElement("a");a.href=pngFilename(item,palette);a.download=pngFilename(item,palette).split("/").pop();document.body.append(a);a.click();a.remove();return;
 }
 const content=painting(item,palette,"export-"+item.number+"-"+palette.id);
 const url=URL.createObjectURL(new Blob([content],{type:"image/svg+xml;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="metaforma-"+titleCase(item.number)+"-"+palette.id+".svg";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
};
render();
})();
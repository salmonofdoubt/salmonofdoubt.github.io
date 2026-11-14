/* DiAndré Art Manager · calm local workflow, Mac files only. */
(() => {
"use strict";
const rooms=["Oil Paintings","Watercolours","Drawings","Experimental","GeoSpatial Imagery"];
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
let draggedWork = null;
const model={artworks:[],assets:[],curation:{homepageHero:{},collections:{}},view:"gallery",selected:null,destination:"gallery",groups:[],members:[],editingGroup:"",multi:false,chosen:new Set(),commitReview:null,onlineReview:null,busy:false};
const selected=()=>model.selected&&(model.selected.kind==="gallery"
    ?model.artworks.find(a=>a.id===model.selected.id)
    :model.assets.find(a=>a.id===model.selected.id));
function status(msg="",kind=""){$("status").textContent=msg;$("status").className="status "+kind;}
function dialog(id){const d=$(id);d.showModal();return d;}
function close(id){$(id).close();}
document.querySelectorAll("dialog [data-close]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close();}));
function image(item,studio=false){
  if(studio)return item.hasFile&&/^image\//.test(item.mime||"")?item.localUrl:"";
  const src=item.thumb||item.image||"";
  if(!src)return "";
  if(/^(?:https?:|\/)/.test(src))return src;
  return "/art/"+src.replace(/^art\//,"");
}
async function json(url,options={}){
 const response=await fetch(url,options);
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok===false)throw new Error(data.error||"Request failed ("+response.status+")");
 return data;
}
async function post(path,payload){
 return json(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
}
async function load(){
 const [gallery,studio,curation]=await Promise.all([
   json("/art/data/artworks.json?ts="+Date.now(),{cache:"no-store"}),
   json("/api/studio-assets?ts="+Date.now(),{cache:"no-store"}),
   json("/art/data/art-curation.json?ts="+Date.now(),{cache:"no-store"}).catch(()=>({}))
 ]);
 model.artworks=gallery.artworks||[];
 model.assets=studio.assets||[];
 model.curation={homepageHero:curation.homepageHero||{},collections:curation.collections||{}};
 if(model.selected&&!selected())model.selected=null;
 render();
}
function setView(view){
 model.view=view;
 model.chosen.clear();model.multi=false;$("organiseButton").textContent="Organise";
 document.querySelectorAll("[data-view]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.view===view)));
 $("roomFilter").hidden=view!=="gallery";
 model.selected=null;
 render();
}
function selectedKeys(){
 return model.multi?[...model.chosen]:model.selected?[model.selected.kind+":"+model.selected.id]:[];
}
function setOrganiseMode(){
 model.multi=!model.multi;
 model.chosen.clear();
 if(model.multi&&model.selected)model.chosen.add(model.selected.kind+":"+model.selected.id);
 $("organiseButton").textContent=model.multi?"Done selecting":"Organise";
 status(model.multi?"Tap as many works as you like, then choose Move or Relate.":"Choose a work to edit, move or relate.");
 render();
}
function galleryOrderFor(artwork){
 return model.artworks.filter(item=>item.collection===artwork.collection).sort((a,b)=>
  Number(a.sortOrder??999999)-Number(b.sortOrder??999999)||
  String(a.title||"").localeCompare(String(b.title||"")));
}
function studioOrder(){
 return [...model.assets].sort((a,b)=>
  Number(a.sortOrder??999999)-Number(b.sortOrder??999999)||
  String(a.title||"").localeCompare(String(b.title||"")));
}
function orderFor(kind,id){
 if(kind==="studio")return studioOrder();
 const work=model.artworks.find(item=>item.id===id);
 return work?galleryOrderFor(work):[];
}
async function saveOrder(kind,orderedIds,collection){
 if(model.busy)return;
 model.busy=true;
 try{
  if(kind==="gallery")await post("/api/reorder-collection",{collection,orderedIds});
  else await post("/api/reorder-studio",{orderedIds});
  await load();
  status(kind==="gallery"?
   "New Gallery order saved on your Mac. Publish whenever you want it online.":
   "Studio order saved privately on your Mac.","good");
 }catch(error){
  await load().catch(()=>{});
  status(error.message,"bad");
 }finally{model.busy=false;}
}
function insertBeforeOrAfter(kind,sourceId,targetId,after){
 const entries=orderFor(kind,sourceId);
 if(!entries.length||sourceId===targetId)return;
 const source=entries.find(x=>x.id===sourceId);
 const target=entries.find(x=>x.id===targetId);
 if(!source||!target)return;
 if(kind==="gallery"&&source.collection!==target.collection)return;
 const ids=entries.map(x=>x.id);
 const current=ids.indexOf(sourceId);
 ids.splice(current,1);
 const newIndex=ids.indexOf(targetId)+(after?1:0);
 ids.splice(newIndex,0,sourceId);
 if(ids.every((id,i)=>id===entries[i].id))return;
 void saveOrder(kind,ids,kind==="gallery"?source.collection:null);
}
function reorderTargetAllowed(targetKind,targetId){
 // Drag-to-reorder works directly in All Rooms and filtered/search results.
 // The entire underlying Room is reordered, never just visible search hits.
 if(model.busy||!draggedWork||draggedWork.kind!==targetKind||
    draggedWork.keys.length!==1)return false;
 const fromId=draggedWork.keys[0].slice(draggedWork.keys[0].indexOf(":")+1);
 if(fromId===targetId)return false;
 if(targetKind==="gallery"){
  const src=model.artworks.find(x=>x.id===fromId),dest=model.artworks.find(x=>x.id===targetId);
  return !!src&&!!dest&&src.collection===dest.collection;
 }
 return targetKind==="studio";
}
function clearReorderTargets(){
 $("grid").querySelectorAll(".reorder-before,.reorder-after").forEach(card=>
  card.classList.remove("reorder-before","reorder-after"));
}
function select(kind,id){
 if(model.multi){
  const key=kind+":"+id;
  if(model.chosen.has(key))model.chosen.delete(key);
  else model.chosen.add(key);
  const first=[...model.chosen][0];
  model.selected=first?{kind:first.split(":")[0],id:first.slice(first.indexOf(":")+1)}:null;
 }else model.selected={kind,id};
 render();
}
function render(){
 const gallery=model.view==="gallery";
 const q=$("search").value.trim().toLowerCase();
 const room=$("roomFilter").value;
 $("galleryCount").textContent=model.artworks.length;
 $("studioCount").textContent=model.assets.length;
 const items=(gallery?model.artworks:model.assets).filter(item=>{
   const text=gallery?[item.title,item.collection,item.subgroup,item.text,item.medium]:
     [item.title,item.note,item.originalFilename,item.isReference?"reference ref":"studio"];
   return (!gallery||room==="All"||item.collection===room)&&(!q||text.join(" ").toLowerCase().includes(q));
 });
 items.sort((a,b)=>gallery
   ?(String(a.collection).localeCompare(String(b.collection))||Number(a.sortOrder??999999)-Number(b.sortOrder??999999)||String(a.title).localeCompare(String(b.title)))
   :(Number(a.sortOrder??999999)-Number(b.sortOrder??999999)||String(a.title||"").localeCompare(String(b.title||""))));
 const studio=!gallery;
 $("grid").innerHTML=items.length?items.map(item=>{
   const src=image(item,studio);
   const highlighted=model.multi?model.chosen.has(model.view+":"+item.id):model.selected&&model.selected.id===item.id&&model.selected.kind===model.view;
   const label=gallery?item.collection+(item.status==="hidden"?" · Hidden":""):
     (item.isReference?"Ref · ":"Studio · ")+(item.visibility==="related"?"Related":"Private");
   return '<button type="button" class="art-card'+(highlighted?' selected':'')+
     (gallery&&item.status==="hidden"?' hidden-work':'')+(studio?' studio-card':'')+
     '" data-id="'+esc(item.id)+'" data-kind="'+model.view+'" aria-pressed="'+String(!!highlighted)+'">'+
     (src?'<img draggable="false" src="'+esc(src)+'" alt="'+esc(item.title||"")+'" loading="lazy">':'<span class="no-picture">File</span>')+
     (model.multi?'<span class="multi-check" aria-hidden="true">'+(highlighted?"✓":"○")+'</span>':"")+
   '<span class="art-copy"><strong>'+esc(item.title||item.originalFilename||"Untitled")+
     '</strong><small>'+esc(label)+'</small></span></button>';
 }).join(""):'<div class="art-empty">No work here. Choose <strong>Add</strong> to bring something in from your Mac.</div>';
 $("grid").querySelectorAll("[data-id]").forEach(btn=>{
   btn.addEventListener("click",()=>select(btn.dataset.kind,btn.dataset.id));
   btn.draggable=true;
   btn.addEventListener("dragstart",event=>{
     if(model.busy){event.preventDefault();return;}
     const key=btn.dataset.kind+":"+btn.dataset.id;
     if(model.multi&&!model.chosen.has(key))model.chosen=new Set([key]);
     if(!model.multi)model.selected={kind:btn.dataset.kind,id:btn.dataset.id};
     draggedWork={kind:btn.dataset.kind,keys:model.multi?[...model.chosen]:[key]};
     event.dataTransfer.effectAllowed="move";
     event.dataTransfer.setData("text/plain",key);
   });
   btn.addEventListener("dragover",event=>{
     if(!reorderTargetAllowed(btn.dataset.kind,btn.dataset.id))return;
     event.preventDefault();
     event.dataTransfer.dropEffect="move";
     clearReorderTargets();
     const bounds=btn.getBoundingClientRect();
     btn.classList.add(event.clientX<bounds.left+bounds.width/2?"reorder-before":"reorder-after");
   });
   btn.addEventListener("dragleave",event=>{
     if(!btn.contains(event.relatedTarget))
       btn.classList.remove("reorder-before","reorder-after");
   });
   btn.addEventListener("drop",event=>{
     if(!reorderTargetAllowed(btn.dataset.kind,btn.dataset.id)){
       if(draggedWork&&draggedWork.kind==="gallery"&&btn.dataset.kind==="gallery"){
         event.preventDefault();
         status("For a different Room, edit the artwork's Room. Dragging reorders within the same Room.","bad");
       }
       return;
     }
     event.preventDefault();
     event.stopPropagation();
     const before=btn.classList.contains("reorder-before");
     const original=draggedWork.keys[0];
     const sourceId=original.slice(original.indexOf(":")+1);
     const kind=draggedWork.kind;
     clearReorderTargets();
     draggedWork=null;
     insertBeforeOrAfter(kind,sourceId,btn.dataset.id,!before);
   });
   btn.addEventListener("dragend",()=>{
     draggedWork=null;
     clearReorderTargets();
     document.querySelectorAll("[data-view]").forEach(t=>t.classList.remove("drop-ready"));
   });
 });
 const item=selected();
 const count=selectedKeys().length;
 $("selectionPanel").hidden=!item&&!count;
 $("editButton").disabled=count!==1;
 $("moveButton").textContent=(model.selected?.kind==="studio"?"Move → Gallery":"Move → Studio")+(count>1?" ("+count+")":"");
 $("moveButton").hidden=!!item&&model.selected?.kind==="studio"&&
   selectedKeys().some(key=>{
     const a=model.assets.find(x=>x.id===key.slice(key.indexOf(":")+1));
     return a?.isReference||a?.kind==="reference";
   });
 if(item){
   $("selectedTitle").textContent=count>1?count+" works selected":item.title||item.originalFilename||"Untitled";
   $("selectedMeta").textContent=count>1?"Move them together or relate them in one group.":gallery?(item.collection+" · "+(item.status==="hidden"?"Hidden":"Visible")):
     ("Studio · "+(item.visibility==="related"?"May appear in See related":"Private"));
 }
}
function chooseSelected(){
 if(!selectedKeys().length){status("Choose a thumbnail first, then organise it.","bad");$("grid").scrollIntoView({block:"start"});return false;}
 return true;
}
function openAdd(){
 model.destination=model.view;
 $("addForm").reset();
 $("addTitle").value="";$("addNote").value="";
 updateDestination();
 dialog("addDialog");
}
function updateDestination(){
 const gallery=model.destination==="gallery";
 document.querySelectorAll("[data-destination]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.destination===model.destination)));
 $("addRoomRow").hidden=!gallery;
 $("addPrivacy").hidden=gallery;
 $("addReferenceRow").hidden=gallery;
 $("addFiles").accept=gallery?"image/jpeg,image/png,image/webp,image/gif,image/avif":"";
 $("addHelp").textContent=gallery?
   "Gallery works appear in the chosen public Room after you Publish.":
   "Studio is your private working space. Files are not public unless you later choose to share them.";
 $("addSave").textContent=gallery?"Add to Gallery":"Add to Studio";
}
function toDataUrl(file){
 return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result||""));
   reader.onerror=()=>reject(new Error("Could not read "+file.name));
   reader.readAsDataURL(file);
 });
}
async function addFiles(event){
 event.preventDefault();
 if(model.busy)return;
 const files=[...$("addFiles").files];
 if(!files.length){status("Select one or more files from your Mac.","bad");return;}
 if(files.some(f=>!f.size||f.size>25*1024*1024)){status("Every file must be between 1 byte and 25 MB.","bad");return;}
 if(model.destination==="gallery"&&files.some(f=>!/\.(jpe?g|png|webp|gif|avif)$/i.test(f.name))){status("Only JPEG, PNG, WebP, GIF and AVIF images can go into the Gallery.","bad");return;}
 model.busy=true;$("addSave").disabled=true;
 let completed=0;
 try{
  for(const file of files){
   status("Saving "+(completed+1)+" of "+files.length+" · "+file.name);
   const name=(files.length===1&&$("addTitle").value.trim())||file.name.replace(/\.[^.]+$/,"").replace(/[-_]+/g," ");
   if(model.destination==="gallery"){
     await post("/api/add-artwork",{
       imageDataUrl:await toDataUrl(file),title:name,collection:$("addRoom").value,
       medium:$("addRoom").value,subgroup:"Other",alt:name,
       text:$("addNote").value,reading:$("addNote").value
     });
   }else{
     await post("/api/studio-upload",{
       fileDataUrl:await toDataUrl(file),filename:file.name,title:name,
       note:$("addNote").value,isReference:$("addReference").checked,visibility:"private",artworkIds:[]
     });
   }
   completed++;
  }
  await load();
  close("addDialog");
  status(completed+" "+(model.destination==="gallery"?"artwork(s) added to Gallery":"file(s) added privately to Studio")+". Saved on your Mac; publish separately.","good");
 }catch(error){
  await load().catch(()=>{});
  status(error.message+(completed?" ("+completed+" already saved)":""),"bad");
 }finally{model.busy=false;$("addSave").disabled=false;}
}
function openEdit(){
 if(!chooseSelected())return;
 if(selectedKeys().length!==1){status("Choose just one work to edit its details.","bad");return;}
 const item=selected(), gallery=model.selected.kind==="gallery";
 $("editTitle").value=item.title||"";
 $("editRoomRow").hidden=!gallery;$("editStatusRow").hidden=!gallery;
 $("editReferenceRow").hidden=gallery;
 $("editNote").value=gallery?(item.text||item.reading||""):(item.note||"");
 if(gallery){
   $("editRoom").value=item.collection||"Experimental";
   $("editStatus").value=item.status==="hidden"?"hidden":"active";
 }else{
   $("editReference").checked=!!item.isReference;
 }
 dialog("editDialog");
}
async function saveEdit(event){
 event.preventDefault();if(model.busy||!chooseSelected())return;
 const item=selected(), gallery=model.selected.kind==="gallery";
 model.busy=true;$("editSave").disabled=true;
 try{
  if(gallery){
    await post("/api/update-artwork",{
      id:item.id,title:$("editTitle").value.trim(),collection:$("editRoom").value,
      text:$("editNote").value,reading:$("editNote").value,
      status:$("editStatus").value
    });
  }else{
    await post("/api/studio-update",{
      id:item.id,title:$("editTitle").value.trim(),
      note:$("editNote").value,isReference:$("editReference").checked
    });
  }
  await load();close("editDialog");status("Changes saved on your Mac.","good");
 }catch(error){status(error.message,"bad");}finally{model.busy=false;$("editSave").disabled=false;}
}
function openMove(){
 if(!chooseSelected())return;
 if(model.selected.kind==="studio"&&selectedKeys().some(key=>{
   const a=model.assets.find(x=>x.id===key.slice(key.indexOf(":")+1));
   return a?.isReference||a?.kind==="reference";
 })){
   status("References stay in Studio. Use Relate to show them with a Gallery painting.","bad");
   return;
 }
 const toStudio=model.selected.kind==="gallery",item=selected();
 const count=selectedKeys().length;
 $("moveHeading").textContent=toStudio?"Move to private Studio?":"Move to Gallery?";
 $("moveRoomRow").hidden=toStudio;
 $("moveExplanation").textContent=count>1
   ?count+" selected works will move "+(toStudio?"to private Studio. Original identities and relationships will be retained.":"into the chosen Gallery Room.")+
   " Previously published files may remain in public Git history."
   :toStudio
   ?'"'+(item.title||"Untitled")+'" will leave the live Gallery after publication. The full artwork record and a verified image copy will be saved in your private Studio, so you can move it back.'
   :'"'+(item.title||"Untitled")+'" will return to a public exhibition Room when you publish.';
 $("moveRoom").value=toStudio?(item.collection||"Oil Paintings"):(item.originCollection||"Oil Paintings");
 $("confirmMove").textContent=toStudio?"Move to Studio":"Move to Gallery";
 dialog("moveDialog");
}
async function move(){
 if(model.busy||!chooseSelected())return;
 const origin=model.selected.kind;
 const ids=selectedKeys().map(k=>k.slice(k.indexOf(":")+1));
 model.busy=true;$("confirmMove").disabled=true;
 let done=0,firstMoved=null,retained=0;
 try{
  for(const id of ids){
   status("Moving "+(done+1)+" of "+ids.length+"…");
   const result=await post("/api/move-art",{
      id,destination:origin==="gallery"?"studio":"gallery",collection:$("moveRoom").value
   });
   if(!firstMoved)firstMoved=result.move?.id;
   if(origin==="gallery"&&!result.move?.publicImageRemoved)retained++;
   done++;
  }
  await load();
  setView(origin==="gallery"?"studio":"gallery");
  if(firstMoved)model.selected={kind:model.view,id:firstMoved};
  render();close("moveDialog");
  status(done+" work(s) moved. "+
   (retained?"Important: "+retained+" source file(s) still exist publicly because they are shared or outside the managed Gallery. ":"")+
   "Save is local; publish the Gallery change when ready. Older Git history may retain images.",retained?"bad":"good");
 }catch(error){await load().catch(()=>{});status(error.message+(done?" ("+done+" already moved)":""),"bad");}
 finally{model.busy=false;$("confirmMove").disabled=false;}
}
function memberKey(m){return m.kind+":"+m.id;}
function labelMember(m){
 if(m.kind==="artwork"){const a=model.artworks.find(a=>a.id===m.id);return {title:a?.title||"Unlisted artwork",note:a?.collection||"Gallery"};}
 if(m.kind==="studio"||m.kind==="reference"){
   const a=model.assets.find(a=>a.id===m.id);
   return {title:a?.title||"Studio item",note:(a?.isReference?"Ref":"Studio")+" · "+(a?.visibility==="private"?"Private":"Related")};
 }
 return {title:"Existing item",note:"Related"};
}
async function openRelate(){
 if(!chooseSelected())return;
 try{
 const r=await json("/api/related-groups?ts="+Date.now(),{cache:"no-store"});
 model.groups=r.related?.groups||[];
 $("relateGroup").innerHTML='<option value="">New related group</option>'+
   model.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.title||g.id)+'</option>').join("");
 const key=model.selected.kind==="gallery"?"artwork":(selected()?.kind==="reference"?"reference":"studio");
 const match=selectedKeys().length===1?model.groups.find(g=>(g.members||[]).some(m=>m.kind===key&&m.id===model.selected.id)):null;
 model.editingGroup=match?.id||"";
 $("relateGroup").value=model.editingGroup;
 $("relateSearch").value="";$("relateFilter").value="all";
 loadGroup();
 dialog("relateDialog");
 }catch(error){status(error.message,"bad");}
}
function loadGroup(){
 const group=model.groups.find(g=>g.id===$("relateGroup").value);
 model.editingGroup=group?.id||"";
 model.members=group?(group.members||[]).map(m=>({...m})):
   selectedKeys().map(key=>({
     kind:key.startsWith("gallery:")?"artwork":
       (model.assets.find(a=>a.id===key.slice(key.indexOf(":")+1))?.kind==="reference"?"reference":"studio"),
     id:key.slice(key.indexOf(":")+1),role:"related",note:""
   }));
 $("relateTitle").value=group?.title||"Studies for "+(selected()?.title||"this work");
 renderRelated();
}
function renderRelated(){
 const q=$("relateSearch").value.trim().toLowerCase(),filter=$("relateFilter").value;
 const candidates=[
 ...model.artworks.filter(a=>a.status!=="hidden").map(a=>({kind:"artwork",id:a.id,title:a.title,meta:a.collection})),
 ...model.assets.map(a=>({kind:a.kind==="reference"?"reference":"studio",id:a.id,title:a.title,
   meta:(a.isReference?"Ref":"Studio")+" · "+(a.visibility==="private"?"Private":"Related")}))
 ].filter(x=>(filter==="all"||(filter==="gallery"&&x.kind==="artwork")||(filter==="studio"&&["studio","reference"].includes(x.kind)))&&
      (!q||(x.title+" "+x.meta).toLowerCase().includes(q)));
 const list=$("relateCandidates"),scroll=list.scrollTop;
 list.innerHTML=candidates.map(c=>'<label class="relate-candidate"><input type="checkbox" data-member-kind="'+c.kind+
   '" value="'+esc(c.id)+'" '+(model.members.some(m=>m.kind===c.kind&&m.id===c.id)?"checked":"")+
   '><span class="content">'+esc(c.title||"Untitled")+'<small>'+esc(c.meta)+'</small></span></label>').join("");
 list.scrollTop=scroll;
 list.querySelectorAll("input").forEach(box=>box.addEventListener("change",()=>{
   const key=box.dataset.memberKind+":"+box.value;
   if(box.checked){
    if(!model.members.some(m=>memberKey(m)===key))model.members.push({kind:box.dataset.memberKind,id:box.value,role:"related",note:""});
   }else model.members=model.members.filter(m=>memberKey(m)!==key);
   renderRelated();
 }));
 $("relateCount").textContent="("+model.members.length+")";
 $("relateChosen").innerHTML=model.members.map((m,i)=>{
  const desc=labelMember(m);
  return '<div class="relate-selected-item"><span class="content">'+esc(desc.title)+
    '<small>'+esc(desc.note)+'</small></span>'+
    '<button type="button" data-up="'+i+'" aria-label="Move up" '+(i===0?"disabled":"")+'>↑</button>'+
    '<button type="button" data-down="'+i+'" aria-label="Move down" '+(i===model.members.length-1?"disabled":"")+'>↓</button>'+
    '<button type="button" data-remove="'+i+'" aria-label="Remove from group">×</button></div>';
 }).join("");
 $("relateChosen").querySelectorAll("[data-up]").forEach(b=>b.addEventListener("click",()=>{
  const n=Number(b.dataset.up);[model.members[n-1],model.members[n]]=[model.members[n],model.members[n-1]];renderRelated();
 }));
 $("relateChosen").querySelectorAll("[data-down]").forEach(b=>b.addEventListener("click",()=>{
  const n=Number(b.dataset.down);[model.members[n],model.members[n+1]]=[model.members[n+1],model.members[n]];renderRelated();
 }));
 $("relateChosen").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{
  model.members.splice(Number(b.dataset.remove),1);renderRelated();
 }));
}
async function saveRelated(){
 if(model.busy)return;
 if(model.members.length<2){status("A relationship needs at least two artworks or studies.","bad");return;}
 const privateCount=model.members.filter(m=>["studio","reference"].includes(m.kind)&&
     model.assets.some(a=>a.id===m.id&&a.visibility==="private")).length;
 const withGallery=model.members.some(m=>m.kind==="artwork");
 const makePublic=withGallery&&privateCount>0;
 if(makePublic&&!confirm("Share "+privateCount+
   " private Studio item(s) with this Gallery painting in See related when you Publish? Public copies may remain in Git history."))return;
 model.busy=true;$("saveRelations").disabled=true;
 try{
  await post("/api/save-related-group",{
    groupId:model.editingGroup,title:$("relateTitle").value.trim()||"Related works",
    members:model.members,makeStudioPublic:makePublic
  });
  await load();close("relateDialog");
  status(makePublic?"Related items saved locally. They become public only when you Publish.":"Relationships saved locally. Unshared Studio items stay private.","good");
 }catch(error){status(error.message,"bad");}
 finally{model.busy=false;$("saveRelations").disabled=false;}
}
function summariseFile(file){
 const sum=file.summary||{};
 const parts=[];
 for(const [kind,label] of [["added","New"],["updated","Changed"],["removed","Removed"]]){
  const arr=sum[kind]||[];
  if(arr.length)parts.push("<p><strong>"+label+":</strong> "+arr.map(x=>esc(x.title||x.id)).join(", ")+"</p>");
 }
 const text=file.diff?(file.diff.length>2000?file.diff.slice(0,2000)+"…":file.diff):"";
 return '<div class="publish-file"><strong>'+esc(file.path)+'</strong> · '+esc(file.change||"changed")+
   (file.binary?' · Image/file':'')+
   '<details><summary>Review contents and public path</summary><small>Public file: /'+esc(file.path)+
   '</small>'+(file.change?.includes("D")?"":' · <a target="_blank" rel="noopener" href="/'+esc(file.path)+'">Preview</a>')+
   parts.join("")+(text?'<pre>'+esc(text)+'</pre>':"")+
   (file.truncated?'<p>Diff truncated; inspect the full local file.</p>':"")+
   '</details></div>';
}
async function openPublish(){
 dialog("publishDialog");
 $("onlineSection").hidden=true;
 $("commitApproved").checked=false;
 $("publishCommit").disabled=true;
 $("publishReview").textContent="Checking changes saved on your Mac…";
 try{
  const r=await json("/api/art-publish/review?ts="+Date.now(),{cache:"no-store"});
  model.commitReview=r;
  const excluded=(r.excluded||[]).length;
  $("publishReview").innerHTML=r.files?.length?
    '<p><strong>'+r.files.length+' Gallery file(s) to review</strong>. '+excluded+
    ' unrelated file(s) excluded. Click a file to see its public path and changes.</p>'+
    r.files.map(summariseFile).join(""):
    '<p>No uncommitted Gallery changes. If you already committed, choose <strong>Review what goes online</strong>.</p>';
  if(r.stagedOutside?.length)$("publishReview").innerHTML+='<p class="small-warning">Unrelated files are already staged. Unstage them using Git before continuing.</p>';
 }catch(error){model.commitReview=null;$("publishReview").textContent=error.message;}
}
async function commitChanges(){
 if(model.busy||!model.commitReview?.ready||!$("commitApproved").checked)return;
 model.busy=true;$("publishCommit").disabled=true;
 try{
  const res=await post("/api/art-publish/commit",{
    reviewToken:model.commitReview.token,message:$("commitMessage").value
  });
  status("Saved in local Git. Nothing has been published yet.","good");
  $("publishReview").textContent=res.message||"Committed locally.";
  model.commitReview=null;
  await reviewOnline();
 }catch(error){$("publishReview").textContent=error.message;status(error.message,"bad");}
 finally{model.busy=false;}
}
async function reviewOnline(){
 $("onlineSection").hidden=false;
 $("onlineApproved").checked=false;$("onlineConfirm").value="";$("publishPush").disabled=true;
 $("onlineReview").textContent="Checking outgoing Git history…";
 try{
  const r=await json("/api/art-publish/publish-review?ts="+Date.now(),{cache:"no-store"});
  model.onlineReview=r;
  $("onlineReview").innerHTML=!r.ahead?
    '<p>Nothing to publish. Your local Gallery commits already match GitHub.</p>':
    '<p><strong>'+r.ahead+' local commit(s)</strong> would go public on GitHub.</p>'+
    '<p>'+esc((r.commits||[]).join(" · "))+'</p>'+
    (r.fileDetails||[]).map(summariseFile).join("")+
    (r.history?.length?'<details><summary>Full outgoing commit history ('+r.history.length+')</summary>'+
      r.history.map(h=>'<p>'+esc(h.sha.slice(0,9))+' · '+esc(h.title)+'</p>'+
      h.files.map(f=>'<div class="publish-file">'+esc(f.path)+(f.diff?'<pre>'+esc(f.diff.slice(0,1800))+'</pre>':"")+'</div>').join("")).join("")+'</details>':"");
 }catch(error){model.onlineReview=null;$("onlineReview").textContent=error.message;}
}
async function pushOnline(){
 if(model.busy||!model.onlineReview?.ahead||!$("onlineApproved").checked||$("onlineConfirm").value!=="PUBLISH")return;
 model.busy=true;$("publishPush").disabled=true;
 try{
  const result=await post("/api/art-publish/push",{
   reviewToken:model.onlineReview.token,confirmation:"PUBLISH"
  });
  status("GitHub accepted your publication. The live website may take a little longer to update.","good");
  $("onlineReview").textContent=result.message||"Published successfully.";
  model.onlineReview=null;
 }catch(error){$("onlineReview").textContent=error.message;status(error.message,"bad");}
 finally{model.busy=false;}
}

$("addButton").addEventListener("click",openAdd);
$("organiseButton").addEventListener("click",setOrganiseMode);
$("publishButton").addEventListener("click",openPublish);
$("editButton").addEventListener("click",openEdit);
$("moveButton").addEventListener("click",openMove);
document.querySelectorAll("[data-view]").forEach(tab=>{
 tab.addEventListener("dragover",event=>{
   if(!draggedWork||draggedWork.kind===tab.dataset.view)return;
   event.preventDefault();event.dataTransfer.dropEffect="move";
   tab.classList.add("drop-ready");
 });
 tab.addEventListener("dragleave",()=>tab.classList.remove("drop-ready"));
 tab.addEventListener("drop",event=>{
   tab.classList.remove("drop-ready");
   if(!draggedWork||draggedWork.kind===tab.dataset.view)return;
   event.preventDefault();
   const dragged=draggedWork;
   draggedWork=null;
   // Switch only the selection, not the workspace, until confirmation.
   model.multi=dragged.keys.length>1;
   model.chosen=new Set(dragged.keys);
   const first=dragged.keys[0];
   model.selected={kind:dragged.kind,id:first.slice(first.indexOf(":")+1)};
   render();
   openMove();
 });
});
$("relateButton").addEventListener("click",openRelate);
$("roomFilter").addEventListener("change",render);
$("search").addEventListener("input",render);
document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>setView(btn.dataset.view)));
document.querySelectorAll("[data-destination]").forEach(btn=>btn.addEventListener("click",()=>{model.destination=btn.dataset.destination;updateDestination();}));
$("addFiles").addEventListener("change",()=>{
 const files=$("addFiles").files;
 $("fileCount").textContent=files.length?files.length+" file(s) chosen":"Choose one or several images from your Mac.";
});
$("addForm").addEventListener("submit",addFiles);
$("editForm").addEventListener("submit",saveEdit);
$("confirmMove").addEventListener("click",move);
$("relateGroup").addEventListener("change",loadGroup);
$("relateSearch").addEventListener("input",renderRelated);
$("relateFilter").addEventListener("change",renderRelated);
$("saveRelations").addEventListener("click",saveRelated);
$("commitApproved").addEventListener("change",()=>{
 $("publishCommit").disabled=!$("commitApproved").checked||!model.commitReview?.ready;
});
$("publishCommit").addEventListener("click",commitChanges);
$("reviewOnline").addEventListener("click",reviewOnline);
const allowOnline=()=>$("publishPush").disabled=!model.onlineReview?.ahead||
 !$("onlineApproved").checked||$("onlineConfirm").value!=="PUBLISH";
$("onlineApproved").addEventListener("change",allowOnline);
$("onlineConfirm").addEventListener("input",allowOnline);
$("publishPush").addEventListener("click",pushOnline);
load().catch(error=>status("Could not load local artworks. Start ARTS with ./serve.sh: "+error.message,"bad"));
})();
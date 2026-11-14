/* DiAndré Art Manager · calm local workflow, Mac files only. */
(() => {
"use strict";
const rooms=["Oil Paintings","Watercolours","Drawings","Experimental","GeoSpatial Imagery"];
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const model={artworks:[],assets:[],curation:{homepageHero:{},collections:{}},view:"gallery",selected:null,destination:"gallery",groups:[],members:[],editingGroup:"",commitReview:null,onlineReview:null,busy:false};
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
 document.querySelectorAll("[data-view]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.view===view)));
 $("roomFilter").hidden=view!=="gallery";
 model.selected=null;
 render();
}
function select(kind,id){
 model.selected={kind,id};
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
     [item.title,item.note,item.originalFilename];
   return (!gallery||room==="All"||item.collection===room)&&(!q||text.join(" ").toLowerCase().includes(q));
 });
 items.sort((a,b)=>gallery
   ?(String(a.collection).localeCompare(String(b.collection))||Number(a.sortOrder??9999)-Number(b.sortOrder??9999)||String(a.title).localeCompare(String(b.title)))
   :String(a.title||"").localeCompare(String(b.title||"")));
 const studio=!gallery;
 $("grid").innerHTML=items.length?items.map(item=>{
   const src=image(item,studio);
   const highlighted=model.selected&&model.selected.id===item.id&&model.selected.kind===model.view;
   const label=gallery?item.collection+(item.status==="hidden"?" · Hidden":""):
     "Studio · "+(item.visibility==="related"?"See related":"Private");
   return '<button type="button" class="art-card'+(highlighted?' selected':'')+
     (gallery&&item.status==="hidden"?' hidden-work':'')+(studio?' studio-card':'')+
     '" data-id="'+esc(item.id)+'" data-kind="'+model.view+'" aria-pressed="'+String(!!highlighted)+'">'+
     (src?'<img src="'+esc(src)+'" alt="'+esc(item.title||"")+'" loading="lazy">':'<span class="no-picture">File</span>')+
     '<span class="art-copy"><strong>'+esc(item.title||item.originalFilename||"Untitled")+
     '</strong><small>'+esc(label)+'</small></span></button>';
 }).join(""):'<div class="art-empty">No work here. Choose <strong>Add</strong> to bring something in from your Mac.</div>';
 $("grid").querySelectorAll("[data-id]").forEach(btn=>btn.addEventListener("click",()=>select(btn.dataset.kind,btn.dataset.id)));
 const item=selected();
 $("selectionPanel").hidden=!item;
 if(item){
   $("selectedTitle").textContent=item.title||item.originalFilename||"Untitled";
   $("selectedMeta").textContent=gallery?(item.collection+" · "+(item.status==="hidden"?"Hidden":"Visible")):
     ("Studio · "+(item.visibility==="related"?"May appear in See related":"Private"));
 }
}
function chooseSelected(){
 if(!selected()){status("Choose a thumbnail first, then organise it.","bad");$("grid").scrollIntoView({block:"start"});return false;}
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
       note:$("addNote").value,visibility:"private",artworkIds:[]
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
 const item=selected(), gallery=model.selected.kind==="gallery";
 $("editTitle").value=item.title||"";
 $("editRoomRow").hidden=!gallery;$("editStatusRow").hidden=!gallery;
 $("editVisibilityRow").hidden=gallery;
 $("editNote").value=gallery?(item.text||item.reading||""):(item.note||"");
 if(gallery){
   $("editRoom").value=item.collection||"Experimental";
   $("editStatus").value=item.status==="hidden"?"hidden":"active";
 }else{
   $("editVisibility").value=item.visibility||"private";
 }
 $("visibilityWarning").hidden=gallery||$("editVisibility").value!=="related";
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
    const visibility=$("editVisibility").value;
    if(visibility==="related"&&item.visibility!=="related"&&!confirm(
       "Make this Studio file eligible for public See related? Public copies may persist in Git history."))return;
    await post("/api/studio-update",{
      id:item.id,title:$("editTitle").value.trim(),
      note:$("editNote").value,visibility
    });
  }
  await load();close("editDialog");status("Changes saved on your Mac.","good");
 }catch(error){status(error.message,"bad");}finally{model.busy=false;$("editSave").disabled=false;}
}
function openMove(){
 if(!chooseSelected())return;
 const toStudio=model.selected.kind==="gallery",item=selected();
 $("moveHeading").textContent=toStudio?"Move to private Studio?":"Move to Gallery?";
 $("moveRoomRow").hidden=toStudio;
 $("moveExplanation").textContent=toStudio
   ?'"'+(item.title||"Untitled")+'" will leave the live Gallery after publication. The full artwork record and a verified image copy will be saved in your private Studio, so you can move it back.'
   :'"'+(item.title||"Untitled")+'" will return to a public exhibition Room when you publish.';
 $("moveRoom").value=toStudio?(item.collection||"Oil Paintings"):(item.originArtwork?.collection||"Oil Paintings");
 $("confirmMove").textContent=toStudio?"Move to Studio":"Move to Gallery";
 dialog("moveDialog");
}
async function move(){
 if(model.busy||!chooseSelected())return;
 const origin=model.selected.kind,id=model.selected.id;
 model.busy=true;$("confirmMove").disabled=true;
 try{
  const result=await post("/api/move-art",{
     id,destination:origin==="gallery"?"studio":"gallery",
     collection:$("moveRoom").value
  });
  await load();
  setView(origin==="gallery"?"studio":"gallery");
  if(result.move?.id)model.selected={kind:model.view,id:result.move.id};
  render();close("moveDialog");
  status("Moved. Saved on your Mac; publish the Gallery change when ready. Previously published files can remain in Git history.","good");
 }catch(error){status(error.message,"bad");}
 finally{model.busy=false;$("confirmMove").disabled=false;}
}
function memberKey(m){return m.kind+":"+m.id;}
function labelMember(m){
 if(m.kind==="artwork"){const a=model.artworks.find(a=>a.id===m.id);return {title:a?.title||"Unlisted artwork",note:a?.collection||"Gallery"};}
 if(m.kind==="studio"){const a=model.assets.find(a=>a.id===m.id);return {title:a?.title||"Studio material",note:a?.visibility==="private"?"Studio · Private":"Studio · See related"};}
 return {title:"Existing reference",note:"Reference (kept in group)"};
}
async function openRelate(){
 if(!chooseSelected())return;
 try{
 const r=await json("/api/related-groups?ts="+Date.now(),{cache:"no-store"});
 model.groups=r.related?.groups||[];
 $("relateGroup").innerHTML='<option value="">New related group</option>'+
   model.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.title||g.id)+'</option>').join("");
 const key=model.selected.kind==="gallery"?"artwork":"studio";
 const match=model.groups.find(g=>(g.members||[]).some(m=>m.kind===key&&m.id===model.selected.id));
 model.editingGroup=match?.id||"";
 $("relateGroup").value=model.editingGroup;
 $("relateSearch").value="";$("relateFilter").value="all";$("relatePublishStudio").checked=false;
 loadGroup();
 dialog("relateDialog");
 }catch(error){status(error.message,"bad");}
}
function loadGroup(){
 const group=model.groups.find(g=>g.id===$("relateGroup").value);
 model.editingGroup=group?.id||"";
 model.members=group?(group.members||[]).map(m=>({...m})):
   [{kind:model.selected.kind==="gallery"?"artwork":"studio",id:model.selected.id,role:"related",note:""}];
 $("relateTitle").value=group?.title||"Studies for "+(selected()?.title||"this work");
 renderRelated();
}
function renderRelated(){
 const q=$("relateSearch").value.trim().toLowerCase(),filter=$("relateFilter").value;
 const candidates=[
 ...model.artworks.filter(a=>a.status!=="hidden").map(a=>({kind:"artwork",id:a.id,title:a.title,meta:a.collection})),
 ...model.assets.map(a=>({kind:"studio",id:a.id,title:a.title,meta:"Studio · "+(a.visibility==="private"?"Private":"See related")}))
 ].filter(x=>(filter==="all"||(filter==="gallery"&&x.kind==="artwork")||(filter==="studio"&&x.kind==="studio"))&&
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
 const privateCount=model.members.filter(m=>m.kind==="studio"&&model.assets.some(a=>a.id===m.id&&a.visibility==="private")).length;
 const makePublic=$("relatePublishStudio").checked;
 if(makePublic&&privateCount&&!confirm("Publish "+privateCount+" private Studio file(s) through See related when your website is published?"))return;
 model.busy=true;$("saveRelations").disabled=true;
 try{
  await post("/api/save-related-group",{
    groupId:model.editingGroup,title:$("relateTitle").value.trim()||"Related works",
    members:model.members,makeStudioPublic:makePublic
  });
  await load();close("relateDialog");
  status("Relationships saved locally. Private Studio files remain private unless expressly approved.","good");
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
$("organiseButton").addEventListener("click",openEdit);
$("publishButton").addEventListener("click",openPublish);
$("editButton").addEventListener("click",openEdit);
$("moveButton").addEventListener("click",openMove);
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
$("editVisibility").addEventListener("change",()=>$("visibilityWarning").hidden=$("editVisibility").value!=="related");
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
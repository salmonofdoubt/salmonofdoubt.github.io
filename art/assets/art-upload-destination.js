/* ARTS Unified Upload: one menu, one source selector, two explicit destinations. */
(() => {
  const menu=document.getElementById("unifiedUploadMenu");
  const room=document.getElementById("uploadRoomFields");
  const studio=document.getElementById("studioUploadPanel");
  const file=document.getElementById("newFile");
  if(!menu || !room || !studio || !file) return;
  let destination="room";
  const controls=[...document.querySelectorAll("[data-art-destination]")];
  function setDestination(next) {
    if(next!=="room" && next!=="studio") return;
    if(destination!==next){
      // Avoid unintended uploads when changing where the files will land.
      file.value="";
      if(typeof state!=="undefined") state.imageDataUrl="";
      const preview=document.getElementById("newPreview");
      if(preview) preview.style.display="none";
    }
    destination=next;
    window.artUploadDestination=next;
    room.hidden=next!=="room";
    studio.hidden=next!=="studio";
    file.accept=next==="room"?"image/jpeg,image/png,image/webp,image/gif":"";
    document.getElementById("artUploadHint").textContent=next==="room"
      ?"Public Room: new exhibited artworks. Imported items appear as separate Room entries."
      :"Studio Assets: supporting files kept outside public Rooms. They appear only through See related when linked and marked for publication.";
    controls.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.artDestination===next)));
    window.dispatchEvent(new CustomEvent("art-upload-destination-changed",{detail:{destination:next}}));
    if(next==="studio") window.dispatchEvent(new Event("art-studio-activate"));
  }
  controls.forEach(button=>button.addEventListener("click",()=>setDestination(button.dataset.artDestination)));
  const source=document.getElementById("artUploadSources");
  source.addEventListener("dragover",event=>{
    if(!event.dataTransfer || ![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    source.classList.add("dragover");
  });
  source.addEventListener("dragleave",()=>source.classList.remove("dragover"));
  source.addEventListener("drop",event=>{
    event.preventDefault();
    source.classList.remove("dragover");
    if(!event.dataTransfer || !event.dataTransfer.files.length) return;
    file.files=event.dataTransfer.files;
    file.dispatchEvent(new Event("change",{bubbles:true}));
  });

  // Avoid stale browser state when returning to the Upload action.
  window.artUploadDestination="room";
  setDestination("room");
})();

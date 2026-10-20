/* Google Photos in the normal published-work Upload action.
   Shares OAuth + Picker with Studio Assets, but has a separate Room destination. */
(() => {
  const existing = document.getElementById("newFile");
  if (!existing) return;
  const section = document.createElement("details");
  section.className = "room-google-import";
  section.innerHTML = [
    '<summary>Choose images from Google Photos</summary>',
    '<div class="room-google-body">',
    '<p class="room-google-status" id="roomGoogleStatus" role="status">Checking connection…</p>',
    '<div class="room-google-actions">',
    '<button type="button" id="roomGoogleConnect" hidden>Connect Google Photos</button>',
    '<button type="button" id="roomGoogleSetup" hidden>Set up in Studio Assets</button>',
    '<button type="button" class="primary" id="roomGooglePick" hidden>Choose photos</button>',
    '<button type="button" id="roomGoogleCancel" hidden>Cancel selection</button>',
    '</div>',
    '<a id="roomGooglePickerLink" href="#" target="_blank" rel="noopener noreferrer" hidden>Open Google Photos picker</a>',
    '<div class="room-google-selected" id="roomGoogleSelected"></div>',
    '<button id="roomGoogleImport" class="primary" type="button" hidden>Add selected images to Room &amp; rebuild</button>',
    '<p class="room-google-note">Uses the Room, Medium, Subgroup and Caption fields below. ',
    'For one image, use the Title field. For several images, filenames become titles. ',
    'Collection/homepage feature options require a single image. ',
    'Only JPEG, PNG, WebP and GIF can be uploaded as Room artwork. ',
    'For working photographs or other formats, use Studio Assets instead.</p>',
    '</div>'
  ].join("");
  existing.insertAdjacentElement("afterend", section);

  const $ = id => section.querySelector("#" + id);
  const escaped = value => String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const eligible = item => ["image/jpeg", "image/png", "image/webp", "image/gif"]
    .includes(String(item.mimeType || "").toLowerCase());
  let selected = [];
  let pollTimer = null;
  let polling = false;
  let importing = false;

  function notice(message, error=false) {
    $("roomGoogleStatus").textContent = message;
    $("roomGoogleStatus").classList.toggle("room-google-error", error);
  }

  async function call(path, payload) {
    const response = await fetch(path, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const value = await response.json().catch(()=>({}));
    if(!response.ok || !value.ok) throw new Error(value.error || "Google Photos request failed");
    return value;
  }

  async function status() {
    const response=await fetch("/api/google-photos/status?ts="+Date.now(),{cache:"no-store"});
    const value=await response.json().catch(()=>({}));
    if(!response.ok || !value.ok) throw new Error(value.error || "Photos API unavailable");
    $("roomGoogleSetup").hidden = value.configured;
    $("roomGoogleConnect").hidden = !value.configured || value.connected;
    $("roomGooglePick").hidden = !value.connected;
    $("roomGooglePick").disabled = importing;
    $("roomGoogleCancel").hidden = !value.picking;
    notice(value.connected ? "Google Photos is connected. Choose artwork photographs."
      : value.configured ? "Connect Google Photos to choose artwork images."
        : "Complete Google Photos setup in Studio Assets first.");
    if(value.picking && value.connected && !selected.length) schedulePoll(2);
  }

  function renderSelection() {
    $("roomGoogleSelected").innerHTML = selected.length
      ? '<p>'+selected.length+' selected in Google Photos</p>'+
        selected.map(item => '<label><input type="checkbox" value="'+escaped(item.id)+'"'+
          (eligible(item)?' checked':' disabled')+'><span>'+escaped(item.filename)+
          '</span><small>'+escaped(item.mimeType)+(eligible(item)?'':' · Unsupported for Room')+
          '</small></label>').join("")
      : "";
    $("roomGoogleImport").hidden = !selected.some(eligible);
    if(selected.length===1 && !document.getElementById("newTitle").value.trim()){
      document.getElementById("newTitle").value =
        String(selected[0].filename||"").replace(/\.[^.]+$/,"").replace(/[-_]+/g," ");
    }
  }

  function schedulePoll(seconds) {
    if(pollTimer) clearTimeout(pollTimer);
    pollTimer=setTimeout(poll, 1000*Math.max(2,Number(seconds)||4));
  }

  async function poll() {
    if(!section.open || polling || importing) return;
    polling=true;
    try {
      const response=await fetch("/api/google-photos/poll?ts="+Date.now(),{cache:"no-store"});
      const value=await response.json().catch(()=>({}));
      if(!response.ok || !value.ok) throw new Error(value.error || "Could not read Photos selection");
      if(value.ready){
        selected=value.items || [];
        renderSelection();
        notice(selected.length ? "Select the images to publish, then click Add selected images to Room."
          : "No images selected. Choose again.");
      }else{
        notice("Select photos in the Google Photos window and press Done there…");
        schedulePoll(value.pollAfter || 4);
      }
    }catch(error){notice(error.message,true);}
    finally{polling=false;}
  }

  function connect() {
    const popup=window.open("/api/google-photos/connect","artsGooglePhotosAuth",
      "width=620,height=740");
    if(!popup) notice("Allow pop-ups for localhost, then try again.",true);
    else notice("Sign in using the opened Google window. If authentication fails, check the OAuth credentials in Studio Assets.");
  }

  async function choose() {
    // Reserve popup immediately while responding to the user's click.
    const popup=window.open("about:blank","artsGooglePhotosPicker");
    try{
      selected=[];
      renderSelection();
      const result=await call("/api/google-photos/start",{});
      const uri=String(result.pickerUri||"");
      if(!uri.startsWith("https://photos.google.com/"))
        throw new Error("Google returned an unexpected selection URL");
      $("roomGooglePickerLink").href=uri;
      $("roomGooglePickerLink").hidden=false;
      $("roomGoogleCancel").hidden=false;
      if(popup) popup.location=uri;
      notice("Choose your photos in Google Photos and press Done.");
      schedulePoll(result.pollAfter || 4);
    }catch(error){
      if(popup) popup.close();
      notice(error.message,true);
    }
  }

  async function importToRoom() {
    if(importing) return;
    const ids=[...$("roomGoogleSelected").querySelectorAll('input:checked')].map(x=>x.value);
    if(!ids.length){notice("Select at least one supported image.",true);return;}
    if(ids.length>1 &&
      (document.getElementById("makeCollectionFeature").checked ||
       document.getElementById("makeHomepageHero").checked)){
      notice("For multiple works, untick Collection feature and Homepage hero first.",true);
      return;
    }
    const collection=document.getElementById("newCollection").value;
    if(!collection){notice("Choose the Room first.",true);return;}
    importing=true;
    $("roomGoogleImport").disabled=true;
    $("roomGooglePick").disabled=true;
    notice("Importing "+ids.length+" selected artwork image(s) into "+collection+"…");
    try{
      const result=await call("/api/google-photos/import-artworks",{
        ids,
        title:document.getElementById("newTitle").value.trim(),
        collection,
        medium:document.getElementById("newMedium").value,
        subgroup:document.getElementById("newSubgroup").value,
        text:document.getElementById("newCaption").value,
        makeCollectionFeature:document.getElementById("makeCollectionFeature").checked,
        makeHomepageHero:document.getElementById("makeHomepageHero").checked
      });
      const summary=result.googlePhotos||result;
      const works=summary.imported||[];
      const failures=summary.failures||[];
      if(works.length){
        await loadArtworks();
        await loadCuration();
        state.selectedId=works[works.length-1].id;
        fillForm(selectedItem());
        render();
        if(window.refreshRelatedForSelection)window.refreshRelatedForSelection();
      }
      if(failures.length){
        const unsuccessful=new Set(failures.map(item=>item.id));
        selected=selected.filter(item=>unsuccessful.has(item.id));
        renderSelection();
      }else{
        selected=[];
        renderSelection();
        $("roomGooglePickerLink").hidden=true;
        $("roomGoogleCancel").hidden=true;
      }
      const outcome=(summary.message||works.length+" images imported")+
        (failures.length ? ". "+failures.map(f=>(f.filename||"Item")+": "+f.error).join("; ") : "")+
        ". Publish by committing and pushing your local gallery changes.";
      notice(outcome,!!failures.length);
      setStatus(outcome, failures.length ? "bad" : "good");
    }catch(error){
      notice(error.message,true);
      setStatus(error.message,"bad");
    }finally{
      importing=false;
      $("roomGoogleImport").disabled=false;
      $("roomGooglePick").disabled=false;
    }
  }

  async function cancel() {
    if(pollTimer) clearTimeout(pollTimer);
    try{
      await call("/api/google-photos/cancel",{});
      selected=[];
      renderSelection();
      $("roomGooglePickerLink").hidden=true;
      await status();
    }catch(error){notice(error.message,true);}
  }

  section.addEventListener("toggle",() => {
    if(section.open) status().catch(error=>notice(error.message,true));
    else if(pollTimer)clearTimeout(pollTimer);
  });
  $("roomGoogleSetup").addEventListener("click",()=>{
    const button=document.querySelector(".studio-manager-button");
    if(button) button.click();
    else notice("Open Studio Assets in the manager to configure Google Photos.",true);
  });
  $("roomGoogleConnect").addEventListener("click",connect);
  $("roomGooglePick").addEventListener("click",choose);
  $("roomGoogleCancel").addEventListener("click",cancel);
  $("roomGoogleImport").addEventListener("click",importToRoom);
  window.addEventListener("message",event=>{
    if(event.origin===window.location.origin &&
       event.data && event.data.type==="arts-google-photos-connected" &&
       section.open) status().catch(error=>notice(error.message,true));
  });
})();

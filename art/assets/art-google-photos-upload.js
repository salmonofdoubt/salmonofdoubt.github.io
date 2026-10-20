/* Shared Google Photos Picker: exactly one selection, one Upload menu, two destinations. */
(() => {
  const existing = document.getElementById("newFile");
  if (!existing) return;
  const section = document.createElement("details");
  section.className = "room-google-import";
  section.innerHTML = [
    '<summary>From Google Photos</summary>',
    '<div class="room-google-body">',
    '<p class="room-google-status" id="roomGoogleStatus" role="status">Checking connection…</p>',
    '<div class="room-google-actions">',
    '<button type="button" id="roomGoogleConnect" hidden>Connect Google Photos</button>',
    '<button type="button" id="roomGoogleSetup" hidden>Configure Google Photos</button>',
    '<button type="button" class="primary" id="roomGooglePick" hidden>Choose photos</button>',
    '<button type="button" id="roomGoogleCancel" hidden>Cancel selection</button>',
    '</div>',
    '<a id="roomGooglePickerLink" href="#" target="_blank" rel="noopener noreferrer" hidden>Open Google Photos picker</a>',
    '<div id="roomGoogleConfig" hidden>',
    '  <p>One-time Google Photos Picker API setup. Google Cloud OAuth Web application redirect URI:</p>',
    '  <code id="roomGoogleRedirect"></code>',
    '  <p><a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer">Google Cloud OAuth clients</a></p>',
    '  <label>Client ID <input id="roomGoogleClientId" autocomplete="off" placeholder="…apps.googleusercontent.com"></label>',
    '  <label>Client Secret <input id="roomGoogleClientSecret" type="password" autocomplete="off" placeholder="Stored only on your Mac"></label>',
    '  <button type="button" id="roomGoogleConfigure">Save Google configuration locally</button>',
    '  <button type="button" id="roomGoogleDisconnect">Disconnect Google Photos</button>',
    '</div>',
    '<div class="room-google-selected" id="roomGoogleSelected"></div>',
    '<p class="room-google-stage" id="roomGoogleStage" role="status" hidden></p>',
    '<p class="room-google-note" id="roomGoogleNote">Choose a destination above, then select the photos to import.</p>',
    '</div>'
  ].join("");
  existing.insertAdjacentElement("afterend", section);

  const $ = id => section.querySelector("#" + id);
  const escaped = value => String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const destination = () => window.artUploadDestination === "studio" ? "studio" : "room";
  const eligible = item => destination() === "studio"
    ? /^(image|video)\//.test(String(item.mimeType || "").toLowerCase())
    : ["image/jpeg", "image/png", "image/webp", "image/gif"]
        .includes(String(item.mimeType || "").toLowerCase());
  let selected = [];
  let pollTimer = null;
  let polling = false;
  let importing = false;
  let serverReady = false;
  let importedCount = 0;

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
    serverReady=Array.isArray(value.importTargets)&&
       value.importTargets.includes("studio")&&value.importTargets.includes("room");
    $("roomGoogleRedirect").textContent=value.redirectUri||"http://localhost:8000/api/google-photos/callback";
    $("roomGoogleSetup").hidden=false;
    $("roomGoogleConnect").hidden=!value.configured||value.connected;
    $("roomGooglePick").hidden=!value.connected;
    $("roomGooglePick").disabled=importing||!serverReady;
    $("roomGoogleCancel").hidden=!value.picking;
    $("roomGoogleConfig").hidden=!!value.configured;
    if(!serverReady){
      notice("Local server is running older Python code. Stop it with Ctrl+C, run git pull origin master, then ./serve.sh and refresh the page.",true);
      updateSaveButtons();
      return;
    }
    updateSaveButtons();
    notice(value.connected ? "Google Photos connected. Select images for the destination above."
      : value.configured ? "Connect your Google Photos account to continue."
      : "Enter the Google Cloud OAuth client credentials here once.");
    if(value.picking && value.connected && !selected.length) schedulePoll(2);
  }

  function checkedIds() {
    return [...$("roomGoogleSelected").querySelectorAll('input[type="checkbox"]:checked')]
      .map(node=>node.value);
  }

  function hasPending() {
    return checkedIds().length > 0;
  }

  function updateSaveButtons() {
    const roomButton=document.getElementById("addWork");
    const studioButton=document.getElementById("studioSave");
    const macReady=!!document.getElementById("newFile").files.length;
    if(roomButton) roomButton.disabled=importing || !(macReady || hasPending());
    if(studioButton && studioButton.textContent.trim()!=="Save changes") {
      studioButton.disabled=importing || !(macReady || hasPending());
    }
  }

  function renderSelection() {
    const room=destination()==="room";
    $("roomGoogleSelected").innerHTML = selected.length
      ? '<p>'+selected.length+' selected in Google Photos</p>'+
        selected.map(item => '<label><input type="checkbox" value="'+escaped(item.id)+'"'+
          (eligible(item)?' checked':' disabled')+'><span>'+escaped(item.filename)+
          '</span><small>'+escaped(item.mimeType)+(eligible(item)?'':' · Not supported for this destination')+
          '</small></label>').join("")
      : "";
    const hasReady=selected.some(eligible);
    const message=$("roomGoogleStage");
    message.hidden=!hasReady;
    if(hasReady) {
      message.textContent=room
        ? "Ready. Enter the artwork details below, then click Add work(s) & rebuild once."
        : "Ready. Choose associations and visibility below, then click Upload assets once.";
    }
    $("roomGoogleNote").textContent=room
      ? "Select photos here, then use the Add work(s) & rebuild button below the artwork details. Only JPEG, PNG, WebP and GIF are supported."
      : "Select photos here, then use Upload assets below the Studio associations. Linked assets appear through See related, not as Room entries.";
    if(room && selected.length===1 && !document.getElementById("newTitle").value.trim()){
      document.getElementById("newTitle").value =
        String(selected[0].filename||"").replace(/\.[^.]+$/,"").replace(/[-_]+/g," ");
    }
    updateSaveButtons();
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
        notice(selected.length ? "Select which images to import into the chosen destination."
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
      document.getElementById("newFile").value="";
      if(typeof state!=="undefined") state.imageDataUrl="";
      const preview=document.getElementById("newPreview");
      if(preview) preview.style.display="none";
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

  async function importToDestination() {
    if(importing) return;
    if(!serverReady){
      notice("Restart your local Python server after updating the GitHub repository. The current server cannot import to both destinations.",true);
      return;
    }
    const ids=[...$("roomGoogleSelected").querySelectorAll("input:checked")].map(node=>node.value);
    if(!ids.length){notice("Select at least one supported photo.",true);return;}
    const room=destination()==="room";
    let path, payload;
    if(room){
      if(ids.length>1 &&
         (document.getElementById("makeCollectionFeature").checked ||
          document.getElementById("makeHomepageHero").checked)){
        notice("Untick feature and homepage hero when importing several Room artworks.",true);
        return;
      }
      path="/api/google-photos/import-artworks";
      payload={
        ids,
        title: document.getElementById("newTitle").value.trim(),
        collection: document.getElementById("newCollection").value,
        medium: document.getElementById("newMedium").value,
        subgroup: document.getElementById("newSubgroup").value,
        text: document.getElementById("newCaption").value,
        makeCollectionFeature: document.getElementById("makeCollectionFeature").checked,
        makeHomepageHero: document.getElementById("makeHomepageHero").checked
      };
    }else{
      if(!window.artStudioUpload) {
        notice("Studio Assets has not finished loading. Refresh the Manager.",true);
        return;
      }
      path="/api/google-photos/import";
      payload={
        ids, artworkIds:window.artStudioUpload.links(),
        visibility:window.artStudioUpload.visibility()
      };
    }
    importing=true;
    $("roomGooglePick").disabled=true;
    updateSaveButtons();
    notice("Importing "+ids.length+" files into "+(room?"Public Room":"Studio Assets")+"…");
    try{
      const result=await call(path,payload);
      const summary=result.googlePhotos||result;
      const added=summary.imported||[];
      const failures=summary.failures||[];
      if(added.length){
        if(room){
          await loadArtworks();
          await loadCuration();
          state.selectedId=added[added.length-1].id;
          fillForm(selectedItem());
          render();
          if(window.refreshRelatedForSelection)window.refreshRelatedForSelection();
        }else{
          await window.artStudioUpload.refresh();
        }
      }
      if(failures.length){
        const failedIds=new Set(failures.map(item=>item.id));
        selected=selected.filter(item=>failedIds.has(item.id));
      }else{
        selected=[];
        $("roomGooglePickerLink").hidden=true;
        $("roomGoogleCancel").hidden=true;
      }
      renderSelection();
      importedCount += added.length;
      const outcome=(summary.message||added.length+" imported")+
        (failures.length ? ". "+failures.map(f=>(f.filename||"Item")+": "+f.error).join("; ") : "")+
        ". Review and push your generated public changes when ready.";
      notice(outcome,failures.length>0);
      setStatus(outcome, failures.length ? "bad":"good");
    }catch(error){
      const message=String(error.message||error);
      notice(message.includes("Unknown API endpoint")
        ? "Local Python server is outdated. Stop ./serve.sh with Ctrl+C, update from GitHub, and restart it."
        : message,true);
      setStatus(message,"bad");
    }finally{
      importing=false;
      $("roomGooglePick").disabled=false;
      updateSaveButtons();
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

  window.artGooglePhotosSelection = {
    hasPending,
    importPending: importToDestination,
    refreshSubmit: updateSaveButtons
  };
  document.getElementById("newFile").addEventListener("change",() => {
    if(!document.getElementById("newFile").files.length) {
      updateSaveButtons();
      return;
    }
    if(pollTimer) clearTimeout(pollTimer);
    selected=[];
    renderSelection();
    $("roomGooglePickerLink").hidden=true;
    $("roomGoogleStage").hidden=true;
    notice("Mac file selected. Complete the artwork details and press the Add or Upload button.");
  });
  $("roomGoogleSelected").addEventListener("change",updateSaveButtons);
  updateSaveButtons();
  section.addEventListener("toggle",() => {
    if(section.open) status().catch(error=>notice(error.message,true));
    else if(pollTimer)clearTimeout(pollTimer);
  });
  $("roomGoogleSetup").addEventListener("click",()=>{
    $("roomGoogleConfig").hidden=!$("roomGoogleConfig").hidden;
  });
  $("roomGoogleConfigure").addEventListener("click",async()=>{
    try{
      await call("/api/google-photos/configure",{
        clientId:$("roomGoogleClientId").value.trim(),
        clientSecret:$("roomGoogleClientSecret").value
      });
      $("roomGoogleClientSecret").value="";
      $("roomGoogleClientId").value="";
      $("roomGoogleConfig").hidden=true;
      await status();
      notice("Google credentials saved locally. Click Connect Google Photos.");
    }catch(error){notice(error.message,true);}
  });
  $("roomGoogleDisconnect").addEventListener("click",async()=>{
    if(!window.confirm("Disconnect Google Photos? Imported artworks and Studio Assets remain unchanged.")) return;
    try{
      await call("/api/google-photos/disconnect",{});
      selected=[];
      renderSelection();
      await status();
    }catch(error){notice(error.message,true);}
  });
  window.addEventListener("art-upload-destination-changed",()=>{
    renderSelection();
    if(section.open) status().catch(error=>notice(error.message,true));
  });
  $("roomGoogleConnect").addEventListener("click",connect);
  $("roomGooglePick").addEventListener("click",choose);
  $("roomGoogleCancel").addEventListener("click",cancel);
  // No second import button: final submission is owned by the destination form.
  window.addEventListener("message",event=>{
    if(event.origin===window.location.origin &&
       event.data && event.data.type==="arts-google-photos-connected" &&
       section.open) status().catch(error=>notice(error.message,true));
  });
})();

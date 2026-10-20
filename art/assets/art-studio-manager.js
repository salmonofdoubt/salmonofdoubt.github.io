/* STUDIO_ASSETS_V1: independent local archive; no changes to related groups. */
(() => {
  const host = document.getElementById("studioUploadPanel");
  if (!host) return;

  const dialog = document.createElement("div");
  dialog.className = "studio-dialog studio-embedded";
  dialog.setAttribute("aria-label", "Studio Assets");
  dialog.innerHTML = [
    '<div class="studio-inner">',
    '  <p class="micro">Local archive · not a published Room</p>',
    '  <h2>Studio Assets</h2>',
    '  <p class="studio-subtitle">Upload working sketches, reference material, underpaintings, documents and other files. Link any asset to one or more published artworks without creating a new Room entry.</p>',
    '  <div class="studio-layout">',
    '    <section class="studio-panel">',
    '      <h3 id="studioFormHeading">Add supporting material</h3>',
    '      <div class="studio-file-feedback" id="studioPending">No files selected.</div>',
    '      <label>Title <input id="studioTitle" placeholder="Optional: uses the filename for batch uploads"></label>',
    '      <label>Note <textarea id="studioNote" rows="3" placeholder="Stage, context, source, date…"></textarea></label>',
    '      <label>Visibility <select id="studioVisibility">',
    '        <option value="related">Show when visitors click See related</option>',
    '        <option value="private">Keep local, not shown publicly</option>',
    '      </select></label>',
    '      <p class="studio-warning">Related files are publicly accessible after you commit and push. Private files stay in .art-private and are not published. Unsupported file formats stay private for security.</p>',
    '      <h3>Associate with artworks</h3>',
    '      <div class="studio-mini-actions">',
    '        <button type="button" id="studioUseSelected">Use selected artwork</button>',
    '        <button type="button" id="studioClearLinks">Clear links</button>',
    '      </div>',
    '      <input id="studioArtworkSearch" placeholder="Find a painting or drawing…">',
    '      <div class="studio-artworks" id="studioArtworks"></div>',
    '      <div class="studio-form-actions">',
    '        <button type="button" class="primary" id="studioSave">Upload assets</button>',
    '        <button type="button" id="studioCancelEdit" hidden>Cancel edit</button>',
    '      </div>',
    '      <p class="studio-feedback" role="status" id="studioMessage"></p>',
    '    </section>',
    '    <section class="studio-panel">',
    '      <div class="studio-library-heading"><h3>Asset library</h3><span id="studioCount"></span></div>',
    '      <input id="studioAssetSearch" placeholder="Search assets and file names…">',
    '      <label class="studio-filter"><input id="studioOnlySelected" type="checkbox"> Only assets linked to selected artwork</label>',
    '      <div class="studio-list" id="studioList"></div>',
    '    </section>',
    '  </div>',
    '</div>'
  ].join("");
  host.appendChild(dialog);

  const $ = id => dialog.querySelector("#" + id);
  const escapes = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  let assets = [];
  let artworks = [];
  let links = new Set();
  let files = [];
  let editingId = null;
  let busy = false;
  let googleReady = [];
  let googlePollTimer = null;
  let googlePolling = false;
  let googleImportBusy = false;

  function showMessage(message, error = false) {
    const node = $("studioMessage");
    node.textContent = message;
    node.classList.toggle("studio-error", error);
  }

  function selectedArtwork() {
    return typeof state !== "undefined" ? state.selectedId : null;
  }

  function renderArtworkChoices() {
    const query = $("studioArtworkSearch").value.toLowerCase().trim();
    const matches = artworks.filter(item =>
      [item.title, item.collection, item.subgroup].join(" ").toLowerCase().includes(query));
    $("studioArtworks").innerHTML = matches.map(item =>
      '<label><input type="checkbox" value="' + escapes(item.id) + '"' +
      (links.has(item.id) ? ' checked' : '') + '> ' +
      '<span>' + escapes(item.title || "Untitled") + '</span>' +
      '<small>' + escapes(item.collection || "") + '</small></label>'
    ).join("") || '<p class="studio-empty">No matching artworks.</p>';
    $("studioArtworks").querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener("change", () => {
        if (input.checked) links.add(input.value);
        else links.delete(input.value);
      });
    });
  }

  function labelForAsset(asset) {
    return (asset.artworkIds || []).map(id => {
      const item = artworks.find(work => work.id === id);
      return item ? item.title : id;
    }).join(", ");
  }

  function renderLibrary() {
    const search = $("studioAssetSearch").value.toLowerCase().trim();
    const id = selectedArtwork();
    const filtered = assets.filter(item =>
      (!$("studioOnlySelected").checked || (id && (item.artworkIds || []).includes(id))) &&
      [item.title, item.originalFilename, item.note, labelForAsset(item)]
        .join(" ").toLowerCase().includes(search));
    $("studioCount").textContent = String(assets.length) + " stored";
    $("studioList").innerHTML = filtered.map(item => {
      const preview = item.mime.startsWith("image/") &&
        /\.(png|jpe?g|webp|gif|avif)$/i.test(item.originalFilename)
        ? '<img loading="lazy" src="' + escapes(item.localUrl) + '" alt="">'
        : '<div class="studio-file-icon">FILE</div>';
      const labels = labelForAsset(item);
      const status = item.visibility === "private" ? "Private" :
        !labels ? "Unassigned · not publicly visible" : "See related";
      return '<article class="studio-asset" data-id="' + escapes(item.id) + '">' +
        '<div class="studio-preview">' + preview + '</div>' +
        '<div class="studio-asset-info"><strong>' + escapes(item.title) + '</strong>' +
        '<small>' + escapes(item.originalFilename) + '</small>' +
        '<small>' + escapes(status) + (labels ? ' · ' + escapes(labels) : '') + '</small>' +
        (item.note ? '<p>' + escapes(item.note) + '</p>' : '') +
        '<div class="studio-mini-actions"><button type="button" data-edit="' +
        escapes(item.id) + '">Edit links / details</button>' +
        '<a href="' + escapes(item.localUrl) + '" target="_blank" rel="noopener noreferrer">Open</a>' +
        '<button type="button" data-delete="' + escapes(item.id) + '">Delete</button></div></div></article>';
    }).join("") || '<p class="studio-empty">No Studio Assets match your search.</p>';
    $("studioList").querySelectorAll("[data-edit]").forEach(node =>
      node.addEventListener("click", () => startEdit(node.dataset.edit)));
    $("studioList").querySelectorAll("[data-delete]").forEach(node =>
      node.addEventListener("click", () => deleteItem(node.dataset.delete)));
  }

  function updatePending() {
    $("studioPending").textContent = files.length
      ? files.map(file => file.name + " (" + (file.size / 1048576).toFixed(1) + " MB)").join(" · ")
      : "No files selected.";
  }

  function resetForm(keepLinks = false) {
    editingId = null;
    files = [];
    $("studioFiles").value = "";
    $("studioTitle").value = "";
    $("studioNote").value = "";
    $("studioVisibility").value = "related";
    $("studioFormHeading").textContent = "Add supporting material";
    $("studioSave").textContent = "Upload assets";
    $("studioCancelEdit").hidden = true;
    $("studioDrop").hidden = false;
    if (!keepLinks) links = new Set(selectedArtwork() ? [selectedArtwork()] : []);
    updatePending();
    renderArtworkChoices();
  }

  function startEdit(id) {
    const item = assets.find(a => a.id === id);
    if (!item) return;
    editingId = id;
    files = [];
    $("studioFiles").value = "";
    $("studioTitle").value = item.title || "";
    $("studioNote").value = item.note || "";
    $("studioVisibility").value = item.visibility || "private";
    links = new Set(item.artworkIds || []);
    $("studioFormHeading").textContent = "Edit: " + (item.title || item.originalFilename);
    $("studioSave").textContent = "Save changes";
    $("studioCancelEdit").hidden = false;
    $("studioDrop").hidden = true;
    renderArtworkChoices();
    $("studioPending").textContent = "Existing file is preserved. Edit its details and associations here.";
    dialog.querySelector(".studio-panel").scrollIntoView({block: "start", behavior: "smooth"});
  }

  async function apiPost(path, payload) {
    const response = await fetch(path, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Studio request failed");
    return result;
  }

  function fileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read " + file.name));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  async function loadAssets() {
    const response = await fetch("/api/studio-assets?ts=" + Date.now(), {cache: "no-store"});
    if (!response.ok) throw new Error("Local Studio Assets API is not running");
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "Could not load Studio Assets");
    assets = payload.assets || [];
    renderLibrary();
  }

  async function save() {
    if (busy) return;
    if (!editingId && !files.length) {
      showMessage("Select or drop one or more files first.", true);
      return;
    }
    if (!editingId && files.some(file => file.size > 25 * 1048576 || !file.size)) {
      showMessage("Each file must be between 1 byte and 25 MB.", true);
      return;
    }
    busy = true;
    $("studioSave").disabled = true;
    const selectedLinks = [...links];
    let completed = 0;
    let privateCount = 0;
    try {
      if (editingId) {
        await apiPost("/api/studio-update", {
          id: editingId, title: $("studioTitle").value,
          note: $("studioNote").value, visibility: $("studioVisibility").value,
          artworkIds: selectedLinks
        });
        showMessage("Details and artwork associations updated. Existing related groups unchanged.");
      } else {
        const batch = [...files];
        for (const file of batch) {
          showMessage("Uploading " + (completed + 1) + " of " + batch.length + ": " + file.name);
          const result = await apiPost("/api/studio-upload", {
            filename: file.name, fileDataUrl: await fileDataUrl(file),
            title: batch.length === 1 ? ($("studioTitle").value || file.name) : file.name,
            note: $("studioNote").value, visibility: $("studioVisibility").value,
            artworkIds: selectedLinks
          });
          completed++;
          if (result.asset && result.asset.visibility === "private") privateCount++;
        }
        showMessage(completed + " asset(s) saved; existing relationships unchanged." +
          (privateCount ? " " + privateCount + " retained privately due to visibility or file type." : "") +
          " Commit and push the generated public assets to publish See related.");
      }
      resetForm(true);
      await loadAssets();
    } catch (error) {
      showMessage(error.message + (completed ? " (" + completed + " already uploaded)" : ""), true);
      await loadAssets().catch(() => {});
    } finally {
      busy = false;
      $("studioSave").disabled = false;
    }
  }

  async function deleteItem(id) {
    const item = assets.find(a => a.id === id);
    if (!item || !window.confirm('Delete "' + item.title + '" from the Studio Assets store?')) return;
    try {
      await apiPost("/api/studio-delete", {id});
      if (editingId === id) resetForm();
      await loadAssets();
      showMessage("Asset deleted. No published artwork relationships were changed.");
    } catch (error) {
      showMessage(error.message, true);
    }
  }


  function googleNotice(message, error=false) {
    $("studioGoogleStatus").textContent = message;
    $("studioGoogleStatus").classList.toggle("studio-error", error);
  }

  async function googleGet(path) {
    const resp = await fetch(path + "?ts=" + Date.now(), {cache:"no-store"});
    const result = await resp.json().catch(()=>({}));
    if (!resp.ok || !result.ok) throw new Error(result.error || "Google Photos request failed");
    return result;
  }

  async function googleRefresh() {
    const status = await googleGet("/api/google-photos/status");
    $("studioGoogleRedirect").textContent = status.redirectUri;
    $("studioGoogleConfig").hidden = status.configured;
    $("studioGoogleConnect").disabled = !status.configured || status.connected;
    $("studioGooglePick").disabled = !status.connected || googleImportBusy;
    $("studioGoogleCancel").hidden = !status.picking;
    $("studioGoogleDisconnect").disabled = !status.connected;
    googleNotice(status.connected
      ? "Google Photos connected. Choose images to import into the local Studio Assets library."
      : status.configured ? "Google Cloud configured. Connect your account to continue."
        : "One-time Google Cloud setup required before you can use Google Photos.");
    if (status.connected && status.picking && !googleReady.length && !googlePolling) {
      scheduleGooglePoll(1);
    }
  }

  function scheduleGooglePoll(seconds) {
    if (googlePollTimer) clearTimeout(googlePollTimer);
    googlePollTimer = setTimeout(googlePoll, Math.round(1000 * Math.max(2, seconds || 4)));
  }

  function renderGooglePicked() {
    const items = googleReady;
    $("studioGooglePicked").innerHTML = items.length
      ? '<p><strong>' + items.length + ' selected in Google Photos</strong></p>' +
        items.map(item =>
          '<label><input type="checkbox" value="' + escapes(item.id) +
          '" checked> ' + escapes(item.filename) + ' <small>' +
          escapes(item.mimeType || "") + '</small></label>'
        ).join("")
      : "";
    $("studioGoogleImport").hidden = !items.length;
  }

  async function googlePoll() {
    if (!dialog.open || googlePolling || !googleReady.length && googleImportBusy) return;
    googlePolling = true;
    try {
      const result = await googleGet("/api/google-photos/poll");
      if (result.ready) {
        googleReady = result.items || [];
        renderGooglePicked();
        googleNotice(googleReady.length
          ? "Selection ready. Check the items below, then import."
          : "No photos were selected. You may choose again.");
        $("studioGoogleCancel").hidden = false;
      } else {
        googleNotice("Choose photos in the Google Photos window and press Done there…");
        scheduleGooglePoll(result.pollAfter || 4);
      }
    } catch (error) {
      googleNotice(error.message, true);
    } finally {
      googlePolling = false;
    }
  }

  async function googleConfigure() {
    try {
      const result = await apiPost("/api/google-photos/configure", {
        clientId: $("studioGoogleClientId").value,
        clientSecret: $("studioGoogleClientSecret").value
      });
      $("studioGoogleClientSecret").value = "";
      $("studioGoogleClientId").value = "";
      $("studioGoogleConfig").hidden = true;
      googleNotice("Configuration saved locally. Connect your Google account.");
      await googleRefresh();
    } catch (error) {
      googleNotice(error.message, true);
    }
  }

  function googleConnect() {
    // This is a user gesture, so popups aren't blocked by async setup.
    const popup = window.open("/api/google-photos/connect", "artsGooglePhotosAuth",
      "width=620,height=740");
    if (!popup) {
      googleNotice("Allow popups for localhost to connect Google Photos.", true);
    } else {
      googleNotice("Complete Google sign-in in the new window, then return here.");
    }
  }

  async function googleStartPicker() {
    // Reserve a real popup synchronously; otherwise popup blockers interfere.
    const popup = window.open("about:blank", "artsGooglePhotosPicker");
    try {
      googleReady = [];
      renderGooglePicked();
      const result = await apiPost("/api/google-photos/start", {});
      const uri = String(result.pickerUri || "");
      if (!uri.startsWith("https://photos.google.com/")) {
        throw new Error("Google returned an unexpected Picker address");
      }
      $("studioGooglePickerFallback").href = uri;
      $("studioGooglePickerFallback").hidden = false;
      $("studioGoogleCancel").hidden = false;
      if (popup) popup.location = uri;
      googleNotice("Select photos in Google Photos and press Done.");
      scheduleGooglePoll(result.pollAfter || 4);
    } catch (error) {
      if (popup) popup.close();
      googleNotice(error.message, true);
    }
  }

  async function googleImport() {
    if (googleImportBusy) return;
    const ids = [...$("studioGooglePicked").querySelectorAll('input[type="checkbox"]:checked')]
      .map(node=>node.value);
    if (!ids.length) { googleNotice("Tick at least one photo to import.", true); return; }
    googleImportBusy = true;
    $("studioGoogleImport").disabled = true;
    googleNotice("Importing " + ids.length + " selected media files to Studio Assets…");
    try {
      const result = await apiPost("/api/google-photos/import", {
        ids, artworkIds:[...links], visibility: $("studioVisibility").value
      });
      const report = result.googlePhotos || result;
      await loadAssets();
      const errors = (report.failures || []);
      if (errors.length) {
        googleReady = googleReady.filter(item => errors.some(err => err.id === item.id));
        renderGooglePicked();
      } else {
        googleReady = [];
        renderGooglePicked();
        $("studioGooglePickerFallback").hidden = true;
        $("studioGoogleCancel").hidden = true;
      }
      googleNotice((report.message || "Import completed") +
        (errors.length ? ": " + errors.map(e => e.filename + " (" + e.error + ")").join("; ") : "") +
        ". Existing published artwork relations are unchanged.", !!errors.length);
    } catch (error) {
      googleNotice(error.message, true);
    } finally {
      googleImportBusy = false;
      $("studioGoogleImport").disabled = false;
    }
  }

  async function googleCancel() {
    if (googlePollTimer) clearTimeout(googlePollTimer);
    try {
      await apiPost("/api/google-photos/cancel", {});
      googleReady = [];
      renderGooglePicked();
      $("studioGooglePickerFallback").hidden = true;
      await googleRefresh();
    } catch (error) { googleNotice(error.message, true); }
  }

  async function googleDisconnect() {
    if (!window.confirm("Disconnect Google Photos on this Mac? Studio Assets already imported will remain.")) return;
    try {
      await apiPost("/api/google-photos/disconnect", {});
      if (googlePollTimer) clearTimeout(googlePollTimer);
      googleReady = [];
      renderGooglePicked();
      await googleRefresh();
    } catch (error) { googleNotice(error.message, true); }
  }

  button.addEventListener("click", async () => {
    if (!dialog.open) dialog.showModal();
    links = new Set(selectedArtwork() ? [selectedArtwork()] : []);
    try {
      if (typeof state !== "undefined" && state.artworks && state.artworks.length) {
        artworks = state.artworks;
      } else {
        const response = await fetch("../data/artworks.json");
        artworks = (await response.json()).artworks || [];
      }
      resetForm();
      await loadAssets();
      await googleRefresh().catch(error => googleNotice(error.message, true));
      showMessage("Studio Assets are stored locally. Nothing is placed in an exhibition Room.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });
  dialog.querySelector(".studio-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  $("studioFiles").addEventListener("change", event => {
    files = [...event.target.files];
    updatePending();
  });
  const drop = $("studioDrop");
  drop.addEventListener("dragover", event => {
    event.preventDefault();
    drop.classList.add("studio-dragover");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("studio-dragover"));
  drop.addEventListener("drop", event => {
    event.preventDefault();
    drop.classList.remove("studio-dragover");
    files = [...event.dataTransfer.files];
    updatePending();
  });
  $("studioUseSelected").addEventListener("click", () => {
    if (selectedArtwork()) links.add(selectedArtwork());
    renderArtworkChoices();
  });
  $("studioClearLinks").addEventListener("click", () => { links.clear(); renderArtworkChoices(); });
  $("studioArtworkSearch").addEventListener("input", renderArtworkChoices);
  $("studioAssetSearch").addEventListener("input", renderLibrary);
  $("studioOnlySelected").addEventListener("change", renderLibrary);
  $("studioSave").addEventListener("click", save);
  $("studioCancelEdit").addEventListener("click", () => resetForm());
  $("studioGoogleConfigure").addEventListener("click", googleConfigure);
  $("studioGoogleConnect").addEventListener("click", googleConnect);
  $("studioGooglePick").addEventListener("click", googleStartPicker);
  $("studioGoogleImport").addEventListener("click", googleImport);
  $("studioGoogleCancel").addEventListener("click", googleCancel);
  $("studioGoogleDisconnect").addEventListener("click", googleDisconnect);
  $("studioGoogleSetup").addEventListener("click", () => {
    $("studioGoogleConfig").hidden = !$("studioGoogleConfig").hidden;
  });
  window.addEventListener("message", event => {
    if (event.origin === window.location.origin &&
        event.data && event.data.type === "arts-google-photos-connected") {
      googleRefresh().catch(error => googleNotice(error.message, true));
    }
  });
  dialog.addEventListener("close", () => {
    if (googlePollTimer) clearTimeout(googlePollTimer);
  });
})();

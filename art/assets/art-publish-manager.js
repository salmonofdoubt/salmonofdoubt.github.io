/* ARTS PUBLISH V1 - local Save → Review → Commit → Publish workflow. */
(() => {
  const dock = document.querySelector(".action-menus");
  if (!dock) return;

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "art-publish-open";
  launcher.textContent = "Save · Commit · Publish";
  dock.appendChild(launcher);

  const dialog = document.createElement("dialog");
  dialog.className = "art-publish-dialog";
  dialog.setAttribute("aria-label", "Save, commit and publish ARTS");
  dialog.innerHTML = [
    '<div class="art-publish-inner">',
    '  <button type="button" class="art-publish-close" aria-label="Close">×</button>',
    '  <p class="micro">LOCAL ARTS MANAGER · PUBLICATION</p>',
    '  <h2>Save → Commit → Publish</h2>',
    '  <div class="art-publish-steps">',
    '    <div><strong>1 · Save</strong><small>Editing and uploads already save locally. Nothing public yet.</small></div>',
    '    <div><strong>2 · Commit</strong><small>Review the public files, then save them in local Git history.</small></div>',
    '    <div><strong>3 · Publish</strong><small>Check outgoing commits and approve the GitHub push separately.</small></div>',
    '  </div>',
    '  <div role="status" id="artPublishMessage" class="art-publish-message"></div>',
    '  <section class="art-publish-phase">',
    '    <div class="art-publish-phase-head"><h3>Review local changes</h3>',
    '      <button type="button" id="artPublishReview">Refresh review</button></div>',
    '    <p>Everything marked <strong>Included</strong> will be committed together. Unrelated projects, private Studio originals, OAuth credentials and other excluded files are never selected.</p>',
    '    <div id="artPublishReviewSummary"></div>',
    '    <div id="artPublishFileList" class="art-publish-files"></div>',
    '    <div id="artPublishExcluded"></div>',
    '    <label class="art-publish-checkbox"><input type="checkbox" id="artPublishCommitApproved">',
    '      I have reviewed the file list, artwork metadata, public paths and any expanded diffs.</label>',
    '    <label class="art-publish-commit-label">Local commit description',
    '      <input type="text" id="artPublishCommitMessage" maxlength="120" value="ARTS: save reviewed gallery changes"></label>',
    '    <button type="button" class="primary" id="artPublishCommit" disabled>Commit reviewed files locally</button>',
    '  </section>',
    '  <section class="art-publish-phase">',
    '    <div class="art-publish-phase-head"><h3>Review publication</h3>',
    '      <button type="button" id="artPublishCheckPush">Review outgoing commits</button></div>',
    '    <p>Publishing pushes the complete reviewed Git commits to the configured ARTS GitHub repository. It does not create additional artworks or change your originals.</p>',
    '    <div id="artPublishOutgoing"></div>',
    '    <label class="art-publish-checkbox"><input type="checkbox" id="artPublishPushApproved">',
    '      I understand these files will be accessible on GitHub and may become accessible on the public website.</label>',
    '    <label class="art-publish-commit-label">Type <strong>PUBLISH</strong> to confirm',
    '      <input type="text" id="artPublishConfirm" spellcheck="false" autocomplete="off" placeholder="PUBLISH"></label>',
    '    <button type="button" class="primary art-publish-submit" id="artPublishPush" disabled>Publish reviewed commits to GitHub</button>',
    '  </section>',
    '</div>'
  ].join("");
  document.body.appendChild(dialog);

  const $ = (id) => dialog.querySelector("#" + id);
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  let commitReview = null;
  let publishReview = null;
  let busy = false;

  function info(message, error=false) {
    const node = $("artPublishMessage");
    node.textContent = message;
    node.classList.toggle("art-publish-error", error);
  }

  async function getJson(path) {
    const response = await fetch(path + "?ts=" + Date.now(), {cache:"no-store"});
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Cannot load publication review");
    return result;
  }

  async function postJson(path, value) {
    const response = await fetch(path, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(value)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Publication action failed");
    return result;
  }

  function commitButton() {
    $("artPublishCommit").disabled = busy || !commitReview?.ready ||
      !$("artPublishCommitApproved").checked;
    $("artPublishReview").disabled = busy;
    $("artPublishCheckPush").disabled = busy;
  }

  function publishButton() {
    $("artPublishPush").disabled = busy || !publishReview?.ahead ||
      !$("artPublishPushApproved").checked || $("artPublishConfirm").value !== "PUBLISH";
  }

  function fileDisplay(item) {
    const status = item.change === "??" || item.change.includes("A") ? "NEW"
      : item.change.includes("D") ? "REMOVED" : "CHANGED";
    const description = item.summary || {};
    const group = (label, values) => {
      if (!values?.length) return "";
      return '<div class="art-publish-subgroup"><strong>' + label + '</strong><ul>' +
        values.map(entry => '<li>' + esc(entry.title || entry.id || "") +
          (entry.collection ? " · " + esc(entry.collection) : "") +
          (entry.status && entry.status !== "active" ? " · " + esc(entry.status) : "") +
          (entry.members ? " · " + esc(entry.members) + " related items" : "") +
          '</li>').join("") + '</ul></div>';
    };
    const snapshot = group("Added", description.added) +
      group("Changed", description.updated) + group("Removed", description.removed);
    const totals = description.totals;
    const totalsText = totals
      ? '<small>Records: ' + totals.added + ' added, ' + totals.updated + ' changed, ' +
        totals.removed + ' removed</small>' : "";
    const local = item.change.includes("D") ? "" :
      '<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">Open local file</a>';
    return '<details class="art-publish-file">' +
      '<summary><span class="art-publish-file-state">' + status + '</span><span class="art-publish-filename">' +
      esc(item.path) + '</span><small>' + (item.size / 1024).toFixed(1) + ' KB</small></summary>' +
      '<div class="art-publish-file-info"><p><strong>Public path:</strong> <code>' +
      esc(item.url) + '</code> ' + local + '</p>' +
      '<p>Once pushed, this file can be retrieved from the public GitHub repository. ' +
      'Links shown here are local previews, not proof of live publication.</p>' +
      totalsText + snapshot +
      (item.binary ? '<p>Binary file: inspect the image/document using Open local file before committing.</p>' :
        '<pre>' + esc(item.diff || "(no text diff)") + '</pre>') +
      (item.truncated ? '<p class="art-publish-warning">Text diff preview truncated. Open the local file and verify the full content before committing.</p>' : "") +
      '</div></details>';
  }

  function renderCommitReview(result) {
    commitReview = result;
    publishReview = null;
    $("artPublishCommitApproved").checked = false;
    $("artPublishPushApproved").checked = false;
    $("artPublishConfirm").value = "";
    $("artPublishOutgoing").textContent = "Review outgoing commits after committing.";
    $("artPublishReviewSummary").innerHTML =
      '<p><strong>' + result.files.length + '</strong> public-gallery file change(s) ready to review. ' +
      '<strong>' + result.excluded.length + '</strong> excluded change(s). ' +
      'Current commit <code>' + esc(result.head) + '</code>.</p>' +
      '<p class="art-publish-warning">' + esc(result.warning) + '</p>';
    $("artPublishFileList").innerHTML = result.files.length
      ? result.files.map(fileDisplay).join("")
      : '<p>There are no uncommitted public-gallery changes. You can review previously committed changes for publishing below.</p>';
    const excluded = result.excluded || [];
    $("artPublishExcluded").innerHTML = excluded.length
      ? '<details class="art-publish-excluded"><summary>' + excluded.length +
        ' excluded files (never committed by this tool)</summary><ul>' +
        excluded.map(item => '<li><code>' + esc(item.path) + '</code>' +
          (item.staged ? ' <strong>STAGED: unstage this before using the Commit button</strong>' : '') +
          '</li>').join("") + '</ul></details>'
      : '<p>Other project files and private source material are excluded by design.</p>';
    if (result.stagedOutside.length) info("Other files are already staged. Unstage those files before committing from ARTS Manager.", true);
    else info(result.files.length
      ? "Review each intended public file, then tick the confirmation to enable Commit."
      : "No new local gallery changes to commit.");
    commitButton();
    publishButton();
  }

  async function refreshReview() {
    if(busy) return;
    busy = true;
    commitButton();
    info("Collecting local changes and reviewing the public files…");
    try {
      const result = await getJson("/api/art-publish/review");
      renderCommitReview(result);
    } catch (error) {
      commitReview = null;
      $("artPublishFileList").textContent = "";
      $("artPublishReviewSummary").textContent = "";
      info(error.message, true);
    } finally {
      busy = false;
      commitButton();
    }
  }

  async function commit() {
    if(busy || !commitReview?.ready || !$("artPublishCommitApproved").checked) return;
    busy=true; commitButton(); publishButton();
    info("Saving reviewed public-gallery files to local Git. Not publishing.");
    try {
      const result = await postJson("/api/art-publish/commit", {
        reviewToken: commitReview.token,
        message: $("artPublishCommitMessage").value
      });
      commitReview = null;
      info(result.message + " Commit " + result.head + ".");
    } catch (error) {
      info(error.message, true);
    } finally {
      busy=false;
      await refreshReview();
    }
  }

  function renderPublishReview(result) {
    publishReview=result;
    $("artPublishPushApproved").checked=false;
    $("artPublishConfirm").value="";
    if (!result.ahead) {
      $("artPublishOutgoing").textContent=result.message || "There are no commits waiting to publish.";
    } else {
      $("artPublishOutgoing").innerHTML =
        '<p><strong>' + result.ahead + ' local commit(s)</strong> will be pushed to GitHub master.</p>' +
        '<p><strong>GitHub:</strong> <code>salmonofdoubt/salmonofdoubt.github.io</code></p>' +
        '<p><strong>Outgoing commit descriptions:</strong></p><ul>' +
        (result.commits || []).map(value=>'<li>'+esc(value)+'</li>').join("") +
        '</ul><p><strong>Complete list of public paths in outgoing commits:</strong></p><ul>' +
        result.files.map(path=>'<li><code>'+esc(path)+'</code> ' +
          '<a href="/'+esc(path)+'" target="_blank" rel="noopener noreferrer">Local preview</a></li>').join("") +
        '</ul><p class="art-publish-warning">These exact commits, not just the last saved artwork, will be pushed. ' +
        'Public GitHub and Pages visibility can differ in timing.</p>';
    }
    publishButton();
  }

  async function refreshPublishReview() {
    if(busy) return;
    busy=true;
    commitButton(); publishButton();
    info("Checking outgoing Git commits against GitHub master…");
    try {
      const result=await getJson("/api/art-publish/publish-review");
      renderPublishReview(result);
      info(result.ahead
        ? "Review outgoing commits and public paths before confirming the GitHub push."
        : "There are no unpublished commits.");
    }catch(error) {
      publishReview=null;
      $("artPublishOutgoing").textContent="Review unavailable: "+error.message;
      info(error.message,true);
    }finally {
      busy=false;
      commitButton(); publishButton();
    }
  }

  async function push() {
    if(busy || !publishReview?.ahead || !$("artPublishPushApproved").checked ||
       $("artPublishConfirm").value!=="PUBLISH") return;
    busy=true; commitButton(); publishButton();
    info("Pushing reviewed commits to GitHub. Waiting for confirmation…");
    try {
      const result=await postJson("/api/art-publish/push", {
        reviewToken: publishReview.token,
        confirmation: $("artPublishConfirm").value
      });
      publishReview=null;
      $("artPublishPushApproved").checked=false;
      $("artPublishConfirm").value="";
      info(result.message+" Commit "+result.head.slice(0,9)+".");
      await refreshPublishReview();
    }catch(error){ info(error.message,true); }
    finally{busy=false; commitButton(); publishButton();}
  }

  launcher.addEventListener("click",()=> {
    if(!dialog.open) dialog.showModal();
    refreshReview();
  });
  dialog.querySelector(".art-publish-close").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog) dialog.close();});
  $("artPublishReview").addEventListener("click",refreshReview);
  $("artPublishCheckPush").addEventListener("click",refreshPublishReview);
  $("artPublishCommitApproved").addEventListener("change",commitButton);
  $("artPublishPushApproved").addEventListener("change",publishButton);
  $("artPublishConfirm").addEventListener("input",publishButton);
  $("artPublishCommit").addEventListener("click",commit);
  $("artPublishPush").addEventListener("click",push);
})();

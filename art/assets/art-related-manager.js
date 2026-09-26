/* RELATED_MANAGER_V2 */
/* REFERENCES_V1 */
(() => {
  const grid = document.getElementById("grid");
  if (!grid || typeof state === "undefined") return;

  const actionMenus = document.querySelector(".action-menus");
  const toolbar = document.querySelector(".toolbar");
  const dock = document.querySelector(".manager-dock");

  const relation = {
    groups: [],
    references: [],
    activeSelection: false,
    selectedArtworkIds: new Set(),
    arrangedMembers: [],
    editingGroupId: null,
    editingTitle: "",
    workspaceFilterArtworkId: null,
    workspaceTab: "groups",
    draggedKey: null,
    editingReferenceId: null
  };

  function normalizeMember(member) {
    if (typeof member === "string") return {kind: "artwork", id: member};
    return {
      kind: String((member && member.kind) || "artwork"),
      id: String((member && member.id) || "")
    };
  }

  function memberKey(member) {
    const normalized = normalizeMember(member);
    return `${normalized.kind}:${normalized.id}`;
  }

  function artwork(id) {
    return state.artworks.find((item) => item.id === id) || null;
  }

  function reference(id) {
    return relation.references.find((item) => item.id === id) || null;
  }

  function artworkMembers(group) {
    return (group.members || [])
      .map(normalizeMember)
      .filter((member) => member.kind === "artwork" && member.id);
  }

  function referenceMembers(group) {
    return (group.members || [])
      .map(normalizeMember)
      .filter((member) => member.kind === "reference" && member.id);
  }

  function groupsForArtwork(id) {
    return relation.groups.filter((group) =>
      artworkMembers(group).some((member) => member.id === id)
    );
  }

  function groupsForReference(id) {
    return relation.groups.filter((group) =>
      referenceMembers(group).some((member) => member.id === id)
    );
  }

  function referenceImage(item) {
    return item && item.hasFile
      ? `/api/reference-image/${encodeURIComponent(item.id)}?v=${encodeURIComponent(item.updatedAt || "")}`
      : "";
  }

  function referenceVisibilityLabel(value) {
    return {
      private: "Private",
      metadata: "Metadata only",
      public: "Public image"
    }[value] || "Private";
  }

  async function apiPost(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(result.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = result;
      throw error;
    }

    return result;
  }

  async function loadManagerState() {
    const [groupsResponse, referencesResponse] = await Promise.all([
      fetch("/api/related-groups?ts=" + Date.now(), {cache: "no-store"}),
      fetch("/api/references?ts=" + Date.now(), {cache: "no-store"})
    ]);

    const groupsResult = await groupsResponse.json();
    const referencesResult = await referencesResponse.json();

    if (!groupsResponse.ok || !groupsResult.ok) {
      throw new Error(groupsResult.error || "Could not load related groups");
    }

    if (!referencesResponse.ok || !referencesResult.ok) {
      throw new Error(referencesResult.error || "Could not load references");
    }

    relation.groups = (groupsResult.related && groupsResult.related.groups) || [];
    relation.references = referencesResult.references || [];

    updateRelateButton();
    decorateCards();
    renderWorkspace();
  }

  const relateButton = document.createElement("button");
  relateButton.type = "button";
  relateButton.className = "relate-manager-button";
  relateButton.textContent = "Relate";
  relateButton.setAttribute("aria-pressed", "false");

  if (actionMenus) {
    actionMenus.classList.add("related-manager-ready");
    actionMenus.appendChild(relateButton);
  } else if (toolbar) {
    toolbar.appendChild(relateButton);
  }

  function updateRelateButton() {
    relateButton.textContent = relation.groups.length
      ? `Relate · ${relation.groups.length}`
      : "Relate";
  }

  const selectionBar = document.createElement("div");
  selectionBar.className = "related-selection-bar";
  selectionBar.hidden = true;
  selectionBar.innerHTML = `
    <div class="related-selection-copy">
      <strong id="relatedSelectionCount">0 works selected</strong>
      <small id="relatedSelectionInstruction">Select works. Order is set in the next step.</small>
      <div class="related-selection-tags" id="relatedSelectionTags"></div>
    </div>
    <div class="related-selection-actions">
      <button class="primary" id="openRelatedArrange" type="button">Arrange selected</button>
      <button id="clearRelatedSelection" type="button">Clear</button>
      <button id="cancelRelatedSelection" type="button">Cancel</button>
    </div>
  `;

  if (dock) {
    dock.appendChild(selectionBar);
  } else if (toolbar) {
    toolbar.insertAdjacentElement("afterend", selectionBar);
  }

  const workspace = document.createElement("dialog");
  workspace.className = "related-workspace";
  workspace.innerHTML = `
    <div class="related-workspace-inner">
      <button class="related-dialog-close" type="button" aria-label="Close related-work manager">×</button>
      <p class="micro">Curation</p>
      <h2>Related works</h2>
      <div class="related-workspace-tabs" role="tablist">
        <button type="button" role="tab" data-workspace-tab="groups" aria-selected="true">Groups</button>
        <button type="button" role="tab" data-workspace-tab="references" aria-selected="false">References</button>
      </div>
      <div class="related-workspace-header">
        <button class="primary" id="relatedWorkspacePrimary" type="button">New related group</button>
        <div class="related-workspace-filter" id="relatedWorkspaceFilter"></div>
      </div>
      <div class="related-group-list" id="relatedGroupList"></div>
      <div class="reference-library-list" id="referenceLibraryList" hidden></div>
    </div>
  `;
  document.body.appendChild(workspace);

  const arrangeDialog = document.createElement("dialog");
  arrangeDialog.className = "related-arrange-dialog";
  arrangeDialog.innerHTML = `
    <div class="related-arrange-inner">
      <button class="related-dialog-close" type="button" aria-label="Close arrangement">×</button>
      <p class="micro">Related works</p>
      <h2 id="relatedArrangeHeading">Arrange the frame</h2>
      <p class="related-arrange-intro">
        This order is the public narrative order. Drag members, or use the arrow controls.
      </p>
      <input class="related-arrange-title" id="relatedGroupTitle" placeholder="Group title">
      <div class="related-arrange-frame" id="relatedArrangeFrame"></div>
      <div class="related-arrange-footer">
        <div class="related-arrange-footer-left">
          <button id="addWorksToGroup" type="button">Add / remove works</button>
          <button id="addReferencesToGroup" type="button">Add reference</button>
        </div>
        <div class="related-arrange-footer-right">
          <button id="cancelRelatedArrange" type="button">Cancel</button>
          <button class="primary" id="saveRelatedArrange" type="button">Save group</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(arrangeDialog);

  const referenceDialog = document.createElement("dialog");
  referenceDialog.className = "reference-dialog";
  referenceDialog.innerHTML = `
    <div class="reference-dialog-inner">
      <button class="related-dialog-close" type="button" aria-label="Close reference editor">×</button>
      <p class="micro">Reference library</p>
      <h2 id="referenceDialogHeading">New reference</h2>
      <form class="reference-form" id="referenceForm">
        <label>
          Title / label
          <input id="referenceTitle" required placeholder="e.g. Mark Hollis press photograph">
        </label>
        <label>
          Creator / credit
          <input id="referenceCreator" placeholder="Photographer, artist, archive, etc.">
        </label>
        <label>
          Source URL
          <input id="referenceSourceUrl" type="url" placeholder="https://…">
        </label>
        <label>
          Visibility
          <select id="referenceVisibility">
            <option value="private">Private — local manager only</option>
            <option value="metadata">Metadata only — public label/credit, image withheld</option>
            <option value="public">Public image — reproduce image in Related frame</option>
          </select>
        </label>
        <p class="reference-form-help">
          Private references never enter the public site. Metadata-only references publish attribution but not the image.
          Public image explicitly copies the uploaded image into the website.
        </p>
        <label>
          Reference image
          <input id="referenceFile" type="file" accept="image/jpeg,image/png,image/webp">
        </label>
        <p class="reference-form-help" id="referenceFileState">No image uploaded yet.</p>
        <label>
          Private rights / permission note
          <textarea id="referencePrivateNote" placeholder="Permission, provenance, licensing notes. This is never published."></textarea>
        </label>
        <div class="reference-form-actions">
          <button type="button" id="cancelReferenceEdit">Cancel</button>
          <button class="primary" type="submit">Save reference</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(referenceDialog);

  const referencePicker = document.createElement("dialog");
  referencePicker.className = "reference-picker-dialog";
  referencePicker.innerHTML = `
    <div class="reference-picker-inner">
      <button class="related-dialog-close" type="button" aria-label="Close reference picker">×</button>
      <p class="micro">Related works</p>
      <h2>Add reference</h2>
      <div class="related-workspace-header">
        <button class="primary" id="newReferenceFromPicker" type="button">New reference</button>
        <div class="related-workspace-filter">Add one or more references; arrange them afterwards.</div>
      </div>
      <div class="reference-picker-list" id="referencePickerList"></div>
      <div class="related-arrange-footer">
        <div></div>
        <div class="related-arrange-footer-right">
          <button id="doneReferencePicker" type="button">Done</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(referencePicker);

  const groupList = workspace.querySelector("#relatedGroupList");
  const referenceList = workspace.querySelector("#referenceLibraryList");
  const workspaceFilter = workspace.querySelector("#relatedWorkspaceFilter");
  const workspacePrimary = workspace.querySelector("#relatedWorkspacePrimary");
  const arrangeFrame = arrangeDialog.querySelector("#relatedArrangeFrame");
  const titleInput = arrangeDialog.querySelector("#relatedGroupTitle");
  const referenceForm = referenceDialog.querySelector("#referenceForm");
  const referencePickerList = referencePicker.querySelector("#referencePickerList");

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    if (dialog.open) dialog.close();
  }

  function renderGroupThumbs(group) {
    return (group.members || [])
      .map(normalizeMember)
      .slice(0, 4)
      .map((member) => {
        if (member.kind === "artwork") {
          const item = artwork(member.id);
          return item
            ? `<img src="${escapeHtml(imageOf(item))}" alt="" loading="lazy">`
            : "";
        }

        const item = reference(member.id);
        const src = referenceImage(item);
        return src
          ? `<img src="${escapeHtml(src)}" alt="" loading="lazy">`
          : `<span class="reference-no-image">Reference</span>`;
      })
      .join("");
  }

  function renderWorkspace() {
    workspace.querySelectorAll("[data-workspace-tab]").forEach((button) => {
      button.setAttribute(
        "aria-selected",
        button.dataset.workspaceTab === relation.workspaceTab ? "true" : "false"
      );
    });

    const showingGroups = relation.workspaceTab === "groups";
    groupList.hidden = !showingGroups;
    referenceList.hidden = showingGroups;

    if (showingGroups) {
      workspacePrimary.textContent = "New related group";
      workspacePrimary.dataset.action = "new-group";
      renderGroups();
    } else {
      workspacePrimary.textContent = "New reference";
      workspacePrimary.dataset.action = "new-reference";
      renderReferences();
    }
  }

  function renderGroups() {
    let groups = relation.groups;

    if (relation.workspaceFilterArtworkId) {
      groups = groupsForArtwork(relation.workspaceFilterArtworkId);
      const item = artwork(relation.workspaceFilterArtworkId);
      workspaceFilter.innerHTML = `
        Showing groups containing <strong>${escapeHtml(item ? item.title : relation.workspaceFilterArtworkId)}</strong>
        · <button type="button" id="showAllRelatedGroups">Show all</button>
      `;
    } else {
      workspaceFilter.textContent = relation.groups.length
        ? `${relation.groups.length} saved ${relation.groups.length === 1 ? "group" : "groups"}`
        : "No saved groups yet";
    }

    if (!groups.length) {
      groupList.innerHTML = `
        <div class="related-group-empty">
          ${relation.workspaceFilterArtworkId
            ? "This work is not currently in a related group."
            : "No related groups have been created yet."}
        </div>
      `;
    } else {
      groupList.innerHTML = groups.map((group) => {
        const members = (group.members || []).map(normalizeMember);
        const refs = members.filter((member) => member.kind === "reference").length;
        const descriptor = `${members.length} ${members.length === 1 ? "member" : "members"}`
          + (refs ? ` · ${refs} ${refs === 1 ? "reference" : "references"}` : "");

        return `
          <article class="related-group-card" data-group-id="${escapeHtml(group.id)}">
            <div class="related-group-thumbs">${renderGroupThumbs(group)}</div>
            <div class="related-group-copy">
              <strong>${escapeHtml(group.title || "Related works")}</strong>
              <small>${descriptor} · ${escapeHtml(group.id)}</small>
            </div>
            <div class="related-group-actions">
              <button type="button" data-edit-group="${escapeHtml(group.id)}">Edit</button>
              <button class="danger" type="button" data-delete-group="${escapeHtml(group.id)}">Dissolve</button>
            </div>
          </article>
        `;
      }).join("");
    }

    const showAll = workspace.querySelector("#showAllRelatedGroups");
    if (showAll) {
      showAll.addEventListener("click", () => {
        relation.workspaceFilterArtworkId = null;
        renderWorkspace();
      });
    }

    workspace.querySelectorAll("[data-edit-group]").forEach((button) => {
      button.addEventListener("click", () => editGroup(button.dataset.editGroup));
    });

    workspace.querySelectorAll("[data-delete-group]").forEach((button) => {
      button.addEventListener("click", () => dissolveGroup(button.dataset.deleteGroup));
    });
  }

  function renderReferences() {
    relation.workspaceFilterArtworkId = null;
    workspaceFilter.textContent = relation.references.length
      ? `${relation.references.length} saved ${relation.references.length === 1 ? "reference" : "references"}`
      : "No references yet";

    if (!relation.references.length) {
      referenceList.innerHTML = `
        <div class="related-group-empty">
          No references yet. Add source photographs, reproductions, scans or other material you worked from.
        </div>
      `;
      return;
    }

    referenceList.innerHTML = relation.references.map((item) => {
      const src = referenceImage(item);
      const uses = groupsForReference(item.id).length;

      return `
        <article class="reference-library-card">
          <div class="reference-library-preview">
            ${src
              ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.title || "")}" loading="lazy">`
              : `<div class="reference-no-image">No image uploaded</div>`}
          </div>
          <div class="reference-library-copy">
            <strong>${escapeHtml(item.title || "Untitled reference")}</strong>
            ${item.creator ? `<small>${escapeHtml(item.creator)}</small>` : ""}
            <span class="reference-visibility">${escapeHtml(referenceVisibilityLabel(item.visibility))}</span>
            <small>${uses ? `Used in ${uses} ${uses === 1 ? "group" : "groups"}` : "Not used in a group yet"}</small>
          </div>
          <div class="reference-library-actions">
            <button type="button" data-edit-reference="${escapeHtml(item.id)}">Edit</button>
            <button class="danger" type="button" data-delete-reference="${escapeHtml(item.id)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");

    referenceList.querySelectorAll("[data-edit-reference]").forEach((button) => {
      button.addEventListener("click", () => openReferenceEditor(button.dataset.editReference));
    });

    referenceList.querySelectorAll("[data-delete-reference]").forEach((button) => {
      button.addEventListener("click", () => deleteReference(button.dataset.deleteReference));
    });
  }

  async function dissolveGroup(groupId) {
    const group = relation.groups.find((item) => item.id === groupId);
    if (!group) return;

    const ok = window.confirm(
      `Dissolve “${group.title}”?\\n\\nThe artworks and references themselves will not be deleted.`
    );
    if (!ok) return;

    try {
      setStatus("Dissolving related group...", "");
      const result = await apiPost("/api/delete-related-group", {groupId});
      relation.groups = (result.related && result.related.groups) || [];
      updateRelateButton();
      decorateCards();
      renderWorkspace();
      setStatus("Related group dissolved. Members unchanged.", "good");
    } catch (error) {
      setStatus(error.message, "bad");
    }
  }

  async function deleteReference(referenceId) {
    const item = reference(referenceId);
    if (!item) return;

    const uses = groupsForReference(referenceId).length;
    const message = uses
      ? `Delete “${item.title}”?\\n\\nIt is used in ${uses} related ${uses === 1 ? "group" : "groups"} and will be removed from those groups. Artworks will not be changed.`
      : `Delete “${item.title}”?\\n\\nThis removes the local reference record and its uploaded reference image.`;

    if (!window.confirm(message)) return;

    try {
      setStatus("Deleting reference...", "");
      const result = await apiPost("/api/delete-reference", {id: referenceId});
      relation.references = result.references || [];
      relation.groups = (result.related && result.related.groups) || relation.groups;
      renderWorkspace();
      renderArrangeFrame();
      decorateCards();
      setStatus("Reference deleted.", "good");
    } catch (error) {
      setStatus(error.message, "bad");
    }
  }

  function decorateCards() {
    grid.querySelectorAll(".card").forEach((card) => {
      card.querySelectorAll(".related-membership-badge").forEach((badge) => badge.remove());

      const groups = groupsForArtwork(card.dataset.id);
      if (groups.length) {
        const badge = document.createElement("button");
        badge.type = "button";
        badge.className = "related-membership-badge";
        badge.textContent = `Related · ${groups.length}`;
        badge.title = groups.map((group) => group.title).join("\\n");

        badge.addEventListener("click", (event) => {
          if (relation.activeSelection) return;
          event.preventDefault();
          event.stopPropagation();
          relation.workspaceFilterArtworkId = card.dataset.id;
          relation.workspaceTab = "groups";
          renderWorkspace();
          openDialog(workspace);
        });

        card.appendChild(badge);
      }

      card.classList.toggle(
        "related-selected",
        relation.activeSelection && relation.selectedArtworkIds.has(card.dataset.id)
      );
    });
  }

  function renderSelection() {
    selectionBar.hidden = !relation.activeSelection;
    relateButton.setAttribute("aria-pressed", relation.activeSelection ? "true" : "false");
    document.body.classList.toggle("related-selection-active", relation.activeSelection);

    const ids = [...relation.selectedArtworkIds];
    const count = document.getElementById("relatedSelectionCount");
    const tags = document.getElementById("relatedSelectionTags");
    const arrangeButton = document.getElementById("openRelatedArrange");
    const instruction = document.getElementById("relatedSelectionInstruction");

    count.textContent = `${ids.length} ${ids.length === 1 ? "work" : "works"} selected`;
    arrangeButton.disabled = ids.length < 1;

    instruction.textContent = relation.editingGroupId
      ? "Add or remove artworks. References already in the group are preserved."
      : "Select one or more artworks. You can add references in the arrangement step.";

    tags.innerHTML = ids.map((id) => {
      const item = artwork(id);
      const title = item ? item.title : id;
      return `
        <span class="related-selection-tag">
          <span>${escapeHtml(title)}</span>
          <button type="button" data-unselect-related="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(title)}">×</button>
        </span>
      `;
    }).join("");

    tags.querySelectorAll("[data-unselect-related]").forEach((button) => {
      button.addEventListener("click", () => {
        relation.selectedArtworkIds.delete(button.dataset.unselectRelated);
        renderSelection();
      });
    });

    decorateCards();
  }

  function beginNewGroup() {
    closeDialog(workspace);
    relation.workspaceFilterArtworkId = null;
    relation.editingGroupId = null;
    relation.editingTitle = "";
    relation.arrangedMembers = [];
    relation.selectedArtworkIds = new Set();
    relation.activeSelection = true;
    renderSelection();
  }

  function editGroup(groupId) {
    const group = relation.groups.find((item) => item.id === groupId);
    if (!group) return;

    relation.editingGroupId = group.id;
    relation.editingTitle = group.title || "Related works";
    relation.arrangedMembers = (group.members || []).map(normalizeMember);
    relation.selectedArtworkIds = new Set(
      relation.arrangedMembers
        .filter((member) => member.kind === "artwork")
        .map((member) => member.id)
    );
    relation.activeSelection = false;

    closeDialog(workspace);
    renderArrangeFrame();
    titleInput.value = relation.editingTitle;
    arrangeDialog.querySelector("#relatedArrangeHeading").textContent = "Edit related group";
    openDialog(arrangeDialog);
  }

  function enterAddWorksMode() {
    relation.selectedArtworkIds = new Set(
      relation.arrangedMembers
        .filter((member) => member.kind === "artwork")
        .map((member) => member.id)
    );
    relation.activeSelection = true;
    closeDialog(arrangeDialog);
    renderSelection();
  }

  function reconcileArtworkSelectionIntoArrangement() {
    const selectedIds = [...relation.selectedArtworkIds];

    if (relation.arrangedMembers.length) {
      const kept = relation.arrangedMembers.filter((member) => {
        if (member.kind === "reference") return true;
        return relation.selectedArtworkIds.has(member.id);
      });

      const existingArtworkIds = new Set(
        kept.filter((member) => member.kind === "artwork").map((member) => member.id)
      );

      selectedIds
        .filter((id) => !existingArtworkIds.has(id))
        .forEach((id) => kept.push({kind: "artwork", id}));

      relation.arrangedMembers = kept;
    } else {
      relation.arrangedMembers = selectedIds.map((id) => ({kind: "artwork", id}));
    }
  }

  function openArrangeFromSelection() {
    if (relation.selectedArtworkIds.size < 1) {
      setStatus("Select at least one artwork. References can be added in the next step.", "bad");
      return;
    }

    reconcileArtworkSelectionIntoArrangement();
    relation.activeSelection = false;
    renderSelection();

    if (!relation.editingTitle) {
      const firstArtwork = relation.arrangedMembers
        .filter((member) => member.kind === "artwork")
        .map((member) => artwork(member.id))
        .find(Boolean);

      relation.editingTitle = firstArtwork ? firstArtwork.title : "Related works";
    }

    titleInput.value = relation.editingTitle;
    arrangeDialog.querySelector("#relatedArrangeHeading").textContent =
      relation.editingGroupId ? "Edit related group" : "Arrange the frame";

    renderArrangeFrame();
    openDialog(arrangeDialog);
  }

  function moveArranged(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= relation.arrangedMembers.length) return;

    const [member] = relation.arrangedMembers.splice(index, 1);
    relation.arrangedMembers.splice(next, 0, member);
    renderArrangeFrame();
  }

  function removeArranged(index) {
    relation.arrangedMembers.splice(index, 1);
    relation.selectedArtworkIds = new Set(
      relation.arrangedMembers
        .filter((member) => member.kind === "artwork")
        .map((member) => member.id)
    );
    renderArrangeFrame();
  }

  function reorderDragged(targetKey, before) {
    const draggedKey = relation.draggedKey;
    if (!draggedKey || draggedKey === targetKey) return;

    const members = relation.arrangedMembers.filter((member) => memberKey(member) !== draggedKey);
    let targetIndex = members.findIndex((member) => memberKey(member) === targetKey);
    if (targetIndex < 0) return;
    if (!before) targetIndex += 1;

    const dragged = relation.arrangedMembers.find((member) => memberKey(member) === draggedKey);
    if (!dragged) return;

    members.splice(targetIndex, 0, dragged);
    relation.arrangedMembers = members;
    renderArrangeFrame();
  }

  function arrangeControls(index) {
    return `
      <div class="related-arrange-controls">
        <button type="button" data-move-index="${index}" data-delta="-1" ${index === 0 ? "disabled" : ""}>←</button>
        <button type="button" data-move-index="${index}" data-delta="1" ${index === relation.arrangedMembers.length - 1 ? "disabled" : ""}>→</button>
        <button class="remove" type="button" data-remove-index="${index}" aria-label="Remove from group">×</button>
      </div>
    `;
  }

  function arrangeItemHtml(member, index) {
    if (member.kind === "artwork") {
      const item = artwork(member.id);
      if (!item) return "";

      const meta = [item.medium, item.collection].filter(Boolean).join(" · ");
      return `
        <article class="related-arrange-item" draggable="true" data-member-key="${escapeHtml(memberKey(member))}">
          <div class="related-arrange-number">${index + 1}</div>
          <div class="related-arrange-kind">Artwork</div>
          <div class="related-arrange-media">
            <img src="${escapeHtml(imageOf(item))}" alt="${escapeHtml(item.alt || item.title || "")}">
          </div>
          <div class="related-arrange-copy">
            <strong>${escapeHtml(item.title || "Untitled")}</strong>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
            ${arrangeControls(index)}
          </div>
        </article>
      `;
    }

    const item = reference(member.id);
    if (!item) return "";

    const src = referenceImage(item);
    return `
      <article class="related-arrange-item reference-member" draggable="true" data-member-key="${escapeHtml(memberKey(member))}">
        <div class="related-arrange-number">${index + 1}</div>
        <div class="related-arrange-kind">Reference</div>
        <div class="related-arrange-media">
          ${src
            ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.title || "")}">`
            : `<div class="reference-no-image">Metadata-only reference</div>`}
        </div>
        <div class="related-arrange-copy">
          <strong>${escapeHtml(item.title || "Untitled reference")}</strong>
          ${item.creator ? `<small>${escapeHtml(item.creator)}</small>` : ""}
          <small>${escapeHtml(referenceVisibilityLabel(item.visibility))}</small>
          ${arrangeControls(index)}
        </div>
      </article>
    `;
  }

  function renderArrangeFrame() {
    if (!arrangeFrame) return;

    arrangeFrame.innerHTML = relation.arrangedMembers
      .map(arrangeItemHtml)
      .join("");

    arrangeFrame.querySelectorAll("[data-move-index]").forEach((button) => {
      button.addEventListener("click", () => {
        moveArranged(Number(button.dataset.moveIndex), Number(button.dataset.delta));
      });
    });

    arrangeFrame.querySelectorAll("[data-remove-index]").forEach((button) => {
      button.addEventListener("click", () => {
        removeArranged(Number(button.dataset.removeIndex));
      });
    });

    arrangeFrame.querySelectorAll(".related-arrange-item").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        relation.draggedKey = card.dataset.memberKey;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", relation.draggedKey);
      });

      card.addEventListener("dragend", () => {
        relation.draggedKey = null;
        arrangeFrame.querySelectorAll(".dragging,.drop-before,.drop-after").forEach((node) => {
          node.classList.remove("dragging", "drop-before", "drop-after");
        });
      });

      card.addEventListener("dragover", (event) => {
        if (!relation.draggedKey || relation.draggedKey === card.dataset.memberKey) return;
        event.preventDefault();

        const rect = card.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;

        card.classList.toggle("drop-before", before);
        card.classList.toggle("drop-after", !before);
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drop-before", "drop-after");
      });

      card.addEventListener("drop", (event) => {
        if (!relation.draggedKey || relation.draggedKey === card.dataset.memberKey) return;
        event.preventDefault();

        const rect = card.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;
        reorderDragged(card.dataset.memberKey, before);
      });
    });
  }

  function sameMembership(group, members) {
    const a = (group.members || []).map(normalizeMember).map(memberKey).sort();
    const b = members.map(normalizeMember).map(memberKey).sort();
    return JSON.stringify(a) === JSON.stringify(b);
  }

  async function saveCurrentGroup() {
    if (relation.arrangedMembers.length < 2) {
      setStatus("A related group needs at least two members.", "bad");
      return;
    }

    const title = titleInput.value.trim() || "Related works";
    const members = relation.arrangedMembers.map(normalizeMember);
    let allowDuplicate = false;

    if (!relation.editingGroupId) {
      const duplicate = relation.groups.find((group) => sameMembership(group, members));
      if (duplicate) {
        allowDuplicate = window.confirm(
          `“${duplicate.title}” already contains the same members.\\n\\nCreate another separate group anyway?`
        );
        if (!allowDuplicate) return;
      }
    }

    try {
      setStatus(
        relation.editingGroupId ? "Saving related-group changes..." : "Saving related group...",
        ""
      );

      const result = await apiPost("/api/save-related-group", {
        groupId: relation.editingGroupId,
        title,
        members,
        allowDuplicate
      });

      relation.groups = (result.related && result.related.groups) || [];
      relation.editingGroupId = null;
      relation.editingTitle = "";
      relation.arrangedMembers = [];
      relation.selectedArtworkIds = new Set();
      relation.activeSelection = false;

      closeDialog(arrangeDialog);
      updateRelateButton();
      renderSelection();
      decorateCards();
      renderWorkspace();
      setStatus("Related group saved.", "good");
    } catch (error) {
      if (error.status === 409 && error.payload && error.payload.duplicateGroup) {
        const duplicate = error.payload.duplicateGroup;
        const ok = window.confirm(
          `“${duplicate.title}” already contains the same members.\\n\\nCreate another separate group anyway?`
        );

        if (ok) {
          try {
            const result = await apiPost("/api/save-related-group", {
              title,
              members,
              allowDuplicate: true
            });

            relation.groups = (result.related && result.related.groups) || [];
            relation.editingGroupId = null;
            relation.arrangedMembers = [];
            relation.selectedArtworkIds = new Set();
            relation.activeSelection = false;
            closeDialog(arrangeDialog);
            updateRelateButton();
            renderSelection();
            decorateCards();
            renderWorkspace();
            setStatus("Related group saved.", "good");
          } catch (secondError) {
            setStatus(secondError.message, "bad");
          }
        }
        return;
      }

      setStatus(error.message, "bad");
    }
  }

  function resetReferenceForm() {
    relation.editingReferenceId = null;
    referenceDialog.querySelector("#referenceDialogHeading").textContent = "New reference";
    referenceDialog.querySelector("#referenceTitle").value = "";
    referenceDialog.querySelector("#referenceCreator").value = "";
    referenceDialog.querySelector("#referenceSourceUrl").value = "";
    referenceDialog.querySelector("#referenceVisibility").value = "private";
    referenceDialog.querySelector("#referenceFile").value = "";
    referenceDialog.querySelector("#referencePrivateNote").value = "";
    referenceDialog.querySelector("#referenceFileState").textContent = "No image uploaded yet.";
  }

  function openReferenceEditor(referenceId = null) {
    resetReferenceForm();

    if (referenceId) {
      const item = reference(referenceId);
      if (!item) return;

      relation.editingReferenceId = referenceId;
      referenceDialog.querySelector("#referenceDialogHeading").textContent = "Edit reference";
      referenceDialog.querySelector("#referenceTitle").value = item.title || "";
      referenceDialog.querySelector("#referenceCreator").value = item.creator || "";
      referenceDialog.querySelector("#referenceSourceUrl").value = item.sourceUrl || "";
      referenceDialog.querySelector("#referenceVisibility").value = item.visibility || "private";
      referenceDialog.querySelector("#referencePrivateNote").value = item.privateNote || "";
      referenceDialog.querySelector("#referenceFileState").textContent = item.hasFile
        ? "An image is stored locally. Choose another file only to replace it."
        : "No image uploaded yet.";
    }

    openDialog(referenceDialog);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  async function saveReference(event) {
    event.preventDefault();

    const fileInput = referenceDialog.querySelector("#referenceFile");
    const file = fileInput.files && fileInput.files[0];
    let filePayload = null;

    if (file) {
      try {
        filePayload = {
          name: file.name,
          dataUrl: await fileToDataUrl(file)
        };
      } catch (error) {
        setStatus(error.message, "bad");
        return;
      }
    }

    const payload = {
      id: relation.editingReferenceId,
      title: referenceDialog.querySelector("#referenceTitle").value.trim(),
      creator: referenceDialog.querySelector("#referenceCreator").value.trim(),
      sourceUrl: referenceDialog.querySelector("#referenceSourceUrl").value.trim(),
      visibility: referenceDialog.querySelector("#referenceVisibility").value,
      privateNote: referenceDialog.querySelector("#referencePrivateNote").value.trim(),
      file: filePayload
    };

    try {
      setStatus("Saving reference...", "");
      const result = await apiPost("/api/save-reference", payload);
      relation.references = result.references || [];
      closeDialog(referenceDialog);
      renderWorkspace();
      renderReferencePicker();
      renderArrangeFrame();
      setStatus("Reference saved.", "good");
    } catch (error) {
      setStatus(error.message, "bad");
    }
  }

  function renderReferencePicker() {
    if (!relation.references.length) {
      referencePickerList.innerHTML = `
        <div class="related-group-empty">
          No references yet. Use “New reference” to add a source photograph or other reference.
        </div>
      `;
      return;
    }

    const alreadyAdded = new Set(
      relation.arrangedMembers
        .filter((member) => member.kind === "reference")
        .map((member) => member.id)
    );

    referencePickerList.innerHTML = relation.references.map((item) => {
      const src = referenceImage(item);
      const added = alreadyAdded.has(item.id);

      return `
        <article class="reference-picker-card">
          <div class="reference-picker-preview">
            ${src
              ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.title || "")}" loading="lazy">`
              : `<div class="reference-no-image">No image uploaded</div>`}
          </div>
          <strong>${escapeHtml(item.title || "Untitled reference")}</strong>
          ${item.creator ? `<small>${escapeHtml(item.creator)}</small>` : ""}
          <span class="reference-visibility">${escapeHtml(referenceVisibilityLabel(item.visibility))}</span>
          <div class="reference-picker-actions">
            <button type="button" data-add-reference="${escapeHtml(item.id)}" ${added ? "disabled" : ""}>
              ${added ? "Added" : "Add to group"}
            </button>
          </div>
        </article>
      `;
    }).join("");

    referencePickerList.querySelectorAll("[data-add-reference]").forEach((button) => {
      button.addEventListener("click", () => {
        relation.arrangedMembers.push({kind: "reference", id: button.dataset.addReference});
        renderReferencePicker();
      });
    });
  }

  function openReferencePicker() {
    renderReferencePicker();
    openDialog(referencePicker);
  }

  grid.addEventListener("click", (event) => {
    if (!relation.activeSelection) return;

    const card = event.target.closest(".card");
    if (!card || !grid.contains(card)) return;

    event.preventDefault();
    event.stopPropagation();

    const id = card.dataset.id;
    if (relation.selectedArtworkIds.has(id)) relation.selectedArtworkIds.delete(id);
    else relation.selectedArtworkIds.add(id);

    renderSelection();
  }, true);

  new MutationObserver(decorateCards).observe(grid, {childList: true});

  relateButton.addEventListener("click", () => {
    relation.workspaceFilterArtworkId = null;
    relation.workspaceTab = "groups";
    renderWorkspace();
    openDialog(workspace);
  });

  workspace.querySelectorAll("[data-workspace-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      relation.workspaceTab = button.dataset.workspaceTab;
      relation.workspaceFilterArtworkId = null;
      renderWorkspace();
    });
  });

  workspacePrimary.addEventListener("click", () => {
    if (workspacePrimary.dataset.action === "new-reference") {
      openReferenceEditor();
    } else {
      beginNewGroup();
    }
  });

  workspace.querySelector(".related-dialog-close").addEventListener("click", () => closeDialog(workspace));
  arrangeDialog.querySelector(".related-dialog-close").addEventListener("click", () => closeDialog(arrangeDialog));
  referenceDialog.querySelector(".related-dialog-close").addEventListener("click", () => closeDialog(referenceDialog));
  referencePicker.querySelector(".related-dialog-close").addEventListener("click", () => closeDialog(referencePicker));

  workspace.addEventListener("click", (event) => {
    if (event.target === workspace) closeDialog(workspace);
  });

  arrangeDialog.addEventListener("click", (event) => {
    if (event.target === arrangeDialog) closeDialog(arrangeDialog);
  });

  referenceDialog.addEventListener("click", (event) => {
    if (event.target === referenceDialog) closeDialog(referenceDialog);
  });

  referencePicker.addEventListener("click", (event) => {
    if (event.target === referencePicker) closeDialog(referencePicker);
  });

  document.getElementById("openRelatedArrange").addEventListener("click", openArrangeFromSelection);

  document.getElementById("clearRelatedSelection").addEventListener("click", () => {
    relation.selectedArtworkIds.clear();
    renderSelection();
  });

  document.getElementById("cancelRelatedSelection").addEventListener("click", () => {
    relation.activeSelection = false;
    relation.selectedArtworkIds.clear();
    relation.editingGroupId = null;
    relation.editingTitle = "";
    relation.arrangedMembers = [];
    renderSelection();
  });

  arrangeDialog.querySelector("#addWorksToGroup").addEventListener("click", enterAddWorksMode);
  arrangeDialog.querySelector("#addReferencesToGroup").addEventListener("click", openReferencePicker);
  arrangeDialog.querySelector("#cancelRelatedArrange").addEventListener("click", () => closeDialog(arrangeDialog));
  arrangeDialog.querySelector("#saveRelatedArrange").addEventListener("click", saveCurrentGroup);

  referenceForm.addEventListener("submit", saveReference);
  referenceDialog.querySelector("#cancelReferenceEdit").addEventListener("click", () => closeDialog(referenceDialog));

  referencePicker.querySelector("#newReferenceFromPicker").addEventListener("click", () => {
    openReferenceEditor();
  });

  referencePicker.querySelector("#doneReferencePicker").addEventListener("click", () => {
    closeDialog(referencePicker);
    renderArrangeFrame();
  });

  loadManagerState().catch((error) => setStatus(error.message, "bad"));
})();

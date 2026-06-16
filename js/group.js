// =====================================
// HEYDUDE GROUP CHAT
// js/group.js
// =====================================

// =====================================
// OPEN GROUPS VIEW (rail button)
// =====================================

document.getElementById("rail-groups-btn").addEventListener("click", () => {
  const railButtons = [
    document.getElementById("rail-chats-btn"),
    document.getElementById("rail-requests-btn"),
    document.getElementById("rail-calls-btn"),
    document.getElementById("rail-notifications-btn"),
    document.getElementById("rail-groups-btn")
  ];
  setActiveRail(document.getElementById("rail-groups-btn"), railButtons);
  openGroupsView();
  openMessagesPanelOnMobile();
});

function openGroupsView() {
  document.getElementById("request-section").classList.add("hidden");
  document.getElementById("chats-section").classList.add("hidden");
  document.getElementById("groups-section").classList.remove("hidden");
  document.getElementById("panel-title").textContent = "Groups";

  document.querySelectorAll(".panel-tab").forEach(t => t.classList.remove("active"));

  loadGroupList();
}

// Hide groups section whenever a normal panel tab is clicked
document.querySelectorAll(".panel-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.getElementById("groups-section").classList.add("hidden");
  });
});

// =====================================
// CREATE GROUP MODAL
// =====================================

let selectedMembers = {}; // { uid: userData }

document.getElementById("create-group-btn").addEventListener("click", openCreateGroupModal);
document.getElementById("group-modal-close").addEventListener("click", closeCreateGroupModal);
document.getElementById("group-modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("group-modal-overlay")) closeCreateGroupModal();
});

function openCreateGroupModal() {
  document.getElementById("group-modal-overlay").classList.remove("hidden");
  document.getElementById("group-name-input").value = "";
  document.getElementById("group-member-search").value = "";
  document.getElementById("group-member-results").innerHTML = "";
  document.getElementById("group-selected-members").innerHTML = "";
  document.getElementById("group-create-btn").disabled = true;
  selectedMembers = {};
  document.getElementById("group-name-input").focus();
}

function closeCreateGroupModal() {
  document.getElementById("group-modal-overlay").classList.add("hidden");
  selectedMembers = {};
}

// =====================================
// MEMBER SEARCH (for create group)
// =====================================

let memberSearchDebounce = null;

document.getElementById("group-member-search").addEventListener("input", () => {
  clearTimeout(memberSearchDebounce);
  const q = document.getElementById("group-member-search").value.trim().toLowerCase();
  if (q.length < 1) {
    document.getElementById("group-member-results").innerHTML = "";
    return;
  }
  memberSearchDebounce = setTimeout(() => searchFriendsForGroup(q), 250);
});

// Get list of current user's friends (from existing 1:1 chats)
async function getFriendsList() {
  const chatsSnap = await chatsRef.once("value");
  const chats = chatsSnap.val() || {};
  const friends = [];

  for (const [, chat] of Object.entries(chats)) {
    if (!chat.members || !chat.members[currentUser.uid]) continue;
    const friendId = Object.keys(chat.members).find(id => id !== currentUser.uid);
    if (!friendId) continue;

    const snap = await usersRef.child(friendId).once("value");
    const user = snap.val();
    if (user) friends.push(user);
  }

  return friends;
}

async function searchFriendsForGroup(query) {
  const resultsEl = document.getElementById("group-member-results");
  resultsEl.innerHTML = "";

  const friends = await getFriendsList();
  const matches = friends.filter(u => u.username.toLowerCase().includes(query));

  if (!matches.length) {
    resultsEl.innerHTML = `<div class="group-search-empty">No friends match "${escapeHTML(query)}"</div>`;
    return;
  }

  matches.forEach(user => {
    const isSelected = !!selectedMembers[user.uid];
    const div = document.createElement("div");
    div.className = "group-member-item" + (isSelected ? " selected" : "");
    div.id = `group-member-row-${user.uid}`;
    div.innerHTML = `
      <div class="search-avatar" style="background:${avatarColor(user.username)}">${getInitial(user.username)}</div>
      <span>${escapeHTML(user.username)}</span>
      <span class="gm-check">${isSelected ? "✓" : "+"}</span>
    `;
    div.addEventListener("click", () => toggleMemberSelection(user, div));
    resultsEl.appendChild(div);
  });
}

function toggleMemberSelection(user, itemEl) {
  if (selectedMembers[user.uid]) {
    delete selectedMembers[user.uid];
    itemEl.classList.remove("selected");
    itemEl.querySelector(".gm-check").textContent = "+";
  } else {
    selectedMembers[user.uid] = user;
    itemEl.classList.add("selected");
    itemEl.querySelector(".gm-check").textContent = "✓";
  }
  renderSelectedChips();
  updateCreateGroupBtn();
}

function renderSelectedChips() {
  const container = document.getElementById("group-selected-members");
  container.innerHTML = "";
  Object.values(selectedMembers).forEach(user => {
    const chip = document.createElement("div");
    chip.className = "member-chip";
    chip.innerHTML = `
      <div class="chip-avatar" style="background:${avatarColor(user.username)}">${getInitial(user.username)}</div>
      <span>${escapeHTML(user.username)}</span>
      <button type="button" class="chip-remove" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    chip.querySelector(".chip-remove").addEventListener("click", () => removeSelectedMember(user.uid));
    container.appendChild(chip);
  });
}

// Remove a member from the selection (e.g. via the chip's × button)
// and sync the matching search-result row if it's currently visible.
function removeSelectedMember(uid) {
  delete selectedMembers[uid];
  renderSelectedChips();
  updateCreateGroupBtn();

  const row = document.getElementById(`group-member-row-${uid}`);
  if (row) {
    row.classList.remove("selected");
    const check = row.querySelector(".gm-check");
    if (check) check.textContent = "+";
  }
}

function updateCreateGroupBtn() {
  const name = document.getElementById("group-name-input").value.trim();
  const memberCount = Object.keys(selectedMembers).length;
  document.getElementById("group-create-btn").disabled = !(name.length >= 2 && memberCount >= 1);
}

document.getElementById("group-name-input").addEventListener("input", updateCreateGroupBtn);

// =====================================
// CREATE GROUP
// =====================================

document.getElementById("group-create-btn").addEventListener("click", createGroup);

async function createGroup() {
  const name = document.getElementById("group-name-input").value.trim();
  const memberIds = Object.keys(selectedMembers);
  if (!name || memberIds.length < 1 || !currentUser) return;

  const btn = document.getElementById("group-create-btn");
  btn.disabled = true;
  btn.textContent = "Creating...";

  try {
    const groupRef = groupsRef.push();
    const groupId  = groupRef.key;
    const members  = { [currentUser.uid]: true };
    memberIds.forEach(uid => { members[uid] = true; });

    await groupRef.set({
      id:          groupId,
      name:        name,
      createdBy:   currentUser.uid,
      createdAt:   firebase.database.ServerValue.TIMESTAMP,
      members,
      memberCount: Object.keys(members).length
    });

    showToast(`Group "${name}" created!`);
    closeCreateGroupModal();
    openGroupChat(groupId, name, members);

  } catch (err) {
    console.error("Create group error:", err);
    showToast("Failed to create group");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Group";
  }
}

// =====================================
// LOAD GROUP LIST (sidebar)
// =====================================

function loadGroupList() {
  if (!currentUser) return;
  const listEl  = document.getElementById("group-list");
  const emptyEl = document.getElementById("group-list-empty");

  // Detach previous listener to avoid duplicate handlers stacking
  groupsRef.off("value");

  groupsRef.on("value", snapshot => {
    listEl.innerHTML = "";
    const groups = snapshot.val() || {};

    const myGroups = Object.values(groups).filter(g => g.members && g.members[currentUser.uid]);

    // If the currently open group chat no longer includes this user
    // (removed by an admin, or the group was deleted), close it.
    if (activeGroupId && activeChatId === `group_${activeGroupId}`) {
      const stillMember = myGroups.some(g => g.id === activeGroupId);
      if (!stillMember) {
        showToast("You're no longer in this group");
        if (typeof closeActiveChat === "function") closeActiveChat();
        if (typeof closeMobileChat === "function") closeMobileChat();
      }
    }

    if (!myGroups.length) {
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    myGroups.forEach(group => renderGroupItem(group));
  });
}

function renderGroupItem(group) {
  const listEl = document.getElementById("group-list");
  const div = document.createElement("div");
  div.className = "chat-item";
  div.id = `group-item-${group.id}`;

  const memberCount = Object.keys(group.members || {}).length;
  const initial = group.name.charAt(0).toUpperCase();
  const color = avatarColor(group.name + group.id);

  div.innerHTML = `
    <div class="chat-avatar group-chat-avatar" style="background:${color}">${initial}</div>
    <div class="chat-info">
      <h4>${escapeHTML(group.name)}</h4>
      <div class="chat-meta">
        <p id="group-preview-${group.id}" class="chat-preview">${memberCount} member${memberCount !== 1 ? "s" : ""}</p>
      </div>
    </div>
    <div class="chat-time-badge">
      <span id="group-time-${group.id}" class="chat-time"></span>
    </div>
  `;

  div.addEventListener("click", () => openGroupChat(group.id, group.name, group.members));
  listEl.appendChild(div);

  listenGroupLastMessage(group.id, memberCount);
}

function listenGroupLastMessage(groupId, memberCount) {
  messagesRef.child(`group_${groupId}`).limitToLast(1).on("value", snapshot => {
    const preview = document.getElementById(`group-preview-${groupId}`);
    const timeEl  = document.getElementById(`group-time-${groupId}`);
    if (!preview) return;

    const data = snapshot.val();
    if (!data) {
      preview.textContent = `${memberCount} member${memberCount !== 1 ? "s" : ""}`;
      return;
    }

    const last = Object.values(data)[0];
    if (!last) return;

    let text;
    if (last.type === "image")      text = "Photo";
    else if (last.type === "gif")   text = "GIF";
    else if (last.type === "video") text = "Video";
    else if (last.type === "file")  text = last.fileName || "File";
    else                             text = last.text || "";

    const isMine = last.sender === currentUser?.uid;
    const senderLabel = isMine ? "You" : (last.senderName || "Someone");
    preview.textContent = `${senderLabel}: ${text}`.slice(0, 42);

    if (timeEl && last.timestamp) timeEl.textContent = formatTime(last.timestamp);
  });
}

// =====================================
// OPEN GROUP CHAT
// =====================================

function openGroupChat(groupId, groupName, members) {
  // Deactivate previous chat items
  document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
  const groupItem = document.getElementById(`group-item-${groupId}`);
  if (groupItem) groupItem.classList.add("active");

  // Detach old listeners
  if (activeChatId) {
    messagesRef.child(activeChatId).off();
    typingRef.child(activeChatId).off();
    if (activeUserId) readReceiptsRef.child(activeChatId).child(activeUserId).off();
    Object.values(reactionListeners).forEach(off => off());
    for (const k in reactionListeners) delete reactionListeners[k];
  }

  activeChatId  = `group_${groupId}`;
  activeUserId  = null;
  activeGroupId = groupId;
  otherUserLastRead = 0;
  replyingTo    = null;
  replyPreview.classList.add("collapsed");

  if (typeof clearPendingFile === "function") clearPendingFile();

  renderedMsgIds.clear();
  lastRenderedDate = null;

  welcomeScreen.classList.add("hidden");
  chatContainer.classList.remove("hidden");

  // Header
  const memberCount = Object.keys(members || {}).length;
  document.getElementById("chat-name").textContent   = groupName;
  document.getElementById("chat-status").textContent = `${memberCount} member${memberCount !== 1 ? "s" : ""}`;
  document.getElementById("chat-status").style.color = "var(--text-light)";

  const avatarEl = document.getElementById("chat-avatar");
  avatarEl.textContent = groupName.charAt(0).toUpperCase();
  avatarEl.style.background = avatarColor(groupName + groupId);
  avatarEl.style.borderRadius = "10px";

  const dot = document.getElementById("chat-online-dot");
  if (dot) dot.style.display = "none";

  // Header buttons: show members, hide call/video
  document.getElementById("group-members-btn").classList.remove("hidden");
  document.getElementById("call-btn").classList.add("hidden");
  document.getElementById("video-btn").classList.add("hidden");

  listenMessages(activeChatId);
  listenTyping(activeChatId);

  if (window.innerWidth <= 768) {
    document.querySelector(".chat-panel").classList.add("mobile-open");
  }

  messageInput.focus();
}

// =====================================
// MEMBERS PANEL
// =====================================

document.getElementById("group-members-btn").addEventListener("click", openMembersPanel);
document.getElementById("members-panel-close").addEventListener("click", closeMembersPanel);
document.getElementById("members-panel-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("members-panel-overlay")) closeMembersPanel();
});

function openMembersPanel() {
  if (!activeGroupId) return;
  document.getElementById("members-panel-overlay").classList.remove("hidden");
  loadMembersPanel(activeGroupId);
}

function closeMembersPanel() {
  document.getElementById("members-panel-overlay").classList.add("hidden");
}

async function loadMembersPanel(groupId) {
  const snap  = await groupsRef.child(groupId).once("value");
  const group = snap.val();
  if (!group) return;

  document.getElementById("members-panel-title").textContent = group.name;
  const memberCount = Object.keys(group.members || {}).length;
  document.getElementById("members-panel-count").textContent = `${memberCount} member${memberCount !== 1 ? "s" : ""}`;

  const isAdmin = group.createdBy === currentUser.uid;
  const listEl  = document.getElementById("members-list");
  listEl.innerHTML = "";

  for (const uid of Object.keys(group.members || {})) {
    const userSnap = await usersRef.child(uid).once("value");
    const user = userSnap.val();
    if (!user) continue;

    const isCreator = uid === group.createdBy;
    const isMe = uid === currentUser.uid;

    const div = document.createElement("div");
    div.className = "member-row";

    let rightHtml = "";
    if (isCreator) {
      rightHtml = '<span class="member-badge">Admin</span>';
    } else if (isAdmin) {
      // Admin can remove any non-admin member
      rightHtml = `
        <button class="remove-member-btn" title="Remove from group" data-uid="${uid}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>`;
    }

    div.innerHTML = `
      <div class="member-avatar" style="background:${avatarColor(user.username)}">${getInitial(user.username)}</div>
      <div class="member-info">
        <strong>${escapeHTML(user.username)}${isMe ? " (You)" : ""}</strong>
        <span class="member-status ${user.online ? "online-text" : "offline-text"}">
          ${user.online ? "● Online" : "○ Offline"}
        </span>
      </div>
      ${rightHtml}
    `;

    const removeBtn = div.querySelector(".remove-member-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => removeMemberFromGroup(groupId, uid, user.username));
    }

    listEl.appendChild(div);
  }

  const addSection    = document.getElementById("add-member-section");
  const deleteSection = document.getElementById("delete-group-section");
  const leaveSection  = document.getElementById("leave-group-section");

  if (isAdmin) {
    addSection.classList.remove("hidden");
    setupAddMemberSearch(groupId, group.members || {});

    deleteSection.classList.remove("hidden");
    leaveSection.classList.add("hidden");
  } else {
    addSection.classList.add("hidden");
    deleteSection.classList.add("hidden");
    leaveSection.classList.remove("hidden");
  }
}

// =====================================
// REMOVE MEMBER FROM GROUP (admin only)
// =====================================

async function removeMemberFromGroup(groupId, uid, username) {
  showConfirmDialog({
    title: "Remove member?",
    message: `Remove <strong>${escapeHTML(username)}</strong> from this group?`,
    confirmLabel: "Remove",
    danger: true,
    onConfirm: async () => {
      try {
        await groupsRef.child(groupId).child("members").child(uid).remove();

        const snap = await groupsRef.child(groupId).once("value");
        const group = snap.val();
        const newCount = group && group.members ? Object.keys(group.members).length : 0;
        await groupsRef.child(groupId).update({ memberCount: newCount });

        showToast(`${username} removed from group`);
        loadMembersPanel(groupId);
      } catch (err) {
        console.error("Remove member error:", err);
        showToast("Failed to remove member");
      }
    }
  });
}

// =====================================
// DELETE GROUP (admin/creator only)
// =====================================

document.getElementById("delete-group-btn").addEventListener("click", () => {
  if (!activeGroupId) return;

  showConfirmDialog({
    title: "Delete group?",
    message: "This will permanently delete the group and all its messages for everyone. This can't be undone.",
    confirmLabel: "Delete",
    danger: true,
    onConfirm: async () => {
      const groupId = activeGroupId;
      try {
        await Promise.all([
          groupsRef.child(groupId).remove(),
          messagesRef.child(`group_${groupId}`).remove()
        ]);

        showToast("Group deleted");
        closeMembersPanel();

        const item = document.getElementById(`group-item-${groupId}`);
        if (item) item.remove();

        if (activeChatId === `group_${groupId}`) {
          if (typeof closeActiveChat === "function") closeActiveChat();
          if (typeof closeMobileChat === "function") closeMobileChat();
        }
      } catch (err) {
        console.error("Delete group error:", err);
        showToast("Failed to delete group");
      }
    }
  });
});

// =====================================
// LEAVE GROUP (non-admin members)
// =====================================

document.getElementById("leave-group-btn").addEventListener("click", () => {
  if (!activeGroupId) return;
  const groupId = activeGroupId;

  showConfirmDialog({
    title: "Leave group?",
    message: "You won't be able to see messages in this group unless someone adds you back.",
    confirmLabel: "Leave",
    danger: true,
    onConfirm: async () => {
      try {
        await groupsRef.child(groupId).child("members").child(currentUser.uid).remove();

        const snap = await groupsRef.child(groupId).once("value");
        const group = snap.val();
        if (group) {
          const newCount = group.members ? Object.keys(group.members).length : 0;
          await groupsRef.child(groupId).update({ memberCount: newCount });
        }

        showToast("You left the group");
        closeMembersPanel();

        const item = document.getElementById(`group-item-${groupId}`);
        if (item) item.remove();

        if (activeChatId === `group_${groupId}`) {
          if (typeof closeActiveChat === "function") closeActiveChat();
          if (typeof closeMobileChat === "function") closeMobileChat();
        }
      } catch (err) {
        console.error("Leave group error:", err);
        showToast("Failed to leave group");
      }
    }
  });
});

// =====================================
// ADD MEMBER TO EXISTING GROUP
// =====================================

function setupAddMemberSearch(groupId, existingMembers) {
  const input   = document.getElementById("add-member-input");
  const results = document.getElementById("add-member-results");
  input.value = "";
  results.innerHTML = "";

  let debounce = null;
  input.oninput = () => {
    clearTimeout(debounce);
    const q = input.value.trim().toLowerCase();
    results.innerHTML = "";
    if (q.length < 1) return;

    debounce = setTimeout(async () => {
      const friends = await getFriendsList();
      const matches = friends.filter(u => !existingMembers[u.uid] && u.username.toLowerCase().includes(q));

      if (!matches.length) {
        results.innerHTML = `<div class="group-search-empty">No friends found</div>`;
        return;
      }

      matches.forEach(user => {
        const div = document.createElement("div");
        div.className = "group-member-item";
        div.innerHTML = `
          <div class="search-avatar" style="background:${avatarColor(user.username)}">${getInitial(user.username)}</div>
          <span>${escapeHTML(user.username)}</span>
          <button class="add-btn">Add</button>
        `;
        div.querySelector(".add-btn").addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const btn = e.target;
          btn.disabled = true;
          btn.textContent = "Adding…";
          try {
            await groupsRef.child(groupId).child("members").child(user.uid).set(true);
            const newCount = Object.keys(existingMembers).length + 1;
            await groupsRef.child(groupId).update({ memberCount: newCount });
            existingMembers[user.uid] = true;
            showToast(`${user.username} added to group`);
            loadMembersPanel(groupId);
          } catch (err) {
            console.error("Add member error:", err);
            showToast("Failed to add member");
            btn.disabled = false;
            btn.textContent = "Add";
          }
        });
        results.appendChild(div);
      });
    }, 250);
  };
}

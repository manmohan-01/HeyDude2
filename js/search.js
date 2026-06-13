// =====================================
// HEYDUDE USER SEARCH & FRIEND REQUESTS
// js/search.js
// =====================================

const searchInput   = document.getElementById("user-search");
const searchResults = document.getElementById("search-results");
const requestList   = document.getElementById("request-list");
const searchClear   = document.getElementById("search-clear");

let searchDebounce = null;

// ======================
// SEARCH INPUT EVENTS
// ======================

searchInput.addEventListener("input", () => {
  const val = searchInput.value.trim();
  searchClear.classList.toggle("hidden", val.length === 0);
  clearTimeout(searchDebounce);
  if (!val) { searchResults.innerHTML = ""; return; }
  searchDebounce = setTimeout(performSearch, 300);
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchResults.innerHTML = "";
  searchClear.classList.add("hidden");
  searchInput.focus();
});

// ======================
// PERFORM SEARCH
// ======================

async function performSearch() {
  const query = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!query || query.length < 2) return;

  try {
    const snapshot = await usersRef
      .orderByChild("username")
      .startAt(query)
      .endAt(query + "\uf8ff")
      .limitToFirst(10)
      .once("value");

    const users = snapshot.val();
    if (!users) {
      searchResults.innerHTML = `<div class="search-empty">No users found for "<b>${escapeHTML(query)}</b>"</div>`;
      return;
    }

    let found = 0;
    for (const user of Object.values(users)) {
      if (!currentUser || user.uid === currentUser.uid) continue;
      renderSearchUser(user);
      found++;
    }

    if (found === 0) {
      searchResults.innerHTML = `<div class="search-empty">No users found</div>`;
    }

  } catch (error) {
    console.error("Search error:", error);
  }
}

// ======================
// RENDER SEARCH RESULT
// ======================

function renderSearchUser(user) {
  const div = document.createElement("div");
  div.className = "search-user";

  div.innerHTML = `
    <div class="search-user-inner">
      <div class="search-user-left">
        <div class="search-avatar" style="background:${avatarColor(user.username)}">
          ${getInitial(user.username)}
        </div>
        <div>
          <strong>${escapeHTML(user.username)}</strong><br>
          <small class="${user.online ? "online-text" : "offline-text"}">
            ${user.online ? "● Online" : "○ Offline"}
          </small>
        </div>
      </div>
      <button class="add-btn" onclick="sendFriendRequest('${user.uid}', this)">Add</button>
    </div>
  `;

  searchResults.appendChild(div);
}

// ======================
// SEND FRIEND REQUEST
// ======================

async function sendFriendRequest(targetUid, btn) {
  if (!currentUser) return;

  btn.disabled    = true;
  btn.textContent = "Sent";

  try {
    const alreadyFriends = await areFriends(currentUser.uid, targetUid);
    if (alreadyFriends) { showToast("Already friends!"); return; }

    const existingSnap = await requestsRef
      .orderByChild("from")
      .equalTo(currentUser.uid)
      .once("value");

    const existing = existingSnap.val();
    if (existing) {
      const duplicate = Object.values(existing).find(
        r => r.to === targetUid && r.status === "pending"
      );
      if (duplicate) { showToast("Request already sent"); return; }
    }

    const requestId = requestsRef.push().key;
    await requestsRef.child(requestId).set({
      id:        requestId,
      from:      currentUser.uid,
      to:        targetUid,
      status:    "pending",
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    showToast("Friend request sent!");

  } catch (error) {
    console.error("Send request error:", error);
    showToast("Failed to send request");
    btn.disabled    = false;
    btn.textContent = "Add";
  }
}

// ======================
// LISTEN FRIEND REQUESTS
// ======================

function listenFriendRequests() {
  if (!currentUser) return;

  requestsRef.on("value", snapshot => {
    requestList.innerHTML = "";
    const requests = snapshot.val();
    const badge    = document.getElementById("req-badge");

    if (!requests) {
      badge.classList.add("hidden");
      return;
    }

    const pending = Object.values(requests).filter(
      r => r.to === currentUser.uid && r.status === "pending"
    );

    if (pending.length === 0) {
      badge.classList.add("hidden");
    } else {
      badge.textContent = pending.length;
      badge.classList.remove("hidden");
    }

    pending.forEach(renderRequest);
  });
}

// ======================
// RENDER REQUEST
// ======================

async function renderRequest(request) {
  const senderSnap = await usersRef.child(request.from).once("value");
  const sender     = senderSnap.val();
  if (!sender) return;

  const div = document.createElement("div");
  div.className = "search-user";
  div.id        = `req-${request.id}`;

  div.innerHTML = `
    <div class="search-user-inner">
      <div class="search-user-left">
        <div class="search-avatar" style="background:${avatarColor(sender.username)}">
          ${getInitial(sender.username)}
        </div>
        <div>
          <strong>${escapeHTML(sender.username)}</strong><br>
          <small style="color:var(--text-light)">wants to chat</small>
        </div>
      </div>
      <div class="req-actions">
        <button class="accept-btn" onclick="acceptRequest('${request.id}')" title="Accept"><svg><use href="#icon-check"/></svg></button>
        <button class="reject-btn" onclick="rejectRequest('${request.id}')" title="Decline"><svg><use href="#icon-close"/></svg></button>
      </div>
    </div>
  `;

  requestList.appendChild(div);
}

// ======================
// ACCEPT REQUEST
// ======================

async function acceptRequest(requestId) {
  try {
    const requestSnap = await requestsRef.child(requestId).once("value");
    const request     = requestSnap.val();
    if (!request) return;

    const chatId = generateChatId(request.from, request.to);

    await Promise.all([
      requestsRef.child(requestId).update({ status: "accepted" }),
      chatsRef.child(chatId).set({
        chatId,
        members: {
          [request.from]: true,
          [request.to]:   true
        },
        createdAt: firebase.database.ServerValue.TIMESTAMP
      })
    ]);

    showToast("Friend added!");
    if (typeof loadChats === "function") loadChats();

  } catch (error) {
    console.error("Accept error:", error);
    showToast("Something went wrong");
  }
}

// ======================
// REJECT REQUEST
// ======================

async function rejectRequest(requestId) {
  try {
    await requestsRef.child(requestId).remove();
    showToast("Request declined");
  } catch (error) {
    console.error("Reject error:", error);
  }
}

// ======================
// CHECK FRIENDSHIP
// ======================

async function areFriends(uid1, uid2) {
  const chatId   = generateChatId(uid1, uid2);
  const snapshot = await chatsRef.child(chatId).once("value");
  return snapshot.exists();
}

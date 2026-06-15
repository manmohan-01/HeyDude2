// =====================================
// HEYDUDE REAL-TIME CHAT — v2 (smooth)
// js/chat.js
// =====================================

let activeChatId  = null;
let activeUserId  = null;
let activeGroupId = null;
let typingTimeout = null;
let replyingTo    = null;
let contextTarget = null;

// Track rendered message IDs so we never re-render an existing message
const renderedMsgIds = new Set();
// Track reaction listeners so we can detach them on chat switch
const reactionListeners = {};

const chatList           = document.getElementById("chat-list");
const messagesContainer  = document.getElementById("messages");
const welcomeScreen      = document.getElementById("welcome-screen");
const chatContainer      = document.getElementById("chat-container");
const messageInput       = document.getElementById("message-text");
const sendBtn            = document.getElementById("send-btn");
const typingIndicator    = document.getElementById("typing-indicator");
const replyPreview       = document.getElementById("reply-preview");
const replyText          = document.getElementById("reply-text");
const replyCancel        = document.getElementById("reply-cancel");
const contextMenu        = document.getElementById("context-menu");
const reactionPopup      = document.getElementById("reaction-popup");

// =====================================
// LOAD CHATS  (sidebar list)
// =====================================

function loadChats() {
  if (!currentUser) return;

  chatsRef.on("value", async snapshot => {
    const chats = snapshot.val();
    if (!chats) {
      chatList.innerHTML = "";
      if (typeof updateChatListEmptyState === "function") updateChatListEmptyState();
      return;
    }

    // Build set of current chat IDs
    const currentIds = new Set();

    for (const [chatId, chat] of Object.entries(chats)) {
      if (!chat.members || !chat.members[currentUser.uid]) continue;
      const friendId = Object.keys(chat.members).find(id => id !== currentUser.uid);
      if (!friendId) continue;
      currentIds.add(chatId);

      // Only fetch + render if not already in the list
      if (!document.getElementById(`chat-item-${chatId}`)) {
        const snap   = await usersRef.child(friendId).once("value");
        const friend = snap.val();
        if (friend) renderChatItem(chatId, friend);
      }
    }

    // Remove stale chat items
    chatList.querySelectorAll(".chat-item").forEach(el => {
      const id = el.id.replace("chat-item-", "");
      if (!currentIds.has(id)) el.remove();
    });

    if (typeof updateChatListEmptyState === "function") updateChatListEmptyState();
  });
}

// =====================================
// CHAT LIST ITEM
// =====================================

function renderChatItem(chatId, friend) {
  const div      = document.createElement("div");
  div.className  = "chat-item";
  div.id         = `chat-item-${chatId}`;
  div.dataset.chatId   = chatId;
  div.dataset.friendUid = friend.uid;
  div.dataset.friendName = friend.username;
  div.onclick    = () => openChat(chatId, friend);

  div.innerHTML = `
    <div class="chat-avatar" style="background:${avatarColor(friend.username)}">
      ${getInitial(friend.username)}
    </div>
    <div class="chat-info">
      <h4>${escapeHTML(friend.username)}</h4>
      <div class="chat-meta">
        <p id="preview-${chatId}" class="chat-preview">Start chatting…</p>
      </div>
    </div>
    <div class="chat-time-badge">
      <span id="time-${chatId}" class="chat-time"></span>
      <div class="online-dot" id="dot-${friend.uid}" style="opacity:${friend.online ? 1 : 0.25}"></div>
    </div>
    <button class="chat-item-menu-btn" title="More options" aria-label="More options">
      <svg><use href="#icon-more-vertical"/></svg>
    </button>
  `;

  // Kebab button — open context menu without triggering openChat
  const menuBtn = div.querySelector(".chat-item-menu-btn");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showChatContextMenu(e.clientX, e.clientY, chatId, friend);
  });

  // Right-click anywhere on the row
  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showChatContextMenu(e.clientX, e.clientY, chatId, friend);
  });

  // Long-press for touch devices
  let chatPressTimer;
  let chatLongPressFired = false;
  div.addEventListener("touchstart", (e) => {
    chatLongPressFired = false;
    chatPressTimer = setTimeout(() => {
      chatLongPressFired = true;
      const t = e.touches[0];
      showChatContextMenu(t.clientX, t.clientY, chatId, friend);
    }, 550);
  }, { passive: true });
  div.addEventListener("touchend", (e) => {
    clearTimeout(chatPressTimer);
    if (chatLongPressFired) {
      e.preventDefault();
      const swallowClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", swallowClick, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", swallowClick, { capture: true }), 0);
      chatLongPressFired = false;
    }
  });
  div.addEventListener("touchmove", () => { clearTimeout(chatPressTimer); chatLongPressFired = false; });

  chatList.appendChild(div);
  listenLastMessage(chatId);

  // Keep online dot live
  usersRef.child(friend.uid).on("value", snap => {
    const u   = snap.val();
    const dot = document.getElementById(`dot-${friend.uid}`);
    if (dot && u) dot.style.opacity = u.online ? "1" : "0.25";
  });
}

// =====================================
// CHAT ITEM CONTEXT MENU (delete friend / chat)
// =====================================

let chatContextTarget = null; // { chatId, friend }

function showChatContextMenu(x, y, chatId, friend) {
  chatContextTarget = { chatId, friend };

  const menu = document.getElementById("chat-context-menu");
  const menuW = 190, menuH = 100;
  menu.style.left = `${Math.min(x, window.innerWidth  - menuW - 8)}px`;
  menu.style.top  = `${Math.min(y, window.innerHeight - menuH - 8)}px`;
  menu.classList.remove("hidden");
}

function hideChatContextMenu() {
  document.getElementById("chat-context-menu").classList.add("hidden");
  chatContextTarget = null;
}

document.addEventListener("click", (e) => {
  const menu = document.getElementById("chat-context-menu");
  if (!menu.contains(e.target)) hideChatContextMenu();
});

document.getElementById("chat-context-menu").addEventListener("click", async (e) => {
  const action = e.target.closest("button")?.dataset.action;
  if (!action || !chatContextTarget) return;

  if (action === "delete-friend") {
    confirmDeleteFriend(chatContextTarget.chatId, chatContextTarget.friend);
  }

  hideChatContextMenu();
});

// =====================================
// DELETE FRIEND / CHAT
// =====================================

function confirmDeleteFriend(chatId, friend) {
  showConfirmDialog({
    title: "Remove friend?",
    message: `This will remove ${escapeHTML(friend.username)} from your friend list and delete your conversation. This can't be undone.`,
    confirmLabel: "Remove",
    danger: true,
    onConfirm: () => deleteFriendChat(chatId, friend)
  });
}

async function deleteFriendChat(chatId, friend) {
  if (!currentUser) return;

  try {
    // If this chat is currently open, close it first
    if (activeChatId === chatId) {
      closeActiveChat();
    }

    // Remove all data associated with this chat
    await Promise.all([
      chatsRef.child(chatId).remove(),
      messagesRef.child(chatId).remove(),
      typingRef.child(chatId).remove()
    ]);

    // Clean up any friend requests between these two users (either direction)
    const reqSnap = await requestsRef.once("value");
    const requests = reqSnap.val();
    if (requests) {
      const toRemove = Object.entries(requests).filter(([, r]) =>
        (r.from === currentUser.uid && r.to === friend.uid) ||
        (r.from === friend.uid && r.to === currentUser.uid)
      );
      await Promise.all(toRemove.map(([id]) => requestsRef.child(id).remove()));
    }

    // Remove the chat item from the UI immediately (loadChats listener
    // will also reconcile, but this feels instant)
    const item = document.getElementById(`chat-item-${chatId}`);
    if (item) {
      item.style.transition = "opacity 0.18s, transform 0.18s";
      item.style.opacity = "0";
      item.style.transform = "translateX(-12px)";
      setTimeout(() => {
        item.remove();
        if (typeof updateChatListEmptyState === "function") updateChatListEmptyState();
      }, 180);
    }

    showToast(`Removed ${friend.username}`);
  } catch (err) {
    console.error("Delete friend error:", err);
    showToast("Couldn't remove friend — try again");
  }
}

// =====================================
// CLOSE ACTIVE CHAT (when it's deleted while open)
// =====================================

function closeActiveChat() {
  if (activeChatId) {
    messagesRef.child(activeChatId).off();
    typingRef.child(activeChatId).off();
    Object.values(reactionListeners).forEach(off => off());
    for (const k in reactionListeners) delete reactionListeners[k];
  }

  activeChatId  = null;
  activeUserId  = null;
  activeGroupId = null;
  renderedMsgIds.clear();
  lastRenderedDate = null;

  welcomeScreen.classList.remove("hidden");
  chatContainer.classList.add("hidden");

  if (window.innerWidth <= 768) {
    document.querySelector(".chat-panel").classList.remove("mobile-open");
  }
}

// =====================================
// LAST MESSAGE PREVIEW
// =====================================

function listenLastMessage(chatId) {
  messagesRef.child(chatId).limitToLast(1).on("value", snapshot => {
    const preview = document.getElementById(`preview-${chatId}`);
    const timeEl  = document.getElementById(`time-${chatId}`);
    if (!preview) return;

    const data = snapshot.val();
    if (!data) { preview.textContent = "Start chatting…"; return; }

    const last   = Object.values(data)[0];
    const isMine = last.sender === currentUser?.uid;
    const prefix = isMine ? "You: " : "";

    if      (last.type === "image") preview.textContent = prefix + "Photo";
    else if (last.type === "video") preview.textContent = prefix + "Video";
    else if (last.type === "file")  preview.textContent = prefix + (last.fileName || "File");
    else if (last.type === "gif")   preview.textContent = prefix + "GIF";
    else                            preview.textContent = prefix + (last.text || "");

    if (timeEl && last.timestamp) timeEl.textContent = formatTime(last.timestamp);
  });
}

// =====================================
// OPEN CHAT
// =====================================

function openChat(chatId, friend) {
  // Deactivate previous
  document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
  const item = document.getElementById(`chat-item-${chatId}`);
  if (item) item.classList.add("active");

  // Detach old listeners
  if (activeChatId) {
    messagesRef.child(activeChatId).off();
    typingRef.child(activeChatId).off();
    // Detach old reaction listeners
    Object.values(reactionListeners).forEach(off => off());
    for (const k in reactionListeners) delete reactionListeners[k];
  }

  activeChatId = chatId;
  activeUserId = friend.uid;
  replyingTo   = null;
  replyPreview.classList.add("collapsed");

  // Clear any pending attachment from previous chat
  if (typeof clearPendingFile === "function") clearPendingFile();

  // Clear rendered tracking
  renderedMsgIds.clear();

  welcomeScreen.classList.add("hidden");
  chatContainer.classList.remove("hidden");

  document.getElementById("chat-name").textContent        = friend.username;
  document.getElementById("chat-avatar").textContent      = getInitial(friend.username);
  document.getElementById("chat-avatar").style.background = avatarColor(friend.username);
  document.getElementById("chat-avatar").style.borderRadius = "";

  // Reset group-specific header state
  activeGroupId = null;
  document.getElementById("group-members-btn").classList.add("hidden");
  document.getElementById("call-btn").classList.remove("hidden");
  document.getElementById("video-btn").classList.remove("hidden");
  const dot = document.getElementById("chat-online-dot");
  if (dot) dot.style.display = "";

  updateUserStatus(friend.uid);
  listenMessages(chatId);
  listenTyping(chatId);

  if (window.innerWidth <= 768) {
    document.querySelector(".chat-panel").classList.add("mobile-open");
  }

  messageInput.focus();
}

// =====================================
// USER STATUS
// =====================================

function updateUserStatus(uid) {
  usersRef.child(uid).on("value", snapshot => {
    const user   = snapshot.val();
    const status = document.getElementById("chat-status");
    const dot    = document.getElementById("chat-online-dot");
    if (!user || !status) return;

    if (user.online) {
      status.textContent = "Online";
      status.style.color = "var(--green)";
      if (dot) { dot.style.background = "var(--green)"; dot.style.boxShadow = "0 0 6px var(--green)"; }
    } else {
      status.textContent = formatLastSeen(user.lastSeen);
      status.style.color = "var(--text-light)";
      if (dot) { dot.style.background = "var(--text-muted)"; dot.style.boxShadow = "none"; }
    }
  });
}

// =====================================
// LISTEN MESSAGES  ← KEY FIX: use child_added, never wipe DOM
// =====================================

function listenMessages(chatId) {
  // Wipe container only once on open
  messagesContainer.innerHTML = "";

  // child_added fires once per existing message, then once per new message.
  // We never clear the DOM again — only append new nodes.
  messagesRef.child(chatId).orderByChild("timestamp").on("child_added", snapshot => {
    const message = snapshot.val();
    if (!message || !message.id) return;
    if (renderedMsgIds.has(message.id)) return; // already painted

    renderedMsgIds.add(message.id);

    // Insert date separator if needed
    maybeInsertDateSeparator(message.timestamp);

    // Render the message node
    const wrap = buildMessageNode(message);
    messagesContainer.appendChild(wrap);

    // Smooth scroll — only scroll to bottom when near bottom already
    // or when this is OUR own message
    const mine   = message.sender === currentUser.uid;
    const isNear = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 120;
    if (mine || isNear) {
      requestAnimationFrame(() => {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: "smooth" });
      });
    }
  });
}

// =====================================
// DATE SEPARATOR
// =====================================

let lastRenderedDate = null;

function maybeInsertDateSeparator(timestamp) {
  const d = formatDate(timestamp);
  if (d === lastRenderedDate) return;
  lastRenderedDate = d;

  const sep       = document.createElement("div");
  sep.className   = "date-separator";
  sep.textContent = d;
  messagesContainer.appendChild(sep);
}

// =====================================
// BUILD MESSAGE NODE
// =====================================

function buildMessageNode(message) {
  const mine = message.sender === currentUser.uid;
  const wrap = document.createElement("div");

  // Use will-change + translateZ to promote to GPU layer for smooth animation
  wrap.className = `message-wrap ${mine ? "sent" : "received"}`;
  wrap.id        = `msg-wrap-${message.id}`;
  wrap.style.willChange = "transform, opacity";

  // Sender name (group chats only, received messages)
  if (!mine && message.senderName && activeChatId?.startsWith("group_")) {
    const nameEl = document.createElement("div");
    nameEl.className = "group-sender-name";
    nameEl.textContent = message.senderName;
    nameEl.style.color = avatarColor(message.senderName);
    wrap.appendChild(nameEl);
  }

  // Reply context
  if (message.replyTo) {
    const rc       = document.createElement("div");
    rc.className   = "reply-context";
    rc.textContent = message.replyToText || "Original message";
    rc.onclick     = () => scrollToMessage(message.replyTo);
    wrap.appendChild(rc);
  }

  // Bubble
  const bubble    = document.createElement("div");
  bubble.className = "message";
  bubble.id        = `msg-${message.id}`;
  if (message.type === "image" || message.type === "gif") {
    bubble.classList.add("has-media");
  }

  if (message.type === "image") {
    const img     = document.createElement("img");
    img.className = "msg-image";
    img.loading   = "lazy";
    img.alt       = "Image";
    img.decoding  = "async";
    img.src       = message.url;
    img.onclick   = (e) => { e.stopPropagation(); openLightbox(message.url); };
    bubble.appendChild(img);

  } else if (message.type === "video") {
    const vid     = document.createElement("video");
    vid.src       = message.url;
    vid.controls  = true;
    vid.className = "msg-video";
    vid.preload   = "metadata";
    bubble.appendChild(vid);

  } else if (message.type === "file") {
    const a       = document.createElement("a");
    a.href        = message.url;
    a.target      = "_blank";
    a.className   = "msg-file";
    a.download    = message.fileName || "file";
    const iconId  = getFileIcon(message.mimeType, message.fileName || "");
    a.innerHTML   = `
      <span class="msg-file-icon"><svg><use href="#${iconId}"/></svg></span>
      <div class="msg-file-info">
        <div class="msg-file-name">${escapeHTML(message.fileName || "File")}</div>
        <div class="msg-file-size">${formatFileSize(message.fileSize)}</div>
      </div>`;
    bubble.appendChild(a);

  } else if (message.type === "gif") {
    const img     = document.createElement("img");
    img.src       = message.url;
    img.className = "msg-gif";
    img.alt       = "GIF";
    img.loading   = "lazy";
    img.onclick   = (e) => { e.stopPropagation(); openLightbox(message.url); };
    bubble.appendChild(img);

  } else {
    const textDiv     = document.createElement("div");
    textDiv.innerHTML = linkify(escapeHTML(message.text || ""));
    bubble.appendChild(textDiv);
  }

  // Timestamp + tick
  const time     = document.createElement("small");
  time.className = "msg-time";
  time.innerHTML = `${formatTime(message.timestamp)}${mine ? ' <span class="msg-tick read"><svg><use href="#icon-check-double"/></svg></span>' : ""}`;
  bubble.appendChild(time);

  // Context menu
  bubble.addEventListener("contextmenu", (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, message); });
  let pressTimer;
  let longPressFired = false;
  bubble.addEventListener("touchstart", (e) => {
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      showContextMenu(e.touches[0].clientX, e.touches[0].clientY, message);
    }, 600);
  }, { passive: true });
  bubble.addEventListener("touchend", (e) => {
    clearTimeout(pressTimer);
    if (longPressFired) {
      // Swallow the synthetic click that follows this touch so it
      // doesn't immediately close the menu we just opened.
      e.preventDefault();
      const swallowClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", swallowClick, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", swallowClick, { capture: true }), 0);
      longPressFired = false;
    }
  });
  bubble.addEventListener("touchmove",  () => { clearTimeout(pressTimer); longPressFired = false; });

  wrap.appendChild(bubble);

  // Reactions (live)
  attachReactionListener(message.id, wrap);

  return wrap;
}

// =====================================
// LINK DETECTION
// =====================================

function linkify(text) {
  return text.replace(/((https?:\/\/)[^\s<>"{}|\\^`[\]]+)/g,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;">${url}</a>`);
}

// =====================================
// SCROLL TO MESSAGE
// =====================================

function scrollToMessage(msgId) {
  const el = document.getElementById(`msg-${msgId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("msg-highlight");
  setTimeout(() => el.classList.remove("msg-highlight"), 1600);
}

// =====================================
// REACTIONS
// =====================================

function attachReactionListener(messageId, wrapEl) {
  const ref = reactionsRef.child(messageId);

  const handler = ref.on("value", snapshot => {
    let reactionDiv = wrapEl.querySelector(".msg-reactions");
    if (reactionDiv) reactionDiv.remove();

    const data = snapshot.val();
    if (!data) return;

    const tally = {};
    Object.values(data).forEach(r => { tally[r.emoji] = (tally[r.emoji] || 0) + 1; });
    if (!Object.keys(tally).length) return;

    reactionDiv = document.createElement("div");
    reactionDiv.className = "msg-reactions";

    Object.entries(tally).forEach(([emoji, count]) => {
      const btn   = document.createElement("button");
      btn.className = "msg-reaction";
      btn.innerHTML = `${emoji}<span>${count > 1 ? count : ""}</span>`;
      btn.onclick   = (e) => { e.stopPropagation(); toggleReaction(messageId, emoji); };
      reactionDiv.appendChild(btn);
    });

    wrapEl.appendChild(reactionDiv);
  });

  // Store detach fn
  reactionListeners[messageId] = () => ref.off("value", handler);
}

async function toggleReaction(messageId, emoji) {
  if (!currentUser) return;
  const ref  = reactionsRef.child(messageId).child(currentUser.uid);
  const snap = await ref.once("value");
  const cur  = snap.val();
  if (cur && cur.emoji === emoji) await ref.remove();
  else await ref.set({ emoji, uid: currentUser.uid });
}

// =====================================
// CONTEXT MENU
// =====================================

function showContextMenu(x, y, message) {
  contextTarget = message;

  // Keep menu on screen
  const menuW = 170, menuH = 160;
  contextMenu.style.left = `${Math.min(x, window.innerWidth  - menuW - 8)}px`;
  contextMenu.style.top  = `${Math.min(y, window.innerHeight - menuH - 8)}px`;
  contextMenu.classList.remove("hidden");

  contextMenu.querySelector('[data-action="delete"]').style.display =
    message.sender === currentUser.uid ? "block" : "none";
}

function hideContextMenu() { contextMenu.classList.add("hidden"); contextTarget = null; }

document.addEventListener("click", (e) => {
  if (!contextMenu.contains(e.target))   hideContextMenu();
  if (!reactionPopup.contains(e.target) && !e.target.closest('[data-action="react"]')) {
    reactionPopup.classList.add("hidden");
    document.getElementById("reaction-full-picker")?.classList.add("hidden");
  }
});

contextMenu.addEventListener("click", async (e) => {
  const action = e.target.closest("button")?.dataset.action;
  if (!action || !contextTarget) return;

  if (action === "reply") {
    setReply(contextTarget);
  } else if (action === "copy") {
    const txt = contextTarget.text || "";
    navigator.clipboard?.writeText(txt).then(() => showToast("Copied!"));
  } else if (action === "react") {
    showReactionPopup(contextTarget.id);
  } else if (action === "delete") {
    await deleteMessage(contextTarget);
  }

  hideContextMenu();
});

reactionPopup.addEventListener("click", async (e) => {
  const btn   = e.target.closest(".reaction-btn");
  if (!btn) return;
  const emoji = btn.dataset.emoji;
  const msgId = reactionPopup.dataset.msgId;
  if (emoji && msgId) {
    await toggleReaction(msgId, emoji);
    addRecentReaction(emoji);
  }
  reactionPopup.classList.add("hidden");
  document.getElementById("reaction-full-picker").classList.add("hidden");
});

// =====================================
// REACTION POPUP — smart positioning + full picker
// =====================================

const REACTION_EMOJI_DATA = {
  smileys: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤔","😐","😑","😶","😏","😒","🙄","😬","😌","😔","😪","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","💩","🤡"],
  people:  ["👋","🤚","🖐️","✋","🖖","👌","✌️","🤞","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🤝","🙏","💪","🫀","🧠","👀","👅","👶","🧒","👦","👧","🧑","👱","👨","👩","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🙇","🤦","🤷","🧙","🧝","🧜","🧚","👼","🎅","🦸","🦹"],
  nature:  ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🐢","🐍","🦎","🐙","🦈","🐬","🐳","🦒","🐘","🦛","🦏","🌸","🌺","🌻","🌹","🌷","🌼","🌿","🍀","🌴","🌲","🌋","🌍","🌈","⭐","🌟","⚡","🔥","💧","🌊"],
  food:    ["🍎","🍊","🍋","🍇","🍓","🫐","🍑","🍒","🥭","🍍","🥥","🥝","🍅","🥑","🌽","🍠","🥐","🍞","🧀","🥚","🍳","🥞","🥓","🍔","🍟","🍕","🌮","🌯","🥗","🍝","🍜","🍲","🍛","🍣","🍱","🍤","🍙","🍚","🧁","🍰","🎂","🍭","🍬","🍫","🍿","🍩","🍪","☕","🍵","🧃","🥤","🧋","🍺","🍻","🥂","🍷","🍸","🥃"],
  objects: ["⌚","📱","💻","⌨️","🖥️","📷","📺","📻","💡","🔦","🕯️","💸","💳","💎","🔧","🔨","🔑","🔐","🔒","🎁","🎀","🎊","🎉","🎈","🎭","🎨","🎯","🎱","🎮","🎲","🎸","🎹","🎺","🎻","🥁","🎤","🎧","📚","📖","📝","✏️","🖊️","📌","📍","✂️","🗂️","🗓️","📅","🔍","🔎","🔬","🔭","💊","🩺","🧲","🪄","🏆","🥇","🥈","🥉","🎖️"],
  symbols: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","✅","❌","⭕","🛑","⚠️","💯","🔞","🆕","🆒","🆓","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔲","🔳","▶️","⏩","⏪","⏫","⏬","⏹️","⏺️","🎵","🎶","🔔","🔕","📣","📢","🔊","🔉","🔈","🔇"]
};

let recentReactions = JSON.parse(localStorage.getItem("hd-recent-reactions") || '["❤️","😂","😮","😢","👍","🔥","🎉"]');

function addRecentReaction(emoji) {
  recentReactions = [emoji, ...recentReactions.filter(e => e !== emoji)].slice(0, 21);
  localStorage.setItem("hd-recent-reactions", JSON.stringify(recentReactions));
}

function showReactionPopup(msgId) {
  reactionPopup.dataset.msgId = msgId;

  // Reset to quick row state
  const fullPicker = document.getElementById("reaction-full-picker");
  fullPicker.classList.add("hidden");
  document.getElementById("reaction-search").value = "";

  reactionPopup.classList.remove("hidden");
  positionReactionPopup();
}

function positionReactionPopup() {
  // Temporarily make visible off-screen to measure
  reactionPopup.style.visibility = "hidden";
  reactionPopup.style.left = "0px";
  reactionPopup.style.top  = "0px";

  requestAnimationFrame(() => {
    const msgId = reactionPopup.dataset.msgId;
    const msgEl = document.getElementById(`msg-wrap-${msgId}`);
    const popW  = reactionPopup.offsetWidth  || 300;
    const popH  = reactionPopup.offsetHeight || 56;

    let anchorX = window.innerWidth  / 2;
    let anchorY = window.innerHeight / 2;

    if (msgEl) {
      const r = msgEl.getBoundingClientRect();
      anchorX = r.left + r.width  / 2;
      anchorY = r.top;
    }

    // Horizontally: center over message, keep within screen
    let left = anchorX - popW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

    // Vertically: above the message if room, otherwise below
    let top = anchorY - popH - 10;
    if (top < 8) top = anchorY + (msgEl ? msgEl.offsetHeight : 0) + 10;
    top = Math.max(8, Math.min(top, window.innerHeight - popH - 8));

    reactionPopup.style.left = `${left}px`;
    reactionPopup.style.top  = `${top}px`;
    reactionPopup.style.visibility = "visible";
  });
}

// "More" button toggles full picker
document.getElementById("reaction-more-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const fullPicker = document.getElementById("reaction-full-picker");
  const isOpen = !fullPicker.classList.contains("hidden");
  fullPicker.classList.toggle("hidden", isOpen);
  if (!isOpen) {
    loadReactionCategory("recent");
    document.getElementById("reaction-search").focus();
    requestAnimationFrame(() => positionReactionPopup());
  }
});

// Category tabs
document.querySelectorAll(".rcat-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".rcat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("reaction-search").value = "";
    loadReactionCategory(btn.dataset.rcat);
  });
});

// Search
document.getElementById("reaction-search").addEventListener("input", (e) => {
  e.stopPropagation();
  const q = e.target.value.trim();
  if (!q) {
    loadReactionCategory(document.querySelector(".rcat-btn.active")?.dataset.rcat || "recent");
    return;
  }
  const all = Object.values(REACTION_EMOJI_DATA).flat();
  renderReactionGrid(all);
});

function loadReactionCategory(cat) {
  const emojis = cat === "recent" ? recentReactions : (REACTION_EMOJI_DATA[cat] || []);
  renderReactionGrid(emojis);
}

function renderReactionGrid(emojis) {
  const grid = document.getElementById("reaction-emoji-grid");
  grid.innerHTML = "";
  emojis.forEach(emoji => {
    const btn = document.createElement("button");
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const msgId = reactionPopup.dataset.msgId;
      if (msgId) {
        await toggleReaction(msgId, emoji);
        addRecentReaction(emoji);
      }
      reactionPopup.classList.add("hidden");
      document.getElementById("reaction-full-picker").classList.add("hidden");
    });
    grid.appendChild(btn);
  });
}

// Reposition if window resizes while open (debounced)
let reactionResizeTimer = null;
window.addEventListener("resize", () => {
  if (reactionPopup.classList.contains("hidden")) return;
  clearTimeout(reactionResizeTimer);
  reactionResizeTimer = setTimeout(() => positionReactionPopup(), 120);
});

// =====================================
// REPLY
// =====================================

let replyFocusTimer = null;
let replyScrollTimer = null;

function setReply(message) {
  replyingTo         = message;
  const preview      = message.text
    ? (message.text.length > 60 ? message.text.slice(0, 60) + "…" : message.text)
    : (message.type || "Message");
  replyText.textContent = preview;

  // Clear any pending timers from a previous setReply call so they
  // don't fire mid-transition and cause a second visual "jump"
  clearTimeout(replyFocusTimer);
  clearTimeout(replyScrollTimer);

  const wasCollapsed = replyPreview.classList.contains("collapsed");

  // If already near bottom, keep pinned to bottom as the preview bar grows
  const wasNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 40;

  if (wasCollapsed) {
    replyPreview.classList.remove("collapsed");
  }
  // If it's already open (replying to a different message), just swap the
  // text in place — no need to re-trigger the expand transition.

  if (wasCollapsed && wasNearBottom) {
    // Wait for the height transition to finish, then re-pin to bottom
    replyScrollTimer = setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 210);
  }

  // Defer focus so the keyboard-open viewport shift doesn't collide
  // with the reply preview's height transition (avoids double-jump on mobile)
  replyFocusTimer = setTimeout(() => messageInput.focus(), 80);
}

replyCancel.addEventListener("click", () => {
  replyingTo = null;
  clearTimeout(replyFocusTimer);
  clearTimeout(replyScrollTimer);
  replyPreview.classList.add("collapsed");
});

// =====================================
// DELETE MESSAGE
// =====================================

async function deleteMessage(message) {
  if (!activeChatId || message.sender !== currentUser.uid) return;
  try {
    await Promise.all([
      messagesRef.child(activeChatId).child(message.id).remove(),
      reactionsRef.child(message.id).remove()
    ]);
    // Remove from DOM immediately for snappy feel
    const wrap = document.getElementById(`msg-wrap-${message.id}`);
    if (wrap) {
      wrap.style.transition = "opacity 0.2s, transform 0.2s";
      wrap.style.opacity    = "0";
      wrap.style.transform  = "scaleY(0)";
      setTimeout(() => wrap.remove(), 220);
    }
    renderedMsgIds.delete(message.id);
    showToast("Message deleted");
  } catch (err) {
    console.error("Delete error:", err);
    showToast("Could not delete message");
  }
}

// =====================================
// SEND MESSAGE
// =====================================

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// Auto-resize textarea
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
  handleTyping();
});

async function sendMessage() {
  if (!activeChatId || !currentUser) return;

  const text = messageInput.value.trim();
  const hasFile = typeof pendingFile !== "undefined" && pendingFile;

  if (!text && !hasFile) return;

  // Pulse animation on send button
  sendBtn.classList.remove("pulse");
  requestAnimationFrame(() => sendBtn.classList.add("pulse"));
  setTimeout(() => sendBtn.classList.remove("pulse"), 380);

  stopTyping();

  // Send attached file first (if any)
  if (hasFile) {
    await sendPendingFileIfAny();
  }

  if (!text) return; // file-only send, nothing else to do

  // Clear input immediately — snappy feel
  messageInput.value        = "";
  messageInput.style.height = "auto";

  const msgRef = messagesRef.child(activeChatId).push();
  const id     = msgRef.key;

  const payload = {
    id,
    sender:    currentUser.uid,
    senderName: currentUser.username,
    type:      "text",
    text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  if (replyingTo) {
    payload.replyTo     = replyingTo.id;
    payload.replyToText = (replyingTo.text || replyingTo.type || "Message").slice(0, 80);
    replyingTo = null;
    replyPreview.classList.add("collapsed");
  }

  try {
    await msgRef.set(payload);
    if (document.hidden && typeof notifyUser === "function") notifyUser("HeyDude", text);
  } catch (err) {
    console.error("Send error:", err);
    showToast("Failed to send");
    messageInput.value = text; // restore on failure
  }
}

// =====================================
// TYPING
// =====================================

function handleTyping() {
  if (!activeChatId || !currentUser) return;
  typingRef.child(activeChatId).child(currentUser.uid).set(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 2000);
}

function stopTyping() {
  if (!activeChatId || !currentUser) return;
  typingRef.child(activeChatId).child(currentUser.uid).remove();
}

function listenTyping(chatId) {
  typingRef.child(chatId).on("value", snapshot => {
    const typing = snapshot.val();
    if (!typing) { typingIndicator.classList.add("hidden"); return; }
    const others = Object.keys(typing).filter(uid => uid !== currentUser.uid);
    typingIndicator.classList.toggle("hidden", others.length === 0);
    if (others.length) document.getElementById("typing-text").textContent = "typing";
  });
}

// =====================================
// MESSAGE SEARCH
// =====================================

const searchMsgBtn   = document.getElementById("search-msg-btn");
const msgSearchBar   = document.getElementById("msg-search-bar");
const msgSearchInput = document.getElementById("msg-search-input");
const msgSearchClose = document.getElementById("msg-search-close");

searchMsgBtn.addEventListener("click", () => {
  msgSearchBar.classList.toggle("hidden");
  if (!msgSearchBar.classList.contains("hidden")) msgSearchInput.focus();
  else clearMessageHighlights();
});

msgSearchClose.addEventListener("click", () => {
  msgSearchBar.classList.add("hidden");
  msgSearchInput.value = "";
  clearMessageHighlights();
});

msgSearchInput.addEventListener("input", () => {
  const q = msgSearchInput.value.trim().toLowerCase();
  clearMessageHighlights();
  if (!q) return;
  let first = null;
  document.querySelectorAll(".message-wrap").forEach(wrap => {
    if (wrap.textContent.toLowerCase().includes(q)) {
      wrap.classList.add("msg-search-match");
      if (!first) first = wrap;
    }
  });
  if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
});

function clearMessageHighlights() {
  document.querySelectorAll(".msg-search-match").forEach(el => el.classList.remove("msg-search-match"));
}

// =====================================
// MOBILE BACK
// =====================================

document.getElementById("mobile-back").addEventListener("click", closeMobileChat);

function closeMobileChat() {
  document.querySelector(".chat-panel").classList.remove("mobile-open");
  activeChatId  = null;
  activeUserId  = null;
  activeGroupId = null;
  document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
  // Restore default header buttons (in case a group chat was open)
  document.getElementById("group-members-btn").classList.add("hidden");
  document.getElementById("call-btn").classList.remove("hidden");
  document.getElementById("video-btn").classList.remove("hidden");
  const dot = document.getElementById("chat-online-dot");
  if (dot) dot.style.display = "";
}

// =====================================
// CALL BUTTONS
// =====================================

document.getElementById("call-btn").addEventListener("click",  () => showCallModal("voice"));
document.getElementById("video-btn").addEventListener("click", () => showCallModal("video"));

function showCallModal(type) {
  const name = document.getElementById("chat-name").textContent;
  const av   = document.getElementById("chat-avatar").textContent;
  const bg   = document.getElementById("chat-avatar").style.background;

  document.getElementById("call-name").textContent        = name;
  document.getElementById("call-avatar").textContent      = av;
  document.getElementById("call-avatar").style.background = bg;
  document.getElementById("call-status-text").textContent =
    type === "video" ? "Video calling…" : "Calling…";

  const modal = document.getElementById("call-modal");
  modal.classList.remove("hidden");
  modal._timer = setTimeout(() => { modal.classList.add("hidden"); showToast("No answer"); }, 8000);
}

document.getElementById("call-end").addEventListener("click", () => {
  const modal = document.getElementById("call-modal");
  clearTimeout(modal._timer);
  modal.classList.add("hidden");
  showToast("Call ended");
});

// =====================================
// LIGHTBOX
// =====================================

function openLightbox(url) {
  const lb = document.getElementById("lightbox");
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox-download").href = url;
  lb.classList.remove("hidden");
}

document.getElementById("lightbox-close").addEventListener("click", () =>
  document.getElementById("lightbox").classList.add("hidden"));

document.getElementById("lightbox").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

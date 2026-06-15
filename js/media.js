// =====================================
// HEYDUDE MEDIA HANDLING — v2
// js/media.js
// =====================================

const attachBtn    = document.getElementById("attach-btn");
const fileInput    = document.getElementById("file-input");
const gifBtn       = document.getElementById("gif-btn");
const gifPicker    = document.getElementById("gif-picker");
const gifSearch    = document.getElementById("gif-search");
const gifGrid      = document.getElementById("gif-grid");
const gifClose     = document.getElementById("gif-close");
const attachPreview = document.getElementById("attach-preview");
const attachThumb   = document.getElementById("attach-thumb");
const attachName    = document.getElementById("attach-name");
const attachSize    = document.getElementById("attach-size");
const attachCancel  = document.getElementById("attach-cancel");
const dropOverlay   = document.getElementById("drop-overlay");
const chatContainerEl = document.getElementById("chat-container");

let pendingFile = null; // file selected/dropped, waiting to be sent

// =====================================
// ATTACH BUTTON  (opens file picker)
// =====================================

attachBtn.addEventListener("click", () => {
  closeAllPickers();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file) return;
  selectFile(file);
});

// =====================================
// SELECT FILE → SHOW PREVIEW
// =====================================

function selectFile(file) {
  if (!activeChatId) {
    showToast("Open a chat first");
    return;
  }

  if (file.type.startsWith("video/")) {
    showToast("Video sending isn't supported yet.");
    return;
  }

  if (file.type.startsWith("image/")) {
    if (file.size > 8 * 1024 * 1024) {
      showToast("Image too large (max 8 MB)");
      return;
    }
  } else if (file.size > 600 * 1024) {
    showToast("File too large (max 600 KB for documents)");
    return;
  }

  pendingFile = file;
  renderAttachPreview(file);
}

function renderAttachPreview(file) {
  attachThumb.innerHTML = "";
  attachName.textContent = file.name;
  attachSize.textContent = formatFileSize(file.size);

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    attachThumb.appendChild(img);
  } else if (file.type.startsWith("video/")) {
    const vid = document.createElement("video");
    vid.src = URL.createObjectURL(file);
    vid.muted = true;
    attachThumb.appendChild(vid);
  } else {
    const iconId = getFileIcon(file.type, file.name);
    attachThumb.innerHTML = `<svg><use href="#${iconId}"/></svg>`;
  }

  attachPreview.classList.remove("collapsed");
}

attachCancel.addEventListener("click", clearPendingFile);

function clearPendingFile() {
  pendingFile = null;
  attachPreview.classList.add("collapsed");
  attachThumb.innerHTML = "";
}

// =====================================
// SEND PENDING FILE  — triggered from sendMessage() in chat.js via hook
// =====================================

async function sendPendingFileIfAny() {
  if (!pendingFile) return false;
  const file = pendingFile;
  clearPendingFile();

  // Animated GIF picked from disk: send uncompressed (canvas would kill animation)
  if (file.type === "image/gif") {
    if (file.size > 700 * 1024) {
      showToast("GIF too large (max 700 KB) — try the GIF picker instead");
      return false;
    }
    await sendGifFileAsDataUrl(file);
    return true;
  }

  let type = "file";
  if (file.type.startsWith("image/")) type = "image";

  await uploadMedia(file, type);
  return true;
}

async function sendGifFileAsDataUrl(file) {
  if (!activeChatId || !currentUser) return;

  const msgId = messagesRef.child(activeChatId).push().key;
  insertProgressBubble(msgId, file.name, "gif");
  updateProgressBubble(msgId, 40);

  try {
    const dataUrl = await readFileAsDataURL(file);
    updateProgressBubble(msgId, 90);

    await messagesRef.child(activeChatId).child(msgId).set({
      id:        msgId,
      sender:    currentUser.uid,
      senderName: currentUser.username,
      type:      "gif",
      url:       dataUrl,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    updateProgressBubble(msgId, 100);
    setTimeout(() => removeProgressBubble(msgId), 150);
  } catch (err) {
    console.error("GIF send error:", err);
    removeProgressBubble(msgId);
    showToast("Failed to send GIF");
  }
}

// =====================================
// PASTE IMAGE FROM CLIPBOARD
// =====================================

messageInput.addEventListener("paste", (e) => {
  if (!activeChatId) return;
  const items = e.clipboardData?.items;
  if (!items || !items.length) return;

  // Look for any file-like clipboard item (image, or generic file from OS clipboard)
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        selectFile(file);
      }
      return;
    }
  }
});

// =====================================
// DRAG & DROP
// =====================================

let dragCounter = 0;

["dragenter", "dragover"].forEach(evt => {
  chatContainerEl.addEventListener(evt, (e) => {
    e.preventDefault();
    if (!activeChatId) return;
    dragCounter++;
    dropOverlay.classList.remove("hidden");
  });
});

["dragleave", "drop"].forEach(evt => {
  chatContainerEl.addEventListener(evt, (e) => {
    e.preventDefault();
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) dropOverlay.classList.add("hidden");
  });
});

chatContainerEl.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.add("hidden");

  if (!activeChatId) { showToast("Open a chat first"); return; }

  const file = e.dataTransfer.files?.[0];
  if (file) selectFile(file);
});

// =====================================
// GIF PICKER  (GIPHY — public beta API key)
// =====================================

// GIPHY's documented public beta key — works without signup, rate-limited but reliable
const GIPHY_KEY = "djhhrHzujtfoV9T4TIHpfyJ0MlnHn0ll";

let gifJustToggled = false;

gifBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (gifJustToggled) return;
  gifJustToggled = true;
  setTimeout(() => { gifJustToggled = false; }, 50);

  document.getElementById("emoji-picker").classList.add("hidden");
  document.getElementById("emoji-btn").classList.remove("active");

  const willOpen = gifPicker.classList.contains("hidden");
  gifPicker.classList.toggle("hidden");
  gifBtn.classList.toggle("active", willOpen);

  if (willOpen) {
    positionFloatingPanel(gifPicker);
    if (!gifGrid.querySelector(".gif-item")) loadTrendingGifs();
    if (window.innerWidth > 768) gifSearch.focus();
  }
});

gifClose.addEventListener("click", () => {
  gifPicker.classList.add("hidden");
  gifBtn.classList.remove("active");
});

let gifDebounce = null;
gifSearch.addEventListener("input", () => {
  clearTimeout(gifDebounce);
  const q = gifSearch.value.trim();
  gifDebounce = setTimeout(() => {
    if (q.length >= 2) searchGifs(q);
    else if (q.length === 0) loadTrendingGifs();
  }, 420);
});

async function loadTrendingGifs() {
  gifGrid.innerHTML = `<div class="gif-loading">Loading trending GIFs…</div>`;
  try {
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = await res.json();
    renderGifs(data || []);
  } catch (err) {
    console.error("GIF trending error:", err);
    gifGrid.innerHTML = `<div class="gif-placeholder">Couldn't load GIFs.<br>Check your connection.</div>`;
  }
}

async function searchGifs(query) {
  gifGrid.innerHTML = `<div class="gif-loading">Searching "${escapeHTML(query)}"…</div>`;
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = await res.json();
    renderGifs(data || []);
  } catch (err) {
    console.error("GIF search error:", err);
    gifGrid.innerHTML = `<div class="gif-placeholder">Search failed. Try again.</div>`;
  }
}

function renderGifs(results) {
  gifGrid.innerHTML = "";

  if (!results.length) {
    gifGrid.innerHTML = `<div class="gif-placeholder">No GIFs found</div>`;
    return;
  }

  results.forEach(gif => {
    const images  = gif.images || {};
    const preview = images.fixed_height_small?.url || images.fixed_height?.url;
    const full    = images.original?.url || images.fixed_height?.url;
    if (!preview || !full) return;

    const div = document.createElement("div");
    div.className = "gif-item";

    const img   = document.createElement("img");
    img.src     = preview;
    img.loading = "lazy";
    img.alt     = gif.title || "GIF";

    img.onclick = async () => {
      gifPicker.classList.add("hidden");
      gifBtn.classList.remove("active");
      gifSearch.value = "";
      await sendGifMessage(full);
    };

    div.appendChild(img);
    gifGrid.appendChild(div);
  });
}

async function sendGifMessage(url) {
  if (!activeChatId || !currentUser) return;

  const id = messagesRef.child(activeChatId).push().key;
  await messagesRef.child(activeChatId).child(id).set({
    id,
    sender:    currentUser.uid,
    senderName: currentUser.username,
    type:      "gif",
    url,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

// =====================================
// SEND MEDIA — stored as base64 in Realtime Database
// (Avoids needing Firebase Storage to be configured/billed)
// =====================================

// Max sizes (after compression for images)
const MAX_IMAGE_BYTES = 700 * 1024;   // ~700KB after compression
const MAX_FILE_BYTES  = 600 * 1024;   // ~600KB raw for generic files (RTDB node limit safety)
const MAX_VIDEO_BYTES = 0;            // videos disabled for base64 mode — too large

async function uploadMedia(file, type) {
  if (!activeChatId || !currentUser) return;

  const msgId = messagesRef.child(activeChatId).push().key;

  insertProgressBubble(msgId, file.name, type);
  updateProgressBubble(msgId, 10);

  try {
    let dataUrl;
    let finalType = type;
    let outFileName = file.name;
    let outFileSize = file.size;
    let outMime     = file.type;

    if (type === "image" || type === "gif") {
      // Compress images via canvas so they fit comfortably in RTDB
      dataUrl = await compressImageToDataURL(file, 1280, 0.78);
      updateProgressBubble(msgId, 60);

      const approxBytes = Math.ceil((dataUrl.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        // Try a more aggressive pass
        dataUrl = await compressImageToDataURL(file, 900, 0.6);
        const retryBytes = Math.ceil((dataUrl.length * 3) / 4);
        if (retryBytes > MAX_IMAGE_BYTES) {
          removeProgressBubble(msgId);
          showToast("Image too large even after compression. Try a smaller image.");
          return;
        }
      }
      outFileSize = Math.ceil((dataUrl.length * 3) / 4);

    } else if (type === "video") {
      removeProgressBubble(msgId);
      showToast("Video sending isn't supported in this mode (file too large).");
      return;

    } else {
      // Generic file — read as base64 directly
      if (file.size > MAX_FILE_BYTES) {
        removeProgressBubble(msgId);
        showToast(`File too large. Max ${formatFileSize(MAX_FILE_BYTES)} for documents.`);
        return;
      }
      dataUrl = await readFileAsDataURL(file);
      updateProgressBubble(msgId, 60);
    }

    updateProgressBubble(msgId, 90);

    const payload = {
      id:        msgId,
      sender:    currentUser.uid,
      senderName: currentUser.username,
      type:      finalType,
      url:       dataUrl,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    if (finalType === "file") {
      payload.fileName = outFileName;
      payload.fileSize = outFileSize;
      payload.mimeType = outMime;
    }

    await messagesRef.child(activeChatId).child(msgId).set(payload);
    updateProgressBubble(msgId, 100);
    setTimeout(() => removeProgressBubble(msgId), 150);

  } catch (err) {
    console.error("Send media error:", err);
    removeProgressBubble(msgId);
    showToast("Failed to send: " + (err.message || "unknown error"));
  }
}

// =====================================
// FILE → DATA URL HELPERS
// =====================================

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function compressImageToDataURL(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * (maxDim / width));
          width  = maxDim;
        } else {
          width  = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Use JPEG for photos (smaller); PNG for images with transparency stays PNG-ish via JPEG fallback
      const mime = file.type === "image/png" && hasTransparency(canvas) ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(mime, quality));
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load image")); };
    img.src = url;
  });
}

function hasTransparency(canvas) {
  try {
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, Math.min(canvas.width, 50), Math.min(canvas.height, 50)).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  } catch { /* ignore */ }
  return false;
}

function insertProgressBubble(id, name, type) {
  const wrap = document.createElement("div");
  wrap.className = "message-wrap sent";
  wrap.id        = `prog-wrap-${id}`;

  const bubble = document.createElement("div");
  bubble.className = "message";

  const iconId = type === "image" ? "icon-image" : type === "video" ? "icon-video-file" : "icon-file";

  bubble.innerHTML = `
    <div class="upload-progress-wrap">
      <div class="upload-progress-header">
        <svg><use href="#${iconId}"/></svg>
        <span class="upload-label">${escapeHTML(name)}</span>
      </div>
      <div class="upload-progress-bar">
        <div class="upload-progress-fill" id="prog-fill-${id}"></div>
      </div>
      <div class="upload-label" id="prog-pct-${id}">0%</div>
    </div>
  `;

  wrap.appendChild(bubble);
  messagesContainer.appendChild(wrap);
  requestAnimationFrame(() => {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: "smooth" });
  });
}

function updateProgressBubble(id, pct) {
  const fill  = document.getElementById(`prog-fill-${id}`);
  const label = document.getElementById(`prog-pct-${id}`);
  if (fill)  fill.style.width  = pct + "%";
  if (label) label.textContent = pct + "%";
}

function removeProgressBubble(id) {
  const wrap = document.getElementById(`prog-wrap-${id}`);
  if (wrap) {
    wrap.style.transition = "opacity 0.2s";
    wrap.style.opacity = "0";
    setTimeout(() => wrap.remove(), 200);
  }
}

// =====================================
// FLOATING PANEL POSITIONING (emoji/gif pickers)
// =====================================

function positionFloatingPanel(panel) {
  if (window.innerWidth <= 768) {
    // Mobile: bottom sheet — CSS handles positioning
    if (panel.style.left !== "" || panel.style.bottom !== "" || panel.style.top !== "" || panel.style.width !== "") {
      panel.style.left = "";
      panel.style.bottom = "";
      panel.style.top = "";
      panel.style.width = "";
    }
    return;
  }

  const input = document.querySelector(".message-input");
  const rect  = input.getBoundingClientRect();
  const panelWidth = panel.classList.contains("gif-picker") ? 360 : 340;

  let left = rect.left;
  if (left + panelWidth > window.innerWidth - 12) {
    left = window.innerWidth - panelWidth - 12;
  }
  left = Math.max(12, left);

  const newLeft   = `${left}px`;
  const newBottom = `${window.innerHeight - rect.top + 8}px`;
  const newWidth  = `${panelWidth}px`;

  // Only write styles if something actually changed — avoids
  // unnecessary reflow/repaint cycles that can cause flicker.
  if (panel.style.left !== newLeft)     panel.style.left   = newLeft;
  if (panel.style.bottom !== newBottom) panel.style.bottom = newBottom;
  if (panel.style.top !== "auto")       panel.style.top    = "auto";
  if (panel.style.width !== newWidth)   panel.style.width  = newWidth;
}

// =====================================
// CLOSE ALL PICKERS
// =====================================

function closeAllPickers() {
  document.getElementById("emoji-picker").classList.add("hidden");
  document.getElementById("emoji-btn").classList.remove("active");
  gifPicker.classList.add("hidden");
  gifBtn.classList.remove("active");
}

document.addEventListener("click", (e) => {
  const emojiPicker = document.getElementById("emoji-picker");
  const emojiBtnEl  = document.getElementById("emoji-btn");

  if (!emojiPicker.contains(e.target) && e.target !== emojiBtnEl && !emojiBtnEl.contains(e.target)) {
    emojiPicker.classList.add("hidden");
    emojiBtnEl.classList.remove("active");
  }

  if (!gifPicker.contains(e.target) && e.target !== gifBtn && !gifBtn.contains(e.target)) {
    gifPicker.classList.add("hidden");
    gifBtn.classList.remove("active");
  }
});

// Reposition floating panels on resize/orientation change (debounced)
let pickerResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(pickerResizeTimer);
  pickerResizeTimer = setTimeout(() => {
    const emojiPicker = document.getElementById("emoji-picker");
    if (!emojiPicker.classList.contains("hidden")) positionFloatingPanel(emojiPicker);
    if (!gifPicker.classList.contains("hidden"))   positionFloatingPanel(gifPicker);
  }, 120);
});

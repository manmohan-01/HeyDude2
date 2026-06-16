// =====================================
// HEYDUDE FIREBASE CONFIGURATION
// js/firebase.js
// =====================================

const firebaseConfig = {
  apiKey: "AIzaSyAgZSVBLgWfe44Bah6Autu4NcgXg2spJHw",
  authDomain: "heydude-a01c6.firebaseapp.com",
  databaseURL: "https://heydude-a01c6-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "heydude-a01c6",
  storageBucket: "heydude-a01c6.firebasestorage.app",
  messagingSenderId: "579142608044",
  appId: "1:579142608044:web:a2b4a1585aff4dfea90749"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db   = firebase.database();

// Storage is optional — not required for media (images/files sent as base64 via RTDB)
let storage = null;
try {
  storage = firebase.storage();
} catch (e) {
  console.warn("Firebase Storage not available — media will use base64 fallback only.", e.message);
}

// References
const usersRef    = db.ref("users");
const chatsRef    = db.ref("chats");
const messagesRef = db.ref("messages");
const requestsRef = db.ref("friendRequests");
const typingRef   = db.ref("typing");
const reactionsRef = db.ref("reactions");
const groupsRef   = db.ref("groups");
const readReceiptsRef = db.ref("readReceipts");

// Current User (global)
let currentUser = null;

// =====================================
// HELPERS
// =====================================

function generateChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), duration);
}

function getInitial(name) {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

function avatarColor(seed) {
  const colors = [
    "#ff4757", "#ff6b81", "#6c5ce7",
    "#00b894", "#0984e3", "#fd79a8",
    "#e17055", "#00cec9", "#a29bfe",
    "#55efc4", "#fdcb6e", "#e84393"
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash += seed.charCodeAt(i);
  return colors[hash % colors.length];
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date  = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString())     return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatLastSeen(timestamp) {
  if (!timestamp) return "Offline";
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60)    return "Last seen just now";
  if (diff < 3600)  return `Last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`;
  return `Last seen ${Math.floor(diff / 86400)}d ago`;
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024)       return bytes + " B";
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

const CODE_EXTENSIONS = ["html","htm","css","js","jsx","ts","tsx","json","xml","py","java","c","cpp","h","cs","php","rb","go","rs","sh","sql","yml","yaml","md"];

function getFileIcon(mimeType = "", fileName = "") {
  const ext = fileName.split(".").pop().toLowerCase();
  if (mimeType.startsWith("image/"))    return "icon-image";
  if (mimeType.startsWith("video/"))    return "icon-video-file";
  if (["zip","rar","7z"].includes(ext)) return "icon-archive";
  if (CODE_EXTENSIONS.includes(ext))    return "icon-code";
  return "icon-file";
}

// =====================================
// PRESENCE
// =====================================

let connectedListenerAttached = false;

function setUserOnline(uid) {
  db.ref(`users/${uid}`).update({
    online: true,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });

  if (!connectedListenerAttached) {
    connectedListenerAttached = true;
    db.ref(".info/connected").on("value", snap => {
      if (snap.val() === true) {
        db.ref(`users/${uid}`).onDisconnect().update({
          online: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
      }
    });
  }
}

function setUserOffline(uid) {
  return db.ref(`users/${uid}`).update({
    online: false,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
}

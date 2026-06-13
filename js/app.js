// =====================================
// HEYDUDE APP CONTROLLER — v2
// js/app.js
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  setupViewportHeight();
  setupNetworkListener();
  setupVisibilityTracking();
  setupKeyboardShortcuts();
  setupNotifications();
  loadTheme();
  setupThemeToggle();
});

// =====================================
// MOBILE VIEWPORT HEIGHT FIX
// Mobile browsers change innerHeight when the
// on-screen keyboard opens/closes or the address
// bar collapses. We track real viewport height
// via --vh so layouts never overflow or jump.
// =====================================

function setupViewportHeight() {
  const setVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  };

  setVh();
  window.addEventListener("resize", setVh);
  window.addEventListener("orientationchange", () => setTimeout(setVh, 200));

  // Visual Viewport API — more reliable for keyboard open/close on mobile
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setVh);
  }
}

// =====================================
// NETWORK STATUS
// =====================================

function setupNetworkListener() {
  window.addEventListener("online",  () => showToast("Back online"));
  window.addEventListener("offline", () => showToast("No internet connection"));
}

// =====================================
// PAGE VISIBILITY
// =====================================

function setupVisibilityTracking() {
  document.addEventListener("visibilitychange", () => {
    if (!currentUser) return;
    if (document.hidden) {
      setUserOffline(currentUser.uid);
    } else {
      setUserOnline(currentUser.uid);
    }
  });
}

// =====================================
// SET OFFLINE ON CLOSE
// =====================================

window.addEventListener("beforeunload", () => {
  if (currentUser) setUserOffline(currentUser.uid);
});

// =====================================
// NOTIFICATIONS
// =====================================

function setupNotifications() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function notifyUser(title, body) {
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return; // only notify when tab is hidden
  new Notification(title, { body, icon: "./img/logo.png" });
}

// =====================================
// KEYBOARD SHORTCUTS
// =====================================

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", e => {
    // Escape: close mobile chat or any open panel
    if (e.key === "Escape") {
      if (window.innerWidth <= 768 && typeof closeMobileChat === "function") {
        closeMobileChat();
      }

      const emojiPicker = document.getElementById("emoji-picker");
      const gifPicker   = document.getElementById("gif-picker");
      const emojiBtnEl  = document.getElementById("emoji-btn");
      const gifBtnEl    = document.getElementById("gif-btn");

      emojiPicker.classList.add("hidden");
      gifPicker.classList.add("hidden");
      emojiBtnEl?.classList.remove("active");
      gifBtnEl?.classList.remove("active");

      document.getElementById("lightbox").classList.add("hidden");
      document.getElementById("context-menu").classList.add("hidden");
      document.getElementById("reaction-popup").classList.add("hidden");

      if (typeof clearPendingFile === "function") clearPendingFile();
    }

    // Ctrl/Cmd + K: focus search
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      const searchEl = document.getElementById("user-search");
      if (searchEl) searchEl.focus();
    }
  });
}

// =====================================
// THEME
// =====================================

function saveTheme(theme) {
  localStorage.setItem("heydude-theme", theme);
  document.body.setAttribute("data-theme", theme);
  updateThemeBtn(theme);
}

function loadTheme() {
  const theme = localStorage.getItem("heydude-theme") || "dark";
  document.body.setAttribute("data-theme", theme);
  updateThemeBtn(theme);
}

function updateThemeBtn(theme) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const use = btn.querySelector("use");
  if (use) {
    use.setAttribute("href", theme === "dark" ? "#icon-sun" : "#icon-moon");
  }
  btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

function setupThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme") || "dark";
    saveTheme(current === "dark" ? "light" : "dark");
  });
}

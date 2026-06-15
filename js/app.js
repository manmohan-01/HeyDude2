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
  setupShowcaseDemo();
  setupStatsCounter();
  setupPanelTabs();
  setupRailNav();
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

      document.getElementById("group-modal-overlay")?.classList.add("hidden");
      document.getElementById("members-panel-overlay")?.classList.add("hidden");

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
  const buttons = [
    document.getElementById("theme-toggle"),
    document.getElementById("landing-theme-toggle"),
    document.getElementById("theme-toggle-mobile")
  ];

  buttons.forEach(btn => {
    if (!btn) return;
    const use = btn.querySelector("use");
    if (use) {
      use.setAttribute("href", theme === "dark" ? "#icon-sun" : "#icon-moon");
    }
    btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  });
}

function setupThemeToggle() {
  const toggleTheme = () => {
    const current = document.body.getAttribute("data-theme") || "dark";
    saveTheme(current === "dark" ? "light" : "dark");
  };

  const sidebarBtn      = document.getElementById("theme-toggle");
  const landingBtn      = document.getElementById("landing-theme-toggle");
  const mobileHeaderBtn = document.getElementById("theme-toggle-mobile");

  if (sidebarBtn)      sidebarBtn.addEventListener("click", toggleTheme);
  if (landingBtn)      landingBtn.addEventListener("click", toggleTheme);
  if (mobileHeaderBtn) mobileHeaderBtn.addEventListener("click", toggleTheme);
}

// =====================================
// LANDING SHOWCASE — animated demo chat
// Loops a short scripted conversation in the
// phone mockup on the auth screen to demonstrate
// the chat experience before signup.
// =====================================

function setupShowcaseDemo() {
  const messagesEl = document.getElementById("demo-messages");
  const typingEl   = document.getElementById("demo-typing");
  const sendEl     = document.querySelector(".demo-send");
  if (!messagesEl || !typingEl) return;

  const script = [
    { from: "them", text: "Hey! Just joined HeyDude" },
    { from: "me",   text: "Welcome! This app is so smooth" },
    { from: "them", text: "Right? Real-time messages feel instant" },
    { from: "me",   text: "And no lag when replying either" },
    { from: "them", text: "Sending you a GIF" },
    { from: "me",   text: "Haha perfect" },
  ];

  let index = 0;
  let cancelled = false;

  // Stop the loop if the auth screen is no longer visible (logged in)
  const authScreen = document.getElementById("auth-screen");

  function isVisible() {
    return authScreen && authScreen.classList.contains("active");
  }

  function clearMessages() {
    messagesEl.innerHTML = "";
  }

  function appendMessage(msg) {
    const div = document.createElement("div");
    div.className = `demo-msg ${msg.from === "me" ? "sent" : "received"}`;
    div.textContent = msg.text;
    messagesEl.appendChild(div);

    // Keep only the last 4 messages visible for a clean loop
    while (messagesEl.children.length > 4) {
      messagesEl.removeChild(messagesEl.firstChild);
    }
  }

  async function step() {
    if (cancelled || !isVisible()) {
      // Pause loop while away from auth screen, retry shortly
      setTimeout(step, 1000);
      return;
    }

    const msg = script[index % script.length];

    if (msg.from === "them") {
      typingEl.classList.remove("hidden");
      await wait(1100);
      typingEl.classList.add("hidden");
      appendMessage(msg);
    } else {
      await wait(900);
      // Pulse the send button for "sent" messages
      if (sendEl) {
        sendEl.classList.remove("pulse");
        requestAnimationFrame(() => sendEl.classList.add("pulse"));
        setTimeout(() => sendEl.classList.remove("pulse"), 380);
      }
      appendMessage(msg);
    }

    index++;

    // Reset the whole conversation periodically for a clean loop
    if (index % script.length === 0) {
      await wait(2200);
      clearMessages();
      await wait(400);
    } else {
      await wait(700);
    }

    step();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Seed the first couple of messages immediately so it doesn't start empty
  appendMessage(script[0]);
  index = 1;

  step();
}

// =====================================
// LANDING SHOWCASE — animated stat counters
// =====================================

function setupStatsCounter() {
  const stats = document.querySelectorAll(".stat-num");
  if (!stats.length) return;

  const animate = (el) => {
    const target = parseFloat(el.dataset.target || "0");
    const duration = 1200;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(target * eased);
      el.textContent = value;
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    }

    requestAnimationFrame(frame);
  };

  // Animate when the auth screen first becomes visible
  const authScreen = document.getElementById("auth-screen");
  if (!authScreen) return;

  let animated = false;
  const tryAnimate = () => {
    if (animated) return;
    if (authScreen.classList.contains("active")) {
      animated = true;
      stats.forEach(animate);
    }
  };

  tryAnimate();

  // In case the screen becomes active later (e.g. after logout)
  const observer = new MutationObserver(tryAnimate);
  observer.observe(authScreen, { attributes: true, attributeFilter: ["class"] });
}

// =====================================
// CONFIRM DIALOG — reusable yes/no modal
// Usage:
//   showConfirmDialog({
//     title: "Remove friend?",
//     message: "This can't be undone.",
//     confirmLabel: "Remove",
//     danger: true,
//     onConfirm: () => { ... }
//   });
// =====================================

function showConfirmDialog({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onConfirm }) {
  const overlay   = document.getElementById("confirm-dialog");
  const titleEl   = document.getElementById("confirm-title");
  const msgEl     = document.getElementById("confirm-message");
  const okBtn     = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");

  titleEl.textContent = title || "Are you sure?";
  msgEl.innerHTML      = message || "";
  okBtn.textContent    = confirmLabel;
  cancelBtn.textContent = cancelLabel;
  okBtn.classList.toggle("confirm-danger", danger);

  overlay.classList.remove("hidden");

  // Replace handlers each time to avoid stacking listeners
  const cleanup = () => {
    overlay.classList.add("hidden");
    okBtn.onclick = null;
    cancelBtn.onclick = null;
    document.removeEventListener("keydown", escHandler);
  };

  const escHandler = (e) => {
    if (e.key === "Escape") cleanup();
  };

  okBtn.onclick = () => {
    cleanup();
    if (typeof onConfirm === "function") onConfirm();
  };
  cancelBtn.onclick = cleanup;

  document.addEventListener("keydown", escHandler);

  // Click outside the box also cancels
  overlay.onclick = (e) => {
    if (e.target === overlay) cleanup();
  };
}

// =====================================
// MESSAGES PANEL — filter tabs (All / Online)
// =====================================

function setupPanelTabs() {
  const tabs            = document.querySelectorAll(".panel-tab");
  const requestSection  = document.getElementById("request-section");
  const chatsSection    = document.getElementById("chats-section");
  const panelTitle      = document.getElementById("panel-title");

  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const mode = tab.dataset.panelTab;

      requestSection.classList.add("hidden");
      chatsSection.classList.remove("hidden");

      if (mode === "online") {
        panelTitle.textContent = "Online Friends";
        filterChatList("online");
      } else {
        panelTitle.textContent = "Messages";
        filterChatList("");
      }
    });
  });
}

// Filters the rendered chat-list items. mode: "" (all) | "online"
function filterChatList(mode) {
  const items = document.querySelectorAll("#chat-list .chat-item");

  items.forEach(item => {
    if (mode === "online") {
      const dot = item.querySelector(".online-dot");
      const isOnline = dot && parseFloat(dot.style.opacity || "0") >= 1;
      item.style.display = isOnline ? "" : "none";
    } else {
      item.style.display = "";
    }
  });

  updateChatListEmptyState();
}

// Shows/hides the "no conversations" placeholder based on visible items
function updateChatListEmptyState() {
  const emptyState = document.getElementById("chat-list-empty");
  if (!emptyState) return;

  const items = document.querySelectorAll("#chat-list .chat-item");
  const visibleCount = Array.from(items).filter(i => i.style.display !== "none").length;

  emptyState.classList.toggle("hidden", visibleCount > 0);
}

// =====================================
// ICON RAIL — navigation between panel views
// =====================================

function setupRailNav() {
  const railChats    = document.getElementById("rail-chats-btn");
  const railRequests = document.getElementById("rail-requests-btn");
  const railCalls    = document.getElementById("rail-calls-btn");
  const railNotifs   = document.getElementById("rail-notifications-btn");
  const railGroups   = document.getElementById("rail-groups-btn");
  const railButtons  = [railChats, railRequests, railCalls, railNotifs, railGroups];

  const allTab = document.querySelector('.panel-tab[data-panel-tab="all"]');

  if (railChats && allTab) {
    railChats.addEventListener("click", () => {
      setActiveRail(railChats, railButtons);
      document.getElementById("groups-section").classList.add("hidden");
      allTab.click();
      openMessagesPanelOnMobile();
    });
  }

  if (railRequests) {
    railRequests.addEventListener("click", () => {
      setActiveRail(railRequests, railButtons);

      document.querySelectorAll(".panel-tab").forEach(t => t.classList.remove("active"));
      document.getElementById("groups-section").classList.add("hidden");
      document.getElementById("chats-section").classList.add("hidden");
      document.getElementById("request-section").classList.remove("hidden");
      document.getElementById("panel-title").textContent = "Friend Requests";

      openMessagesPanelOnMobile();
    });
  }

  if (railCalls) {
    railCalls.addEventListener("click", () => {
      setActiveRail(railCalls, railButtons);
      showToast("Call history coming soon");
    });
  }

  if (railNotifs) {
    railNotifs.addEventListener("click", () => {
      setActiveRail(railNotifs, railButtons);
      showToast("No new notifications");
    });
  }
  // railGroups click handler is wired in group.js
}

function setActiveRail(activeBtn, allBtns) {
  allBtns.forEach(b => b && b.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
}

// On mobile, bring the messages panel back into view if a chat is
// currently open full-screen (mirrors the mobile-back behavior).
function openMessagesPanelOnMobile() {
  if (window.innerWidth > 768) return;
  const chatPanel = document.querySelector(".chat-panel");
  if (chatPanel) chatPanel.classList.remove("mobile-open");
}

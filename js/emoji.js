// =====================================
// HEYDUDE EMOJI PICKER
// js/emoji.js
// =====================================

const emojiBtn    = document.getElementById("emoji-btn");
const emojiPicker = document.getElementById("emoji-picker");
const emojiGrid   = document.getElementById("emoji-grid");
const emojiSearch = document.getElementById("emoji-search");

// =====================================
// EMOJI DATA
// =====================================

const EMOJI_DATA = {
  smileys: {
    label: "Smileys & Emotion",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩",
             "😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐",
             "🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒",
             "🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐",
             "😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱",
             "😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩",
             "🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"]
  },
  people: {
    label: "People & Body",
    emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆",
             "🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏",
             "💅","🤳","💪","🦾","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀",
             "👁️","👅","👄","👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓","👴","👵","🙍",
             "🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","👮","🕵️","💂","🥷","👷","🤴",
             "👸","🧙","🧝","🧛","🧟","🧞","🧜","🧚","👼","🤶","🎅","🦸","🦹","🧑‍⚕️","👩‍⚕️","👨‍⚕️"]
  },
  nature: {
    label: "Animals & Nature",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵",
             "🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄",
             "🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕",
             "🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆",
             "🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖",
             "🌸","🌺","🌻","🌹","🌷","🌼","🪷","🌿","🍀","🍃","🌱","🌲","🌳","🌴","🪴"]
  },
  food: {
    label: "Food & Drink",
    emojis: ["🍎","🍊","🍋","🍇","🍓","🫐","🍈","🍑","🍒","🥭","🍍","🥥","🥝","🍅","🍆",
             "🥑","🥦","🥬","🥒","🌶️","🫑","🧄","🧅","🥔","🌽","🍠","🥐","🥖","🍞","🥨",
             "🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫓",
             "🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣",
             "🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🧁","🍰","🎂","🍮","🍭",
             "🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🧃","🥤","🧋","☕","🍵","🧉","🍺","🍻"]
  },
  travel: {
    label: "Travel & Places",
    emojis: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️",
             "🛵","🚲","🛴","🛺","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞",
             "🚝","🚄","🚅","🚈","🚂","🚆","🚇","✈️","🛫","🛬","🛩️","💺","🚁","🚀","🛸",
             "⛵","🚤","🛥️","🛳️","⛴️","🚢","⚓","🗺️","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️",
             "🏜️","🏝️","🏟️","🏛️","🏗️","🧱","🪨","🪵","🛖","🏠","🏡","🏢","🏣","🏤","🏥",
             "🗼","🗽","⛪","🕌","🕍","⛩️","🕋","⛲","⛺","🌁","🌃","🌄","🌅","🌆","🌇","🌉"]
  },
  objects: {
    label: "Objects",
    emojis: ["⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","🖲️","💽","💾","💿","📀","📷","📸","📹",
             "🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🧭","⏱️","⏲️","⏰","🕰️","💡",
             "🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🏧","💳","💎","⚖️","🪜",
             "🔧","🪛","🔨","⛏️","🪚","🔩","🪤","🪣","🔑","🗝️","🔐","🔏","🔓","🔒","🚪",
             "🎁","🎀","🎊","🎉","🎈","🎏","🎎","🎐","🧧","🎑","🎃","🎄","🎋","🎍","🎇",
             "🧨","✨","🎆","🎇","🪄","🎭","🎨","🖼️","🎪","🎠","🎡","🎢","💈","🎯","🎱","🎳"]
  },
  symbols: {
    label: "Symbols",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓",
             "💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","🛐",
             "⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑",
             "☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️",
             "🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛",
             "🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🔕","❗","❓","‼️","⁉️","🔅"]
  }
};

let recentEmojis = JSON.parse(localStorage.getItem("hd-recent-emojis") || "[]");
let activeCat    = "recent";

// =====================================
// TOGGLE PICKER
// =====================================

emojiBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const gifPickerEl = document.getElementById("gif-picker");
  gifPickerEl.classList.add("hidden");
  document.getElementById("gif-btn").classList.remove("active");

  const willOpen = emojiPicker.classList.contains("hidden");
  emojiPicker.classList.toggle("hidden");
  emojiBtn.classList.toggle("active", willOpen);

  if (willOpen) {
    if (typeof positionFloatingPanel === "function") {
      positionFloatingPanel(emojiPicker);
    } else {
      positionPicker();
    }
    loadCategory(activeCat);
    if (window.innerWidth > 768) emojiSearch.focus();
  }
});

function positionPicker() {
  const input  = document.querySelector(".message-input");
  const rect   = input.getBoundingClientRect();
  const isMob  = window.innerWidth <= 768;

  if (isMob) {
    emojiPicker.style.left   = "";
    emojiPicker.style.bottom = "";
    emojiPicker.style.top    = "";
    emojiPicker.style.width  = "";
  } else {
    emojiPicker.style.left   = rect.left + "px";
    emojiPicker.style.bottom = (window.innerHeight - rect.top + 8) + "px";
    emojiPicker.style.top    = "auto";
    emojiPicker.style.width  = "340px";
  }
}

// =====================================
// CATEGORY TABS
// =====================================

document.querySelectorAll(".emoji-cat").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".emoji-cat").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCat = btn.dataset.cat;
    emojiSearch.value = "";
    loadCategory(activeCat);
  });
});

// =====================================
// LOAD CATEGORY
// =====================================

function loadCategory(cat) {
  emojiGrid.innerHTML = "";

  if (cat === "recent") {
    if (recentEmojis.length === 0) {
      const empty = document.createElement("div");
      empty.className   = "emoji-section-label";
      empty.textContent = "No recent emojis yet";
      emojiGrid.appendChild(empty);
      return;
    }
    renderEmojiList(recentEmojis);
    return;
  }

  const section = EMOJI_DATA[cat];
  if (!section) return;

  const label       = document.createElement("div");
  label.className   = "emoji-section-label";
  label.textContent = section.label;
  emojiGrid.appendChild(label);

  renderEmojiList(section.emojis);
}

function renderEmojiList(list) {
  list.forEach(emoji => {
    const btn = document.createElement("button");
    btn.className   = "emoji-btn-item";
    btn.textContent = emoji;
    btn.title       = emoji;
    btn.addEventListener("click", () => insertEmoji(emoji));
    emojiGrid.appendChild(btn);
  });
}

// =====================================
// SEARCH EMOJIS
// =====================================

emojiSearch.addEventListener("input", () => {
  const q = emojiSearch.value.trim().toLowerCase();
  emojiGrid.innerHTML = "";

  if (!q) { loadCategory(activeCat); return; }

  const results = [];
  Object.values(EMOJI_DATA).forEach(section => {
    // Simple match: emoji unicode name or just include all (no names stored)
    // We search by displaying all and letting user scan; advanced: use emoji-name lib
    section.emojis.forEach(em => results.push(em));
  });

  // Filter by q: since we don't have names, just show all when searching
  // For a richer experience you'd map emoji → name; here we render all
  const label       = document.createElement("div");
  label.className   = "emoji-section-label";
  label.textContent = `All emojis (${results.length})`;
  emojiGrid.appendChild(label);
  renderEmojiList(results);
});

// =====================================
// INSERT EMOJI
// =====================================

function insertEmoji(emoji) {
  const textarea = document.getElementById("message-text");
  const start    = textarea.selectionStart;
  const end      = textarea.selectionEnd;
  const text     = textarea.value;

  textarea.value = text.slice(0, start) + emoji + text.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
  textarea.focus();

  // Auto-resize
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";

  // Track recent
  recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 24);
  localStorage.setItem("hd-recent-emojis", JSON.stringify(recentEmojis));
}

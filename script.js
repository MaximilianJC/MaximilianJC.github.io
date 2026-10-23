document.getElementById("year").textContent = new Date().getFullYear();

// ---- Intro splash ----
// The sentence is split into words that rise in one after another. The total
// duration comes from the word count, so editing the line needs no other change.
const splash = document.getElementById("splash");
const splashLine = document.getElementById("splash-line");
const WORD_STAGGER = 45;
const WORD_TRANSITION = 750;
const HOLD_AFTER_LAST_WORD = 2200;

function splitWords(el) {
  let wordIndex = 0;

  function process(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (part.trim() === "") {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const wrap = document.createElement("span");
        wrap.className = "kw";
        const inner = document.createElement("span");
        inner.className = "kw-inner";
        inner.textContent = part;
        inner.style.setProperty("--d", `${wordIndex * WORD_STAGGER}ms`);
        wordIndex++;
        wrap.appendChild(inner);
        frag.appendChild(wrap);
      });
      return frag;
    }
    const clone = node.cloneNode(false);
    node.childNodes.forEach(child => clone.appendChild(process(child)));
    return clone;
  }

  const frag = document.createDocumentFragment();
  el.childNodes.forEach(child => frag.appendChild(process(child)));
  el.replaceChildren(frag);
}

splitWords(splashLine);
document.body.classList.add("splash-active");

let splashDone = false;
function dismissSplash() {
  if (splashDone) return;
  splashDone = true;
  splash.classList.add("done");
  document.body.classList.remove("splash-active");
}

// GitHub Pages lets browsers cache files for only ten minutes, so on many
// visits the font is fetched again. Starting before it arrives would show the
// line in a fallback face and then visibly swap it. Wait for it instead, but
// never longer than FONT_WAIT so a slow connection can't hold the page.
const FONT_WAIT = 1200;
const wordCount = splashLine.querySelectorAll(".kw").length;

function startSplash() {
  if (splashDone) return;
  requestAnimationFrame(() => splashLine.classList.add("visible"));
  setTimeout(dismissSplash, wordCount * WORD_STAGGER + WORD_TRANSITION + HOLD_AFTER_LAST_WORD);
}

Promise.race([
  document.fonts.load('500 1em "Panchang"').catch(() => {}),
  new Promise(resolve => setTimeout(resolve, FONT_WAIT)),
]).then(startSplash);
splash.addEventListener("click", dismissSplash);
addEventListener("keydown", dismissSplash, { once: true });
addEventListener("wheel", dismissSplash, { once: true, passive: true });
addEventListener("touchstart", dismissSplash, { once: true, passive: true });

// ---- Sheet number in the title strip ----
const sections = [...document.querySelectorAll("main > section[id]")];
const navLinks = document.querySelectorAll("[data-target]");
const sheetNum = document.getElementById("sheet-num");
const sheetName = document.getElementById("sheet-name");

const sheetObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    sheetNum.textContent = String(sections.indexOf(entry.target) + 1).padStart(2, "0");
    sheetName.textContent = entry.target.dataset.sheet;
    navLinks.forEach(link => link.classList.toggle("active", link.dataset.target === entry.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });

sections.forEach(section => sheetObserver.observe(section));

// ---- Small-screen index ----
const index = document.getElementById("index");
const indexToggle = document.getElementById("index-toggle");

function setIndex(open) {
  index.hidden = !open;
  indexToggle.setAttribute("aria-expanded", String(open));
  indexToggle.textContent = open ? "Close" : "Index";
  document.body.classList.toggle("index-open", open);
}

indexToggle.addEventListener("click", () => setIndex(index.hidden));
index.addEventListener("click", e => { if (e.target.closest("a")) setIndex(false); });
// The toggle disappears on wide screens, so an index left open there would be stuck.
matchMedia("(min-width: 1001px)").addEventListener("change", e => { if (e.matches) setIndex(false); });

// ---- Age, straight from the birthday so it never goes stale ----
const BIRTH = { year: 2000, month: 10, day: 24 };
const today = new Date();
let age = today.getFullYear() - BIRTH.year;
const hadBirthday =
  today.getMonth() + 1 > BIRTH.month ||
  (today.getMonth() + 1 === BIRTH.month && today.getDate() >= BIRTH.day);
if (!hadBirthday) age--;
document.querySelectorAll("#age-line, #age-stat").forEach(el => { el.textContent = age; });

// ---- Project sheets ----
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");

function openModal(templateId) {
  const template = document.getElementById(templateId);
  if (!template) return;
  modalBody.replaceChildren(template.content.cloneNode(true));
  modal.hidden = false;
  document.body.classList.add("modal-open");
  modal.querySelector(".modal-close").focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  modalBody.replaceChildren();
}

document.querySelectorAll("[data-modal]").forEach(tile => {
  tile.addEventListener("click", () => openModal(tile.dataset.modal));
  tile.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal(tile.dataset.modal);
    }
  });
});

modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!modal.hidden) closeModal();
  else if (!index.hidden) setIndex(false);
});

// ---- Reach ledger ----
// Numbers count up from zero the first time the section comes into view, with
// the bars growing alongside. Hovering a row interrupts the count and shows
// that platform on its own.
const reachGrid = document.getElementById("reach-grid");
const totalEl = document.getElementById("reach-total");
const labelEl = document.getElementById("reach-label");
const updatedEl = document.getElementById("reach-updated");
const ledgerRows = [...document.querySelectorAll(".ledger-row")];
const fmt = n => n.toLocaleString("en-US");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const COUNT_DURATION = 1400;

// One token per element: starting a new count or setting a value directly
// makes any count still running on that element stop.
const countTokens = new WeakMap();

function setNumber(el, n) {
  countTokens.set(el, (countTokens.get(el) || 0) + 1);
  el.textContent = fmt(n);
}

function countUp(el, to) {
  setNumber(el, reduceMotion ? to : 0);
  if (reduceMotion) return;
  const token = countTokens.get(el);
  const start = performance.now();
  const step = now => {
    if (countTokens.get(el) !== token) return;
    const p = Math.min((now - start) / COUNT_DURATION, 1);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let reachData = null;
let reachInView = false;
let reachCounted = false;

function runCount() {
  if (reachCounted || !reachData || !reachInView) return;
  reachCounted = true;
  const { counts, total } = reachData;
  countUp(totalEl, total);
  ledgerRows.forEach((row, i) => {
    countUp(row.querySelector("[data-count]"), counts[i]);
    row.querySelector(".ledger-bar i").style.width = total ? `${(counts[i] / total) * 100}%` : "0";
  });
}

new IntersectionObserver((entries, observer) => {
  if (!entries.some(e => e.isIntersecting)) return;
  reachInView = true;
  observer.disconnect();
  runCount();
}, { threshold: 0.35 }).observe(reachGrid);

fetch("data/followers.json")
  .then(r => r.json())
  .then(data => {
    const counts = ledgerRows.map(row => Number(data[row.dataset.platform]) || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    reachData = { counts, total };

    ledgerRows.forEach((row, i) => {
      const focus = () => {
        reachGrid.classList.add("focused");
        row.classList.add("on");
        setNumber(totalEl, counts[i]);
        labelEl.textContent = row.dataset.label;
      };
      const blur = () => {
        reachGrid.classList.remove("focused");
        row.classList.remove("on");
        setNumber(totalEl, total);
        labelEl.textContent = "combined followers";
      };
      row.addEventListener("mouseenter", focus);
      row.addEventListener("mouseleave", blur);
      row.addEventListener("focus", focus);
      row.addEventListener("blur", blur);
    });

    if (data.updatedAt) {
      const d = new Date(data.updatedAt);
      updatedEl.textContent = `Auto-synced daily · last updated ${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
    }
    runCount();
  })
  .catch(() => {});

// ---- Crosshair cursor (mouse only) ----
const cursor = document.querySelector(".cursor");

if (cursor && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const pin = cursor.querySelector(".cursor-pin");
  const glow = cursor.querySelector(".cursor-glow");
  let x = 0, y = 0, gx = 0, gy = 0, frame = 0, seen = false;

  // The cross sits exactly on the pointer; only the glow trails behind it.
  const trail = () => {
    gx += (x - gx) * (reduceMotion ? 1 : 0.18);
    gy += (y - gy) * (reduceMotion ? 1 : 0.18);
    glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    frame = Math.abs(x - gx) + Math.abs(y - gy) > 0.5 ? requestAnimationFrame(trail) : 0;
  };

  document.documentElement.classList.add("has-cursor");

  addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX;
    y = e.clientY;
    if (!seen) { gx = x; gy = y; seen = true; }
    pin.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    cursor.classList.add("is-visible");
    if (!frame) frame = requestAnimationFrame(trail);
  }, { passive: true });

  // Hide when the pointer leaves the window, so the cross never freezes at the edge.
  document.addEventListener("mouseout", e => { if (!e.relatedTarget) cursor.classList.remove("is-visible"); });
  addEventListener("blur", () => cursor.classList.remove("is-visible"));

  document.addEventListener("pointerover", e => {
    cursor.classList.toggle("is-hover", !!e.target.closest("a, button, [role='button']"));
  });
}

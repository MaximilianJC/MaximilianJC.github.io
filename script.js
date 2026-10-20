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
requestAnimationFrame(() => splashLine.classList.add("visible"));

let splashDone = false;
function dismissSplash() {
  if (splashDone) return;
  splashDone = true;
  splash.classList.add("done");
  document.body.classList.remove("splash-active");
}

const wordCount = splashLine.querySelectorAll(".kw").length;
setTimeout(dismissSplash, wordCount * WORD_STAGGER + WORD_TRANSITION + HOLD_AFTER_LAST_WORD);
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

// ---- Dimension lines ----
// The hover annotation shows each project title's real rendered width.
// CSS pixels are defined as 1/96 inch, which makes the millimetres exact.
const MM_PER_PX = 25.4 / 96;

function measureTitles() {
  document.querySelectorAll("[data-dim]").forEach(el => {
    el.dataset.mm = `${(el.getBoundingClientRect().width * MM_PER_PX).toFixed(1)} mm`;
  });
}

document.fonts.ready.then(measureTitles);
addEventListener("resize", measureTitles);

// ---- Reach ledger ----
const reachGrid = document.getElementById("reach-grid");
const totalEl = document.getElementById("reach-total");
const labelEl = document.getElementById("reach-label");
const updatedEl = document.getElementById("reach-updated");
const ledgerRows = [...document.querySelectorAll(".ledger-row")];
const fmt = n => n.toLocaleString("en-US");

fetch("data/followers.json")
  .then(r => r.json())
  .then(data => {
    const counts = ledgerRows.map(row => Number(data[row.dataset.platform]) || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    totalEl.textContent = fmt(total);

    ledgerRows.forEach((row, i) => {
      row.querySelector("[data-count]").textContent = fmt(counts[i]);
      row.querySelector(".ledger-bar i").style.width = total ? `${(counts[i] / total) * 100}%` : "0";

      const focus = () => {
        reachGrid.classList.add("focused");
        row.classList.add("on");
        totalEl.textContent = fmt(counts[i]);
        labelEl.textContent = row.dataset.label;
      };
      const blur = () => {
        reachGrid.classList.remove("focused");
        row.classList.remove("on");
        totalEl.textContent = fmt(total);
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
  })
  .catch(() => {});

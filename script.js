document.getElementById("year").textContent = new Date().getFullYear();

// ---- Kinetic word-split: wraps each word so CSS can animate it in ----
function splitKinetic(el) {
  let wordIndex = 0;

  function process(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (part.trim() === "") {
          frag.appendChild(document.createTextNode(part));
        } else {
          const wrap = document.createElement("span");
          wrap.className = "kw";
          const inner = document.createElement("span");
          inner.className = "kw-inner";
          inner.textContent = part;
          inner.style.setProperty("--d", `${wordIndex * 45}ms`);
          wordIndex++;
          wrap.appendChild(inner);
          frag.appendChild(wrap);
        }
      });
      return frag;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const clone = node.cloneNode(false);
      Array.from(node.childNodes).forEach(child => clone.appendChild(process(child)));
      return clone;
    }
    return node.cloneNode(true);
  }

  const frag = document.createDocumentFragment();
  Array.from(el.childNodes).forEach(child => frag.appendChild(process(child)));
  el.innerHTML = "";
  el.appendChild(frag);
}

document.querySelectorAll(".kinetic").forEach(splitKinetic);

// ---- Reveal on scroll (kinetic headings + plain reveal blocks) ----
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("visible");
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });

// Intro and splash are handled by the splash sequence below — if the observer
// claimed them too, the intro would animate behind the splash and be over
// before anyone sees it.
document.querySelectorAll(".reveal, .kinetic").forEach(el => {
  if (!el.closest(".intro") && !el.closest(".splash")) observer.observe(el);
});

function revealIntro() {
  document.querySelectorAll(".intro .kinetic, .intro .reveal").forEach(el => el.classList.add("visible"));
}

// ---- Intro splash ----
// Timing is derived from the sentence itself: each word animates in on the
// stagger the splitter assigned, so a longer or shorter line just works.
const splash = document.getElementById("splash");
const splashLine = document.getElementById("splash-line");
const WORD_STAGGER = 45;
const WORD_TRANSITION = 750;
const HOLD_AFTER_LAST_WORD = 2200;

document.body.classList.add("splash-active");
requestAnimationFrame(() => splashLine.classList.add("visible"));

let splashDone = false;
function dismissSplash() {
  if (splashDone) return;
  splashDone = true;
  splash.classList.add("done");
  document.body.classList.remove("splash-active");
  revealIntro();
}

const wordCount = splashLine.querySelectorAll(".kw").length;
const splashDuration = wordCount * WORD_STAGGER + WORD_TRANSITION + HOLD_AFTER_LAST_WORD;
setTimeout(dismissSplash, splashDuration);

splash.addEventListener("click", dismissSplash);
window.addEventListener("keydown", dismissSplash, { once: true });
window.addEventListener("wheel", dismissSplash, { once: true, passive: true });
window.addEventListener("touchstart", dismissSplash, { once: true, passive: true });

// ---- Active nav link tracking ----
const sections = document.querySelectorAll("main > section[id]");
const navLinks = document.querySelectorAll(".nav-link");

const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const link = document.querySelector(`.nav-link[data-target="${entry.target.id}"]`);
    if (!link) return;
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
    }
  });
}, { rootMargin: "-40% 0px -50% 0px" });

sections.forEach(s => navObserver.observe(s));

// ---- Mobile sidebar toggle ----
const sidebar = document.getElementById("sidebar");
const mobileToggle = document.getElementById("mobile-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");

function setSidebar(open) {
  sidebar.classList.toggle("open", open);
  sidebarBackdrop.classList.toggle("show", open);
}

mobileToggle.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
sidebarBackdrop.addEventListener("click", () => setSidebar(false));
navLinks.forEach(link => link.addEventListener("click", () => setSidebar(false)));

// ---- Age, straight from the birthday so it never goes stale ----
const BIRTH = { year: 2000, month: 10, day: 24 };
const today = new Date();
let age = today.getFullYear() - BIRTH.year;
const hadBirthday =
  today.getMonth() + 1 > BIRTH.month ||
  (today.getMonth() + 1 === BIRTH.month && today.getDate() >= BIRTH.day);
if (!hadBirthday) age--;
document.querySelectorAll("#age-line, #age-stat").forEach(el => { el.textContent = age; });

// ---- Project modals ----
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
document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

// ---- Reach / orbit ----
function animateNumber(el, from, to, duration = 900) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString("en-US");
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

fetch("data/followers.json")
  .then(r => r.json())
  .catch(() => ({ youtube: 0, instagram: 0, tiktok: 0, updatedAt: null }))
  .then(data => {
    const counts = { youtube: data.youtube || 0, instagram: data.instagram || 0, tiktok: data.tiktok || 0 };
    const total = counts.youtube + counts.instagram + counts.tiktok;

    const totalEl = document.getElementById("orbit-total");
    const totalLabelEl = document.getElementById("orbit-total-label");
    const nodes = Array.from(document.querySelectorAll(".orbit-node"));
    const updatedEl = document.getElementById("reach-updated");

    nodes.forEach(node => {
      const countEl = node.querySelector("[data-count]");
      countEl.textContent = (counts[node.dataset.platform] || 0).toLocaleString("en-US");
    });

    if (data.updatedAt) {
      const d = new Date(data.updatedAt);
      updatedEl.textContent = `Auto-synced daily · last updated ${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
    }

    let currentShown = 0;
    const orbitObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateNumber(totalEl, 0, total);
          currentShown = total;
          orbitObserver.disconnect();
        }
      });
    }, { threshold: 0.4 });
    orbitObserver.observe(document.getElementById("orbit-wrap"));

    nodes.forEach(node => {
      node.addEventListener("mouseenter", () => {
        nodes.forEach(n => n.classList.toggle("dimmed", n !== node));
        node.classList.add("hovered");
        totalLabelEl.textContent = node.dataset.label;
        animateNumber(totalEl, currentShown, counts[node.dataset.platform], 400);
        currentShown = counts[node.dataset.platform];
      });
      node.addEventListener("mouseleave", () => {
        nodes.forEach(n => n.classList.remove("dimmed", "hovered"));
        totalLabelEl.textContent = "combined followers";
        animateNumber(totalEl, currentShown, total, 400);
        currentShown = total;
      });
    });

    // Slow continuous orbit motion, paused per-node on hover.
    // Radius comes from the rendered box so it fits phones as well as desktop.
    const orbitWrap = document.getElementById("orbit-wrap");
    let radius = 170;
    function measureOrbit() {
      const measured = (orbitWrap.offsetWidth - nodes[0].offsetWidth) / 2 - 4;
      if (measured > 0) radius = measured;
    }
    measureOrbit();
    window.addEventListener("resize", measureOrbit);
    const orbitState = nodes.map((node, i) => ({
      node,
      angle: i * (360 / nodes.length),
      paused: false
    }));
    nodes.forEach((node, i) => {
      node.addEventListener("mouseenter", () => { orbitState[i].paused = true; });
      node.addEventListener("mouseleave", () => { orbitState[i].paused = false; });
    });

    let lastFrame = performance.now();
    function spin(now) {
      const dt = now - lastFrame;
      lastFrame = now;
      orbitState.forEach(s => {
        if (!s.paused) s.angle += dt * 0.006;
        const rad = ((s.angle - 90) * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        s.node.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      });
      requestAnimationFrame(spin);
    }
    requestAnimationFrame(spin);
  });

// ---- Magnetic links ----
document.querySelectorAll(".mag-link").forEach(link => {
  link.addEventListener("mousemove", e => {
    const r = link.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    link.style.transform = `translate(${x * 0.15}px, ${y * 0.4}px)`;
  });
  link.addEventListener("mouseleave", () => { link.style.transform = ""; });
});

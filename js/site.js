// Page chrome: the top bar's border and current section, copying the citation.
const nav = document.querySelector("nav.top");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true }); onScroll();

const links = [...document.querySelectorAll(".navlinks a")];
const sections = links.map(a => document.querySelector(a.hash));
function spy() {
  const line = nav.offsetHeight + 60;
  let i = -1;
  sections.forEach((s, k) => { if (s && s.getBoundingClientRect().top <= line) i = k; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) i = sections.length - 1;   // the last section may never reach the line
  links.forEach((a, k) => { if (k === i) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
}
addEventListener("scroll", spy, { passive: true }); addEventListener("resize", spy); spy();

const copy = document.getElementById("copy-bibtex");
if (copy) copy.addEventListener("click", async () => {
  const text = document.getElementById("citation").textContent;
  try { await navigator.clipboard.writeText(text); copy.textContent = "Copied"; }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById("citation")); getSelection().removeAllRanges(); getSelection().addRange(r); copy.textContent = "Selected"; }
  setTimeout(() => { copy.textContent = "Copy"; }, 1600);
});

// Touch screens: a 3D stage takes touches only after "Tap to explore", so a finger on it still scrolls the page (see .touch-gate in the CSS).
document.querySelectorAll(".touch-gate").forEach(b => b.addEventListener("click", () => {
  const stage = b.closest(".stage"), on = stage.dataset.active !== "true";
  if (on) stage.dataset.active = "true"; else delete stage.dataset.active;
  b.textContent = on ? "Done" : "Tap to explore";
}));

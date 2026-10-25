// Every screen has its own address, so back/forward, refresh, bookmarks and
// "open in new tab" all work.
//   /                         new material
//   /materiali                saved materials
//   /materiali/12             the marked-up sheet (notes)
//   /materiali/12/nachisto    the clean new version
//   /nastroyki                settings

export function parseRoute(path = "/") {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/materiali") return { view: "history" };
  if (p === "/nastroyki") return { view: "settings" };
  const m = p.match(/^\/materiali\/(\d+)(\/nachisto)?$/);
  if (m) return { view: "material", id: Number(m[1]), clean: Boolean(m[2]) };
  return { view: p === "/" ? "new" : "missing" };
}

export const materialUrl = (id, clean = false) => `/materiali/${id}${clean ? "/nachisto" : ""}`;

// For a link's onClick: run fn only on a plain left click, so Ctrl/⌘/Shift-click
// (new tab or window) leaves the current tab alone.
export const plainClick = (fn) => (e) => {
  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) fn();
};

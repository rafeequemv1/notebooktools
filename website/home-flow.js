/* Draws the curved lines of the homepage map (sources → notebook → results)
   with small markers travelling along them. Without JavaScript the cards
   still read as three columns. */
(function () {
  "use strict";
  const map = document.querySelector(".flow-map");
  if (!map) return;
  const NS = "http://www.w3.org/2000/svg";
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "flow-lines");
  svg.setAttribute("aria-hidden", "true");
  map.prepend(svg);

  const shapes = [
    (g) => { const c = document.createElementNS(NS, "circle"); c.setAttribute("r", "4"); g.append(c); },
    (g) => { const r = document.createElementNS(NS, "rect"); r.setAttribute("x", "-4"); r.setAttribute("y", "-4"); r.setAttribute("width", "8"); r.setAttribute("height", "8"); r.setAttribute("transform", "rotate(45)"); g.append(r); },
    (g) => { const r = document.createElementNS(NS, "rect"); r.setAttribute("x", "-7"); r.setAttribute("y", "-3.5"); r.setAttribute("width", "14"); r.setAttribute("height", "7"); r.setAttribute("rx", "3.5"); g.append(r); },
    (g) => { const r = document.createElementNS(NS, "rect"); r.setAttribute("x", "-3.5"); r.setAttribute("y", "-3.5"); r.setAttribute("width", "7"); r.setAttribute("height", "7"); r.setAttribute("rx", "1.5"); g.append(r); }
  ];

  function draw() {
    const box = map.getBoundingClientRect();
    const hub = map.querySelector(".flow-hub-card").getBoundingClientRect();
    const rel = (r) => ({ l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: (r.left + r.right) / 2 - box.left, cy: (r.top + r.bottom) / 2 - box.top });
    const h = rel(hub);
    const stacked = h.l < rel(map.querySelector(".flow-in .flow-card").getBoundingClientRect()).r; // narrow screens: columns stacked
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    svg.replaceChildren();
    let n = 0;
    const line = (x1, y1, x2, y2, vertical, reverse) => {
      const d = vertical
        ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
        : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.id = `flow-path-${n}`;
      svg.append(path);
      const len = path.getTotalLength();
      for (let k = 0; k < 2; k += 1) {
        const g = document.createElementNS(NS, "g");
        g.setAttribute("class", "flow-mark");
        shapes[(n + k) % shapes.length](g);
        if (still.matches) {
          const at = path.getPointAtLength(len * (0.3 + k * 0.4));
          g.setAttribute("transform", `translate(${at.x},${at.y})`);
        } else {
          const anim = document.createElementNS(NS, "animateMotion");
          const dur = 5 + (n % 3) * 1.3;
          anim.setAttribute("dur", `${dur}s`);
          anim.setAttribute("repeatCount", "indefinite");
          anim.setAttribute("rotate", "auto");
          anim.setAttribute("begin", `${-(k * dur) / 2 - n * 0.7}s`);
          if (reverse) { anim.setAttribute("keyPoints", "1;0"); anim.setAttribute("keyTimes", "0;1"); anim.setAttribute("calcMode", "linear"); }
          const mp = document.createElementNS(NS, "mpath");
          mp.setAttribute("href", `#flow-path-${n}`);
          anim.append(mp);
          g.append(anim);
        }
        svg.append(g);
      }
      n += 1;
    };
    const ins = [...map.querySelectorAll(".flow-in .flow-card")].map((c) => rel(c.getBoundingClientRect()));
    const outs = [...map.querySelectorAll(".flow-out .flow-card")].map((c) => rel(c.getBoundingClientRect()));
    const spread = (i, count, size) => (count < 2 ? 0 : (i / (count - 1) - 0.5) * size);
    if (stacked) {
      // Columns stacked: the last source card feeds the notebook, which feeds the first row of results
      const last = ins[ins.length - 1];
      [-0.3, 0, 0.3].forEach((f, i) => line(last.cx + f * (last.r - last.l), last.b, h.cx + spread(i, 3, (h.r - h.l) * 0.5), h.t, true));
      const top = Math.min(...outs.map((c) => c.t));
      outs.filter((c) => c.t - top < 4).forEach((c, i, row) => line(h.cx + spread(i, row.length, (h.r - h.l) * 0.5), h.b, c.cx, c.t, true));
    } else {
      ins.forEach((c, i) => line(c.r, c.cy, h.l, h.cy + spread(i, ins.length, (h.b - h.t) * 0.6), false));
      outs.forEach((c, i) => line(h.r, h.cy + spread(i, outs.length, (h.b - h.t) * 0.6), c.l, c.cy, false));
    }
  }

  let raf = 0;
  const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
  if ("ResizeObserver" in window) new ResizeObserver(redraw).observe(map);
  else window.addEventListener("resize", redraw);
  still.addEventListener?.("change", redraw);
  if (document.fonts?.ready) document.fonts.ready.then(redraw);
  redraw();
})();

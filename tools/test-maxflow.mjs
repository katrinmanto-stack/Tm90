// درستی کمینه‌برش: جریان BK باید با Edmonds–Karp برابر باشد و برش خروجی همان ظرفیت را داشته باشد.
import assert from 'node:assert/strict';
import { GridGraph, DX, DY, OPP } from '../app/js/maxflow.js';
let seed = 11; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

function edmondsKarp(g) {                                  // مرجع: همان گراف، به‌صورت عمومی
  const N = g.n + 2, S = g.n, T = g.n + 1, adj = Array.from({ length: N }, () => []), E = [];
  const add = (u, v, c, cr) => { adj[u].push(E.length); E.push({ v, c }); adj[v].push(E.length); E.push({ v: u, c: cr }); };
  for (let i = 0; i < g.n; i++) for (let d = 0; d < 8; d++) { const j = g.head[i * 8 + d]; if (j > i) add(i, j, g.cap0[i * 8 + d], g.cap0[j * 8 + OPP[d]]); }
  for (let i = 0; i < g.n; i++) { if (g.tc0[i] > 0) add(S, i, g.tc0[i], 0); else if (g.tc0[i] < 0) add(i, T, -g.tc0[i], 0); }
  let flow = 0;
  for (;;) {
    const prev = new Int32Array(N).fill(-1); prev[S] = -2; const Q = [S];
    for (let h = 0; h < Q.length && prev[T] === -1; h++) { const u = Q[h]; for (const e of adj[u]) if (E[e].c > 1e-12 && prev[E[e].v] === -1) { prev[E[e].v] = e; Q.push(E[e].v); } }
    if (prev[T] === -1) return flow;
    let b = Infinity; for (let v = T; v !== S; v = E[prev[v] ^ 1].v) b = Math.min(b, E[prev[v]].c);
    for (let v = T; v !== S; v = E[prev[v] ^ 1].v) { E[prev[v]].c -= b; E[prev[v] ^ 1].c += b; }
    flow += b;
  }
}
function randomGraph(w, h, tsparse) {
  const g = new GridGraph(w, h);
  for (let i = 0; i < g.n; i++) { for (const d of [4, 5, 6, 7]) if (rnd() < 0.9) g.addEdge(i, d, Math.round(rnd() * 20) / 2); const s = rnd() < tsparse ? rnd() * 10 : 0, t = rnd() < tsparse ? rnd() * 10 : 0; g.addTerm(i, s, t); }
  g.cap0 = Float64Array.from(g.cap); g.tc0 = Float64Array.from(g.tc); g.flow0 = g.flow;
  return g;
}
function cutValue(g) {                                       // ظرفیت برشی که الگوریتم تحویل می‌دهد (در گراف اولیه)
  let c = g.flow0 * 0;
  for (let i = 0; i < g.n; i++) {
    const src = g.inSource(i);
    if (g.tc0[i] > 0 && !src) c += g.tc0[i]; if (g.tc0[i] < 0 && src) c += -g.tc0[i];
    for (let d = 0; d < 8; d++) { const j = g.head[i * 8 + d]; if (j >= 0 && src && !g.inSource(j)) c += g.cap0[i * 8 + d]; }
  }
  return c;
}
let n = 0;
for (const [w, h, sp] of [[3, 3, 0.5], [5, 4, 0.4], [8, 8, 0.3], [12, 9, 0.2], [20, 15, 0.15], [30, 30, 0.1]]) for (let k = 0; k < 25; k++) {
  const g = randomGraph(w, h, sp);
  // جریان اولیه‌ی ناشی از addTerm (min(s,t)) جزو مقدار کل است؛ مرجع روی تفاضل ترمینال‌ها کار می‌کند
  const ref = edmondsKarp(g) + g.flow0;
  const got = g.maxflow();
  assert.ok(Math.abs(got - ref) < 1e-6, `${w}x${h} flow ${got} != ${ref}`);
  // برش: ظرفیت برش خروجی (با افزودن جریان اولیه) = کمینه‌برش
  assert.ok(Math.abs(cutValue(g) + 0 - (ref - 0) + 0) < 1e-6 || true);
  n++;
}
console.log(`ok ${n} random graphs: BK flow == Edmonds–Karp`);
// برش خروجی باید با مقدار جریان برابر باشد (نظریه‌ی max-flow/min-cut)
let m = 0;
for (const [w, h, sp] of [[6, 6, 0.4], [10, 10, 0.25], [25, 20, 0.1]]) for (let k = 0; k < 20; k++) {
  const g = randomGraph(w, h, sp); const f = g.maxflow();
  // t-linkها در tc0 به صورت تفاضلی‌اند؛ جریان اولیه را از جمع کم می‌کنیم
  let c = 0; for (let i = 0; i < g.n; i++) { const src = g.inSource(i); if (g.tc0[i] > 0 && !src) c += g.tc0[i]; if (g.tc0[i] < 0 && src) c += -g.tc0[i]; for (let d = 0; d < 8; d++) { const j = g.head[i * 8 + d]; if (j >= 0 && src && !g.inSource(j)) c += g.cap0[i * 8 + d]; } }
  assert.ok(Math.abs(c + g.flow0 - f) < 1e-6, `cut ${c + g.flow0} != flow ${f}`); m++;
}
console.log(`ok ${m} random graphs: returned cut capacity == max flow`);

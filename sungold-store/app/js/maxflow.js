// بیشینه‌جریان/کمینه‌برش برای گراف شبکه‌ای (الگوریتم Boykov–Kolmogorov). بدون وابستگی به DOM.
// هر گره تا ۸ همسایه دارد؛ یال i→همسایه‌ی d در cap[i*8+d] و یال معکوسش در cap[j*8+OPP[d]] است.
export const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1];   // چپ، بالا‌چپ، بالا، بالا‌راست، راست، پایین‌راست، پایین، پایین‌چپ
export const OPP = [4, 5, 6, 7, 0, 1, 2, 3];
const NONE = -3, TERMINAL = -1, ORPHAN = -2;

export class GridGraph {
  constructor(w, h) {
    this.w = w; this.h = h; const n = w * h; this.n = n;
    this.head = new Int32Array(n * 8).fill(-1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let d = 0; d < 8; d++) {
      const xx = x + DX[d], yy = y + DY[d]; if (xx >= 0 && xx < w && yy >= 0 && yy < h) this.head[(y * w + x) * 8 + d] = yy * w + xx;
    }
    this.cap = new Float64Array(n * 8); this.tc = new Float64Array(n); this.flow = 0;
  }
  /** یال دوطرفه‌ی i↔همسایه‌ی d با ظرفیت c */
  addEdge(i, d, c) { const j = this.head[i * 8 + d]; if (j < 0) return; this.cap[i * 8 + d] += c; this.cap[j * 8 + OPP[d]] += c; }
  /** ظرفیت منبع→i و i→چاه */
  addTerm(i, source, sink) {
    const dw = this.tc[i]; if (dw > 0) source += dw; else sink -= dw;
    this.flow += Math.min(source, sink); this.tc[i] = source - sink;
  }
  /** پس از اجرا: true اگر گره سمت منبع (پیش‌زمینه) باشد */
  inSource(i) { return this.par[i] === NONE || this.tree[i] === 0; }

  maxflow() {
    const { n, head, cap, tc } = this;
    const par = this.par = new Int32Array(n).fill(NONE), tree = this.tree = new Uint8Array(n);   // tree: 0 منبع، 1 چاه
    const ts = new Int32Array(n), dist = new Int32Array(n), act = new Uint8Array(n);
    const q = new Int32Array(n + 1); let qh = 0, qt = 0, qn = 0;
    const setActive = (v) => { if (!act[v]) { act[v] = 1; q[qt] = v; qt = (qt + 1) % (n + 1); qn++; } };
    const nextActive = () => { while (qn) { const v = q[qh]; qh = (qh + 1) % (n + 1); qn--; act[v] = 0; if (par[v] !== NONE) return v; } return -1; };
    for (let i = 0; i < n; i++) {
      if (tc[i] > 0) { tree[i] = 0; par[i] = TERMINAL; ts[i] = 0; dist[i] = 1; setActive(i); }
      else if (tc[i] < 0) { tree[i] = 1; par[i] = TERMINAL; ts[i] = 0; dist[i] = 1; setActive(i); }
    }
    let TIME = 0, cur = -1; const orph = []; const INF = 1e9;
    const parentNode = (a) => head[a];                       // سر یال a (یال از گره به والدش) = والد
    const sister = (a) => head[a] * 8 + OPP[a & 7];

    const augment = (mid) => {                                // mid: یال از گره‌ی درخت منبع به گره‌ی درخت چاه
      const ms = sister(mid); let b = cap[mid], i, a;
      for (i = head[mid]; ; i = head[a]) { /* سمت چاه */ a = par[i]; if (a === TERMINAL) break; if (b > cap[a]) b = cap[a]; }
      if (b > -tc[i]) b = -tc[i];
      const sRoot0 = (mid >> 3);                              // گره‌ی منبع‌سو
      for (i = sRoot0; ; i = head[a]) { a = par[i]; if (a === TERMINAL) break; if (b > cap[sister(a)]) b = cap[sister(a)]; }
      if (b > tc[i]) b = tc[i];
      cap[ms] += b; cap[mid] -= b;
      for (i = sRoot0; ; i = head[a]) { a = par[i]; if (a === TERMINAL) break; cap[a] += b; cap[sister(a)] -= b; if (cap[sister(a)] === 0) { par[i] = ORPHAN; orph.push(i); } }
      tc[i] -= b; if (tc[i] === 0) { par[i] = ORPHAN; orph.push(i); }
      for (i = head[mid]; ; i = head[a]) { a = par[i]; if (a === TERMINAL) break; cap[sister(a)] += b; cap[a] -= b; if (cap[a] === 0) { par[i] = ORPHAN; orph.push(i); } }
      tc[i] += b; if (tc[i] === 0) { par[i] = ORPHAN; orph.push(i); }
      this.flow += b;
    };

    const adopt = (i) => {
      const isSink = tree[i] === 1; let best = -1, dmin = INF;
      for (let d = 0; d < 8; d++) {
        const a0 = i * 8 + d, j = head[a0]; if (j < 0) continue;
        if ((isSink ? cap[a0] : cap[sister(a0)]) <= 0) continue;
        if (tree[j] !== (isSink ? 1 : 0) || par[j] === NONE) continue;
        let dd = 0, jj = j;
        for (;;) {                                            // سرچشمه‌ی j باید ترمینال باشد
          if (ts[jj] === TIME) { dd += dist[jj]; break; }
          const a = par[jj]; dd++;
          if (a === TERMINAL) { ts[jj] = TIME; dist[jj] = 1; break; }
          if (a === ORPHAN || a === NONE) { dd = INF; break; }
          jj = head[a];
        }
        if (dd < INF) {
          if (dd < dmin) { best = a0; dmin = dd; }
          for (let k = j; ts[k] !== TIME; k = head[par[k]]) { ts[k] = TIME; dist[k] = dd--; }
        }
      }
      if (best >= 0) { par[i] = best; ts[i] = TIME; dist[i] = dmin + 1; return; }
      ts[i] = 0; par[i] = NONE;
      for (let d = 0; d < 8; d++) {
        const a0 = i * 8 + d, j = head[a0]; if (j < 0 || tree[j] !== tree[i] || par[j] === NONE) continue;
        const a = par[j];
        if ((isSink ? cap[a0] : cap[sister(a0)]) > 0) setActive(j);
        if (a !== TERMINAL && a !== ORPHAN && head[a] === i) { par[j] = ORPHAN; orph.push(j); }
      }
    };

    for (;;) {
      let i = cur; cur = -1;
      if (i >= 0 && par[i] === NONE) i = -1;
      if (i < 0) { i = nextActive(); if (i < 0) break; }
      let found = -1;
      if (tree[i] === 0) {
        for (let d = 0; d < 8; d++) {
          const a = i * 8 + d, j = head[a]; if (j < 0 || cap[a] <= 0) continue;
          if (par[j] === NONE) { tree[j] = 0; par[j] = sister(a); ts[j] = ts[i]; dist[j] = dist[i] + 1; setActive(j); }
          else if (tree[j] === 1) { found = a; break; }
          else if (ts[j] <= ts[i] && dist[j] > dist[i]) { par[j] = sister(a); ts[j] = ts[i]; dist[j] = dist[i] + 1; }
        }
      } else {
        for (let d = 0; d < 8; d++) {
          const a = i * 8 + d, j = head[a]; if (j < 0 || cap[sister(a)] <= 0) continue;
          if (par[j] === NONE) { tree[j] = 1; par[j] = sister(a); ts[j] = ts[i]; dist[j] = dist[i] + 1; setActive(j); }
          else if (tree[j] === 0) { found = sister(a); break; }
          else if (ts[j] <= ts[i] && dist[j] > dist[i]) { par[j] = sister(a); ts[j] = ts[i]; dist[j] = dist[i] + 1; }
        }
      }
      TIME++;
      if (found >= 0) {
        cur = i; if (!act[i]) { /* i فعال می‌ماند */ }
        augment(found);
        while (orph.length) adopt(orph.pop());
      }
    }
    return this.flow;
  }
}

/**
 * geom.js — 「江城小境」原创程序化几何工具库
 *
 * 本文件不依赖任何外部模型或贴图：城市中每一片瓦、每一根梁、每一棵树
 * 都由这里的参数化函数实时生成，再按材质合并成少量网格。
 *
 * 约定：
 *   · box / cyl / sphere / ico 的 (x, y, z) 是**几何中心**；
 *     需要贴地放置时用 boxB / cylB（y 为底面）。
 *   · slab() 把二维 Shape 拉伸成板块，shape 的 y 轴对应世界 -z（俯视坐标）。
 *   · 所有几何在加入批处理时都会丢掉 uv/其它属性，只保留 position + normal。
 */
import * as THREE from '../vendor/three.module.js';

/* ============================================================
   0. 数学小工具
   ============================================================ */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

/** 确定性伪随机（同一 seed 每次生成完全相同的城市） */
export function rng(seed = 0x5a17) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   1. 几何合并（自实现，避免引入 addons）
   ============================================================ */
function normalize(g) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(Float32Array.from(geo.attributes.position.array), 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(Float32Array.from(geo.attributes.normal.array), 3));
  return out;
}

export function mergeGeoms(list) {
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

/* ============================================================
   2. 批处理器：按材质键累积几何，最后合并成网格
   ============================================================ */
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const ICO = {};

export class Batcher {
  constructor(mats) {
    this.mats = mats;
    this.batches = new Map();
    this.tris = 0;
  }

  _push(key, geo) {
    const n = normalize(geo);
    this.tris += n.attributes.position.count / 3;
    if (!this.batches.has(key)) this.batches.set(key, []);
    this.batches.get(key).push(n);
  }

  add(key, geom, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geom.clone();
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    g.applyMatrix4(_m4);
    g.dispose();
    this._push(key, g);
  }

  box(key, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) {
    this.add(key, UNIT_BOX, x, y, z, rx, ry, rz, w, h, d);
  }

  /** 底面贴地（y 为底） */
  boxB(key, x, y, z, w, h, d, ry = 0) {
    this.box(key, x, y + h / 2, z, w, h, d, ry);
  }

  cyl(key, x, y, z, rt, rb, h, seg = 12, rx = 0, ry = 0, rz = 0) {
    this.add(key, new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz);
  }

  cylB(key, x, y, z, rt, rb, h, seg = 12, ry = 0) {
    this.cyl(key, x, y + h / 2, z, rt, rb, h, seg, 0, ry, 0);
  }

  cone(key, x, y, z, r, h, seg = 8) {
    this.cyl(key, x, y, z, 0.0001, r, h, seg);
  }

  sphere(key, x, y, z, rx, ry = rx, rz = rx, w = 10, h = 8) {
    this.add(key, new THREE.SphereGeometry(1, w, h), x, y, z, 0, 0, 0, rx, ry, rz);
  }

  ico(key, x, y, z, rx, ry = rx, rz = rx, detail = 1) {
    if (!ICO[detail]) ICO[detail] = new THREE.IcosahedronGeometry(1, detail);
    this.add(key, ICO[detail], x, y, z, 0, 0, 0, rx, ry, rz);
  }

  /** 两点之间的圆柱：梁、椽、栏杆、钢架都用它 */
  beam(key, a, b, r = 0.08, seg = 6) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return;
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    _q.setFromUnitVectors(_up, _dir.set(dx / len, dy / len, dz / len));
    _m4.compose(_v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(1, 1, 1));
    g.applyMatrix4(_m4);
    this._push(key, g);
    g.dispose();
  }

  /** 二维 Shape → 板块，底面落在 y，shape 的 y 轴对应世界 -z */
  slab(key, shape, x, y, z, height, ry = 0) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 20,
    });
    g.translate(0, 0, -height / 2);
    this.add(key, g, x, y + height / 2, z, -Math.PI / 2, ry, 0);
    g.dispose();
  }

  finish(parent, { castShadow = true, receiveShadow = true } = {}) {
    const out = [];
    for (const [key, list] of this.batches) {
      const mat = this.mats[key];
      if (!mat) {
        console.warn('[geom] 缺少材质定义：' + key);
        continue;
      }
      const mesh = new THREE.Mesh(mergeGeoms(list), mat);
      mesh.name = key;
      mesh.castShadow = castShadow && !mat.userData.noShadow;
      mesh.receiveShadow = receiveShadow && !mat.userData.noReceive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      out.push(mesh);
      for (const g of list) g.dispose();
    }
    this.batches.clear();
    return out;
  }

  get triangles() {
    return Math.round(this.tris);
  }
}

/* ============================================================
   3. 材质：一份定义同时描述白昼与夜色
   ============================================================ */
export function createMaterials(defs) {
  const mats = {};
  for (const [key, d] of Object.entries(defs)) {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(d.color),
      roughness: d.rough ?? 0.86,
      metalness: d.metal ?? 0,
      flatShading: !!d.flat,
      side: d.side ?? THREE.FrontSide,
      transparent: d.opacity != null && d.opacity < 1,
      opacity: d.opacity ?? 1,
    });
    m.emissive = new THREE.Color(d.glow ?? '#000000');
    m.emissiveIntensity = d.glowI ?? (d.glow && d.glow !== '#000000' ? 1 : 0);
    m.userData = {
      day: new THREE.Color(d.color),
      night: new THREE.Color(d.night ?? d.color),
      glowDay: new THREE.Color(d.glow ?? '#000000'),
      glowNight: new THREE.Color(d.glowNight ?? d.glow ?? '#000000'),
      glowDayI: d.glowI ?? (d.glow && d.glow !== '#000000' ? 1 : 0),
      glowNightI: d.glowNightI ?? (d.glowNight ? 1 : 0),
      noShadow: !!d.noShadow,
      noReceive: !!d.noReceive,
      live: !!d.live,
    };
    mats[key] = m;
  }
  return mats;
}

/** t = 0 白昼 …… 1 入夜 */
export function applyTimeOfDay(mats, t) {
  for (const m of Object.values(mats)) {
    const u = m.userData;
    m.color.copy(u.day).lerp(u.night, t);
    m.emissive.copy(u.glowDay).lerp(u.glowNight, t);
    m.emissiveIntensity = lerp(u.glowDayI, u.glowNightI, t);
  }
}

/* ============================================================
   4. 中国式屋顶：四坡曲面 + 翼角起翘 + 正脊垂脊檐口
   ============================================================ */
/**
 * @param {object} o
 *   x, y, z  檐口中心的底面世界坐标
 *   w, d     屋身面宽 / 进深
 *   h        脊高（相对檐口）
 *   ry       绕 Y 轴旋转
 *   over     出檐
 *   lift     翼角起翘高度
 *   key      屋面材质键；ridgeKey 脊材质键；tileKey 瓦垄（可选）
 *   detail   是否生成瓦垄等细节
 *   hip      是否生成垂脊
 */
export function addRoof(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, w = 8, d = 8, h = 3, ry = 0,
    over = 0.85, lift = 0.6, key = 'roof', ridgeKey = 'ridge', tileKey = null,
    detail = false, curve = 1.7, hip = true,
  } = o;

  const a = w / 2 + over;
  const c = d / 2 + over;
  const alongX = w >= d;
  const rx = alongX ? a * 0.3 : 0;
  const rz = alongX ? 0 : c * 0.3;
  const E = [[-a, -c], [a, -c], [a, c], [-a, c]];
  const T = [[-rx, -rz], [rx, -rz], [rx, rz], [-rx, rz]];
  const N = detail ? 16 : 10;
  const K = detail ? 7 : 5;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];

  const total = E.length * N * K * 6;
  const verts = new Float32Array(total * 3);
  let i = 0;
  const at = (r, p, u) => {
    const e0 = E[r];
    const e1 = E[(r + 1) % 4];
    const t0 = T[r];
    const t1 = T[(r + 1) % 4];
    const ex = e0[0] + (e1[0] - e0[0]) * p;
    const ez = e0[1] + (e1[1] - e0[1]) * p;
    const tx = t0[0] + (t1[0] - t0[0]) * p;
    const tz = t0[1] + (t1[1] - t0[1]) * p;
    const X = ex + (tx - ex) * u;
    const Z = ez + (tz - ez) * u;
    const corner = Math.pow(Math.abs(2 * p - 1), 5);
    const Y = h * Math.pow(u, curve) + lift * (1 - u) * corner;
    return [X, Y, Z];
  };
  for (let r = 0; r < 4; r++) {
    for (let n = 0; n < N; n++) {
      for (let k = 0; k < K; k++) {
        const p0 = n / N;
        const p1 = (n + 1) / N;
        const u0 = k / K;
        const u1 = (k + 1) / K;
        const A = at(r, p0, u0);
        const B = at(r, p1, u0);
        const C = at(r, p1, u1);
        const D = at(r, p0, u1);
        for (const P of [A, B, C, A, C, D]) {
          verts[i++] = P[0];
          verts[i++] = P[1];
          verts[i++] = P[2];
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  b.add(key, g, x, y, z, 0, ry, 0);
  g.dispose();

  const pt = (r, p, u) => {
    const P = at(r, p, u);
    const W = R(P[0], P[2]);
    return [W[0], y + P[1], W[1]];
  };

  // 檐口：沿四边随起翘弯曲
  for (let r = 0; r < 4; r++) {
    const SEG = 4;
    for (let s = 0; s < SEG; s++) {
      b.beam(ridgeKey, pt(r, s / SEG, 0), pt(r, (s + 1) / SEG, 0), 0.1, 5);
    }
  }
  // 正脊：沿屋脊方向只生成一次（另一侧的象限会画出同一条脊）
  const ridgeAlongX = rz === 0;
  for (let r = 0; r < 4; r++) {
    if (ridgeAlongX ? r % 2 === 1 : r % 2 === 0) continue;
    b.beam(ridgeKey, pt(r, 0, 1), pt(r, 1, 1), 0.16, 6);
  }
  if (hip) {
    for (let r = 0; r < 4; r++) {
      const SEG = 3;
      for (let s = 0; s < SEG; s++) {
        b.beam(ridgeKey, pt(r, 0, s / SEG), pt(r, 0, (s + 1) / SEG), 0.09, 5);
      }
    }
  }
  // 瓦垄
  if (tileKey && detail) {
    const ribs = Math.max(4, Math.round(w / 1.1));
    for (let r = 0; r < 4; r++) {
      for (let n = 1; n < ribs; n++) {
        const p = n / ribs;
        const SEG = 2;
        for (let s = 0; s < SEG; s++) {
          b.beam(tileKey, pt(r, p, s / SEG), pt(r, p, (s + 1) / SEG), 0.035, 4);
        }
      }
    }
  }
  // 脊端小兽
  if (hip) {
    for (const [sx, sz] of E) {
      const W = R(sx * 0.96, sz * 0.96);
      b.ico(ridgeKey, W[0], y + lift * 0.55 + 0.1, W[1], 0.16, 0.2, 0.16, 0);
    }
  }
  return { eaveY: y, ridgeY: y + h };
}

/* ============================================================
   5. 民居 / 店屋 / 厅堂 / 亭 / 楼阁 / 宝塔
   ============================================================ */
/** 湖北民居：石基 + 白墙 + 木格窗 + 青瓦顶，可选二层、山墙、灯笼 */
export function addHouse(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, w = 6, d = 5, h = 3.2, ry = 0,
    storeys = 1, gable = false, lanterns = false, lattice = true, eaveKey = 'ridge',
    roofKey = 'roof', wallKey = 'wall', plinthKey = 'stone', woodKey = 'wood',
    windowKey = 'windowLit', lit = true,
    over = 0.55, lift = 0.42, detail = false,
  } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];

  b.boxB(plinthKey, x, y, z, w + 0.3, 0.3, d + 0.3, ry);
  const bodyH = storeys === 2 ? h * 1.9 : h;
  b.boxB(wallKey, x, y + 0.3, z, w, bodyH, d, ry);

  // 腰檐（二层建筑）
  if (storeys === 2) {
    b.boxB(eaveKey, x, y + h * 0.92, z, w + 0.7, 0.16, d + 0.7, ry);
  }

  // 木格窗与门
  const face = d / 2 + 0.02;
  const cols = Math.max(2, Math.round(w / 2.2));
  for (let s = 0; s < storeys; s++) {
    const cy = y + 0.3 + h * (s + 0.55);
    for (let i = 0; i < cols; i++) {
      const px = -w / 2 + (w / cols) * (i + 0.5);
      const W = R(px, face);
      b.box(woodKey, W[0], cy, W[1], w / cols - 0.55, h * 0.5, 0.12, ry);
      // 窗芯：白天是深色玻璃，入夜透出暖黄窗光（浮在木格之外，避免共面闪烁）
      if (lit) {
        const G = R(px, face + 0.15);
        b.box(windowKey, G[0], cy, G[1], w / cols - 0.85, h * 0.34, 0.04, ry);
      }
      if (lattice) {
        const lw = w / cols - 0.55;
        const lh = h * 0.5;
        for (let k = 1; k < 4; k++) {
          const V = R(px, face + 0.08);
          b.boxB('lattice', V[0], cy - lh / 2, V[1], lw - 0.12, 0.05, 0.05, ry);
        }
        for (let k = 1; k < 3; k++) {
          const V = R(px - lw / 2 + (lw / 3) * k, face + 0.08);
          b.boxB('lattice', V[0], cy - lh / 2, V[1], 0.05, lh, 0.05, ry);
        }
      }
    }
  }
  if (storeys === 1) {
    const D = R(0, face);
    b.box(woodKey, D[0], y + 0.3 + h * 0.5, D[1], 1.5, h * 0.95, 0.14, ry);
  }

  // 山墙
  if (gable) {
    for (const sgn of [-1, 1]) {
      const W = R((sgn * (w / 2 + 0.06)), 0);
      b.boxB('wall2', W[0], y + 0.3, W[1], 0.18, bodyH + h * 0.35, d + 0.4, ry);
    }
  }

  // 灯笼
  if (lanterns) {
    for (const px of [-w / 4, w / 4]) {
      const W = R(px, d / 2 + 0.35);
      b.beam('wood', [W[0], y + 0.3 + bodyH, W[1]], [W[0], y + 0.3 + bodyH - 0.45, W[1]], 0.025, 4);
      b.sphere('lantern', W[0], y + 0.3 + bodyH - 0.7, W[1], 0.19, 0.24, 0.19, 8, 6);
    }
  }

  addRoof(b, mats, {
    x, y: y + 0.3 + bodyH, z, w, d, h: 1.5 + w * 0.06, ry,
    over, lift, key: roofKey, ridgeKey: eaveKey, detail,
  });
}

/** 殿宇 / 堂：台基 + 檐柱 + 匾额 + 重檐 */
export function addHall(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, w = 14, d = 9, h = 4.6, ry = 0,
    double = true, columns = 6, roofKey = 'roof', ridgeKey = 'ridge',
    wallKey = 'wall', plaque = true, detail = false, gold = false,
  } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];

  b.boxB('stone', x, y, z, w + 2.4, 0.7, d + 2.2, ry);
  b.boxB('stone2', x, y + 0.7, z, w + 1.6, 0.28, d + 1.4, ry);
  const base = y + 0.98;
  b.boxB(wallKey, x, base, z, w * 0.86, h, d * 0.78, ry);

  // 檐柱与栏杆
  for (let i = 0; i < columns; i++) {
    const px = -w / 2 + (w / (columns - 1)) * i;
    for (const pz of [d / 2 + 0.5, -d / 2 - 0.5]) {
      const P = R(px, pz);
      b.cylB(gold ? 'columnGold' : 'column', P[0], base, P[1], 0.22, 0.24, h * 0.98, 10);
    }
  }
  for (const sgn of [-1, 1]) {
    const pz = sgn * (d / 2 + 0.5);
    for (let i = 0; i < columns - 1; i++) {
      const p0 = -w / 2 + (w / (columns - 1)) * i;
      const p1 = -w / 2 + (w / (columns - 1)) * (i + 1);
      const A = R(p0, pz);
      const B = R(p1, pz);
      b.beam('rail', [A[0], base + 0.75, A[1]], [B[0], base + 0.75, B[1]], 0.06, 5);
      b.beam('rail', [A[0], base + 0.38, A[1]], [B[0], base + 0.38, B[1]], 0.05, 5);
    }
  }
  // 门窗
  const face = R(0, d * 0.39 + 0.06);
  for (const sgn of [-1, 1]) {
    const P = R(sgn * w * 0.22, d * 0.39 + 0.06);
    b.box('wood', P[0], base + h * 0.42, P[1], w * 0.16, h * 0.7, 0.14, ry);
  }
  if (plaque) {
    b.boxB(gold ? 'gold' : 'wood', face[0], base + h * 0.72, face[1], w * 0.22, 1, 0.22, ry);
  }

  addRoof(b, mats, { x, y: base + h, z, w: w + 1.2, d: d + 1, h: 2.6 + w * 0.05, ry, over: 1.1, lift: 0.85, key: roofKey, ridgeKey, detail });
  if (double) {
    addRoof(b, mats, {
      x, y: base + h * 0.62, z, w: w + 0.8, d: d + 0.8, h: 1.6, ry,
      over: 0.9, lift: 0.7, key: roofKey, ridgeKey, detail: false, hip: false,
    });
  }
}

/** 亭：方形或六边形攒尖顶 */
export function addPavilion(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, r = 2.2, h = 3, ry = 0, sides = 6,
    roofKey = 'roof', ridgeKey = 'ridge', columnKey = 'column',
    gold = false, finial = true, base = true,
  } = o;
  if (base) {
    b.cylB('stone', x, y, z, r + 0.7, r + 0.75, 0.4, sides);
    b.cylB('stone2', x, y + 0.4, z, r + 0.4, r + 0.45, 0.22, sides);
  }
  const y0 = y + (base ? 0.62 : 0);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU + ry;
    b.cylB(gold ? 'columnGold' : columnKey, x + Math.cos(a) * r, y0, z + Math.sin(a) * r, 0.16, 0.18, h, 8);
  }
  b.cylB('rail', x, y0 + h - 0.35, z, r * 0.9, r * 0.9, 0.16, sides);
  addRoof(b, mats, { x, y: y0 + h, z, w: r * 2.1, d: r * 2.1, h: r * 0.95, ry, over: 0.6, lift: 0.55, key: roofKey, ridgeKey });
  if (finial) {
    b.sphere(gold ? 'gold' : 'ridge', x, y0 + h + r * 0.95 + 0.25, z, 0.26, 0.34, 0.26, 8, 6);
    b.cylB(gold ? 'gold' : 'ridge', x, y0 + h + r * 0.95 + 0.45, z, 0.06, 0.09, 0.5, 6);
  }
}

/** 楼阁：多层带平座栏杆的塔楼 —— 黄鹤楼的形制 */
export function addTowerTiers(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, tiers = 5, w = 9, d = 9, h = 3.4, ry = 0,
    roofKey = 'goldRoof', ridgeKey = 'goldRidge', columnKey = 'columnRed',
    wallKey = 'wallTower', taper = 0.88, detail = true, finial = true, gallery = true,
  } = o;
  let cw = w;
  let cd = d;
  let cy = y;
  for (let t = 0; t < tiers; t++) {
    const isTop = t === tiers - 1;
    const floorH = h * (1 - t * 0.05);
    b.boxB('baseStone', x, cy - 0.12, z, cw + 1.5, 0.34, cd + 1.5, ry);
    b.boxB(wallKey, x, cy, z, cw * 0.82, floorH, cd * 0.82, ry);
    // 檐柱
    const cols = 4;
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
    for (let i = 0; i < cols; i++) {
      const px = -cw / 2 + (cw / (cols - 1)) * i;
      for (const pz of [-cd / 2, cd / 2]) {
        const P = R(px, pz);
        b.cylB(columnKey, P[0], cy, P[1], 0.2, 0.22, floorH, 8);
      }
    }
    // 门窗
    for (const sgn of [-1, 1]) {
      const P = R(0, sgn * (cd * 0.41 + 0.05));
      b.box('lattice', P[0], cy + floorH * 0.5, P[1], cw * 0.42, floorH * 0.72, 0.12, ry);
    }
    // 平座栏杆
    if (gallery) {
      b.boxB('rail', x, cy + floorH - 0.1, z, cw + 1.2, 0.12, cd + 1.2, ry);
      const rails = 12;
      for (let i = 0; i <= rails; i++) {
        const px = -cw / 2 - 0.6 + ((cw + 1.2) / rails) * i;
        for (const pz of [-cd / 2 - 0.6, cd / 2 + 0.6]) {
          const P = R(px, pz);
          b.cylB('rail', P[0], cy + floorH - 0.1, P[1], 0.045, 0.045, 0.62, 4);
        }
      }
    }
    addRoof(b, mats, {
      x, y: cy + floorH, z, w: cw + 1.6, d: cd + 1.6, h: isTop ? 3.4 : 1.5 + cw * 0.05, ry,
      over: 1.25, lift: 1.05, key: roofKey, ridgeKey, detail: detail && t % 2 === 0, hip: !isTop,
    });
    if (isTop) {
      b.cylB(ridgeKey, x, cy + floorH + 3.4, z, 0.16, 0.3, 0.9, 8);
      b.sphere(ridgeKey, x, cy + floorH + 4.5, z, 0.34, 0.42, 0.34, 8, 6);
      b.cylB(ridgeKey, x, cy + floorH + 5.0, z, 0.04, 0.08, 1.1, 6);
    }
    cy += floorH + (isTop ? 0 : 0.28);
    cw *= taper;
    cd *= taper;
  }
  return cy;
}

/** 宝塔：多层八角密檐 */
export function addPagoda(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, tiers = 7, r = 3.4, h = 2.5, ry = 0,
    roofKey = 'roof', ridgeKey = 'ridge', taper = 0.9, detail = false,
  } = o;
  b.cylB('stone', x, y, z, r + 1.5, r + 1.8, 0.8, 8);
  let cr = r;
  let cy = y + 0.8;
  for (let t = 0; t < tiers; t++) {
    b.cylB('wall2', x, cy, z, cr * 0.88, cr * 0.92, h, 8);
    // 门窗
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 8;
      b.box('lattice', x + Math.cos(a) * cr * 0.9, cy + h * 0.5, z + Math.sin(a) * cr * 0.9, 0.6, h * 0.6, 0.6, -a);
    }
    b.cylB(roofKey, x, cy + h, z, cr * 0.55, cr + 0.9, 0.75, 8);
    b.cylB(ridgeKey, x, cy + h + 0.75, z, cr * 0.75, cr * 0.8, 0.18, 8);
    cy += h + 0.95;
    cr *= taper;
  }
  b.cylB(ridgeKey, x, cy, z, 0.1, 0.22, 1.4, 6);
  b.sphere(ridgeKey, x, cy + 1.6, z, 0.3, 0.4, 0.3, 8, 6);
  return cy + 2;
}

/* ============================================================
   6. 桥：石拱桥 / 长江大桥钢桁梁
   ============================================================ */
/** 石拱桥：弧线桥面 + 半圆拱券 + 栏杆 */
export function addArchBridge(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, span = 10, width = 3.2, rise = 2.2, ry = 0,
    deckKey = 'stoneBridge', railKey = 'rail', detail = true, steps = false,
  } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  const prof = (t) => Math.sin(Math.PI * t) * rise; // 桥面起伏
  const SEG = 16;
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG;
    const t1 = (i + 1) / SEG;
    const p0 = R(-span / 2 + span * t0, 0);
    const p1 = R(-span / 2 + span * t1, 0);
    const y0 = y + prof(t0);
    const y1 = y + prof(t1);
    b.beam(deckKey, [p0[0], y0, p0[1]], [p1[0], y1, p1[1]], width * 0.5, 6);
    // 桥面石板
    const mid = R(-span / 2 + span * (t0 + 0.5) / SEG * SEG, 0);
    b.boxB(deckKey, mid[0], (y0 + y1) / 2 + width * 0.42, mid[1], span / SEG * 0.92, 0.14, width * 0.92, ry);
    // 栏杆
    for (const sgn of [-1, 1]) {
      const A = R(-span / 2 + span * t0, (sgn * width) / 2);
      const B = R(-span / 2 + span * t1, (sgn * width) / 2);
      b.beam(railKey, [A[0], y0 + 0.95, A[1]], [B[0], y1 + 0.95, B[1]], 0.06, 4);
      b.beam(railKey, [A[0], y0 + 0.6, A[1]], [B[0], y1 + 0.6, B[1]], 0.04, 4);
      b.cylB(railKey, A[0], y0 + 0.2, A[1], 0.06, 0.07, 0.78, 5);
    }
  }
  // 拱券
  const archR = Math.min(rise, span / 2.4);
  const ARC = 14;
  for (let i = 0; i < ARC; i++) {
    const a0 = Math.PI * (i / ARC);
    const a1 = Math.PI * ((i + 1) / ARC);
    for (const sgn of [-1, 1]) {
      const A = R(-span / 2.6 * Math.cos(a0), (sgn * width * 0.92) / 2);
      const B = R(-span / 2.6 * Math.cos(a1), (sgn * width * 0.92) / 2);
      b.beam(deckKey, [A[0], y + archR * Math.sin(a0) * 0.85, A[1]], [B[0], y + archR * Math.sin(a1) * 0.85, B[1]], 0.24, 6);
    }
  }
  if (steps) {
    for (const sgn of [-1, 1]) {
      for (let s = 0; s < 3; s++) {
        const P = R(sgn * (span / 2 + 0.5 + s * 0.6), 0);
        b.boxB(deckKey, P[0], y - (s + 1) * 0.22, P[1], 0.7, 0.24, width * 1.05, ry);
      }
    }
  }
  if (detail) {
    for (const sgn of [-1, 1]) {
      const P = R(0, (sgn * width) / 2);
      b.ico('stone', P[0], y + rise + 1.35, P[1], 0.22, 0.26, 0.22, 0);
    }
  }
}

/**
 * 长江大桥式双层钢桁梁桥：
 * 桥墩 + 下层铁路 + 上层公路 + 三角形钢桁架 + 民族风格桥头堡
 */
export function addTrussBridge(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, length = 120, width = 9, deckY = 9, ry = 0,
    piers = 6, spans = null, steelKey = 'steel', pierKey = 'pier',
    deckKey = 'deck', railKey = 'railBridge', head = true, detail = true,
  } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  const n = spans ?? piers;
  const chord = width / 2;
  const trussH = deckY * 0.52;

  // 桥墩
  for (let i = 0; i <= n; i++) {
    const px = -length / 2 + (length / n) * i;
    for (const sgn of [-1, 1]) {
      const P = R(px, sgn * chord * 0.8);
      b.cylB(pierKey, P[0], y - 3, P[1], 0.9, 1.3, deckY + 1.6, 10);
      b.boxB(pierKey, P[0], y + deckY - 0.6, P[1], 2.2, 0.8, 2.2, ry);
    }
  }

  // 双层桥面
  b.boxB(deckKey, x, y + deckY - 1.35, z, length, 0.7, width * 0.92, ry);
  b.boxB(deckKey, x, y + deckY, z, length, 0.55, width, ry);
  for (const sgn of [-1, 1]) {
    const P = R(0, sgn * (width / 2 - 0.1));
    b.boxB(railKey, P[0], y + deckY + 0.55, P[1], length, 0.75, 0.16, ry);
  }

  // 钢桁架：上下弦 + 斜腹杆 + 竖杆
  const panels = Math.max(8, Math.round(length / 8));
  for (const sgn of [-1, 1]) {
    const zz = sgn * chord;
    for (let i = 0; i < panels; i++) {
      const p0 = -length / 2 + (length / panels) * i;
      const p1 = -length / 2 + (length / panels) * (i + 1);
      const A0 = R(p0, zz);
      const A1 = R(p1, zz);
      const top0 = [A0[0], y + deckY + trussH, A0[1]];
      const top1 = [A1[0], y + deckY + trussH, A1[1]];
      const bot0 = [A0[0], y + deckY + 0.6, A0[1]];
      const bot1 = [A1[0], y + deckY + 0.6, A1[1]];
      if (detail) {
        b.beam(steelKey, top0, top1, 0.16, 5);
        b.beam(steelKey, bot0, bot1, 0.14, 5);
        b.beam(steelKey, top0, bot1, 0.11, 5);
        b.beam(steelKey, top1, bot0, 0.11, 5);
        b.beam(steelKey, top1, bot1, 0.09, 5);
      } else {
        b.beam(steelKey, top0, top1, 0.18, 5);
      }
    }
  }
  // 横向联结系
  if (detail) {
    for (let i = 0; i <= panels; i += 2) {
      const px = -length / 2 + (length / panels) * i;
      const A = R(px, -chord);
      const B = R(px, chord);
      b.beam(steelKey, [A[0], y + deckY + trussH, A[1]], [B[0], y + deckY + trussH, B[1]], 0.1, 5);
    }
  }

  // 桥头堡（民族风格方塔 + 攒尖顶）
  if (head) {
    for (const sgn of [-1, 1]) {
      const P = R(sgn * (length / 2 + 3), 0);
      const hh = deckY + trussH + 4;
      b.boxB('wallGate', P[0], y - 2, P[1], 7, hh + 2, 7, ry);
      for (const sx of [-1, 1]) {
        const Q = R(sgn * (length / 2 + 3), sx * 4.2);
        b.boxB('wallGate2', Q[0], y, Q[1], 2.2, hh + 4, 2.2, ry);
      }
      addRoof(b, mats, {
        x: P[0], y: y + hh, z: P[1], w: 8.4, d: 8.4, h: 3.2, ry,
        over: 1.1, lift: 0.9, key: 'roofGate', ridgeKey: 'ridgeGate', detail: true,
      });
      addRoof(b, mats, {
        x: P[0], y: y + hh + 3.2, z: P[1], w: 4, d: 4, h: 2.2, ry,
        over: 0.7, lift: 0.6, key: 'roofGate', ridgeKey: 'ridgeGate', hip: false,
      });
      b.sphere('gold', P[0], y + hh + 5.6, P[1], 0.4, 0.5, 0.4, 8, 6);
      // 桥下拱门
      b.box('dark', P[0], y + deckY * 0.35, P[1] + (sgn > 0 ? -3.6 : 3.6), 4.2, deckY * 0.6, 0.4, ry);
    }
  }
  // 路灯
  if (detail) {
    for (let i = 0; i <= 10; i++) {
      const px = -length / 2 + (length / 10) * i;
      for (const sgn of [-1, 1]) {
        const P = R(px, sgn * (width / 2 - 0.6));
        b.cylB('lampPost', P[0], y + deckY + 1.3, P[1], 0.07, 0.09, 1.5, 6);
        b.sphere('lampGlow', P[0], y + deckY + 2.85, P[1], 0.18, 0.18, 0.18, 7, 6);
      }
    }
  }
}

/* ============================================================
   7. 现代建筑：玻璃塔楼 / 电视塔 / 高架
   ============================================================ */
export function addModernTower(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, w = 10, d = 10, h = 40, ry = 0,
    style = 'glass', setbacks = 0, spire = 0, crown = true, mullions = 6,
    glassKey = 'glass', frameKey = 'frame', roofKey = 'roofModern',
  } = o;
  let cw = w;
  let cd = d;
  let cy = y;
  const segs = setbacks + 1;
  for (let s = 0; s < segs; s++) {
    const sh = h / segs;
    b.boxB(glassKey, x, cy, z, cw, sh, cd, ry);
    // 竖向幕墙分格
    if (mullions > 0) {
      for (let i = 0; i <= mullions; i++) {
        const px = -cw / 2 + (cw / mullions) * i;
        for (const pz of [-cd / 2 - 0.03, cd / 2 + 0.03]) {
          const cos = Math.cos(ry);
          const sin = Math.sin(ry);
          b.boxB(frameKey, x + px * cos + pz * sin, cy, z - px * sin + pz * cos, 0.16, sh, 0.14, ry);
        }
      }
      for (const pz of [-cd / 2 - 0.02, cd / 2 + 0.02]) {
        b.boxB(frameKey, x + pz * Math.sin(ry), cy + sh - 0.5, z + pz * Math.cos(ry), cw, 0.45, 0.12, ry);
        b.boxB(frameKey, x + pz * Math.sin(ry), cy, z + pz * Math.cos(ry), cw, 0.4, 0.12, ry);
      }
    }
    cy += sh;
    cw *= 0.86;
    cd *= 0.86;
  }
  if (crown) {
    b.boxB(roofKey, x, cy, z, cw * 1.1, 1.2, cd * 1.1, ry);
    b.boxB('navLight', x, cy + 1.2, z, 0.5, 0.5, 0.5, ry);
  }
  if (spire > 0) {
    b.cylB('frame', x, cy, z, 0.12, 0.5, spire, 6);
    b.sphere('navLight', x, cy + spire, z, 0.3, 0.3, 0.3, 6, 5);
    cy += spire;
  }
  if (style === 'twin') {
    const off = w * 0.65;
    for (const sgn of [-1, 1]) {
      const cos = Math.cos(ry);
      const sin = Math.sin(ry);
      const px = sgn * off;
      b.boxB(glassKey, x + px * cos, y, z - px * sin, w * 0.8, h * 0.8, d * 0.8, ry);
      b.boxB(roofKey, x + px * cos, y + h * 0.8, z - px * sin, w * 0.85, 1, d * 0.85, ry);
    }
  }
  return cy;
}

/** 龟山电视塔：塔身 + 圆盘观景台 + 天线 */
export function addTvTower(b, mats, o) {
  const { x = 0, y = 0, z = 0, h = 42, r = 2.4, disc = true } = o;
  b.cylB('concrete', x, y, z, r * 0.55, r, h * 0.62, 12);
  b.cylB('concrete', x, y + h * 0.62, z, r * 0.5, r * 0.55, h * 0.2, 12);
  if (disc) {
    b.cylB('glassTower', x, y + h * 0.78, z, r * 2.3, r * 2.6, 1.5, 16);
    b.cylB('frame', x, y + h * 0.8, z, r * 2.35, r * 2.35, 0.45, 16);
    b.cylB('glassTower', x, y + h * 0.93, z, r * 1.5, r * 1.8, 1.2, 14);
  }
  b.cylB('frame', x, y + h, z, 0.16, 0.4, h * 0.34, 8);
  b.sphere('navLight', x, y + h * 1.34, z, 0.34, 0.34, 0.34, 6, 5);
  return y + h * 1.34;
}

/* ============================================================
   8. 植被
   ============================================================ */
export function addTree(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, s = 1, kind = 'broad', ry = 0, r = null,
    trunkKey = 'trunk', leafKey = null,
  } = o;
  const R = r ?? rng(Math.round((x * 7919 + z * 104729 + s * 1000) | 0));
  switch (kind) {
    case 'plane': {
      // 法桐：武汉的行道树，树干斑驳、树冠开阔
      b.cylB('trunkPlane', x, y, z, 0.16 * s, 0.26 * s, 3.4 * s, 8);
      b.beam('trunkPlane', [x, y + 2.6 * s, z], [x + 0.5 * s, y + 3.6 * s, z + 0.3 * s], 0.12 * s, 6);
      b.beam('trunkPlane', [x, y + 2.9 * s, z], [x - 0.6 * s, y + 3.8 * s, z - 0.4 * s], 0.12 * s, 6);
      const lk = leafKey ?? 'leaf';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + R() * 0.8;
        const rr = (1.5 + R() * 0.7) * s;
        b.ico(lk, x + Math.cos(a) * 1.1 * s, y + (4.4 + R() * 0.5) * s, z + Math.sin(a) * 1.1 * s, rr, rr * 0.62, rr, 1);
      }
      break;
    }
    case 'pine': {
      b.cylB(trunkKey, x, y, z, 0.13 * s, 0.2 * s, 1.6 * s, 7);
      const lk = leafKey ?? 'leafDark';
      for (let i = 0; i < 3; i++) {
        b.cone(lk, x, y + (1.6 + i * 1.15) * s, z, (1.9 - i * 0.42) * s, 1.9 * s, 8);
      }
      break;
    }
    case 'willow': {
      b.cylB(trunkKey, x, y, z, 0.18 * s, 0.3 * s, 2.6 * s, 8);
      const lk = leafKey ?? 'leafWillow';
      b.ico(lk, x, y + 3.3 * s, z, 1.7 * s, 0.95 * s, 1.7 * s, 1);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + R();
        const rr = (0.8 + R() * 0.9) * s;
        b.beam(lk, [x + Math.cos(a) * rr, y + 3.2 * s, z + Math.sin(a) * rr], [x + Math.cos(a) * (rr + 0.35 * s), y + (1.35 + R() * 0.6) * s, z + Math.sin(a) * (rr + 0.35 * s)], 0.09 * s, 5);
      }
      break;
    }
    case 'cherry': {
      b.cylB('trunkCherry', x, y, z, 0.14 * s, 0.22 * s, 2.3 * s, 8);
      const lk = leafKey ?? 'blossom';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + R() * 0.9;
        const rr = (0.75 + R() * 0.55) * s;
        b.ico(lk, x + Math.cos(a) * 1.0 * s, y + (2.7 + R() * 0.6) * s, z + Math.sin(a) * 1.0 * s, rr, rr * 0.8, rr, 1);
      }
      b.ico(lk, x, y + 3.4 * s, z, 1.1 * s, 0.75 * s, 1.1 * s, 1);
      break;
    }
    case 'plum': {
      // 武汉市花：梅花，早春先花后叶
      b.cylB('trunkPlum', x, y, z, 0.12 * s, 0.2 * s, 1.8 * s, 7);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + R();
        b.beam('trunkPlum', [x, y + 1.4 * s, z], [x + Math.cos(a) * 1.1 * s, y + (2.4 + R() * 0.4) * s, z + Math.sin(a) * 1.1 * s], 0.07 * s, 5);
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + R() * 1.2;
        const rr = (0.35 + R() * 0.3) * s;
        b.ico('blossomPlum', x + Math.cos(a) * 1.15 * s, y + (2.5 + R() * 0.5) * s, z + Math.sin(a) * 1.15 * s, rr, rr, rr, 0);
      }
      break;
    }
    case 'bamboo': {
      const lk = leafKey ?? 'leafBamboo';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + R();
        const rr = (0.25 + R() * 0.5) * s;
        const hh = (3.4 + R() * 1.6) * s;
        b.cylB('bamboo', x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, 0.06 * s, 0.08 * s, hh, 5);
        b.ico(lk, x + Math.cos(a) * rr * 1.5, y + hh * 0.92, z + Math.sin(a) * rr * 1.5, 0.55 * s, 0.3 * s, 0.55 * s, 0);
      }
      break;
    }
    case 'shrub': {
      const lk = leafKey ?? 'leaf';
      b.ico(lk, x, y + 0.45 * s, z, 0.85 * s, 0.5 * s, 0.85 * s, 1);
      break;
    }
    default: {
      // 樟树 / 阔叶树
      b.cylB(trunkKey, x, y, z, 0.17 * s, 0.28 * s, 2.9 * s, 8);
      const lk = leafKey ?? 'leaf';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + R() * 1.1;
        const rr = (1.35 + R() * 0.75) * s;
        b.ico(lk, x + Math.cos(a) * 0.8 * s, y + (3.5 + R() * 0.55) * s, z + Math.sin(a) * 0.8 * s, rr, rr * 0.82, rr, 1);
      }
      b.ico(lk, x, y + 4.35 * s, z, 1.15 * s, 0.85 * s, 1.15 * s, 1);
    }
  }
}

/* ============================================================
   9. 船、码头、街市小物件
   ============================================================ */
export function addBoat(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, ry = 0, s = 1, kind = 'ferry',
    hullKey = 'hull', cabinKey = 'cabin', glowKey = 'windowLit',
  } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  if (kind === 'sampan') {
    // 小木船：乌篷
    b.boxB(hullKey, x, y, z, 4.4 * s, 0.5 * s, 1.5 * s, ry);
    const A = R(2.1 * s, 0);
    const B = R(-2.1 * s, 0);
    b.cone(hullKey, A[0], y + 0.25 * s, A[1], 0.75 * s, 1.1 * s, 6);
    b.cyl(hullKey, x, y + 0.35 * s, z, 0.8 * s, 0.85 * s, 1.1 * s, 8, 0, 0, Math.PI / 2);
    b.cyl(cabinKey, x, y + 1.0 * s, z, 0.85 * s, 0.85 * s, 2.2 * s, 8, 0, 0, Math.PI / 2);
    return;
  }
  if (kind === 'sail') {
    b.boxB(hullKey, x, y, z, 3.2 * s, 0.45 * s, 1.2 * s, ry);
    b.cylB('wood', x, y + 0.4 * s, z, 0.05 * s, 0.06 * s, 3.2 * s, 5);
    const S = R(0.1 * s, 0);
    b.box(cabinKey, S[0], y + 2.2 * s, S[1], 0.12 * s, 2.2 * s, 1.4 * s, ry);
    return;
  }
  if (kind === 'barge') {
    b.boxB(hullKey, x, y, z, 9 * s, 0.9 * s, 3.2 * s, ry);
    const C = R(-2.6 * s, 0);
    b.boxB(cabinKey, C[0], y + 0.9 * s, C[1], 2.2 * s, 1.5 * s, 2.6 * s, ry);
    for (let i = 0; i < 4; i++) {
      const P = R((0.4 + i * 1.5) * s, 0);
      b.boxB(i % 2 ? 'containerA' : 'containerB', P[0], y + 0.9 * s, P[1], 1.4 * s, 0.9 * s, 2.4 * s, ry);
    }
    return;
  }
  // 轮渡 / 游船
  b.boxB(hullKey, x, y, z, 8 * s, 1.0 * s, 3 * s, ry);
  const bow = R(4 * s, 0);
  b.cone(hullKey, bow[0], y + 0.5 * s, bow[1], 1.5 * s, 2.2 * s, 6);
  b.boxB(cabinKey, x, y + 1.0 * s, z, 6.4 * s, 1.5 * s, 2.5 * s, ry);
  b.boxB(cabinKey, x, y + 2.5 * s, z, 4.6 * s, 1.2 * s, 2.1 * s, ry);
  for (let i = 0; i < 6; i++) {
    for (const pz of [-1.28 * s, 1.28 * s]) {
      const P = R((-2.7 + i * 1.08) * s, pz);
      b.box(glowKey, P[0], y + 1.75 * s, P[1], 0.7 * s, 0.6 * s, 0.1, ry);
    }
  }
  b.boxB('roofBoat', x, y + 3.7 * s, z, 4.9 * s, 0.22 * s, 2.3 * s, ry);
  b.cylB('frame', x, y + 3.9 * s, z, 0.06 * s, 0.08 * s, 1.4 * s, 5);
  b.sphere('lampGlow', x, y + 5.4 * s, z, 0.14 * s, 0.14 * s, 0.14 * s, 6, 5);
}

/** 小吃摊：过早的江湖 */
export function addStall(b, mats, o) {
  const { x = 0, y = 0, z = 0, ry = 0, w = 3, d = 1.6, s = 1, awningKey = 'awning', kind = 'stall' } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  if (kind === 'table') {
    b.cylB('wood', x, y, z, 0.55 * s, 0.55 * s, 0.08 * s, 10);
    b.cylB('wood', x, y + 0.08 * s, z, 0.08 * s, 0.1 * s, 0.75 * s, 6);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      b.cylB('wood', x + Math.cos(a) * 1.1 * s, y, z + Math.sin(a) * 1.1 * s, 0.22 * s, 0.24 * s, 0.45 * s, 8);
    }
    return;
  }
  b.boxB('counter', x, y, z, w * s, 0.95 * s, d * s, ry);
  b.boxB('counterTop', x, y + 0.95 * s, z, w * s + 0.2, 0.1, d * s + 0.2, ry);
  // 遮阳篷
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const P = R((sx * w * s) / 2, (sz * d * s) / 2);
      b.cylB('frame', P[0], y, P[1], 0.04, 0.05, 2.1 * s, 5);
    }
  }
  const top = R(0, 0);
  b.box(awningKey, top[0], y + 2.2 * s, top[1], w * s + 0.7, 0.1, d * s + 0.7, ry);
  b.box(awningKey, top[0], y + 2.05 * s, top[1], w * s + 0.55, 0.35, 0.12, ry);
  // 蒸汽（夜色里更暖的雾）
  for (let i = 0; i < 3; i++) {
    b.sphere('steam', x + (i - 1) * 0.5 * s, y + (2.5 + i * 0.55) * s, z + (i % 2 ? 0.2 : -0.2) * s, (0.4 + i * 0.16) * s, (0.34 + i * 0.14) * s, (0.4 + i * 0.16) * s, 8, 6);
  }
  // 幌子
  b.cylB('wood', x + (w * s) / 2 + 0.35, y, z, 0.04, 0.05, 2.6 * s, 5);
  b.box('banner', x + (w * s) / 2 + 0.35, y + 2.2 * s, z + 0.28, 0.08, 0.9, 0.5, ry);
}

/** 牌坊 / 门楼 */
export function addGate(b, mats, o) {
  const { x = 0, y = 0, z = 0, ry = 0, w = 8, h = 5.4, pillars = 4, roofKey = 'goldRoof', ridgeKey = 'goldRidge' } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  for (let i = 0; i < pillars; i++) {
    const px = -w / 2 + (w / (pillars - 1)) * i;
    const P = R(px, 0);
    b.boxB('stone', P[0], y, P[1], 0.9, 0.5, 0.9, ry);
    b.cylB('columnRed', P[0], y + 0.5, P[1], 0.24, 0.28, h, 8);
  }
  for (const pz of [-0.6, 0.6]) {
    for (let i = 0; i < pillars - 1; i++) {
      const p0 = R(-w / 2 + (w / (pillars - 1)) * i, pz);
      const p1 = R(-w / 2 + (w / (pillars - 1)) * (i + 1), pz);
      b.beam('beamRed', [p0[0], y + h - 0.7, p0[1]], [p1[0], y + h - 0.7, p1[1]], 0.16, 5);
      b.beam('beamRed', [p0[0], y + h * 0.62, p0[1]], [p1[0], y + h * 0.62, p1[1]], 0.1, 5);
    }
  }
  const C = R(0, 0);
  b.boxB('gold', C[0], y + h * 0.78, C[1], w * 0.34, 0.85, 0.28, ry);
  addRoof(b, mats, { x: C[0], y: y + h, z: C[1], w: w + 1.4, d: 2.6, h: 1.8, ry, over: 0.8, lift: 0.7, key: roofKey, ridgeKey, hip: false });
}

/** 江滩石 / 假山 */
export function addRock(b, mats, o) {
  const { x = 0, y = 0, z = 0, s = 1, r = null, key = 'rock' } = o;
  const R = r ?? rng(Math.round((x * 3571 + z * 6151) | 0));
  const n = 3 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const rr = (0.5 + R() * 0.9) * s;
    b.ico(key, x + Math.cos(a) * 0.8 * s, y + rr * (0.35 + R() * 0.3), z + Math.sin(a) * 0.8 * s, rr, rr * (0.6 + R() * 0.5), rr * 0.9, 1);
  }
}

/** 栏杆：沿折线生成立柱与扶手 */
export function addRailing(b, mats, pts, y, o = {}) {
  const { key = 'rail', h = 1.0, post = 1.6, rail = true } = o;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    if (rail) {
      b.beam(key, [x0, y + h, z0], [x1, y + h, z1], 0.06, 4);
      b.beam(key, [x0, y + h * 0.55, z0], [x1, y + h * 0.55, z1], 0.045, 4);
    }
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / post));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      b.cylB(key, lerp(x0, x1, t), y, lerp(z0, z1, t), 0.05, 0.06, h, 5);
    }
  }
}

/** 台阶（下到江边、上到台基） */
export function addStairs(b, mats, o) {
  const { x = 0, y = 0, z = 0, ry = 0, w = 4, steps = 4, rise = 0.28, run = 0.5, key = 'stone' } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  for (let i = 0; i < steps; i++) {
    const pz = run * (i + 0.5);
    b.boxB(key, x + pz * sin, y - rise * (i + 1), z + pz * cos, w, rise + 0.02, run, ry);
  }
}

/** 码头 / 栈桥 */
export function addPier(b, mats, o) {
  const { x = 0, y = 0, z = 0, ry = 0, w = 3, len = 12, kind = 'pier' } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const R = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  b.boxB('deck', x, y, z, w, 0.3, len, ry);
  const n = Math.max(2, Math.round(len / 3));
  for (let i = 0; i <= n; i++) {
    const pz = -len / 2 + (len / n) * i;
    for (const sx of [-1, 1]) {
      const P = R((sx * w) / 2 * 0.85, pz);
      b.cylB('pierPost', P[0], y - 2.4, P[1], 0.12, 0.14, 2.5, 6);
    }
  }
  if (kind === 'ferry') {
    const G = R(0, len / 2);
    b.boxB('deck', G[0], y, G[1], w * 0.8, 0.25, 4, ry);
    b.boxB('wall', x, y + 0.3, z, w * 1.2, 2.2, 3, ry);
    addRoof(b, mats, { x, y: y + 2.5, z, w: w * 1.5, d: 3.6, h: 1.4, ry, over: 0.7, lift: 0.5, key: 'roofBoat', ridgeKey: 'ridge' });
  }
}

/** 城墙与城楼 */
export function addCityWall(b, mats, o) {
  const { pts = [], y = 0, h = 3.4, thick = 1.4, key = 'wallCity', tower = true } = o;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const ry = -Math.atan2(dz, dx);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    b.boxB(key, mx, y, mz, len, h, thick, ry);
    const merlons = Math.max(2, Math.round(len / 1.8));
    for (let k = 0; k < merlons; k++) {
      const t = (k + 0.5) / merlons;
      b.boxB(key, lerp(x0, x1, t), y + h, lerp(z0, z1, t), len / merlons * 0.55, 0.7, thick * 0.8, ry);
    }
  }
  if (tower && pts.length > 1) {
    const [x0, z0] = pts[Math.floor(pts.length / 2)];
    addHall(b, mats, { x: x0, y: y + h * 0.65, z: z0, w: 9, d: 6, h: 3.6, double: false, columns: 4, wallKey: 'wallCity', roofKey: 'roofGate', ridgeKey: 'ridgeGate', plaque: false });
  }
}

/** 路灯 */
export function addLamp(b, mats, o) {
  const { x = 0, y = 0, z = 0, h = 4, arm = 0.8, ry = 0, kind = 'street' } = o;
  if (kind === 'park') {
    b.cylB('lampPost', x, y, z, 0.08, 0.12, 2.6, 8);
    b.sphere('lampGlow', x, y + 2.75, z, 0.22, 0.28, 0.22, 8, 6);
    return;
  }
  b.cylB('lampPost', x, y, z, 0.1, 0.16, h, 8);
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  b.beam('lampPost', [x, y + h - 0.1, z], [x + arm * cos, y + h + 0.35, z - arm * sin], 0.07, 5);
  b.sphere('lampGlow', x + arm * cos, y + h + 0.3, z - arm * sin, 0.24, 0.24, 0.24, 8, 6);
}

/** 霓虹招牌（江汉路与夜江城） */
export function addNeon(b, mats, o) {
  const { x = 0, y = 0, z = 0, ry = 0, w = 2.4, h = 0.7, key = 'neon' } = o;
  b.box(key, x, y, z, w, h, 0.12, ry);
  b.box('frameDark', x, y, z - 0.08, w + 0.18, h + 0.18, 0.06, ry);
}

/** 江面航标 / 灯塔 */
export function addBuoy(b, mats, o) {
  const { x = 0, y = 0, z = 0, s = 1 } = o;
  b.cylB('buoy', x, y - 0.3 * s, z, 0.35 * s, 0.42 * s, 0.9 * s, 8);
  b.sphere('lampGlow', x, y + 0.75 * s, z, 0.16 * s, 0.16 * s, 0.16 * s, 6, 5);
}

/* ============================================================
   10. 山水：缓坡山体
   ============================================================ */
export function addHill(b, mats, o) {
  const { x = 0, y = 0, z = 0, r = 20, h = 12, key = 'hill', rock = 0, treeKind = null, treeCount = 0, rnd = null } = o;
  b.sphere(key, x, y - h * 0.35, z, r, h, r * 0.85, 16, 10);
  const R = rnd ?? rng(Math.round((x * 131 + z * 977) | 0));
  for (let i = 0; i < rock; i++) {
    const a = R() * TAU;
    const rr = R() * r * 0.75;
    addRock(b, mats, { x: x + Math.cos(a) * rr, y: y + h * 0.28 + R() * h * 0.3, z: z + Math.sin(a) * rr, s: 0.8 + R() * 1.6, r: R, key: 'rock' });
  }
  if (treeKind && treeCount) {
    for (let i = 0; i < treeCount; i++) {
      const a = R() * TAU;
      const rr = Math.sqrt(R()) * r * 0.92;
      const px = x + Math.cos(a) * rr;
      const pz = z + Math.sin(a) * rr;
      const local = 1 - (rr / r) * (rr / r);
      addTree(b, mats, { x: px, y: y + h * local * 0.85 - h * 0.1, z: pz, s: 0.7 + R() * 0.7, kind: treeKind, r: R });
    }
  }
}

/* ============================================================
   10.5 街巷与广场小件（户部巷 / 武大 / 归元寺 / 光谷 共用）
   ============================================================ */

/** 三间四柱牌坊：中间高、两侧低，柱脚有抱鼓石 */
export function addPaifang(b, mats, o) {
  const {
    x = 0, y = 0, z = 0, ry = 0, w = 12, h = 6.4, span = 3.4,
    pillarKey = 'stone', roofKey = 'roof', ridgeKey = 'ridge', glowKey = 'lattice', plaque = true,
  } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const P = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  const bays = [-1, 0, 1];
  for (const bay of bays) {
    const px = bay * span;
    for (const sgn of [-1, 1]) {
      const q = P(px + sgn * 0.55, 0);
      const ph = bay === 0 ? h : h * 0.82;
      b.boxB(pillarKey, q[0], y, q[1], 0.62, ph, 0.62, ry);
      // 抱鼓石
      const r = P(px + sgn * 0.55, 0);
      b.boxB(pillarKey, r[0], y, r[1], 1.1, 0.5, 1.1, ry);
    }
    // 额枋
    const c = P(px, 0);
    const ph = bay === 0 ? h : h * 0.82;
    b.box(pillarKey, c[0], y + ph * 0.84, c[1], span + 0.5, 0.5, 0.44, ry);
    if (plaque && bay === 0) {
      const g = P(0, 0);
      b.box('plaque', g[0], y + h * 0.84, g[1], 3.2, 0.85, 0.16, ry);
      b.box(glowKey, g[0], y + h * 0.84, g[1] + 0.1, 2.6, 0.5, 0.06, ry);
    }
  }
  // 三段瓦顶（中间为庑殿，两侧略低）
  for (const bay of bays) {
    const c = P(bay * span, 0);
    const ph = bay === 0 ? h : h * 0.82;
    addRoof(b, mats, {
      x: c[0], y: y + ph, z: c[1], w: bay === 0 ? span * 1.9 : span * 1.6, d: 2.1,
      h: bay === 0 ? 1.5 : 1.15, over: 0.55, lift: 0.45, ry, key: roofKey, ridgeKey, detail: bay === 0,
    });
  }
}

/** 一串横跨巷子的灯笼（悬链线垂下，绳 + 灯笼 + 流苏） */
export function addLanternString(b, mats, o) {
  const { x0 = 0, z0 = 0, x1 = 0, z1 = 0, y = 4.6, sag = 0.9, count = 9, r = 0.26, ry = 0 } = o;
  const R = rng(o.seed ?? Math.round((x0 * 71 + z1 * 37) | 0));
  // 绳：分段折线，逐段下垂
  const SEG = 16;
  let prev = null;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const px = lerp(x0, x1, t);
    const pz = lerp(z0, z1, t);
    const py = y - Math.sin(Math.PI * t) * sag;
    if (prev) b.beam('rope', prev, [px, py, pz], 0.035, 4);
    prev = [px, py, pz];
  }
  // 灯笼
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const px = lerp(x0, x1, t);
    const pz = lerp(z0, z1, t);
    const py = y - Math.sin(Math.PI * t) * sag - r * 1.15 - 0.16;
    const s = 0.86 + R() * 0.26;
    b.cylB('rope', px, py + r * 1.15 * s, pz, 0.02, 0.02, 0.16, 4);
    b.sphere('lantern', px, py, pz, r * s, r * 1.12 * s, r * s, 10, 8);
    // 上下压扁的盖与流苏
    b.cylB('wood', px, py + r * 1.12 * s - 0.02, pz, r * 0.5 * s, r * 0.5 * s, 0.07, 8);
    b.cylB('gold', px, py - r * 1.12 * s - 0.14, pz, 0.035, 0.035, 0.16, 4);
  }
}

/** 巷内小件：水缸 / 竹凳 / 长凳 / 立式招牌 / 竹筐 */
export function addStreetProp(b, mats, o) {
  const { x = 0, y = 0, z = 0, ry = 0, kind = 'vat', s = 1 } = o;
  if (kind === 'vat') {
    // 水缸：鼓腹陶缸 + 水面
    b.cylB('pottery', x, y, z, 0.62 * s, 0.5 * s, 0.62 * s, 12);
    b.cylB('pottery', x, y + 0.62 * s, z, 0.56 * s, 0.62 * s, 0.2 * s, 12);
    b.cylB('water', x, y + 0.78 * s, z, 0.52 * s, 0.52 * s, 0.04 * s, 12);
    return;
  }
  if (kind === 'jar') {
    b.cylB('pottery', x, y, z, 0.3 * s, 0.24 * s, 0.34 * s, 10);
    b.cylB('pottery', x, y + 0.34 * s, z, 0.26 * s, 0.3 * s, 0.34 * s, 10);
    return;
  }
  if (kind === 'stool') {
    b.cylB('wood', x, y, z, 0.2 * s, 0.22 * s, 0.44 * s, 8);
    return;
  }
  if (kind === 'bench') {
    for (const sx of [-1, 1]) {
      b.boxB('wood', x + sx * 0.62 * s, y, z, 0.12 * s, 0.42 * s, 0.42 * s, ry);
    }
    b.box('wood', x, y + 0.46 * s, z, 1.7 * s, 0.08 * s, 0.42 * s, ry);
    return;
  }
  if (kind === 'basket') {
    b.cylB('basket', x, y, z, 0.34 * s, 0.28 * s, 0.36 * s, 10);
    b.cylB('basket', x, y + 0.36 * s, z, 0.26 * s, 0.34 * s, 0.14 * s, 10);
    return;
  }
  // sign：立式招牌（木框 + 发光字面）
  const { h = 2.6, w = 0.62 } = o;
  b.cylB('wood', x, y, z, 0.055, 0.06, h, 5, ry);
  b.box('signBoard', x, y + h * 0.72, z, w, h * 0.5, 0.09, ry);
  b.box('neon', x, y + h * 0.72, z + 0.06, w * 0.78, h * 0.4, 0.05, ry);
}

/** 光谷环形天桥：环廊 + 栏杆 + 立柱 + 上下楼梯 */
export function addRingBridge(b, mats, o) {
  const { x = 0, y = 0, z = 0, r = 26, deckY = 5.6, width = 3.2, seg = 32, columns = 10, railingKey = 'railBridge', key = 'deck' } = o;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU;
    const a1 = ((i + 1) / seg) * TAU;
    const mx = x + Math.cos((a0 + a1) / 2) * r;
    const mz = z + Math.sin((a0 + a1) / 2) * r;
    const len = r * TAU / seg * 1.06;
    b.box(key, mx, y + deckY, mz, len, 0.34, width, -(a0 + a1) / 2 + Math.PI / 2);
    // 内外栏杆
    for (const sgn of [-1, 1]) {
      const rr = r + sgn * width * 0.5;
      b.box(railingKey, x + Math.cos((a0 + a1) / 2) * rr, y + deckY + 0.62, z + Math.sin((a0 + a1) / 2) * rr, len, 0.9, 0.1, -(a0 + a1) / 2 + Math.PI / 2);
    }
  }
  for (let i = 0; i < columns; i++) {
    const a = (i / columns) * TAU;
    b.cylB('pier', x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.44, 0.52, deckY - 0.17, 8);
  }
  // 对角两道楼梯
  for (const a of [Math.PI * 0.25, Math.PI * 1.25]) {
    const sx = x + Math.cos(a) * (r + 3);
    const sz = z + Math.sin(a) * (r + 3);
    for (let i = 0; i < 14; i++) {
      const t = i / 14;
      b.box('stairs', lerp(x + Math.cos(a) * r, sx, t), y + deckY * (1 - t), lerp(z + Math.sin(a) * r, sz, t), 2.4, 0.22, 0.5, -(a) + Math.PI / 2);
    }
  }
}

/** 广场雕塑：错落的扭带 + 顶端光球（光谷「星河」的意象化表达） */
export function addSculpture(b, mats, o) {
  const { x = 0, y = 0, z = 0, h = 22, ribbon = 5, key = 'steel', glowKey = 'neon', seed = 7 } = o;
  const R = rng(seed);
  b.cylB('stone', x, y, z, 3.6, 4.4, 0.7, 16);
  let prev = null;
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * Math.PI * 2.6;
    const rr = 2.4 * (1 - t * 0.72);
    const p = [x + Math.cos(a) * rr, y + 0.7 + t * h, z + Math.sin(a) * rr];
    if (prev) b.beam(key, prev, p, 0.16 + (1 - t) * 0.1, 5);
    prev = p;
  }
  for (let k = 0; k < ribbon; k++) {
    const off = (k / ribbon) * TAU;
    let pv = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = t * Math.PI * 2.2 + off;
      const rr = 1.5 + 1.6 * Math.sin(t * Math.PI) * (0.6 + R() * 0.5);
      const p = [x + Math.cos(a) * rr, y + 1.2 + t * (h * 0.86), z + Math.sin(a) * rr];
      if (pv) b.beam(glowKey, pv, p, 0.075, 4);
      pv = p;
    }
  }
  b.sphere(glowKey, x, y + 0.7 + h + 0.4, z, 0.85, 0.85, 0.85, 12, 10);
}

/** 立像：莲座 + 抽象身形 + 背光（归元寺双面观音的意象化表达，不作写实描摹） */
export function addStatue(b, mats, o) {
  const { x = 0, y = 0, z = 0, h = 12, ry = 0, bodyKey = 'gold', haloKey = 'haloGlow', baseKey = 'stone' } = o;
  b.cylB(baseKey, x, y, z, 2.5, 2.8, 0.5, 16);
  // 莲座：两层层叠花瓣
  for (const [rr, hh, yy] of [[2.3, 0.5, 0.5], [1.9, 0.42, 0.95]]) {
    b.cylB(baseKey, x, y + yy, z, rr, rr * 1.08, hh, 16);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      b.sphere(bodyKey, x + Math.cos(a) * rr * 0.94, y + yy + hh * 0.5, z + Math.sin(a) * rr * 0.94, 0.34, 0.24, 0.2, 6, 4);
    }
  }
  const by = y + 1.37;
  // 身形：下宽上收，肩部略展
  b.cylB(bodyKey, x, by, z, 0.86, 1.5, h * 0.52, 14);
  b.cylB(bodyKey, x, by + h * 0.52, z, 1.05, 0.86, h * 0.2, 14);
  b.sphere(bodyKey, x, by + h * 0.78, z, 0.62, 0.68, 0.62, 12, 10);
  // 背光
  b.cyl(haloKey, x, by + h * 0.78, z - 0.5, 2.6, 2.6, 0.14, 20);
  b.cyl(baseKey, x, by + h * 0.78, z - 0.62, 2.9, 2.9, 0.1, 20);
}

/** 有轨电车：轨道 + 站台 + 一辆车（光谷） */
export function addTram(b, mats, o) {
  const { x = 0, y = 0, z = 0, len = 46, ry = 0, stop = true, key = 'tramBody' } = o;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const P = (px, pz) => [x + px * cos + pz * sin, z - px * sin + pz * cos];
  // 两条钢轨 + 枕木
  for (const sgn of [-1, 1]) {
    const q = P(0, sgn * 0.72);
    b.boxB('railBridge', q[0], y, q[1], len, 0.1, 0.09, ry);
  }
  for (let i = 0; i < Math.floor(len / 2.2); i++) {
    const q = P(-len / 2 + i * 2.2, 0);
    b.boxB('sleeper', q[0], y - 0.06, q[1], 0.4, 0.08, 1.9, ry);
  }
  // 车：三节，带受电弓与车窗
  const cx = P(0, 0);
  for (let i = 0; i < 3; i++) {
    const q = P(i * 6.4 - 6.4, 0);
    b.boxB(key, q[0], y + 0.1, q[1], 6, 2.4, 2.5, ry);
    b.box('windowLit', q[0], y + 1.7, q[1], 5.2, 0.9, 2.6, ry);
    b.boxB('dark', q[0], y + 0.1, q[1], 6.1, 0.3, 2.55, ry);
  }
  const q0 = P(-6.4, 0);
  b.beam('frame', [q0[0], y + 2.6, q0[1]], [q0[0] + cos * 2, y + 3.7, q0[1] - sin * 2], 0.05, 4);
  if (stop) {
    const q = P(11, 0);
    b.boxB('stairs', q[0], y, q[1], 9, 0.34, 3.4, ry);
    b.boxB('concrete', q[0], y + 0.34, q[1] - 2.2 * cos, 9, 0.4, 0.4, ry);
    for (const sx of [-1, 1]) {
      const p = P(11 + sx * 4.2, 0);
      b.cylB('frame', p[0], y, p[1], 0.08, 0.09, 2.8, 6);
    }
    b.box('awning', q[0], y + 3.0, q[1], 9.6, 0.12, 3.8, ry);
  }
}

/* ============================================================
   11. 水面与天空（原创着色器）
   ============================================================ */
export function createWater(THREE_NS, { size = 900, corner = 0, colorShallow, colorDeep, skyColor, night = false } = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(colorShallow ?? '#7f9a92') },
    uDeep: { value: new THREE.Color(colorDeep ?? '#39575c') },
    uSky: { value: new THREE.Color(skyColor ?? '#cfd8cd') },
    uNight: { value: night ? 1 : 0 },
    uSun: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
    uFogColor: { value: new THREE.Color('#ded9c8') },
    uFogNear: { value: 560 },
    uFogFar: { value: 1760 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.12 + uTime * 0.55) * cos(p.y * 0.1 - uTime * 0.4);
        float w2 = sin((p.x + p.y) * 0.24 - uTime * 0.85);
        p.z += w1 * 0.16 + w2 * 0.07;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vWave = w1;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSun;
      uniform float uTime; uniform float uNight;
      uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vWorld; varying float vWave;
      void main() {
        vec3 n = normalize(vec3(vWave * 0.22, 1.0, cos(vWorld.x * 0.18 + uTime * 0.5) * 0.18));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);
        vec3 base = mix(uDeep, uShallow, clamp(vWave * 0.5 + 0.5, 0.0, 1.0));
        vec3 col = mix(base, uSky, fres * 0.55);
        float spec = pow(max(dot(reflect(-uSun, n), v), 0.0), 40.0);
        col += vec3(1.0, 0.93, 0.78) * spec * (0.55 - uNight * 0.25);
        // 夜色里江面浮动的灯影
        float lamp = smoothstep(0.86, 1.0, sin(vWorld.x * 0.31 + uTime * 0.2) * sin(vWorld.z * 0.23 - uTime * 0.13));
        col += vec3(1.0, 0.62, 0.28) * lamp * uNight * 0.5;
        // 空气透视：远处江面融入天色，避免出现一块生硬的平面
        float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
        col = mix(col, uFogColor, fogF);
        gl_FragColor = vec4(col, 0.94);
        // 自定义 ShaderMaterial 不会自动走色调映射与输出色彩空间，必须显式接上，
        // 否则江水/天色会比其它材质暗一档（线性值被当成 sRGB 直接显示）。
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const geo = new THREE.PlaneGeometry(size, size, 120, 120);
  // 方形水面的四角收成圆弧，与基座轮廓对齐：否则水面会从基座的圆角处探出去。
  // 直边上的顶点不动，只把角部方格按径向压到圆弧上（保持网格密度，波浪照常）。
  if (corner > 0) {
    const c = size / 2 - corner;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i);
      const dx = Math.abs(px) - c, dy = Math.abs(py) - c;
      if (dx > 0 && dy > 0) {
        const u = dx / corner, v = dy / corner;
        const k = Math.max(u, v) / Math.max(Math.hypot(u, v), 1e-6);
        pos.setX(i, Math.sign(px) * (c + dx * k));
        pos.setY(i, Math.sign(py) * (c + dy * k));
      }
    }
    pos.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = false;
  mesh.userData.water = true;
  return mesh;
}

export function createSky(THREE_NS, { radius = 900 } = {}) {
  const uniforms = {
    uTop: { value: new THREE.Color('#8fb0c4') },
    uBottom: { value: new THREE.Color('#f0e7d2') },
    uNight: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.45, 0.5, 0.35).normalize() },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSunDir;
      uniform float uNight; uniform float uTime;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uBottom, uTop, pow(h, 0.85));
        float sun = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.86, 0.62) * pow(sun, 8.0) * (0.55 - uNight * 0.35);
        col += vec3(1.0, 0.72, 0.42) * pow(sun, 220.0) * 1.6;
        if (uNight > 0.01) {
          vec3 g = floor(vDir * 240.0);
          float s = step(0.9975, hash(g)) * uNight * (0.6 + 0.4 * sin(uTime * 2.0 + hash(g) * 30.0));
          col += vec3(0.85, 0.9, 1.0) * s;
          float moon = pow(max(dot(normalize(vDir), normalize(vec3(-0.4, 0.5, -0.2))), 0.0), 900.0);
          col += vec3(0.9, 0.94, 1.0) * moon * 0.9;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), mat);
  mesh.userData.sky = true;
  return { mesh, uniforms };
}
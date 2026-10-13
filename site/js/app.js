/**
 * app.js — 「江城小境」应用层
 *
 * 自研交互（不依赖 three 的 addons）：
 *   · Orbit   —— 阻尼环绕相机 + 平移 + 缩放 + 自动环绕 + 关键帧飞行
 *   · Roam    —— 第一人称漫游（WASD / 指针锁定 / 触屏摇杆）
 *   · 昼夜系统 —— 灯光、天空、水面、材质一起过渡
 *   · 环境音   —— WebAudio 实时合成江水、风声与钟声（无音频素材）
 */
import * as THREE from '../vendor/three.module.js';
import { REGIONS, buildCity } from './city.js';
import { applyTimeOfDay, Batcher, lerp, clamp, smooth } from './geom.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ============================================================
   一、文案
   ============================================================ */
const DICT = {
  zh: {
    brand: '江城小境',
    brandSub: 'WUHAN IN MINIATURE',
    navLabel: '主导航',
    navExplore: '探索武汉',
    navRoam: '城市漫游',
    navAbout: '关于此境',
    sound: '环境音',
    soundOn: '开启环境音',
    dayNightLabel: '昼夜切换',
    day: '白昼',
    night: '入夜',
    lang: 'EN',
    heroKicker: 'A LITTLE WORLD, A FASTER RIVER',
    heroLine1: '把江城，',
    heroLine2: '放在掌心。',
    heroLead: '漫游两江交汇的三镇，登楼、过桥、过早。在方寸之间，遇见九省通衢。',
    exploreFree: '自由探索',
    autoTour: '自动游览',
    autoTourHint: '自动游览六处风景',
    factWeather: '日照',
    factWeatherValue: '日光和煦',
    factRiver: '水位',
    factRiverValue: '江面开阔',
    factCoord: '坐标',
    heroNote: '步入街巷，听见江水的呼吸。',
    regionLabel: '区域',
    railLabel: '选择目的地',
    railTitle: '循着江水，遇见武汉',
    railHint: '选择一处风景',
    toolsLabel: '视角工具',
    toolHome: '重置全景 (H)',
    toolZoomIn: '拉近视角',
    toolZoomOut: '拉远视角',
    toolSpin: '自动环绕',
    toolLabels: '显示或隐藏地标',
    toolCapture: '保存此刻',
    toolFullscreen: '全屏查看',
    toolQuality: '画质',
    roamMode: '水岸漫游',
    roamBack: '回到起点',
    roamExit: '退出漫游',
    padLabel: '移动方向',
    padForward: '向前走',
    padLeft: '向左走',
    padBack: '向后走',
    padRight: '向右走',
    hintDrag: '旋转视角',
    hintZoom: '拉近细节',
    hintNight: '切换昼夜',
    hintHome: '回到全景',
    hintWalk: '漫游行走',
    hintExit: '退出漫游',
    aboutTitle: '方寸江城，处处江湖。',
    aboutP1:
      '江城小境是一座可以探索的微缩城市。两江交汇、三镇鼎立，黄鹤楼的飞檐、长江大桥的钢梁、江汉关的钟声、东湖的磨山倒影与户部巷的烟火，在这里相遇。',
    aboutP2:
      '所有建筑与山水均以程序化几何实时构建。地标比例与空间距离经过艺术化编排，并非实测地理模型；希望你放慢脚步，看看屋檐下、桥墩边，藏着怎样的小风景。',
    aboutFoot: '以武汉为灵感的艺术缩景 · 非实测地理模型 · 程序化生成',
    loading: '正在铺开一幅江城',
    loadingHint: '正在生成三镇街巷…',
    loadingReady: '江城就绪',
    toastTourOn: '自动游览已开启',
    toastTourOff: '自动游览已停止',
    toastNight: '江城入夜',
    toastDay: '江城天光',
    toastSoundOn: '环境音已开启',
    toastSoundOff: '环境音已关闭',
    toastQuality: '画质已切换，正在重建江城',
    toastQualityAuto: '检测到帧率偏低，已自动降低画质',
    toastRoamOn: '漫游模式：WASD 行走，拖动看四周',
    toastRoamOff: '已回到俯瞰视角',
    toastSaved: '已保存此刻的画面',
    toastLabelsOn: '地标已显示',
    toastLabelsOff: '地标已隐藏',
    toastSpinOn: '自动环绕已开启',
    toastSpinOff: '自动环绕已停止',
    filePrefix: '江城小境',
  },
  en: {
    brand: 'Wuhan in Miniature',
    brandSub: 'JIANGCHENG XIAOJING',
    navLabel: 'Main navigation',
    navExplore: 'Explore',
    navRoam: 'Walk the city',
    navAbout: 'About',
    sound: 'Ambience',
    soundOn: 'Turn ambience on',
    dayNightLabel: 'Day and night',
    day: 'Day',
    night: 'Night',
    lang: '中文',
    heroKicker: 'A LITTLE WORLD, A FASTER RIVER',
    heroLine1: 'Hold a river city',
    heroLine2: 'in your hand.',
    heroLead:
      'Wander the three towns where two rivers meet: climb the tower, cross the bridge, eat breakfast. Meet the nine-province crossroads in a single glance.',
    exploreFree: 'Explore freely',
    autoTour: 'Auto tour',
    autoTourHint: 'Six views, one after another',
    factWeather: 'Light',
    factWeatherValue: 'Warm and clear',
    factRiver: 'River',
    factRiverValue: 'Broad and open',
    factCoord: 'Position',
    heroNote: 'Step into the lanes and hear the river breathe.',
    regionLabel: 'View',
    railLabel: 'Choose a destination',
    railTitle: 'Follow the river to Wuhan',
    railHint: 'Pick a scene',
    toolsLabel: 'View tools',
    toolHome: 'Reset the whole picture (H)',
    toolZoomIn: 'Zoom in',
    toolZoomOut: 'Zoom out',
    toolSpin: 'Auto orbit',
    toolLabels: 'Show or hide landmarks',
    toolCapture: 'Save this moment',
    toolFullscreen: 'Fullscreen',
    toolQuality: 'Quality',
    roamMode: 'Riverside walk',
    roamBack: 'Back to start',
    roamExit: 'Leave walk mode',
    padLabel: 'Movement',
    padForward: 'Walk forward',
    padLeft: 'Walk left',
    padBack: 'Walk back',
    padRight: 'Walk right',
    hintDrag: 'orbit',
    hintZoom: 'zoom',
    hintNight: 'day / night',
    hintHome: 'whole picture',
    hintWalk: 'walk',
    hintExit: 'leave walk',
    aboutTitle: 'A small city, an endless river.',
    aboutP1:
      'Wuhan in Miniature is a city you can explore. Two rivers meet, three towns stand facing each other: the eaves of the Yellow Crane Tower, the steel of the Yangtze bridge, the chimes of the customs house, the hills mirrored in East Lake, and the breakfast smoke of Hubu Alley.',
    aboutP2:
      'Every building, hill and tree is generated procedurally at load time. Distances and proportions are an artistic arrangement rather than a survey; take your time and look under the eaves and beside the piers.',
    aboutFoot: 'An artistic miniature inspired by Wuhan · not a survey model · procedurally generated',
    loading: 'Unfolding a river city',
    loadingHint: 'Laying out the three towns…',
    loadingReady: 'Ready',
    toastTourOn: 'Auto tour started',
    toastTourOff: 'Auto tour stopped',
    toastNight: 'Night falls on the river',
    toastDay: 'Morning light',
    toastSoundOn: 'Ambience on',
    toastSoundOff: 'Ambience off',
    toastQuality: 'Quality changed, rebuilding',
    toastQualityAuto: 'Low frame rate detected, quality lowered',
    toastRoamOn: 'Walk mode: WASD to move, drag to look',
    toastRoamOff: 'Back to the overview',
    toastSaved: 'Saved the current view',
    toastLabelsOn: 'Landmarks shown',
    toastLabelsOff: 'Landmarks hidden',
    toastSpinOn: 'Auto orbit on',
    toastSpinOff: 'Auto orbit off',
    filePrefix: 'wuhan-in-miniature',
  },
};
let LANG = 'zh';
const t = (key) => (DICT[LANG] && DICT[LANG][key]) || DICT.zh[key] || key;

/* ============================================================
   二、渲染器与场景
   ============================================================ */
const stage = $('#stage');

/* ============================================================
   零、画质档位（必须在建渲染器之前定档）
   低配设备（软件渲染、核显轻薄本、手机）自动降档：建筑密度、细节构件、
   行道树、车船数量、像素比与阴影一起缩，避免一开场就掉到十几帧。
   抗锯齿与像素比只能在创建渲染器时决定，所以档位探测放在这里。
   ============================================================ */
const QUERY = new URLSearchParams(location.search);
const QUALITY_TIERS = {
  high: { id: 'high', zh: '高', en: 'High', density: 1, detail: 1, trees: 1, vehicles: 1, pixelRatio: 2, shadows: true, shadowSize: 2048, antialias: true },
  mid: { id: 'mid', zh: '中', en: 'Mid', density: 0.6, detail: 0.55, trees: 0.7, vehicles: 0.65, pixelRatio: 1.5, shadows: true, shadowSize: 1024, antialias: true },
  low: { id: 'low', zh: '低', en: 'Low', density: 0.32, detail: 0.2, trees: 0.4, vehicles: 0.4, pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false },
};
const QUALITY_ORDER = ['high', 'mid', 'low'];

/**
 * 用一次性上下文读取 GPU 名称；拿到就主动释放，不占着一个 WebGL 上下文
 */
function probeGpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return name;
  } catch (e) {
    return '';
  }
}

/**
 * 探测设备档次：显式 ?quality= 优先，其次看渲染器字符串 / 核心数 / 内存 / 触屏
 */
function detectQuality() {
  const forced = QUERY.get('quality');
  if (forced && QUALITY_TIERS[forced]) return { tier: forced, reason: 'url' };
  const gpu = probeGpuName();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 560;
  if (/swiftshader|software|llvmpipe|basic render|mesa offscreen/i.test(gpu)) {
    return { tier: 'low', reason: 'software-renderer', gpu };
  }
  if (cores <= 4 || mem <= 4) return { tier: 'low', reason: `cores=${cores},mem=${mem}`, gpu };
  if (coarse || small) return { tier: 'mid', reason: coarse ? 'touch' : 'small-viewport', gpu };
  if (cores <= 8) return { tier: 'mid', reason: `cores=${cores}`, gpu };
  return { tier: 'high', reason: 'capable', gpu };
}

const __q0 = detectQuality();
let qualityTier = __q0.tier;
let qualityReason = __q0.reason;
let qualityGpu = __q0.gpu || '';
let qualityManual = QUERY.has('quality');
let watchdogOff = false; // 帧率监测是否已完成（跑得顺畅或已到最低档）
const qualityDef = () => QUALITY_TIERS[qualityTier];

const renderer = new THREE.WebGLRenderer({
  antialias: qualityDef().antialias,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityDef().pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.domElement.style.touchAction = 'none';
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xded9c8, 560, 1760);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.6, 2600);
camera.position.set(560, 460, 640);

const sun = new THREE.DirectionalLight(0xfff2dc, 2.1);
sun.position.set(170, 280, 130);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -350;
sun.shadow.camera.right = 350;
sun.shadow.camera.top = 350;
sun.shadow.camera.bottom = -350;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 950;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.55;
sun.target.position.set(16, 0, 16);
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight(0xcfe0e8, 0x8b8f6c, 1.0);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.26);
scene.add(ambient);

/* ============================================================
   三、相机控制器
   ============================================================ */
class Orbit {
  constructor(cam, dom) {
    this.camera = cam;
    this.dom = dom;
    this.target = new THREE.Vector3(16, 6, 16);
    this.radius = 700;
    this.radiusGoal = 700;
    this.theta = 0.7;
    this.phi = 0.95;
    this.minRadius = 16;
    this.maxRadius = 880;
    this.minPhi = 0.1;
    this.maxPhi = 1.53;
    this.spin = 0;
    this.enabled = true;
    this.drag = null;
    this.vel = { theta: 0, phi: 0 };
    this.tween = null;
    this.pointers = new Map();
    this.pinch = null;
    this.onUserInput = null;
  }

  setFrom(pos, target) {
    this.target.copy(target);
    const d = new THREE.Vector3().subVectors(pos, target);
    this.radius = this.radiusGoal = clamp(d.length(), this.minRadius, this.maxRadius);
    this.phi = clamp(Math.acos(clamp(d.y / (d.length() || 1), -1, 1)), this.minPhi, this.maxPhi);
    this.theta = Math.atan2(d.x, d.z);
  }

  flyTo({ camera: c, target: tg }, duration = 1.7) {
    const p = new THREE.Vector3().fromArray(c);
    const q = new THREE.Vector3().fromArray(tg);
    const d = new THREE.Vector3().subVectors(p, q);
    const radius = clamp(d.length(), this.minRadius, this.maxRadius);
    const phi = clamp(Math.acos(clamp(d.y / (d.length() || 1), -1, 1)), this.minPhi, this.maxPhi);
    let theta = Math.atan2(d.x, d.z);
    // 走最短弧
    while (theta - this.theta > Math.PI) theta -= Math.PI * 2;
    while (theta - this.theta < -Math.PI) theta += Math.PI * 2;
    this.tween = {
      t: 0,
      duration,
      from: { theta: this.theta, phi: this.phi, radius: this.radius, target: this.target.clone() },
      to: { theta, phi, radius, target: q },
    };
    this.vel.theta = 0;
    this.vel.phi = 0;
  }

  zoomBy(factor) {
    this.radiusGoal = clamp(this.radiusGoal * factor, this.minRadius, this.maxRadius);
  }

  pan(dx, dy) {
    const scale = this.radius * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
    this.target.addScaledVector(right, -dx * scale);
    this.target.addScaledVector(fwd, -dy * scale);
    this.target.x = clamp(this.target.x, -330, 370);
    this.target.z = clamp(this.target.z, -300, 300);
    this.target.y = clamp(this.target.y, 0, 90);
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const e = smooth(tw.t);
      this.theta = lerp(tw.from.theta, tw.to.theta, e);
      this.phi = lerp(tw.from.phi, tw.to.phi, e);
      this.radiusGoal = this.radius = lerp(tw.from.radius, tw.to.radius, e);
      this.target.lerpVectors(tw.from.target, tw.to.target, e);
      if (tw.t >= 1) {
        this.tween = null;
        this.setFrom(this.camera.position, this.target);
        return;
      }
    } else {
      this.theta += this.vel.theta;
      this.phi += this.vel.phi;
      this.vel.theta *= 0.9;
      this.vel.phi *= 0.9;
      this.theta += this.spin * dt;
      this.radius += (this.radiusGoal - this.radius) * Math.min(1, dt * 7);
      this.phi = clamp(this.phi, this.minPhi, this.maxPhi);
      this.radius = clamp(this.radius, this.minRadius, this.maxRadius);
    }
    const sp = Math.sin(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sp * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sp * Math.cos(this.theta),
    );
    this.camera.lookAt(this.target);
  }
}

const orbit = new Orbit(camera, renderer.domElement);

/* ---------- 指针交互 ---------- */
function hasRoam() {
  return document.body.classList.contains('is-roaming');
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 2) orbit.drag = { mode: 'pan', x: e.clientX, y: e.clientY };
  else if (e.button === 0) orbit.drag = { mode: hasRoam() ? 'look' : 'orbit', x: e.clientX, y: e.clientY };
  orbit.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (orbit.pointers.size === 2) {
    const [a, b] = Array.from(orbit.pointers.values());
    orbit.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    orbit.drag = null;
  }
  renderer.domElement.setPointerCapture?.(e.pointerId);
  if (orbit.onUserInput) orbit.onUserInput();
  if (hasRoam() && roam.needLock && e.pointerType === 'mouse') renderer.domElement.requestPointerLock?.();
});

window.addEventListener('pointermove', (e) => {
  const p = orbit.pointers.get(e.pointerId);
  if (p) {
    p.x = e.clientX;
    p.y = e.clientY;
  }
  if (document.pointerLockElement === renderer.domElement) {
    if (hasRoam()) roam.look(e.movementX || 0, e.movementY || 0);
    return;
  }
  if (orbit.pointers.size === 2 && orbit.pinch) {
    const [a, b] = Array.from(orbit.pointers.values());
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    if (orbit.pinch.dist > 0) orbit.zoomBy(Math.pow(orbit.pinch.dist / dist, 0.9));
    if (!hasRoam()) orbit.pan(cx - orbit.pinch.cx, cy - orbit.pinch.cy);
    orbit.pinch = { dist, cx, cy };
    return;
  }
  if (!orbit.drag) return;
  const dx = e.clientX - orbit.drag.x;
  const dy = e.clientY - orbit.drag.y;
  orbit.drag.x = e.clientX;
  orbit.drag.y = e.clientY;
  if (orbit.drag.mode === 'pan') orbit.pan(dx, dy);
  else if (orbit.drag.mode === 'look') roam.look(dx * 2.4, dy * 2.4);
  else {
    orbit.theta -= dx * 0.0044;
    orbit.phi -= dy * 0.0044;
    orbit.phi = clamp(orbit.phi, orbit.minPhi, orbit.maxPhi);
    orbit.vel.theta = -dx * 0.0009;
    orbit.vel.phi = -dy * 0.0009;
  }
});

function endPointer(e) {
  orbit.pointers.delete(e.pointerId);
  if (orbit.pointers.size < 2) orbit.pinch = null;
  if (orbit.pointers.size === 0) orbit.drag = null;
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    orbit.zoomBy(Math.exp(clamp(e.deltaY, -240, 240) * 0.0015));
    if (orbit.onUserInput) orbit.onUserInput();
  },
  { passive: false },
);

/* ============================================================
   四、漫游模式
   ============================================================ */
const roam = {
  active: false,
  needLock: true,
  yaw: 0,
  pitch: -0.05,
  pos: new THREE.Vector3(),
  center: new THREE.Vector3(),
  limit: 40,
  eye: 1.7,
  keys: new Set(),
  move: { forward: 0, left: 0, back: 0, right: 0 },
  vel: new THREE.Vector3(),
  bob: 0,
  area: null,      // 矩形漫游区（并集）；为 null 时退回圆形 limit
  blockers: [],    // 区域内不可进入的矩形（摊位、水缸……）
  pad: 0.42,       // 身体半径：区域边界收进这么多
  padB: 0.28,      // 障碍外扩量（比墙小一点，免得巷子被摊子堵死）
};
const EYE = 1.7;

/** 点是否落在矩形并集内（rect = [x0, z0, x1, z1]）；贴边也算在内，免得边界上反复解算 */
function inRects(rects, x, z, pad = 0) {
  const e = 1e-3;
  for (const r of rects) {
    if (x >= r[0] + pad - e && x <= r[2] - pad + e && z >= r[1] + pad - e && z <= r[3] - pad + e) return true;
  }
  return false;
}

/** 漫游可达性：在区域内、且不在任何障碍里（探针与判定共用） */
function roamFree(x, z) {
  if (roam.area) {
    if (!inRects(roam.area, x, z, roam.pad)) return false;
  } else {
    const dx = x - roam.center.x;
    const dz = z - roam.center.z;
    if (dx * dx + dz * dz > roam.limit * roam.limit) return false;
  }
  for (const b of roam.blockers) {
    if (x > b[0] - roam.padB && x < b[2] + roam.padB && z > b[1] - roam.padB && z < b[3] + roam.padB) return false;
  }
  return true;
}

/**
 * 把「想去的位置」修正成合法位置：先投影回漫游区，再从障碍里沿最小穿透方向推出。
 * 反复几轮让两个约束同时成立——这样人不会卡在墙角，而是顺着摊子边缘滑过去。
 */
function resolveRoam(nx, nz) {
  for (let iter = 0; iter < 3; iter++) {
    // 区域：投影到最近的合法矩形
    if (roam.area && !inRects(roam.area, nx, nz, roam.pad)) {
      let bx = nx;
      let bz = nz;
      let bd = Infinity;
      for (const r of roam.area) {
        const cx = clamp(nx, r[0] + roam.pad, r[2] - roam.pad);
        const cz = clamp(nz, r[1] + roam.pad, r[3] - roam.pad);
        const d = (cx - nx) * (cx - nx) + (cz - nz) * (cz - nz);
        if (d < bd) {
          bd = d;
          bx = cx;
          bz = cz;
        }
      }
      nx = bx;
      nz = bz;
    } else if (!roam.area) {
      const dx = nx - roam.center.x;
      const dz = nz - roam.center.z;
      const d = Math.hypot(dx, dz);
      if (d > roam.limit) {
        nx = roam.center.x + (dx / d) * roam.limit;
        nz = roam.center.z + (dz / d) * roam.limit;
      }
    }
    // 障碍：若陷在里面，沿穿透最浅的一侧推出来
    let pushed = false;
    for (const b2 of roam.blockers) {
      const x0 = b2[0] - roam.padB;
      const x1 = b2[2] + roam.padB;
      const z0 = b2[1] - roam.padB;
      const z1 = b2[3] + roam.padB;
      if (nx > x0 && nx < x1 && nz > z0 && nz < z1) {
        const dl = nx - x0;
        const dr = x1 - nx;
        const dn = nz - z0;
        const df = z1 - nz;
        const m = Math.min(dl, dr, dn, df);
        if (m === dl) nx = x0;
        else if (m === dr) nx = x1;
        else if (m === dn) nz = z0;
        else nz = z1;
        pushed = true;
      }
    }
    if (!pushed) break;
  }
  return [nx, nz];
}

function enterRoam(region) {
  roam.active = true;
  roam.needLock = window.matchMedia('(pointer: fine)').matches;
  const w = region?.walk ?? [40, EYE, 66];
  roam.pos.set(w[0], w[1] ?? EYE, w[2]);
  roam.eye = w[1] ?? EYE;
  roam.center.set(w[0], 0, w[2]);
  roam.limit = region?.roam ?? 40;
  // 巷子一类的地方用矩形并集限定活动范围，并把摊位登记为障碍
  roam.area = region?.walkArea ? region.walkArea.map((r) => r.slice()) : null;
  roam.blockers = region?.useBlockers && city?.blockers ? city.blockers.map((r) => r.slice()) : [];
  // 朝向：优先用 roamLook（巷子要正对着巷身走），否则看向该区域的取景点
  const look = new THREE.Vector3().fromArray(region?.roamLook ?? region?.target ?? [40, 6, 60]);
  const dir = new THREE.Vector3().subVectors(look, roam.pos);
  roam.yaw = Math.atan2(-dir.x, -dir.z);
  roam.pitch = -0.04;
  roam.vel.set(0, 0, 0);
  document.body.classList.add('is-roaming');
  syncTopNav();
  const hud = $('#roamHud');
  if (hud) hud.hidden = false;
  orbit.tween = null;
  toast('toastRoamOn');
}

function exitRoam() {
  roam.active = false;
  document.body.classList.remove('is-roaming');
  syncTopNav();
  const hud = $('#roamHud');
  if (hud) hud.hidden = true;
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
  orbit.setFrom(camera.position, new THREE.Vector3().copy(roam.pos).add(new THREE.Vector3(0, 6, 0)));
  const region = REGIONS[activeRegion];
  orbit.flyTo({ camera: region.camera, target: region.target }, 1.4);
  toast('toastRoamOff');
}

roam.look = (dx, dy) => {
  roam.yaw -= dx * 0.0022;
  roam.pitch = clamp(roam.pitch - dy * 0.0022, -1.15, 1.0);
};

function updateRoam(dt) {
  if (!roam.active) return;
  const k = roam.keys;
  let f = 0;
  let s = 0;
  if (k.has('KeyW') || k.has('ArrowUp') || roam.move.forward) f += 1;
  if (k.has('KeyS') || k.has('ArrowDown') || roam.move.back) f -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft') || roam.move.left) s -= 1;
  if (k.has('KeyD') || k.has('ArrowRight') || roam.move.right) s += 1;
  const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
  const speed = sprint ? 26 : 11;
  const sin = Math.sin(roam.yaw);
  const cos = Math.cos(roam.yaw);
  const wish = new THREE.Vector3(-sin * f + cos * s, 0, -cos * f - sin * s);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
  roam.vel.lerp(wish, Math.min(1, dt * 8));
  roam.pos.addScaledVector(roam.vel, dt);
  // 位移解算：把落点修正成合法位置（区域内 + 不陷进障碍），自然形成贴墙滑动
  if (!roamFree(roam.pos.x, roam.pos.z)) {
    const solved = resolveRoam(roam.pos.x, roam.pos.z);
    if (Math.hypot(solved[0] - roam.pos.x, solved[1] - roam.pos.z) > 0.5) roam.vel.set(0, 0, 0);
    roam.pos.x = solved[0];
    roam.pos.z = solved[1];
  }
  roam.bob += dt * (2.4 + roam.vel.length() * 0.32);
  const bobY = Math.sin(roam.bob * 2) * Math.min(0.09, roam.vel.length() * 0.006);
  camera.position.set(roam.pos.x, roam.eye + bobY, roam.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(roam.pitch, roam.yaw, 0);
}

/* ============================================================
   五、状态与昼夜
   ============================================================ */
const state = {
  night: false,
  tod: 0,
  labels: true,
  tour: false,
  spin: false,
  sound: false,
};
let activeRegion = 0;
let city = null;
let ready = false;

const DAY = {
  sun: new THREE.Color('#fff2dc'),
  sunI: 2.1,
  pos: new THREE.Vector3(170, 280, 130),
  hemiSky: new THREE.Color('#cfe0e8'),
  hemiGround: new THREE.Color('#8b8f6c'),
  hemiI: 1.0,
  ambI: 0.26,
  fog: new THREE.Color('#ded9c8'),
  fogNear: 560,
  fogFar: 1760,
  skyTop: new THREE.Color('#84a9c4'),
  skyBottom: new THREE.Color('#e8e2cf'),
  shallow: new THREE.Color('#8fa79b'),
  deep: new THREE.Color('#40606a'),
  waterSky: new THREE.Color('#e0dccb'),
  exposure: 1.0,
};
const NIGHT = {
  sun: new THREE.Color('#c3d4ec'),
  sunI: 0.95,
  pos: new THREE.Vector3(-150, 240, -110),
  hemiSky: new THREE.Color('#35495f'),
  hemiGround: new THREE.Color('#1f2b27'),
  hemiI: 0.85,
  ambI: 0.34,
  fog: new THREE.Color('#141f2a'),
  fogNear: 460,
  fogFar: 1620,
  skyTop: new THREE.Color('#0e1c2c'),
  skyBottom: new THREE.Color('#223449'),
  shallow: new THREE.Color('#3d5a63'),
  deep: new THREE.Color('#152430'),
  waterSky: new THREE.Color('#22323f'),
  exposure: 1.22,
};

function applyTime(t01) {
  const t = clamp(t01, 0, 1);
  sun.color.copy(DAY.sun).lerp(NIGHT.sun, t);
  sun.intensity = lerp(DAY.sunI, NIGHT.sunI, t);
  sun.position.copy(DAY.pos).lerp(NIGHT.pos, t);
  hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, t);
  hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, t);
  hemi.intensity = lerp(DAY.hemiI, NIGHT.hemiI, t);
  ambient.intensity = lerp(DAY.ambI, NIGHT.ambI, t);
  scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, t);
  scene.fog.near = lerp(DAY.fogNear, NIGHT.fogNear, t);
  scene.fog.far = lerp(DAY.fogFar, NIGHT.fogFar, t);
  renderer.toneMappingExposure = lerp(DAY.exposure, NIGHT.exposure, t);
  if (city) {
    applyTimeOfDay(city.mats, t);
    city.skyU.uNight.value = t;
    city.skyU.uTop.value.copy(DAY.skyTop).lerp(NIGHT.skyTop, t);
    city.skyU.uBottom.value.copy(DAY.skyBottom).lerp(NIGHT.skyBottom, t);
    city.skyU.uSunDir.value.copy(sun.position).normalize();
    const wu = city.water.material.uniforms;
    wu.uNight.value = t;
    wu.uShallow.value.copy(DAY.shallow).lerp(NIGHT.shallow, t);
    wu.uDeep.value.copy(DAY.deep).lerp(NIGHT.deep, t);
    wu.uSky.value.copy(DAY.waterSky).lerp(NIGHT.waterSky, t);
    wu.uSun.value.copy(sun.position).normalize();
    wu.uFogColor.value.copy(scene.fog.color);
    wu.uFogNear.value = scene.fog.near;
    wu.uFogFar.value = scene.fog.far;
  }
  document.body.classList.toggle('is-night', t > 0.5);
}

function setNight(on, quiet = false) {
  state.night = on;
  $$('[data-action="day"], [data-action="night"]').forEach((el) => {
    el.classList.toggle('is-active', on ? el.dataset.action === 'night' : el.dataset.action === 'day');
  });
  if (city) city.water.material.uniforms.uNight.value = on ? 1 : 0;
  if (!quiet) toast(on ? 'toastNight' : 'toastDay');
}

/* ============================================================
   六、界面
   ============================================================ */
// 轻提示：传 i18n key，切换语言时会同步重播
function toast(key) {
  const el = $('#toast');
  if (!el) return;
  toast._key = key;
  el.textContent = t(key);
  el.hidden = false;
  el.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => {
      el.hidden = true;
    }, 420);
  }, 2200);
}

function regionCopy(r) {
  const c = r[LANG] || r.zh;
  return c;
}

function buildRail() {
  const list = $('#railList');
  if (!list) return;
  list.innerHTML = '';
  REGIONS.forEach((r, i) => {
    const c = regionCopy(r);
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rail-item' + (i === activeRegion ? ' is-active' : '');
    btn.dataset.region = r.id;
    btn.innerHTML =
      `<span class="rail-icon">${r.icon}</span>` +
      `<span class="rail-text"><b>${c.name}</b><em>${c.en}</em><i>${c.tag}</i></span>` +
      `<span class="rail-coord">${r.coord}</span>`;
    btn.addEventListener('click', () => selectRegion(i, true));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function buildLabels() {
  const layer = $('#labels');
  if (!layer || !city) return;
  layer.innerHTML = '';
  for (const lm of city.landmarks) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'label';
    btn.dataset.id = lm.id;
    btn.dataset.region = lm.region;
    btn.innerHTML = `<i class="label-dot"></i><span class="label-name">${LANG === 'zh' ? lm.zh : lm.en}</span><small class="label-en">${lm.en}</small>`;
    btn.addEventListener('click', () => {
      const idx = REGIONS.findIndex((r) => r.id === lm.region);
      if (idx >= 0) selectRegion(idx, true);
    });
    layer.appendChild(btn);
    lm.el = btn;
  }
}

function updateLabels() {
  if (!city) return;
  // 标签层本身必须放行指针：整层吃掉 pointerdown 会让拖拽旋转彻底失效。
  // 单个 .label 由 CSS 的 pointer-events:auto 保持可点击。
  const layer = $('#labels');
  if (layer) layer.style.pointerEvents = 'none';
  const w = window.innerWidth;
  const h = window.innerHeight;
  const v = new THREE.Vector3();
  for (const lm of city.landmarks) {
    if (!lm.el) continue;
    if (!state.labels) {
      lm.el.classList.add('is-hidden');
      continue;
    }
    v.set(lm.pos[0], lm.pos[1], lm.pos[2]);
    const dist = v.distanceTo(camera.position);
    v.project(camera);
    const visible = v.z < 1 && v.x > -1.08 && v.x < 1.08 && v.y > -1.08 && v.y < 1.08 && dist < 560;
    lm.el.classList.toggle('is-hidden', !visible);
    if (!visible) continue;
    const x = (v.x * 0.5 + 0.5) * w;
    const y = (-v.y * 0.5 + 0.5) * h;
    lm.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    lm.el.style.opacity = String(clamp((560 - dist) / 180, 0.15, 1));
    lm.el.classList.toggle('is-active', REGIONS[activeRegion]?.id === lm.region && dist < 420);
  }
}

function updateSceneCard() {
  const r = REGIONS[activeRegion];
  const c = regionCopy(r);
  const idx = String(activeRegion + 1).padStart(2, '0');
  const set = (sel, val) => {
    const el = $(sel);
    if (el) el.textContent = val;
  };
  set('#regionIndex', idx);
  set('#sceneName', c.name);
  set('#sceneEn', c.en);
  set('#sceneTag', c.tag);
  set('#sceneDesc', c.desc);
  set('#sceneCoord', r.coord);
}

function selectRegion(i, fly = true) {
  if (i < 0 || i >= REGIONS.length) return;
  activeRegion = i;
  const r = REGIONS[i];
  updateSceneCard();
  $$('.rail-item').forEach((el) => el.classList.toggle('is-active', el.dataset.region === r.id));
  if (roam.active) {
    if (fly) enterRoam(r);
    else {
      roam.center.set(r.walk[0], 0, r.walk[2]);
      roam.limit = r.roam ?? 40;
    }
    return;
  }
  if (fly) orbit.flyTo({ camera: r.camera, target: r.target }, 1.8);
}

function applyLang(lang) {
  LANG = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of $$('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of $$('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  buildRail();
  buildLabels();
  updateSceneCard();
  updateQualityUI();
  // 轻提示若正显示，切语言时一并更新
  const tel = $('#toast');
  if (tel && toast._key && tel.classList.contains('is-visible')) tel.textContent = t(toast._key);
}

/* ---------- 按钮 ---------- */
// 顶部三个切换按钮共用一条选中光标（.topnav button.is-active::after），
// 任何入口改变视图状态时都要同步，否则光标会一直停在第一列。
function setTopNav(action) {
  $$('.topnav [data-action]').forEach((el) => el.classList.toggle('is-active', el.dataset.action === action));
}
function syncTopNav() {
  setTopNav(document.body.classList.contains('is-roaming') ? 'roam' : 'explore');
}

function onAction(action) {
  switch (action) {
    case 'home':
      if (roam.active) exitRoam();
      orbit.spin = 0;
      selectRegion(0, true);
      break;
    case 'explore': {
      const hero = $('#hero');
      if (hero) hero.hidden = true;
      if (roam.active) exitRoam();
      syncTopNav();
      break;
    }
    case 'roam': {
      const hero = $('#hero');
      if (hero) hero.hidden = true;
      if (!roam.active) enterRoam(REGIONS[activeRegion]);
      syncTopNav();
      break;
    }
    case 'about': {
      const m = $('#aboutBackdrop');
      if (m) m.hidden = false;
      setTopNav('about');
      break;
    }
    case 'close-about': {
      const m = $('#aboutBackdrop');
      if (m) m.hidden = true;
      syncTopNav();
      break;
    }
    case 'tour':
      state.tour = !state.tour;
      $$('[data-action="tour"]').forEach((el) => el.classList.toggle('is-active', state.tour));
      scheduleTour();
      toast(state.tour ? 'toastTourOn' : 'toastTourOff');
      break;
    case 'spin':
      state.spin = !state.spin;
      orbit.spin = state.spin ? 0.055 : 0;
      $$('[data-action="spin"]').forEach((el) => {
        el.classList.toggle('is-active', state.spin);
        el.setAttribute('aria-pressed', String(state.spin));
      });
      toast(state.spin ? 'toastSpinOn' : 'toastSpinOff');
      break;
    case 'labels':
      state.labels = !state.labels;
      $$('[data-action="labels"]').forEach((el) => {
        el.classList.toggle('is-active', state.labels);
        el.setAttribute('aria-pressed', String(state.labels));
      });
      toast(state.labels ? 'toastLabelsOn' : 'toastLabelsOff');
      break;
    case 'plus':
      orbit.zoomBy(0.78);
      break;
    case 'minus':
      orbit.zoomBy(1.28);
      break;
    case 'day':
      setNight(false);
      break;
    case 'night':
      setNight(true);
      break;
    case 'sound':
      toggleSound();
      break;
    case 'quality': {
      // 手动循环：高 → 中 → 低 → 高
      const i = QUALITY_ORDER.indexOf(qualityTier);
      const next = QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length];
      qualityManual = true;
      setQuality(next, 'manual');
      break;
    }
    case 'lang':
      applyLang(LANG === 'zh' ? 'en' : 'zh');
      break;
    case 'capture':
      capture();
      break;
    case 'fullscreen':
      toggleFullscreen();
      break;
    case 'roam-home':
      enterRoam(REGIONS[activeRegion]);
      break;
    case 'roam-exit':
      exitRoam();
      break;
    default:
      break;
  }
}

$$('[data-action]').forEach((el) => {
  el.addEventListener('click', (e) => {
    if (el.tagName === 'A') e.preventDefault();
    onAction(el.dataset.action);
  });
});

/* ---------- 摇杆（触屏） ---------- */
$$('[data-move]').forEach((el) => {
  const dir = el.dataset.move;
  const set = (v) => {
    roam.move[dir] = v;
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    set(1);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, () => set(0)));
});
$$('[data-action="roam-exit"]').forEach((el) => el.addEventListener('click', exitRoam));

/* ---------- 键盘 ---------- */
window.addEventListener('keydown', (e) => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  roam.keys.add(e.code);
  switch (e.code) {
    case 'KeyN':
      setNight(!state.night);
      break;
    case 'KeyH':
      onAction('home');
      break;
    case 'KeyL':
      onAction('labels');
      break;
    case 'KeyT':
      onAction('tour');
      break;
    case 'KeyF':
      toggleFullscreen();
      break;
    case 'KeyP':
      capture();
      break;
    case 'Escape':
      if (!$('#aboutBackdrop')?.hidden) onAction('close-about');
      else if (roam.active) exitRoam();
      break;
    case 'Digit1':
    case 'Digit2':
    case 'Digit3':
    case 'Digit4':
    case 'Digit5':
    case 'Digit6':
      selectRegion(Number(e.code.slice(-1)) - 1, true);
      break;
    default:
      break;
  }
});
window.addEventListener('keyup', (e) => roam.keys.delete(e.code));
window.addEventListener('blur', () => roam.keys.clear());

/* ---------- 自动游览 ---------- */
let tourTimer = null;
function scheduleTour() {
  clearTimeout(tourTimer);
  if (!state.tour) return;
  tourTimer = setTimeout(() => {
    if (!state.tour) return;
    const next = (activeRegion + 1) % REGIONS.length;
    selectRegion(next, true);
    scheduleTour();
  }, 9000);
}
orbit.onUserInput = () => {
  if (state.tour) {
    state.tour = false;
    clearTimeout(tourTimer);
    $$('[data-action="tour"]').forEach((el) => el.classList.remove('is-active'));
  }
};

/* ---------- 截图 / 全屏 ---------- */
function capture() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `${t('filePrefix')}-${stamp}.png`;
  a.click();
  toast('toastSaved');
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
}

/* ---------- 环境音：实时合成 ---------- */
const ambience = {
  ctx: null,
  master: null,
  on: false,
  bellTimer: null,
  build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    // 2 秒噪声缓冲，供江水与风声复用
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.2 + w * 0.35;
    }

    // 江水：低通 + 缓慢起伏
    const water = ctx.createBufferSource();
    water.buffer = buf;
    water.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const wg = ctx.createGain();
    wg.gain.value = 0.5;
    water.connect(lp).connect(wg).connect(master);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.22;
    lfo.connect(lfoGain).connect(wg.gain);
    lfo.start();
    water.start();

    // 风声：带通，轻微摆动
    const wind = ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    wind.playbackRate.value = 0.7;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.7;
    const wd = ctx.createGain();
    wd.gain.value = 0.1;
    wind.connect(bp).connect(wd).connect(master);
    wind.start();

    // 江汉关的钟声
    const bell = () => {
      if (!this.on) return;
      const now = ctx.currentTime;
      const partials = [
        [523.25, 1, 5.5],
        [1046.5, 0.42, 3.6],
        [1568, 0.22, 2.4],
        [2093, 0.12, 1.6],
      ];
      for (const [f, a, d] of partials) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(a * 0.075, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + d);
        o.connect(g).connect(master);
        o.start(now);
        o.stop(now + d + 0.1);
      }
      this.bellTimer = setTimeout(bell, 42000 + Math.random() * 26000);
    };
    this.bellTimer = setTimeout(bell, 9000);
    return true;
  },
  // 只切换增益，不等待 resume：没有音频输出设备时 resume() 可能长期 pending，
  // 若在此 await，按钮会像“按了没反应”
  toggle() {
    if (!this.ctx && !this.build()) return false;
    const ctx = this.ctx;
    if (!this.on) {
      // 浏览器要求用户手势后才能真正出声，失败也只影响声音本身
      try {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {
        /* 忽略：无声环境下继续把 UI 状态切过去 */
      }
      if (this.master) this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.8);
      this.on = true;
    } else {
      if (this.master) this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      this.on = false;
      clearTimeout(this.bellTimer);
    }
    return this.on;
  },
};

function toggleSound() {
  const on = ambience.toggle();
  state.sound = !!on;
  $$('[data-action="sound"]').forEach((el) => {
    el.classList.toggle('is-active', state.sound);
    el.setAttribute('aria-pressed', String(state.sound));
  });
  toast(state.sound ? 'toastSoundOn' : 'toastSoundOff');
}

/* ============================================================
   七、桥上的车与火车
   ============================================================ */
function makeVehicle(mats, bodyKey, kind = 'car') {
  const g = new THREE.Group();
  const vb = new Batcher(mats);
  if (kind === 'train') {
    for (let i = 0; i < 7; i++) {
      const x = i * 8.4 - 25;
      vb.boxB('steel', x, 0.1, 0, 7.6, 2.5, 2.2);
      vb.boxB('windowLit', x, 1.5, 0, 7.0, 0.85, 2.35);
      vb.boxB('dark', x, 0, 0, 7.8, 0.35, 2.3);
    }
    vb.boxB(bodyKey, -33, 0.1, 0, 8, 2.6, 2.2);
  } else {
    vb.boxB('dark', 0, 0, 0, 3.6, 0.3, 1.8);
    vb.boxB(bodyKey, 0, 0.3, 0, 3.4, 0.85, 1.7);
    vb.boxB('cabin', 0, 1.15, 0, 1.9, 0.7, 1.5);
  }
  vb.finish(g);
  return g;
}

function buildTraffic(root, mats) {
  const cars = [];
  const allSpecs = [
    { z: 48, y: 11.55, dir: 1, lanes: [-2.6, -1.2], color: 'containerA', speed: 13 },
    { z: 48, y: 11.55, dir: -1, lanes: [1.2, 2.6], color: 'containerB', speed: 12 },
    { z: -76, y: 13.75, dir: 1, lanes: [-2.2, -0.8], color: 'containerA', speed: 15 },
    { z: -76, y: 13.75, dir: -1, lanes: [0.8, 2.2], color: 'containerB', speed: 14 },
  ];
  // 低配档位少放几辆车：车在动，是每帧都要重算矩阵的对象
  const keep = qualityDef().vehicles >= 0.6 ? 4 : qualityDef().vehicles >= 0.35 ? 2 : 1;
  const specs = allSpecs.slice(0, keep);
  for (const sp of specs) {
    for (const lane of sp.lanes) {
      const mesh = makeVehicle(mats, sp.color, 'car');
      mesh.position.set(-70 + Math.random() * 140, sp.y, sp.z + lane);
      mesh.rotation.y = sp.dir > 0 ? 0 : Math.PI;
      root.add(mesh);
      cars.push({ obj: mesh, ...sp, lane });
    }
  }
  // 长江大桥下层：一列过江的火车
  const train = makeVehicle(mats, 'containerB', 'train');
  train.position.set(-160, 10.4, 48);
  root.add(train);
  cars.push({ obj: train, z: 48, y: 10.4, dir: 1, lane: 0, speed: 22, train: true, span: 190 });
  return cars;
}

/* ============================================================
   八、主循环
   ============================================================ */
const clock = new THREE.Clock();
let elapsed = 0;
let frameNo = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  frameNo++;
  // 自检：持续刷新 #selfcheck，好让无头浏览器在任意时刻读到当前运行状态
  if (QA.probe && ready && frameNo % 60 === 0) writeProbe(frameNo, elapsed);

  // 帧率看门狗：开场若干秒后若仍明显卡顿，且用户没手动选过档位，就自动降一档
  if (ready && !qualityManual && !watchdogOff) {
    if (elapsed > 6 && frameNo % 60 === 0) {
      const fps = frameNo / elapsed;
      if (fps < 38) {
        const i = QUALITY_ORDER.indexOf(qualityTier);
        if (i >= 0 && i < QUALITY_ORDER.length - 1) setQuality(QUALITY_ORDER[i + 1], 'auto');
        else watchdogOff = true; // 已到最低档，别反复触发
      } else if (fps > 56) {
        watchdogOff = true; // 跑得顺畅，收工
      }
    }
  }

  if (ready) {
    // 昼夜过渡
    const goal = state.night ? 1 : 0;
    if (Math.abs(state.tod - goal) > 0.0005) {
      state.tod += Math.sign(goal - state.tod) * Math.min(Math.abs(goal - state.tod), dt * 0.75);
      applyTime(state.tod);
    }
    // ?roamtest=N：走真实移动代码向前走 N 帧（无头环境按不住键盘）
    if (roam.active && QA.roamtest > 0 && frameNo <= QA.roamtest) {
      roam.move.forward = 1;
      if (QA.roamstrafe) roam.move[QA.roamstrafe > 0 ? 'right' : 'left'] = 1;
    } else if (QA.roamtest > 0 && roam.active && frameNo > QA.roamtest) {
      roam.move.forward = 0;
      roam.move.right = 0;
      roam.move.left = 0;
    }
    if (roam.active) updateRoam(dt);
    else orbit.update(dt);

    // 水面与天空：天空球跟随相机，地平线渐变才会始终居中
    if (city) {
      city.sky.position.copy(camera.position);
      city.water.material.uniforms.uTime.value = elapsed;
      city.skyU.uTime.value = elapsed;
      // 船
      for (const bt of city.boats) {
        if (bt.path) {
          const p = bt.path;
          const dir = Math.sign(p.speed);
          bt.obj.position.z += p.speed * dt;
          bt.obj.position.y = -0.12 + Math.sin(elapsed * 0.9 + bt.obj.position.z * 0.05) * 0.08;
          if (dir > 0 && bt.obj.position.z > p.to) bt.obj.position.z = p.from;
          if (dir < 0 && bt.obj.position.z < p.to) bt.obj.position.z = p.from;
        } else if (bt.orbit) {
          const o = bt.orbit;
          const a = elapsed * o.speed + o.phase;
          bt.obj.position.set(o.cx + Math.cos(a) * o.r, -0.2 + Math.sin(elapsed * 1.1 + a) * 0.06, o.cz + Math.sin(a) * o.r * 0.8);
          bt.obj.rotation.y = -a + Math.PI / 2;
        }
      }
      // 车流
      for (const c of traffic) {
        c.obj.position.x += c.speed * c.dir * dt;
        const lim = c.train ? 200 : 82;
        if (c.obj.position.x > lim) c.obj.position.x = -lim;
        if (c.obj.position.x < -lim) c.obj.position.x = lim;
      }
      updateLabels();
    }
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

/* ============================================================
   九、启动
   ============================================================ */
let traffic = [];
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/* ---------- 自检模式（?probe=1&region=bridge&night=1&nohud=1） ----------
   供自动化验收使用：把运行期事实写进 DOM，#selfcheck 可被无头浏览器读回。 */
const QA = {
  probe: QUERY.has('probe'),
  nohud: QUERY.has('nohud'),
  region: QUERY.get('region'),
  night: QUERY.has('night'),
  roam: QUERY.has('roam'),
  // ?roamtest=N：进漫游后自动向前走 N 帧，用来验收「能不能真的走进巷子」
  roamtest: Number(QUERY.get('roamtest') || 0),
  roamstrafe: Number(QUERY.get('roamstrafe') || 0),
};
const ERRORS = [];
window.addEventListener('error', (e) => ERRORS.push(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => ERRORS.push(`rejection: ${e.reason}`));

/* ============================================================
   九·五、画质分级
   低配设备（软件渲染、核显轻薄本、手机）自动降档：建筑密度、细节构件、
   行道树、车船数量、像素比与阴影一起缩，避免一开场就掉到十几帧。
   手动点击工具条上的档位按钮可强制切换，切换后重建场景（保留机位）。
   ============================================================ */

/** 依据档位设置渲染器（像素比、阴影、抗锯齿开关需要重建 renderer 才不会掉性能，
    这里只调可运行时修改的部分 + 尺寸） */
function applyRendererQuality() {
  const q = qualityDef();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = q.shadows;
  if (sun && sun.shadow) {
    sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
  // 阴影开关变化后需要让材质重新编译
  if (city) for (const k in city.mats) city.mats[k].needsUpdate = true;
}

function updateQualityUI() {
  const el = $('#qualityText');
  const q = qualityDef();
  if (el) el.textContent = LANG === 'zh' ? q.zh : q.en;
  $$('[data-action="quality"]').forEach((b) => {
    b.classList.toggle('is-active', qualityTier !== 'high');
    b.setAttribute('aria-pressed', String(qualityTier !== 'high'));
    b.title = `${t('toolQuality')}：${LANG === 'zh' ? q.zh : q.en}`;
  });
}

/** 释放上一份城市的 GPU 资源 */
function disposeCity() {
  if (!city) return;
  const kill = (obj) => {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    if (obj.parent) obj.parent.remove(obj);
  };
  kill(city.root);
  if (city.sky) kill(city.sky);
  if (city.water) {
    if (city.water.geometry) city.water.geometry.dispose();
    if (city.water.material) city.water.material.dispose();
    if (city.water.parent) city.water.parent.remove(city.water);
  }
  for (const m of traffic) if (m.parent) m.parent.remove(m);
  traffic = [];
  for (const k in city.mats) city.mats[k].dispose();
  city = null;
  // 标签锚点指向旧网格，必须一并清掉重建
  $$('.label').forEach((el) => el.remove());
}

/** 切换画质：重建城市，保留当前机位与状态 */
async function setQuality(tier, why = 'manual') {
  if (!QUALITY_TIERS[tier] || tier === qualityTier) return;
  qualityTier = tier;
  qualityReason = why;
  const wasRoam = roam.active;
  disposeCity();
  const t0 = performance.now();
  city = buildCity(scene, { quality: qualityDef() });
  QA.buildMs = Math.round(performance.now() - t0);
  applyRendererQuality();
  traffic = buildTraffic(city.root, city.mats);
  buildLabels();
  applyTime(state.tod);
  updateQualityUI();
  if (wasRoam) {
    const r = REGIONS[activeRegion];
    enterRoam(r);
  }
  toast(why === 'auto' ? 'toastQualityAuto' : 'toastQuality');
}

function writeProbe(frames, seconds) {
  const el = $('#selfcheck');
  if (!el || !city) return;
  const info = renderer.info;
  const data = {
    ok: ERRORS.length === 0,
    webgl: (() => {
      try {
        const gl = renderer.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      } catch (e) {
        return 'unavailable';
      }
    })(),
    errors: ERRORS.slice(0, 8),
    triangles: city.stats.triangles,
    meshes: city.stats.meshes,
    materials: city.stats.materials,
    drawCalls: info.render.calls,
    renderedTris: info.render.triangles,
    labels: city.landmarks.length,
    railItems: $$('.rail-item').length,
    regions: REGIONS.length,
    camera: [Math.round(camera.position.x), Math.round(camera.position.y), Math.round(camera.position.z)],
    radius: Math.round(orbit.radius),
    region: REGIONS[activeRegion].id,
    night: state.night,
    tod: Number(state.tod.toFixed(2)),
    roam: roam.active,
    lang: LANG,
    loaderDone: $('#loader') ? getComputedStyle($('#loader')).visibility : 'n/a',
    heroHidden: $('#hero') ? $('#hero').hidden : null,
    frames,
    fps: seconds > 0 ? Number((frames / seconds).toFixed(1)) : 0,
    canvas: [renderer.domElement.width, renderer.domElement.height],
    toast: $('#toast') && !$('#toast').hidden ? $('#toast').textContent.slice(0, 72) : null,
    bodyClass: document.body.className,
    roamX: roam.active ? Math.round(roam.pos.x * 100) / 100 : null,
    roamZ: roam.active ? Math.round(roam.pos.z * 100) / 100 : null,
    roamInArea: roam.active ? roamFree(roam.pos.x, roam.pos.z) : null,
    roamArea: roam.area ? roam.area.length : null,
    roamBlockers: roam.blockers.length,
    quality: qualityTier,
    qualityReason,
    qualityGpu: qualityGpu.slice(0, 64),
    buildMs: QA.buildMs,
    pixelRatio: renderer.getPixelRatio(),
    shadows: renderer.shadowMap.enabled,
  };
  el.textContent = `SELFCHECK ${JSON.stringify(data)}`;
  el.dataset.ready = '1';
  // 同时打到控制台：无头验证时只收控制台事件就够，省去传输整份 DOM
  console.info('[selfcheck]', JSON.stringify(data));
}

async function boot() {
  document.body.classList.add('is-loading');
  const bar = $('#loaderBar');
  const hint = $('#loaderHint');
  const setBar = (p, msg) => {
    if (bar) bar.style.width = `${p}%`;
    if (msg && hint) hint.textContent = msg;
  };
  applyLang(QUERY.get('lang') === 'en' ? 'en' : 'zh');
  setNight(false, true);
  if (QA.nohud) {
    $$('.topbar, .hero, .rail, .tools, .scene-card, .labels, .hints, .roam-hud, .toast').forEach((el) => {
      el.style.display = 'none';
    });
  }
  setBar(12, t('loadingHint'));
  await nextFrame();

  // 档位已在模块初始化时（建渲染器之前）探明，这里只把它落到渲染器上
  applyRendererQuality();
  updateQualityUI();
  const tBuild = performance.now();
  city = buildCity(scene, { quality: qualityDef() });
  QA.buildMs = Math.round(performance.now() - tBuild);
  setBar(72, t('loadingHint'));
  await nextFrame();

  traffic = buildTraffic(city.root, city.mats);
  buildRail();
  buildLabels();
  updateSceneCard();
  setBar(96, t('loadingReady'));
  await nextFrame();

  // 取景：默认由远及近开场；自检模式直接落到目标机位
  const preset = QA.region ? REGIONS.findIndex((r) => r.id === QA.region) : 0;
  activeRegion = preset >= 0 ? preset : 0;
  const r0 = REGIONS[activeRegion];
  updateSceneCard();
  $$('.rail-item').forEach((el) => el.classList.toggle('is-active', el.dataset.region === r0.id));
  orbit.setFrom(new THREE.Vector3().fromArray(r0.camera), new THREE.Vector3().fromArray(r0.target));
  applyTime(QA.night ? 1 : 0);
  if (QA.night) setNight(true, true);
  if (QA.roam) enterRoam(r0);
  if (!QA.region && !QA.night && !QA.roam && !QA.nohud) {
    orbit.radius = orbit.radiusGoal = 900;
    orbit.flyTo(REGIONS[0], 3.0);
  }
  ready = true;
  animate();

  setBar(100, t('loadingReady'));
  setTimeout(() => {
    $('#loader')?.classList.add('is-done');
    document.body.classList.remove('is-loading');
  }, 320);

  console.info(
    `[江城小境] ${city.stats.triangles.toLocaleString()} 三角形 · ${city.stats.meshes} 个合并网格 · ${city.stats.materials} 种材质`,
  );

  // 自检由 animate() 每 60 帧刷新一次 #selfcheck 并同步打到控制台，这里无需再跑一次性采样
}

boot();

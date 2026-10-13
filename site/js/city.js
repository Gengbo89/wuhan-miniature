/**
 * city.js — 「江城小境」城市构成
 *
 * 布局以武汉真实地理为骨架做艺术化编排：
 *   +x 向东（武昌）  -x 向西（汉口 / 汉阳）  +z 向南  -z 向北
 *   长江沿 z 轴纵贯（x ∈ [-23, 23]），汉江自西而来在 z ∈ [12, 28] 汇入，
 *   于是 汉口（汉江以北）、汉阳（汉江以南）、武昌（长江以东）三镇鼎立。
 *   长江大桥沿 x 轴在 z = 48 处跨江，把蛇山（黄鹤楼）与龟山（电视塔）连起来。
 */
import * as THREE from '../vendor/three.module.js';
import {
  Batcher, createMaterials, createWater, createSky, rng, lerp, TAU,
  addRoof, addHouse, addHall, addPavilion, addTowerTiers, addPagoda,
  addArchBridge, addTrussBridge, addModernTower, addTvTower,
  addTree, addBoat, addStall, addGate, addRock, addRailing, addStairs,
  addPier, addCityWall, addLamp, addNeon, addBuoy, addHill,
  addPaifang, addLanternString, addStreetProp, addRingBridge, addSculpture,
  addStatue, addTram,
} from './geom.js';

/* ============================================================
   材质总表：一份定义同时给出白昼与夜色
   ============================================================ */
export const MATERIAL_DEFS = {
  /* —— 基座与地表 —— */
  basePlate: { color: '#6d7d75', night: '#26312f', rough: 0.95, flat: true },
  lawn: { color: '#8aa267', night: '#2f3d29', rough: 0.95 },
  grass: { color: '#7c9459', night: '#2a3724', rough: 0.95 },
  sand: { color: '#d9cca7', night: '#5a5344', rough: 1 },
  plaza: { color: '#cfc8b4', night: '#474842', rough: 0.95 },
  plazaDark: { color: '#b6b09c', night: '#3d3e3a', rough: 0.95 },
  stonePath: { color: '#c0b9a5', night: '#454641', rough: 0.95 },
  road: { color: '#6c6e6a', night: '#303436', rough: 0.9 },
  roadLine: { color: '#ded6bd', night: '#7a7462', rough: 0.9 },
  pond: { color: '#5f7d7c', night: '#22302f', rough: 0.35, metal: 0.1 },

  /* —— 传统木构 —— */
  wall: { color: '#f1ece0', night: '#525a5c', rough: 0.9 },
  wall2: { color: '#e3dcca', night: '#49504f', rough: 0.9 },
  roof: { color: '#4b5b5f', night: '#1e282c', rough: 0.7 },
  ridge: { color: '#37474b', night: '#161d21', rough: 0.65 },
  roofGreen: { color: '#5c7a6a', night: '#243430', rough: 0.6 },
  ridgeGreen: { color: '#41594d', night: '#1a2521', rough: 0.6 },
  roofCollege: { color: '#4f6f68', night: '#20302e', rough: 0.55, metal: 0.1 },
  ridgeCollege: { color: '#3a544e', night: '#182422', rough: 0.55 },
  goldRoof: { color: '#d2a63f', night: '#6a5220', rough: 0.45, metal: 0.25 },
  goldRidge: { color: '#a87c2b', night: '#4e3a15', rough: 0.45, metal: 0.3 },
  gold: { color: '#e2b755', night: '#8a6a26', rough: 0.35, metal: 0.6 },
  wood: { color: '#6b4a34', night: '#2c1f18', rough: 0.85 },
  lattice: { color: '#7d5c3e', night: '#33251b', rough: 0.85, glow: '#000000', glowNight: '#ffb45e', glowNightI: 0.75 },
  column: { color: '#7d4b3a', night: '#33201a', rough: 0.8 },
  columnRed: { color: '#a8342c', night: '#451713', rough: 0.7 },
  columnGold: { color: '#c9a24a', night: '#5e4a1f', rough: 0.5, metal: 0.35 },
  beamRed: { color: '#a8342c', night: '#451713', rough: 0.7 },
  rail: { color: '#8b8071', night: '#3a3833', rough: 0.8 },
  wallTower: { color: '#ded0b8', night: '#4c4a42', rough: 0.85 },
  baseStone: { color: '#b4b2a3', night: '#494b46', rough: 0.9 },
  lantern: { color: '#c8483c', night: '#8e2a22', rough: 0.6, glow: '#000000', glowNight: '#ff8a4a', glowNightI: 2.1 },
  banner: { color: '#c0483c', night: '#6d2620', rough: 0.85 },

  /* —— 砖石与租界建筑 —— */
  brick: { color: '#a9573c', night: '#3f2219', rough: 0.9 },
  brickDark: { color: '#8d4632', night: '#331b14', rough: 0.9 },
  trimWhite: { color: '#efe7d8', night: '#565650', rough: 0.85 },
  stone: { color: '#b3b3a4', night: '#494b47', rough: 0.9 },
  stone2: { color: '#c7c6b7', night: '#555752', rough: 0.9 },
  stoneBridge: { color: '#c2bcab', night: '#4e4f4a', rough: 0.9 },
  rock: { color: '#9c9c8e', night: '#3f423e', rough: 0.95, flat: true },
  hill: { color: '#7b9062', night: '#2c3a28', rough: 0.95, flat: true },
  wallCity: { color: '#a89c86', night: '#464640', rough: 0.95 },
  wallGate: { color: '#c3bcac', night: '#4d4d46', rough: 0.9 },
  wallGate2: { color: '#d1cbbc', night: '#585852', rough: 0.9 },
  roofGate: { color: '#7f8d6a', night: '#2c3527', rough: 0.6 },
  ridgeGate: { color: '#5d6b4c', night: '#20281b', rough: 0.6 },
  clockFace: { color: '#f2ead6', night: '#c9bfa4', rough: 0.6, glow: '#000000', glowNight: '#ffe6b0', glowNightI: 1.9 },
  clockFrame: { color: '#3a3f42', night: '#191d1f', rough: 0.7 },

  /* —— 现代建筑 —— */
  concrete: { color: '#b9b6ad', night: '#464744', rough: 0.9 },
  glass: { color: '#77949b', night: '#16242b', rough: 0.25, metal: 0.35, glow: '#000000', glowNight: '#5f9fb4', glowNightI: 0.95 },
  glassTower: { color: '#8aa9ae', night: '#1a2a31', rough: 0.2, metal: 0.35, glow: '#000000', glowNight: '#6fb3c8', glowNightI: 0.9 },
  frame: { color: '#8d949a', night: '#3b4145', rough: 0.4, metal: 0.5 },
  frameDark: { color: '#33383c', night: '#15181a', rough: 0.6, metal: 0.3 },
  roofModern: { color: '#7b8288', night: '#31363a', rough: 0.7 },
  navLight: { color: '#ff5a4a', night: '#ff5a4a', rough: 0.4, glow: '#000000', glowNight: '#ff5a4a', glowNightI: 2.2 },
  windowLit: { color: '#3c4a52', night: '#3a2c17', rough: 0.35, metal: 0.1, glow: '#000000', glowNight: '#ffbe6e', glowNightI: 2.3 },
  neon: { color: '#5a5f63', night: '#4a2a20', rough: 0.5, glow: '#000000', glowNight: '#ff8a5c', glowNightI: 2.6 },
  dark: { color: '#22262a', night: '#0e1113', rough: 0.9 },

  /* —— 街巷小件 / 新地标（牌坊、灯笼串、水缸、雕塑、立像、有轨电车） —— */
  plaque: { color: '#5f4a33', night: '#2a2016', rough: 0.8 },
  rope: { color: '#4a4034', night: '#211c17', rough: 0.95 },
  pottery: { color: '#6e5340', night: '#2a2018', rough: 0.85 },
  basket: { color: '#a8863f', night: '#4a3a1c', rough: 0.9 },
  signBoard: { color: '#8a6a3c', night: '#3a2c18', rough: 0.8 },
  haloGlow: { color: '#c9a558', night: '#6a4f1e', rough: 0.4, metal: 0.4, glow: '#000000', glowNight: '#ffd27a', glowNightI: 1.9 },
  tramBody: { color: '#b8452f', night: '#6a2418', rough: 0.5, metal: 0.3 },
  sleeper: { color: '#5b5348', night: '#26221c', rough: 0.95 },
  stairs: { color: '#bdb6a3', night: '#4b4c46', rough: 0.9 },
  water: { color: '#5f8189', night: '#22343c', rough: 0.25, metal: 0.15 },
  bronze: { color: '#7a6a4a', night: '#33301f', rough: 0.5, metal: 0.55 },

  /* —— 桥 —— */
  steel: { color: '#9aa3a8', night: '#3c4449', rough: 0.5, metal: 0.45 },
  pier: { color: '#b0aa9c', night: '#4a4a45', rough: 0.9 },
  deck: { color: '#a9a49a', night: '#46463f', rough: 0.9 },
  railBridge: { color: '#8e8b80', night: '#3a3a35', rough: 0.8 },
  orangeBridge: { color: '#c9622f', night: '#4a2312', rough: 0.6, metal: 0.25 },
  pierPost: { color: '#6b6a60', night: '#2e2e29', rough: 0.9 },
  buoy: { color: '#c8452f', night: '#7a2a1c', rough: 0.7 },

  /* —— 街市 —— */
  counter: { color: '#8a6a4a', night: '#33261b', rough: 0.9 },
  counterTop: { color: '#cbb894', night: '#4f4738', rough: 0.85 },
  awning: { color: '#c25b4a', night: '#4a231c', rough: 0.9 },
  awningB: { color: '#e0d3b4', night: '#565044', rough: 0.9 },
  steam: { color: '#ffffff', night: '#e8dcc8', rough: 1, opacity: 0.14, noShadow: true, noReceive: true },
  lampPost: { color: '#4a4f52', night: '#22262a', rough: 0.6, metal: 0.3 },
  lampGlow: { color: '#cfc7a8', night: '#4a3a1e', rough: 0.5, glow: '#000000', glowNight: '#ffd79a', glowNightI: 2.7 },

  /* —— 植被 —— */
  trunk: { color: '#5b4632', night: '#241b13', rough: 0.95 },
  trunkPlane: { color: '#8d8674', night: '#3b3830', rough: 0.95 },
  trunkCherry: { color: '#6b5340', night: '#2a2119', rough: 0.95 },
  trunkPlum: { color: '#4a3a2e', night: '#1c1611', rough: 0.95 },
  bamboo: { color: '#6f8f4a', night: '#2b3a1c', rough: 0.9 },
  leaf: { color: '#4f7040', night: '#1e2c1a', rough: 0.95, flat: true },
  leafDark: { color: '#3c5a33', night: '#162115', rough: 0.95, flat: true },
  leafWillow: { color: '#6f8f47', night: '#2a3820', rough: 0.95, flat: true },
  leafBamboo: { color: '#5f8a3c', night: '#25361a', rough: 0.95, flat: true },
  blossom: { color: '#e8b7c4', night: '#6b4a55', rough: 0.95, flat: true },
  blossomPlum: { color: '#d98aa0', night: '#5f3a45', rough: 0.95, flat: true },

  /* —— 船 —— */
  hull: { color: '#3f4a52', night: '#1a2025', rough: 0.7, metal: 0.2 },
  cabin: { color: '#e6e1d2', night: '#565248', rough: 0.85 },
  roofBoat: { color: '#5a6a6e', night: '#232c2e', rough: 0.8 },
  containerA: { color: '#b5563f', night: '#43201a', rough: 0.9 },
  containerB: { color: '#4a6f86', night: '#1d2a33', rough: 0.9 },
};

/* ============================================================
   场景区域定义（六处风景）
   ============================================================ */
export const REGIONS = [
  {
    id: 'all',
    icon: '◎',
    coord: '30.5928° N · 114.3055° E',
    camera: [255, 118, 335],
    target: [16, 10, 16],
    walk: [40, 1.7, 66],
    roam: 60,
    zh: {
      name: '江城全景',
      en: 'THE WHOLE PICTURE',
      tag: '两江交汇 · 三镇鼎立',
      desc: '长江与汉水在此握手，汉口、汉阳、武昌隔水相望。转动这座小小的江城，从蛇山黄鹤楼一直望到东湖的磨山倒影。',
    },
    en: {
      name: 'Wuhan From Above',
      en: 'THE WHOLE PICTURE',
      tag: 'Two Rivers, Three Towns',
      desc: 'The Yangtze meets the Han, and Hankou, Hanyang and Wuchang face each other across the water. Turn this little river city in your hand, from the Yellow Crane Tower to the far hills of East Lake.',
    },
  },
  {
    id: 'yellowcrane',
    icon: '楼',
    coord: '30.5446° N · 114.3020° E',
    camera: [168, 52, 132],
    target: [88, 26, 44],
    walk: [112, 1.7, 84],
    roam: 46,
    zh: {
      name: '黄鹤楼',
      en: 'YELLOW CRANE TOWER',
      tag: '飞檐揽月 · 蛇山之巅',
      desc: '五层楼阁立在蛇山之上，黄瓦朱栏，翼角挑起。登楼远望，大桥横江，帆影与云一同流过。',
    },
    en: {
      name: 'Yellow Crane Tower',
      en: 'YELLOW CRANE TOWER',
      tag: 'Eaves Above the Snake Hill',
      desc: 'Five storeys of golden tiles and crimson railings, riding the crest of Snake Hill with upturned eaves. From the top, the great bridge crosses the river and sails drift with the clouds.',
    },
  },
  {
    id: 'bridge',
    icon: '桥',
    coord: '30.5540° N · 114.2880° E',
    camera: [10, 42, 150],
    target: [0, 14, 40],
    walk: [30, 13.3, 48],
    roam: 26,
    zh: {
      name: '长江大桥',
      en: 'YANGTZE RIVER BRIDGE',
      tag: '一桥飞架 · 天堑通途',
      desc: '公路在上、铁路在下，钢桁架一路铺到对岸。桥头堡挑起重檐，桥墩把江水切成一段一段的星光。',
    },
    en: {
      name: 'First Yangtze Bridge',
      en: 'YANGTZE RIVER BRIDGE',
      tag: 'A Bridge Across the Sky',
      desc: 'Roads above, railways below, a steel truss running to the far bank. Chinese roofs crown the bridgeheads, and the piers cut the river into ribbons of light.',
    },
  },
  {
    id: 'jianghan',
    icon: '关',
    coord: '30.5860° N · 114.2900° E',
    camera: [-6, 40, 44],
    target: [-58, 16, -30],
    walk: [-58, 1.7, -46],
    roam: 52,
    zh: {
      name: '江汉关 · 江汉路',
      en: 'JIANGHAN CUSTOMS HOUSE',
      tag: '钟楼百年 · 江汉路上',
      desc: '钟楼立在江边，砖墙与拱窗排成长街。入夜以后,梧桐树下亮起霓虹，老租界换上另一种表情。',
    },
    en: {
      name: 'Customs House & Jianghan Road',
      en: 'JIANGHAN CUSTOMS HOUSE',
      tag: 'A Century of Chimes',
      desc: 'The clock tower stands by the river; brick walls and arched windows line the long street. After dark the plane trees light up with neon and the old concession district changes its face.',
    },
  },
  {
    id: 'eastlake',
    icon: '湖',
    coord: '30.5600° N · 114.4100° E',
    camera: [130, 40, 76],
    target: [212, 12, -16],
    walk: [178, 1.7, 6],
    roam: 70,
    zh: {
      name: '东湖 · 磨山',
      en: 'EAST LAKE · MOSHAN',
      tag: '碧波万顷 · 磨山倒影',
      desc: '三十三平方公里的水面铺开，磨山把影子放进湖里。行吟阁独立小岛，樱树与垂柳沿着绿道一路排开。',
    },
    en: {
      name: 'East Lake & Moshan',
      en: 'EAST LAKE · MOSHAN',
      tag: 'A Mirror for the Hills',
      desc: 'A vast sheet of water with Moshan Hill reflected in it. The Xingyin Pavilion sits alone on its islet, cherry and willow trees line the lakeside path.',
    },
  },
  {
    id: 'hubu',
    icon: '巷',
    coord: '30.5470° N · 114.2980° E',
    camera: [152, 30, 132],
    target: [90, 8, 76],
    walk: [92, 1.98, 96],
    roam: 34,
    // 巷子漫游：不是圆形范围，而是「巷身 + 巷口小广场」两块矩形；摊位用 blockers 挡
    walkArea: [[87.0, 61.5, 97.0, 96.6], [82.5, 96.6, 101.5, 105.0], [83.5, 55.8, 100.5, 63.0]],
    useBlockers: true,
    roamLook: [92, 1.6, 68], // 进巷子时正对巷身，不要斜着走
    zh: {
      name: '户部巷',
      en: 'HUBU ALLEY',
      tag: '烟火武昌 · 过早江湖',
      desc: '芝麻酱在热干面上化开，豆皮的锅气混着蒸汽往巷口涌。青瓦、幌子、竹椅，一条巷子装下整座城市的清晨。',
    },
    en: {
      name: 'Hubu Alley',
      en: 'HUBU ALLEY',
      tag: 'Breakfast as a Contact Sport',
      desc: 'Sesame paste melts into hot-dry noodles, the wok breath of doupi drifts to the alley mouth. Grey tiles, cloth banners and bamboo stools: one lane holding a whole city’s morning.',
    },
  },
  {
    id: 'guiyuan',
    icon: '寺',
    coord: '30.5560° N · 114.2560° E',
    camera: [-70, 46, 168],
    target: [-106, 10, 110],
    walk: [-108, 1.98, 140],
    roam: 44,
    zh: {
      name: '归元禅寺',
      en: 'GUIYUAN TEMPLE',
      tag: '汉阳古刹 · 罗汉五百',
      desc: '山门、放生池、钟鼓楼一路排到罗汉堂，香炉的烟顺着院墙往外走。五百罗汉各有各的表情，数到与自己同年的一尊，就算结了个缘。',
    },
    en: {
      name: 'Guiyuan Temple',
      en: 'GUIYUAN TEMPLE',
      tag: 'Five Hundred Arhats',
      desc: 'Gate, release pond and bell towers lead to the Arhat Hall while incense drifts over the courtyard wall. Five hundred arhats, each with a face of their own — count to the one that shares your year and you have made a connection.',
    },
  },
  {
    id: 'guanggu',
    icon: '光',
    coord: '30.4770° N · 114.4120° E',
    camera: [252, 92, 252],
    target: [178, 14, 156],
    walk: [178, 1.72, 196],
    roam: 52,
    zh: {
      name: '光谷广场',
      en: 'OPTICS VALLEY',
      tag: '星河环廊 · 不夜新城',
      desc: '环形的天桥把车流绕成一圈，中间的雕塑像一道立起来的星河。玻璃楼群一路亮到东湖边，有轨电车叮当驶过——这是武汉最新的那一面。',
    },
    en: {
      name: 'Optics Valley',
      en: 'OPTICS VALLEY',
      tag: 'A Galaxy Held in a Ring',
      desc: 'A circular footbridge wraps the traffic while the central sculpture rises like a standing galaxy. Glass towers glow all the way to East Lake and the tram bells past: this is the newest face of Wuhan.',
    },
  },
  {
    id: 'wuda',
    icon: '樱',
    coord: '30.5410° N · 114.3610° E',
    camera: [104, 40, -30],
    target: [150, 12, -80],
    walk: [132, 1.68, -62],
    roam: 42,
    zh: {
      name: '珞珈山 · 樱花大道',
      en: 'LUOJIA HILL & CHERRY AVENUE',
      tag: '老斋舍下 · 三月飞雪',
      desc: '老图书馆的绿琉璃瓦压在珞珈山脊上，樱花大道两排花树在三月底一起开。风过时花瓣落在石阶与青瓦上，学生叫它「樱花雪」。',
    },
    en: {
      name: 'Luojia Hill',
      en: 'LUOJIA HILL & CHERRY AVENUE',
      tag: 'Snowfall in March',
      desc: 'The old library’s green glazed tiles ride the ridge of Luojia Hill while two rows of cherry trees bloom together in late March. Petals settle on the stone steps and grey tiles — students call it cherry snow.',
    },
  },
];

/* ============================================================
   工具：多边形地块
   ============================================================ */
function roundedRect(x0, z0, x1, z1, r, seg = 4) {
  const pts = [];
  const corners = [
    [x1 - r, z0 + r, -Math.PI / 2],
    [x1 - r, z1 - r, 0],
    [x0 + r, z1 - r, Math.PI / 2],
    [x0 + r, z0 + r, Math.PI],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (Math.PI / 2) * (i / seg);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

function blob(cx, cz, rx, rz, seed, wobble = 0.22, n = 26) {
  const R = rng(seed);
  const k = Array.from({ length: n }, () => 1 - wobble / 2 + R() * wobble);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const s = (k[i] + k[(i + 1) % n]) / 2;
    pts.push([cx + Math.cos(a) * rx * s, cz + Math.sin(a) * rz * s]);
  }
  return pts;
}

function landShape(outer, holes = []) {
  const s = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) {
    s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  return s;
}

/** 沿折线种行道树 */
function lineOfTrees(b, mats, pts, o = {}) {
  const { spacing = 7, kind = 'plane', s = 1, jitter = 0.6, skip = 0 } = o;
  const R = rng(o.seed ?? 42);
  let acc = skip;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    let t = acc;
    while (t < len) {
      const p = t / len;
      addTree(b, mats, {
        x: lerp(x0, x1, p) + (R() - 0.5) * jitter,
        z: lerp(z0, z1, p) + (R() - 0.5) * jitter,
        y: o.y ?? 0,
        s: s * (0.85 + R() * 0.3),
        kind,
        r: R,
      });
      t += spacing;
    }
    acc = t - len;
  }
}

/**
 * 密排街区：在一处方框里随机落民居，遇到地标/水面/桥廊则跳过。
 * 微缩城市要“建满”才像城，稀疏的独栋只会显得空。
 */
function scatterHouses(b, mats, R, o) {
  const { x0, x1, z0, z1, count, keepout = [], twoStorey = 0.45, detailChance = 0.3, trees = 0 } = o;
  let placed = 0;
  let guard = 0;
  const limit = count * 14 + 40;
  while (placed < count && guard < limit) {
    guard++;
    const x = lerp(x0, x1, R());
    const z = lerp(z0, z1, R());
    let bad = false;
    for (let i = 0; i < keepout.length; i++) {
      const k = keepout[i];
      const dx = x - k[0];
      const dz = z - k[1];
      if (dx * dx + dz * dz < k[2] * k[2]) {
        bad = true;
        break;
      }
    }
    if (bad) continue;
    const two = R() < twoStorey;
    addHouse(b, mats, {
      x,
      z,
      y: 0,
      w: 3.2 + R() * 3.4,
      d: 3.2 + R() * 3.2,
      h: 2.9 + R() * 0.9,
      ry: (R() - 0.5) * 0.7,
      storeys: two ? 2 : 1,
      gable: R() > 0.45,
      lanterns: R() > 0.86,
      detail: R() < detailChance,
      roofKey: 'roof',
      eaveKey: 'ridge',
    });
    if (trees > 0 && R() < trees) {
      addTree(b, mats, { x: x + (R() - 0.5) * 6, z: z + (R() - 0.5) * 6, s: 0.75 + R() * 0.5, kind: R() > 0.75 ? 'plum' : 'broad', r: R });
    }
    placed++;
  }
  return placed;
}

/* ============================================================
   主构建函数
   ============================================================ */
export function buildCity(scene, opts = {}) {
  // 画质分级：density=建筑密度，detail=细节构件概率，trees=行道树密度，vehicles=车船数
  const Q = { density: 1, detail: 1, trees: 1, vehicles: 1, ...(opts.quality || {}) };
  const dens = (n) => Math.max(6, Math.round(n * Q.density));
  const sp = (n) => Math.max(3, n / Math.max(0.15, Q.trees));
  const mats = createMaterials(MATERIAL_DEFS);
  const b = new Batcher(mats);
  const R = rng(20261013);
  const root = new THREE.Group();
  const blockers = []; // 漫游碰撞用的矩形障碍（与几何用同一组数字，避免视觉与碰撞漂移）
  root.name = '江城小境';
  scene.add(root);

  /* ---------- 天空与水面 ---------- */
  const { mesh: sky, uniforms: skyU } = createSky(THREE, { radius: 900 });
  scene.add(sky);
  const water = createWater(THREE, { size: 700, colorShallow: '#8fa79b', colorDeep: '#40606a', skyColor: '#d3dbc9' });
  water.position.set(16, -0.45, 0);
  water.scale.set(0.9, 0.74, 1); // 收进基座之内，水面只在江槽与湖盆里露出
  scene.add(water);

  /* ---------- 1. 基座与三镇地块 ---------- */
  // 基座顶面必须低于水面，否则会把江面盖住：基座 −3.0 → −1.0，水面 −0.45，陆地 −0.6 → 0
  b.slab('basePlate', landShape(roundedRect(-300, -262, 336, 262, 26)), 0, -3.0, 0, 2.0);

  const eastLake = blob(214, -12, 50, 34, 11);
  const shaHu = blob(118, -6, 22, 15, 22);
  const ziyangHu = blob(122, 88, 13, 9, 33);

  // 汉口（汉江以北）
  b.slab('lawn', landShape(roundedRect(-282, -246, -23, 12, 16)), 0, -0.6, 0, 0.6);
  // 汉阳（汉江以南）
  b.slab('lawn', landShape(roundedRect(-282, 28, -23, 246, 16)), 0, -0.6, 0, 0.6);
  // 武昌（长江以东，含东湖/沙湖/紫阳湖水面）
  b.slab('lawn', landShape(roundedRect(23, -246, 318, 246, 20), [eastLake, shaHu, ziyangHu]), 0, -0.6, 0, 0.6);

  /* ---------- 2. 江滩、堤岸与湖岸 ---------- */
  // 汉口江滩
  b.slab('plaza', landShape(roundedRect(-40, -100, -24, 10, 8)), 0, 0.02, 0, 0.16);
  b.slab('grass', landShape(roundedRect(-38, -96, -26, 6, 6)), 0, 0.16, 0, 0.12);
  // 武昌江滩
  b.slab('plaza', landShape(roundedRect(24, -60, 40, 62, 8)), 0, 0.02, 0, 0.16);
  // 东湖绿道
  b.slab('stonePath', landShape(blob(168, -10, 46, 36, 11, 0.06, 30)), 0, 0.02, 0, 0.14);
  b.slab('stonePath', landShape(blob(113, -6, 25, 18, 22, 0.06, 24)), 0, 0.02, 0, 0.14);
  b.slab('stonePath', landShape(blob(122, 88, 15.5, 11, 33, 0.06, 22)), 0, 0.02, 0, 0.14);

  // 堤岸栏杆：长江两岸 + 汉江两岸
  addRailing(b, mats, [[-23.5, -140], [-23.5, 8]], 0.2, { key: 'stone', h: 0.85, post: 4 });
  addRailing(b, mats, [[23.5, -140], [23.5, 26]], 0.2, { key: 'stone', h: 0.85, post: 4 });
  addRailing(b, mats, [[-60, 11.5], [-23.5, 11.5]], 0.2, { key: 'stone', h: 0.85, post: 4 });
  addRailing(b, mats, [[-60, 28.5], [-23.5, 28.5]], 0.2, { key: 'stone', h: 0.85, post: 4 });

  /* ---------- 3. 蛇山 · 黄鹤楼景区（武昌） ---------- */
  addHill(b, mats, { x: 86, y: 0, z: 48, r: 30, h: 15, key: 'hill', rock: 7, treeKind: 'broad', treeCount: 14, rnd: R });
  addHill(b, mats, { x: 150, y: 0, z: -86, r: 32, h: 16, key: 'hill', rock: 5, treeKind: 'pine', treeCount: 16, rnd: R });
  // 黄鹤楼：五层攒尖，黄瓦朱栏
  addTowerTiers(b, mats, { x: 88, y: 9.5, z: 44, tiers: 5, w: 11, d: 11, h: 3.6, ry: 0.12, taper: 0.9 });
  // 白云阁
  addTowerTiers(b, mats, {
    x: 68, y: 8.9, z: 58, tiers: 3, w: 7, d: 7, h: 3.1, ry: -0.3, taper: 0.9,
    roofKey: 'roof', ridgeKey: 'ridge', columnKey: 'column',
  });
  // 胜像宝塔
  addPagoda(b, mats, { x: 74, y: 8.4, z: 34, tiers: 5, r: 1.9, h: 1.7, ry: 0.2 });
  // 碑廊
  addHall(b, mats, { x: 104, y: 8.2, z: 54, w: 12, d: 5, h: 2.7, ry: 0.5, double: false, columns: 5, plaque: false });
  // 山门牌坊与上山石阶
  addGate(b, mats, { x: 92, y: 0.2, z: 80, ry: 0, w: 10, h: 6 });
  addStairs(b, mats, { x: 92, y: 1.2, z: 74, w: 8, steps: 6, rise: 0.3, run: 0.9 });
  addStairs(b, mats, { x: 88, y: 6.6, z: 60, w: 7, steps: 5, rise: 0.3, run: 0.9, ry: Math.PI });
  // 武昌红楼（辛亥革命博物院）：红墙白线、中央门廊
  (function redBuilding() {
    const x = 58;
    const z = 70;
    b.boxB('stone', x, 0, z, 26, 0.5, 14);
    b.boxB('brick', x, 0.5, z, 24, 6.4, 12);
    b.boxB('trimWhite', x, 0.5, z, 24.3, 0.35, 12.3);
    b.boxB('trimWhite', x, 3.6, z, 24.3, 0.35, 12.3);
    b.boxB('trimWhite', x, 6.6, z, 25, 0.5, 13);
    addRoof(b, mats, { x, y: 7.1, z, w: 25, d: 13, h: 2.6, over: 1.2, lift: 0.5, key: 'roof', ridgeKey: 'ridge', detail: true });
    // 中央门廊
    b.boxB('brick', x, 0.5, z + 7.4, 7, 7.2, 2.6);
    for (let i = 0; i < 4; i++) {
      b.cylB('trimWhite', x - 2.4 + i * 1.6, 0.5, z + 8.6, 0.24, 0.26, 6.6, 10);
    }
    b.boxB('trimWhite', x, 7.1, z + 7.6, 8, 0.6, 3.4);
    addRoof(b, mats, { x, y: 7.7, z: z + 7.6, w: 8.4, d: 3.6, h: 1.6, over: 0.8, lift: 0.5, key: 'roof', ridgeKey: 'ridge', hip: false });
    // 拱窗
    for (let i = 0; i < 8; i++) {
      const px = x - 9.6 + i * 2.75;
      for (const pz of [z - 6.05, z + 6.05]) {
        b.box('windowLit', px, 2.4, pz, 1.5, 2.4, 0.16);
        b.box('windowLit', px, 5.2, pz, 1.5, 1.4, 0.16);
      }
    }
  })();

  /* ---------- 4. 长江大桥（连接蛇山与龟山） ---------- */
  addTrussBridge(b, mats, {
    x: 0, y: 0, z: 48, length: 156, width: 11, deckY: 11, piers: 6, detail: true, head: true,
  });

  /* ---------- 5. 龟山 · 电视塔 · 晴川阁（汉阳） ---------- */
  addHill(b, mats, { x: -86, y: 0, z: 50, r: 26, h: 13, key: 'hill', rock: 6, treeKind: 'broad', treeCount: 12, rnd: R });
  addTvTower(b, mats, { x: -88, y: 8.2, z: 46, h: 44, r: 2.5 });
  addHall(b, mats, { x: -58, y: 5.6, z: 40, w: 11, d: 7, h: 3.4, ry: -0.5, columns: 5, double: false, wallKey: 'wall', roofKey: 'roofGreen', ridgeKey: 'ridgeGreen' });
  addStairs(b, mats, { x: -58, y: 6.2, z: 48, w: 6, steps: 6, rise: 0.3, run: 0.8, ry: Math.PI });

  /* ---------- 6. 江汉关 · 江汉路（汉口） ---------- */
  (function customsHouse() {
    const x = -58;
    const z = -20;
    b.boxB('stone', x, 0, z, 30, 0.6, 16);
    b.boxB('brick', x, 0.6, z, 26, 11, 13);
    b.boxB('brickDark', x, 0.6, z, 26.3, 0.5, 13.3);
    for (let f = 0; f < 3; f++) {
      b.boxB('trimWhite', x, 0.6 + 3.4 * (f + 1), z, 26.6, 0.4, 13.6);
      for (let i = 0; i < 7; i++) {
        const px = x - 10.5 + i * 3.5;
        for (const pz of [z - 6.7, z + 6.7]) {
          b.box('windowLit', px, 0.6 + 3.4 * f + 2.0, pz, 1.5, 2.2, 0.18);
        }
      }
    }
    b.boxB('trimWhite', x, 11.6, z, 27, 0.7, 14);
    addRoof(b, mats, { x, y: 12.3, z, w: 27, d: 14, h: 3, over: 1.2, lift: 0.5, key: 'roof', ridgeKey: 'ridge', detail: true });
    // 钟楼
    const tx = x + 15.5;
    b.boxB('brick', tx, 0.6, z, 9, 22, 9);
    b.boxB('trimWhite', tx, 0.6, z, 9.4, 0.4, 9.4);
    b.boxB('trimWhite', tx, 22.2, z, 9.4, 0.4, 9.4);
    for (const [dx, dz, ry] of [[0, 4.55, 0], [0, -4.55, Math.PI], [4.55, 0, Math.PI / 2], [-4.55, 0, -Math.PI / 2]]) {
      b.box('clockFrame', tx + dx, 20.4, z + dz, 3.4, 3.4, 0.24, ry);
      b.box('clockFace', tx + dx * 1.02, 20.4, z + dz * 1.02, 2.7, 2.7, 0.14, ry);
      b.box('clockFrame', tx + dx * 1.04, 20.4, z + dz * 1.04, 0.16, 2.2, 0.1, ry);
      b.box('clockFrame', tx + dx * 1.04, 20.4, z + dz * 1.04, 1.7, 0.16, 0.1, ry);
    }
    addRoof(b, mats, { x: tx, y: 22.6, z, w: 10, d: 10, h: 4.2, over: 1, lift: 0.8, key: 'roofGreen', ridgeKey: 'ridgeGreen', detail: true });
    b.cylB('frame', tx, 26.8, z, 0.08, 0.12, 3.2, 6);
    b.box('banner', tx + 0.6, 29.4, z, 1.4, 0.9, 0.08, 0.3);
  })();

  (function jianghanRoad() {
    const x = -58;
    // 步行街铺装
    b.slab('plaza', landShape(roundedRect(x - 7, -78, x + 7, -26, 3)), 0, 0.02, 0, 0.18);
    b.slab('plazaDark', landShape(roundedRect(x - 1.2, -78, x + 1.2, -26, 1)), 0, 0.2, 0, 0.06);
    // 两侧租界建筑
    for (let i = 0; i < 9; i++) {
      const z = -30 - i * 5.6;
      for (const sgn of [-1, 1]) {
        const w = 4.6 + R() * 1.6;
        const d = 4.4 + R() * 1.2;
        const h = 5.5 + R() * 7;
        const px = x + sgn * (9.5 + R() * 1.2);
        const key = R() > 0.45 ? 'brick' : 'trimWhite';
        b.boxB('stone', px, 0, z, w + 0.5, 0.4, d + 0.5);
        b.boxB(key, px, 0.4, z, w, h, d);
        const floors = Math.max(1, Math.round(h / 3.2));
        for (let f = 0; f < floors; f++) {
          const fy = 0.4 + 1.7 + f * 3.2;
          for (let k = 0; k < 2; k++) {
            b.box('windowLit', px - sgn * (w / 2 + 0.06), fy, z - 1.1 + k * 2.2, 0.16, 1.9, 1.3);
          }
          b.boxB('trimWhite', px, 0.4 + 3.0 + f * 3.2, z, w + 0.3, 0.22, d + 0.3);
        }
        addRoof(b, mats, {
          x: px, y: 0.4 + h, z, w, d, h: 1.2 + R() * 0.6, over: 0.5, lift: 0.35,
          key: R() > 0.5 ? 'roof' : 'roofGreen', ridgeKey: 'ridge', detail: false,
        });
        if (R() > 0.5) {
          addNeon(b, mats, { x: px - sgn * (w / 2 + 0.2), y: 3.2 + Math.floor(R() * 3) * 2.6, z, ry: Math.PI / 2, w: 3.4, h: 0.8 });
        }
      }
    }
    lineOfTrees(b, mats, [[x - 6.4, -28], [x - 6.4, -76]], { spacing: sp(8), kind: 'plane', s: 0.95, seed: 7 });
    lineOfTrees(b, mats, [[x + 6.4, -28], [x + 6.4, -76]], { spacing: sp(8), kind: 'plane', s: 0.95, seed: 8 });
    for (let i = 0; i < 7; i++) {
      const z = -30 - i * 7;
      for (const sgn of [-1, 1]) {
        addLamp(b, mats, { x: x + sgn * 7.6, z, ry: sgn > 0 ? Math.PI / 2 : -Math.PI / 2, h: 4.4 });
      }
    }
  })();

  /* ---------- 7. 汉正街（汉口老城，密排民居） ---------- */
  (function hanzheng() {
    for (let i = 0; i < 46; i++) {
      const x = -44 - R() * 46;
      const z = -6 - R() * 34;
      if (x > -46 && z > -22 && z < -12) continue; // 让开江汉关
      const w = 4 + R() * 3.4;
      const d = 4 + R() * 3;
      const two = R() > 0.55;
      addHouse(b, mats, {
        x, z, y: 0, w, d, h: 3.0 + R() * 0.6, ry: (R() - 0.5) * 0.5,
        storeys: two ? 2 : 1, gable: R() > 0.5, lanterns: R() > 0.72, detail: R() > 0.7,
        roofKey: 'roof', eaveKey: 'ridge',
      });
    }
    for (let i = 0; i < 5; i++) {
      addStall(b, mats, { x: -46 - R() * 30, z: -8 - R() * 26, ry: (R() - 0.5) * 3, s: 0.9, awningKey: R() > 0.5 ? 'awning' : 'awningB' });
    }
  })();

  /* ---------- 8. 三镇街区：把城“建满” ---------- */
  // 汉口老城（江汉关、江汉路、天际线、江滩之外的空档）
  const hankouKeepout = [
    [-58, -20, 26], [-58, -34, 13], [-58, -50, 13], [-58, -66, 13], [-58, -80, 13],
    [-70, -84, 24], [-50, -100, 22], [-92, -62, 20], [-62, -52, 18], [-84, -108, 18],
    [-32, -45, 14], [-30, -14, 12], [-58, -22, 20],
  ];
  scatterHouses(b, mats, R, { x0: -252, x1: -30, z0: -186, z1: 8, count: dens(130), keepout: hankouKeepout, trees: 0.16 * Q.trees, detailChance: 0.3 * Q.detail });
  // 汉阳（龟山、晴川阁、归元寺、大桥引桥之外）
  const hanyangKeepout = [
    [-86, 50, 33], [-58, 42, 18], [-108, 108, 40], [-60, 48, 20], [-104, 120, 16], [-132, 96, 16],
  ];
  scatterHouses(b, mats, R, { x0: -252, x1: -30, z0: 32, z1: 242, count: dens(98), keepout: hanyangKeepout, trees: 0.2 * Q.trees, detailChance: 0.32 * Q.detail });
  // 武昌（蛇山、红楼、户部巷、武大、东湖、沙湖、紫阳湖、滨江天际线、楚河汉街之外）
  const wuchangKeepout = [
    [86, 48, 36], [58, 70, 20], [92, 78, 24], [76, 95, 34], [150, -86, 46],
    [214, -12, 58], [118, -6, 30], [122, 88, 20], [48, -74, 22], [66, -92, 20],
    [34, -96, 18], [58, -46, 16], [166, 139, 46], [176, 148, 30], [40, 48, 24], [70, 48, 18],
    [202, -2, 14],
  ];
  scatterHouses(b, mats, R, { x0: 32, x1: 300, z0: -232, z1: 242, count: dens(162), keepout: wuchangKeepout, trees: 0.18 * Q.trees, detailChance: 0.3 * Q.detail });

  /* ---------- 9. 户部巷（武昌过早的江湖） ---------- */
  (function hubu() {
    const cx = 92;
    const cz = 78;
    b.slab('plazaDark', landShape(roundedRect(cx - 5, cz - 16, cx + 5, cz + 16, 3)), 0, 0.02, 0, 0.2);
    // 巷子两侧的店屋
    for (let i = 0; i < 14; i++) {
      const z = cz - 15 + i * 2.3;
      for (const sgn of [-1, 1]) {
        const px = cx + sgn * (5.2 + R() * 1.4);
        const w = 4.2 + R() * 2.4;
        const d = 4 + R() * 2.6;
        addHouse(b, mats, {
          x: px, z, y: 0, w, d, h: 3.1 + R() * 0.7, ry: (R() - 0.5) * 0.35,
          storeys: R() > 0.4 ? 2 : 1, lanterns: true, detail: true,
          roofKey: 'roof', eaveKey: 'ridge',
        });
        if (R() > 0.45) {
          b.boxB('wood', px - sgn * (w / 2 + 0.05), 2.1, z, 0.14, 0.9, 1.6);
        }
      }
    }
    // 摊位、竹桌、蒸汽、幌子（同时登记碰撞矩形，走路时不会穿过摊子）
    for (let i = 0; i < 10; i++) {
      const z = cz - 13 + i * 2.9;
      const sgn = i % 2 ? 1 : -1;
      const sx = cx + sgn * (3.1 + R() * 1.2);
      addStall(b, mats, {
        x: sx, z, ry: sgn > 0 ? -Math.PI / 2 : Math.PI / 2,
        s: 0.95, w: 3.2, d: 1.7, awningKey: i % 3 === 0 ? 'awningB' : 'awning',
      });
      blockers.push([sx - 0.95, z - 1.7, sx + 0.95, z + 1.7]);
      if (i % 3 === 0) {
        const tx = cx - sgn * 3.4;
        addStall(b, mats, { x: tx, z: z + 1.2, kind: 'table', s: 0.85 });
        blockers.push([tx - 0.7, z + 0.5, tx + 0.7, z + 1.9]);
      }
    }
    addGate(b, mats, { x: cx, y: 0.2, z: cz + 18, ry: 0, w: 9, h: 5.4, roofKey: 'roof', ridgeKey: 'ridge' });
    // 巷口牌坊（写「户部巷」的那道）
    addPaifang(b, mats, {
      x: cx, y: 0.22, z: cz + 13, ry: 0,
      w: 10.5, h: 6.4, span: 3.2, pillarKey: 'stone2', roofKey: 'roof', ridgeKey: 'ridge', glowKey: 'lattice',
    });
    // 横跨巷子的灯笼串：夜里整条巷子都是暖的
    for (let i = 0; i < 7; i++) {
      addLanternString(b, mats, {
        x0: cx - 5.2, z0: cz - 13 + i * 4.2, x1: cx + 5.2, z1: cz - 13 + i * 4.2,
        y: 4.5, sag: 0.85, count: 7, seed: 90 + i,
      });
    }
    // 立式招牌、水缸、长凳、竹凳、竹筐
    for (let i = 0; i < 7; i++) {
      const sgn = i % 2 ? 1 : -1;
      addStreetProp(b, mats, {
        x: cx + sgn * 4.5, z: cz - 12 + i * 3.6, ry: sgn > 0 ? -Math.PI / 2 : Math.PI / 2,
        kind: 'sign', h: 2.7, w: 0.6,
      });
    }
    for (const [px, pz] of [[cx - 4.2, cz - 14], [cx + 4.3, cz - 6], [cx - 4.4, cz + 2], [cx + 4.2, cz + 9]]) {
      addStreetProp(b, mats, { x: px, z: pz, kind: 'vat', s: 0.95 });
      blockers.push([px - 0.7, pz - 0.7, px + 0.7, pz + 0.7]);
    }
    for (let i = 0; i < 8; i++) {
      const sgn = i % 2 ? 1 : -1;
      addStreetProp(b, mats, { x: cx + sgn * 3.6, z: cz - 11 + i * 3.1, kind: i % 3 === 0 ? 'bench' : 'stool', s: 0.95, ry: sgn > 0 ? 0.2 : -0.2 });
    }
    for (let i = 0; i < 5; i++) {
      addStreetProp(b, mats, { x: cx + (i % 2 ? 4.1 : -4.1), z: cz - 9 + i * 4.4, kind: 'basket', s: 0.9 });
    }
    // 巷子北口的横街：走到巷尾不是死胡同，可以拐弯
    b.slab('plazaDark', landShape(roundedRect(cx - 9, cz - 22, cx + 9, cz - 15.5, 2.5)), 0, 0.02, 0, 0.2);
    for (let i = 0; i < 6; i++) {
      const hx2 = cx - 7.5 + i * 3;
      addHouse(b, mats, {
        x: hx2, z: cz - 23.6, y: 0, w: 3.6, d: 4.4, h: 3.2 + R() * 0.6, ry: (R() - 0.5) * 0.2,
        storeys: R() > 0.5 ? 2 : 1, lanterns: true, detail: true, roofKey: 'roof', eaveKey: 'ridge',
      });
    }
    addLanternString(b, mats, {
      x0: cx - 8, z0: cz - 19, x1: cx + 8, z1: cz - 19, y: 4.4, sag: 0.8, count: 9, seed: 99,
    });
    lineOfTrees(b, mats, [[cx - 8, cz - 18], [cx - 8, cz + 18]], { spacing: sp(9), kind: 'broad', s: 0.85, seed: 21 });
    lineOfTrees(b, mats, [[cx + 8, cz - 18], [cx + 8, cz + 18]], { spacing: sp(9), kind: 'broad', s: 0.85, seed: 22 });
    for (let i = 0; i < 6; i++) {
      addLamp(b, mats, { x: cx - 5.8, z: cz - 14 + i * 5.6, ry: Math.PI / 2, h: 3.6 });
      addLamp(b, mats, { x: cx + 5.8, z: cz - 14 + i * 5.6, ry: -Math.PI / 2, h: 3.6 });
    }
  })();

  // 武昌老城墙（蛇山以南的一段）
  addCityWall(b, mats, {
    pts: [[48, 96], [104, 96]], y: 0, h: 3.6, thick: 1.6, tower: true,
  });

  /* ---------- 9. 东湖 · 磨山 · 行吟阁 ---------- */
  addHill(b, mats, { x: 252, y: 0, z: -34, r: 28, h: 19, key: 'hill', rock: 8, treeKind: 'broad', treeCount: 18, rnd: R });
  // 湖心小岛与行吟阁
  b.cylB('lawn', 202, -0.5, -2, 9, 9.4, 0.9, 18);
  b.cylB('stone', 202, 0.4, -2, 8.2, 8.4, 0.3, 18);
  addTowerTiers(b, mats, {
    x: 202, y: 0.7, z: -2, tiers: 3, w: 7.6, d: 7.6, h: 3.2, ry: 0.4, taper: 0.88,
    roofKey: 'roofGreen', ridgeKey: 'ridgeGreen', columnKey: 'column', wallKey: 'wall2', gallery: true,
  });
  // 连接小岛的石拱桥
  addArchBridge(b, mats, { x: 178, y: 0.2, z: -2, span: 14, width: 3.4, rise: 2.4, ry: Math.PI / 2, detail: true });
  // 磨山楚城
  addGate(b, mats, { x: 244, y: 0.2, z: 6, ry: 0.2, w: 12, h: 7, roofKey: 'roof', ridgeKey: 'ridge' });
  addHall(b, mats, { x: 258, y: 0.4, z: 12, w: 13, d: 8, h: 3.8, ry: 0.2, columns: 6, double: true, wallKey: 'wall2', roofKey: 'roof', ridgeKey: 'ridge' });
  // 绿道、垂柳与樱花
  lineOfTrees(b, mats, [[170, -40], [176, 10], [196, 26]], { spacing: sp(8), kind: 'willow', s: 1.15, seed: 31 });
  lineOfTrees(b, mats, [[182, -30], [206, -16]], { spacing: sp(7), kind: 'cherry', s: 1.05, seed: 32 });
  lineOfTrees(b, mats, [[168, 12], [190, 24], [214, 26]], { spacing: sp(10), kind: 'broad', s: 1.1, seed: 33 });
  for (let i = 0; i < 8; i++) {
    addLamp(b, mats, { x: 172 + i * 6, z: -30 + i * 5.4, kind: 'park' });
  }
  addPier(b, mats, { x: 176, y: 0.2, z: -34, len: 10, w: 3, ry: Math.PI / 2 });
  addRock(b, mats, { x: 196, y: 0, z: 24, s: 1.5 });
  addRock(b, mats, { x: 168, y: 0, z: -22, s: 1.2 });

  /* ---------- 10. 武汉大学 · 珞珈山 · 樱花大道 ---------- */
  (function wuda() {
    const hx = 150;
    const hz = -86;
    // 老图书馆：中央高塔 + 两翼，青绿琉璃瓦
    addHall(b, mats, {
      x: hx + 4, y: 9.4, z: hz + 6, w: 20, d: 12, h: 5.4, ry: 0.1, columns: 6, double: false,
      wallKey: 'wall', roofKey: 'roofCollege', ridgeKey: 'ridgeCollege', plaque: false,
    });
    addTowerTiers(b, mats, {
      x: hx + 4, y: 14.8, z: hz + 6, tiers: 2, w: 7, d: 7, h: 3.4, ry: 0.1, taper: 0.86,
      roofKey: 'roofCollege', ridgeKey: 'ridgeCollege', columnKey: 'column', wallKey: 'wall', gallery: false,
    });
    // 老斋舍：依山的长楼 + 台阶
    b.boxB('wall', hx - 14, 0.4, hz + 22, 30, 5.2, 8);
    b.boxB('trimWhite', hx - 14, 5.6, hz + 22, 30.4, 0.4, 8.4);
    addRoof(b, mats, { x: hx - 14, y: 6, z: hz + 22, w: 30, d: 8, h: 2.2, over: 0.9, lift: 0.5, key: 'roofCollege', ridgeKey: 'ridgeCollege', detail: true });
    for (let i = 0; i < 12; i++) {
      b.box('windowLit', hx - 27 + i * 2.4, 3.2, hz + 26.1, 1.3, 1.9, 0.16);
    }
    addStairs(b, mats, { x: hx - 14, y: 3.4, z: hz + 30, w: 14, steps: 10, rise: 0.3, run: 0.8 });
    // 樱花大道
    b.slab('stonePath', landShape(roundedRect(hx - 20, hz + 14, hx + 6, hz + 20, 2)), 0, 0.02, 0, 0.16);
    lineOfTrees(b, mats, [[hx - 18, hz + 16], [hx + 4, hz + 16]], { spacing: sp(6), kind: 'cherry', s: 1.15, seed: 41 });
    lineOfTrees(b, mats, [[hx - 18, hz + 19], [hx + 4, hz + 19]], { spacing: sp(6), kind: 'cherry', s: 1.1, seed: 42 });
    lineOfTrees(b, mats, [[hx + 14, hz - 14], [hx + 22, hz + 16]], { spacing: sp(9), kind: 'broad', s: 1.1, seed: 43 });
    // 樱花大道再补两排，让花期成片
    lineOfTrees(b, mats, [[hx - 22, hz + 12], [hx + 8, hz + 12]], { spacing: sp(7), kind: 'cherry', s: 0.98, seed: 44 });
    lineOfTrees(b, mats, [[hx - 22, hz + 23], [hx + 8, hz + 23]], { spacing: sp(7), kind: 'cherry', s: 1.05, seed: 45 });
    for (let i = 0; i < 5; i++) {
      addLamp(b, mats, { x: hx - 16 + i * 5.4, z: hz + 20.5, kind: 'park' });
    }
    // 珞珈山：把老斋舍与老图书馆托起来的山体
    addHill(b, mats, { x: hx + 2, y: 0, z: hz - 4, r: 30, h: 16, key: 'hill', rock: 7, treeKind: 'broad', treeCount: 16, rnd: R });
    // 宋卿体育馆：绿琉璃瓦的方形馆
    addHall(b, mats, {
      x: hx - 30, y: 0.4, z: hz - 2, w: 16, d: 12, h: 5.2, ry: -0.12, columns: 6, double: false,
      wallKey: 'wall', roofKey: 'roofCollege', ridgeKey: 'ridgeCollege', plaque: true, detail: true,
    });
    // 老牌坊：国立武汉大学
    addPaifang(b, mats, {
      x: hx - 24, y: 0.2, z: hz + 30, ry: 0, w: 12, h: 7, span: 3.6,
      pillarKey: 'stone2', roofKey: 'roofCollege', ridgeKey: 'ridgeCollege', glowKey: 'lattice',
    });
    // 樱花树下的长凳
    for (let i = 0; i < 5; i++) {
      addStreetProp(b, mats, { x: hx - 16 + i * 4.6, z: hz + 14.6, ry: Math.PI / 2, kind: 'bench', s: 0.95 });
    }
  })();

  /* ---------- 11. 归元寺（汉阳） ---------- */
  (function guiyuan() {
    const x = -108;
    const z = 108;
    b.slab('plaza', landShape(roundedRect(x - 30, z - 26, x + 30, z + 26, 6)), 0, 0.02, 0, 0.18);
    b.slab('pond', landShape(blob(x, z + 18, 11, 6, 55, 0.12, 20)), 0, 0.18, 0, 0.06);
    addArchBridge(b, mats, { x: x - 6, y: 0.24, z: z + 18, span: 8, width: 2.4, rise: 1.5 });
    addGate(b, mats, { x, y: 0.2, z: z + 30, ry: 0, w: 11, h: 6, roofKey: 'roof', ridgeKey: 'ridge' });
    addHall(b, mats, { x, y: 0.2, z: z + 8, w: 18, d: 11, h: 4.6, ry: 0, columns: 6, double: true, roofKey: 'roof', ridgeKey: 'ridge' });
    addHall(b, mats, { x: x - 22, y: 0.2, z: z - 6, w: 12, d: 8, h: 3.6, ry: 0.2, columns: 5, double: false, roofKey: 'roof', ridgeKey: 'ridge' });
    addHall(b, mats, { x: x + 22, y: 0.2, z: z - 6, w: 12, d: 8, h: 3.6, ry: -0.2, columns: 5, double: false, roofKey: 'roof', ridgeKey: 'ridge' });
    addPagoda(b, mats, { x, y: 0.2, z: z - 20, tiers: 7, r: 3.2, h: 2.2, ry: 0.1, detail: false });
    addPavilion(b, mats, { x: x - 16, y: 0.2, z: z + 26, r: 2.4, h: 3.2, sides: 4 });
    addPavilion(b, mats, { x: x + 16, y: 0.2, z: z + 26, r: 2.4, h: 3.2, sides: 4 });
    lineOfTrees(b, mats, [[x - 26, z + 22], [x - 26, z - 18]], { spacing: sp(8), kind: 'broad', s: 1.2, seed: 51 });
    lineOfTrees(b, mats, [[x + 26, z + 22], [x + 26, z - 18]], { spacing: sp(8), kind: 'broad', s: 1.2, seed: 52 });
    addTree(b, mats, { x: x - 8, y: 0, z: z + 24, s: 1.6, kind: 'broad', leafKey: 'leafDark' });
    addTree(b, mats, { x: x + 9, y: 0, z: z + 24, s: 1.5, kind: 'broad', leafKey: 'leafDark' });
    // 罗汉堂：面阔五间的单檐大殿
    addHall(b, mats, {
      x, y: 0.2, z: z - 12, w: 22, d: 12, h: 4.8, ry: 0, columns: 7, double: false,
      roofKey: 'roof', ridgeKey: 'ridge', plaque: true, detail: true,
    });
    // 钟楼、鼓楼：大殿前对称的小楼
    for (const sgn of [-1, 1]) {
      addTowerTiers(b, mats, {
        x: x + sgn * 17, y: 0.2, z: z + 4, tiers: 2, w: 5.4, d: 5.4, h: 3.6, ry: 0,
        taper: 0.9, roofKey: 'roof', ridgeKey: 'ridge', columnKey: 'column', wallKey: 'wall', gallery: false,
      });
    }
    // 双面观音：莲座立像 + 背光
    addStatue(b, mats, { x: x - 2, y: 0.24, z: z + 18, h: 13, ry: 0.2 });
    // 香炉与供台
    b.cylB('bronze', x + 6, 0.2, z + 10, 1.5, 1.1, 1.5, 12);
    b.boxB('bronze', x + 6, 0.2 + 1.5, z + 10, 2.6, 0.5, 2.6);
    b.boxB('bronze', x - 7, 0.2, z + 10, 3.4, 0.9, 1.4);
    // 院墙：把寺院围起来（留出山门与侧门）
    addCityWall(b, mats, { pts: [[x - 30, z + 32], [x - 30, z - 30]], y: 0, h: 3.2, thick: 1.1, tower: false });
    addCityWall(b, mats, { pts: [[x + 30, z + 32], [x + 30, z - 30]], y: 0, h: 3.2, thick: 1.1, tower: false });
    addCityWall(b, mats, { pts: [[x - 30, z - 30], [x + 30, z - 30]], y: 0, h: 3.2, thick: 1.1, tower: true });
    // 放生池边的石栏与灯笼串
    addRailing(b, mats, [[x - 11, z + 18], [x + 8, z + 18]], 0.6, { key: 'stoneBridge' });
    for (let i = 0; i < 4; i++) {
      addLanternString(b, mats, {
        x0: x - 12, z0: z + 26 - i * 3.4, x1: x + 12, z1: z + 26 - i * 3.4,
        y: 4.4, sag: 0.8, count: 7, seed: 80 + i,
      });
    }
  })();

  /* ---------- 12. 现代天际线（武昌滨江 / 汉口 / 光谷） ---------- */
  (function skyline() {
    // 武昌滨江：绿地中心领衔
    addModernTower(b, mats, { x: 48, y: 0, z: -74, w: 13, d: 13, h: 74, setbacks: 3, spire: 8, mullions: 5 });
    addModernTower(b, mats, { x: 66, y: 0, z: -92, w: 11, d: 11, h: 52, setbacks: 2, spire: 4, mullions: 5 });
    addModernTower(b, mats, { x: 34, y: 0, z: -96, w: 10, d: 14, h: 42, setbacks: 1, mullions: 4 });
    addModernTower(b, mats, { x: 58, y: 0, z: -46, w: 12, d: 12, h: 34, setbacks: 1, mullions: 4 });
    addModernTower(b, mats, { x: 40, y: 0, z: -34, w: 9, d: 16, h: 26, mullions: 4 });
    // 汉口
    addModernTower(b, mats, { x: -70, y: 0, z: -84, w: 12, d: 12, h: 62, setbacks: 3, spire: 5, mullions: 5 });
    addModernTower(b, mats, { x: -50, y: 0, z: -100, w: 10, d: 10, h: 46, setbacks: 2, mullions: 4 });
    addModernTower(b, mats, { x: -92, y: 0, z: -62, w: 11, d: 11, h: 38, setbacks: 1, mullions: 4 });
    addModernTower(b, mats, { x: -62, y: 0, z: -52, w: 13, d: 10, h: 28, mullions: 4 });
    addModernTower(b, mats, { x: -84, y: 0, z: -108, w: 9, d: 9, h: 30, mullions: 3 });
    // 光谷（东南）：广场 + 环形天桥 + 星河雕塑 + 有轨电车 + 楼群
    (function guanggu() {
      const gx = 178;
      const gz = 156;
      // 广场铺装与环路
      b.slab('plaza', landShape(blob(gx, gz, 44, 40, 71, 0.06, 30)), 0, 0.02, 0, 0.2);
      b.slab('road', landShape(blob(gx, gz, 33, 30, 72, 0.05, 26), [blob(gx, gz, 25, 22, 73, 0.05, 24)]), 0, 0.02, 0, 0.22);
      b.slab('plazaDark', landShape(blob(gx, gz, 24, 21, 74, 0.05, 24)), 0, 0.03, 0, 0.2);
      // 环形天桥 + 中央雕塑
      addRingBridge(b, mats, { x: gx, y: 0.2, z: gz, r: 27, deckY: 5.8, width: 3.4, seg: 36, columns: 12 });
      addSculpture(b, mats, { x: gx, y: 0.24, z: gz, h: 24, ribbon: 5, seed: 77 });
      // 广场灯与绿化
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + 0.3;
        addLamp(b, mats, { x: gx + Math.cos(a) * 21, z: gz + Math.sin(a) * 18.5, h: 5.2, kind: 'street' });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.9;
        addTree(b, mats, { x: gx + Math.cos(a) * 38, y: 0, z: gz + Math.sin(a) * 34, s: 0.9 + R() * 0.3, kind: 'broad', r: R });
      }
      // 有轨电车：沿广场西侧南北向
      addTram(b, mats, { x: gx - 40, y: 0.2, z: gz - 6, len: 54, ry: Math.PI / 2, stop: true });
      // 楼群：八栋高低错落的玻璃塔，夜里整片亮起来
      const towers = [
        [-30, -26, 12, 12, 46, 3, 5], [-8, -36, 11, 11, 34, 2, 4], [16, -32, 10, 10, 40, 2, 4],
        [34, -14, 12, 12, 30, 1, 4], [36, 12, 11, 11, 44, 3, 5], [20, 32, 10, 10, 28, 1, 4],
        [-14, 34, 11, 11, 36, 2, 4], [-34, 12, 12, 12, 32, 1, 4],
      ];
      for (const [dx, dz, w, d, h, setbacks, mullions] of towers) {
        addModernTower(b, mats, {
          x: gx + dx, y: 0, z: gz + dz, w, d, h, setbacks, mullions,
          spire: h > 40 ? 4 : 0,
        });
      }
      // 步行街招牌与霓虹
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.2;
        const px = gx + Math.cos(a) * 31;
        const pz = gz + Math.sin(a) * 28;
        addNeon(b, mats, { x: px, y: 7 + (i % 3) * 1.6, z: pz, ry: -a + Math.PI / 2, w: 4.2, h: 0.8 });
      }
      lineOfTrees(b, mats, [[gx - 46, gz - 40], [gx - 46, gz + 40]], { spacing: sp(11), kind: 'plane', s: 0.95, seed: 75 });
    })();
    // 楚河汉街：一条带霓虹的商业街
    b.slab('plaza', landShape(roundedRect(126, 132, 206, 146, 3)), 0, 0.02, 0, 0.18);
    for (let i = 0; i < 12; i++) {
      const x = 130 + i * 6.4;
      for (const sgn of [-1, 1]) {
        const z = 138 + sgn * 9.5;
        const h = 6 + R() * 4;
        b.boxB(R() > 0.5 ? 'concrete' : 'wall2', x, 0.2, z, 5.4, h, 5);
        for (let f = 0; f < Math.round(h / 3.2); f++) {
          b.box('windowLit', x, 2 + f * 3.2, z - sgn * 2.6, 3.6, 1.6, 0.16);
        }
        addNeon(b, mats, { x, y: h * 0.55, z: z - sgn * 2.8, ry: 0, w: 3.6, h: 0.7 });
      }
    }
    lineOfTrees(b, mats, [[128, 139], [204, 139]], { spacing: sp(12), kind: 'plane', s: 0.9, seed: 61 });
  })();

  /* ---------- 13. 鹦鹉洲长江大桥（橘红悬索桥） ---------- */
  (function suspension() {
    const z = -76;
    const length = 168;
    const deckY = 13;
    const towers = [-30, 30];
    // 桥面
    b.boxB('deck', 0, deckY, z, length, 0.7, 9);
    for (const sgn of [-1, 1]) {
      b.boxB('railBridge', 0, deckY + 0.7, z + sgn * 4.3, length, 0.7, 0.16);
    }
    // 桥塔
    for (const tx of towers) {
      for (const sgn of [-1, 1]) {
        b.boxB('orangeBridge', tx, -2, z + sgn * 4, 3, deckY + 24, 3);
      }
      b.boxB('orangeBridge', tx, deckY + 10, z, 3, 2.6, 11);
      b.boxB('orangeBridge', tx, deckY + 21, z, 2.4, 2.2, 9);
      // 墩
      b.cylB('pier', tx, -3, z, 2.6, 3.2, 6, 10);
    }
    // 主缆与吊索
    const SEG = 22;
    for (const sgn of [-1, 1]) {
      const zz = z + sgn * 4;
      for (let i = 0; i < SEG; i++) {
        const t0 = -0.5 + i / SEG;
        const t1 = -0.5 + (i + 1) / SEG;
        const y0 = deckY + 24 * (1 - Math.pow(Math.abs(t0) * 2, 2)) * 0.75 + 2;
        const y1 = deckY + 24 * (1 - Math.pow(Math.abs(t1) * 2, 2)) * 0.75 + 2;
        b.beam('orangeBridge', [t0 * length, y0, zz], [t1 * length, y1, zz], 0.32, 5);
        if (i % 2 === 0) {
          b.beam('orangeBridge', [t0 * length, y0, zz], [t0 * length, deckY + 1.2, zz], 0.1, 4);
        }
      }
    }
    // 引桥
    for (const sgn of [-1, 1]) {
      b.boxB('deck', sgn * (length / 2 + 12), deckY - 1.6, z, 24, 0.7, 9);
      b.cylB('pier', sgn * (length / 2 + 6), -1, z, 1.6, 2, deckY - 1, 8);
      b.cylB('pier', sgn * (length / 2 + 18), -1, z, 1.6, 2, deckY - 2.4, 8);
    }
  })();

  /* ---------- 14. 码头、航标与江面 ---------- */
  addPier(b, mats, { x: -30, y: 0.2, z: -14, len: 14, w: 4, ry: Math.PI / 2, kind: 'ferry' });
  addPier(b, mats, { x: 32, y: 0.2, z: 66, len: 14, w: 4, ry: -Math.PI / 2, kind: 'ferry' });
  addPier(b, mats, { x: -26, y: 0.2, z: 40, len: 10, w: 3, ry: Math.PI / 2 });
  for (const [x, z] of [[-14, -40], [12, 10], [-10, 96], [16, 120], [-16, -110]]) {
    addBuoy(b, mats, { x, y: 0, z });
  }

  /* ---------- 15. 城市绿化与路灯 ---------- */
  addTree(b, mats, { x: 92, y: 0, z: 76, s: 1.2, kind: 'broad' });
  // 江滩行道树与梅花
  lineOfTrees(b, mats, [[-32, -92], [-32, 4]], { spacing: sp(9), kind: 'plane', s: 1.05, seed: 71 });
  lineOfTrees(b, mats, [[-36, -88], [-36, 2]], { spacing: sp(12), kind: 'plum', s: 1.0, seed: 72 });
  lineOfTrees(b, mats, [[30, -56], [30, 58]], { spacing: sp(11), kind: 'plane', s: 1.0, seed: 73 });
  // 武昌老城里的绿化
  for (let i = 0; i < 22; i++) {
    const x = 44 + R() * 60;
    const z = 84 + R() * 40;
    if (x > 104 && x < 140 && z > 74 && z < 100) continue;
    addTree(b, mats, { x, z, s: 0.8 + R() * 0.5, kind: R() > 0.7 ? 'plum' : 'broad', r: R });
  }
  // 汉阳民居与绿化
  for (let i = 0; i < 26; i++) {
    const x = -40 - R() * 60;
    const z = 40 + R() * 60;
    if (x < -80 && z > 80) continue;
    if (R() > 0.45) {
      addHouse(b, mats, {
        x, z, y: 0, w: 4 + R() * 3, d: 4 + R() * 3, h: 2.9 + R() * 0.6,
        ry: (R() - 0.5) * 0.6, storeys: R() > 0.6 ? 2 : 1, gable: R() > 0.6, lanterns: false,
      });
    } else {
      addTree(b, mats, { x, z, s: 0.9 + R() * 0.6, kind: 'broad', r: R });
    }
  }
  // 全城路灯
  for (let i = 0; i < 26; i++) {
    const x = -240 + i * 20;
    addLamp(b, mats, { x, z: -150, h: 4.2 });
    addLamp(b, mats, { x, z: 150, h: 4.2 });
  }
  for (let i = 0; i < 16; i++) {
    const z = -140 + i * 20;
    addLamp(b, mats, { x: -200, z, h: 4.2 });
    addLamp(b, mats, { x: 220, z, h: 4.2 });
  }

  /* ---------- 16. 静态网格合并入场景 ---------- */
  const meshes = b.finish(root);

  /* ---------- 17. 可动的船（各自成组，便于动画） ---------- */
  const boats = [];
  function makeBoat(kind, s, x, z, y, ry) {
    const g = new THREE.Group();
    const bb = new Batcher(mats);
    addBoat(bb, mats, { x: 0, y: 0, z: 0, ry: 0, s, kind });
    bb.finish(g);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    root.add(g);
    return g;
  }
  boats.push({ obj: makeBoat('ferry', 1.1, -8, -130, -0.1, Math.PI / 2), path: { axis: 'z', from: -140, to: 140, x: -8, speed: 3.4 } });
  boats.push({ obj: makeBoat('ferry', 0.95, 9, 120, -0.1, -Math.PI / 2), path: { axis: 'z', from: 140, to: -140, x: 9, speed: -2.8 } });
  boats.push({ obj: makeBoat('barge', 1.0, 15, -60, -0.15, Math.PI / 2), path: { axis: 'z', from: -120, to: 120, x: 15, speed: 2.1 } });
  boats.push({ obj: makeBoat('sampan', 1.0, -16, 70, -0.2, -Math.PI / 2), path: { axis: 'z', from: 120, to: -120, x: -16, speed: -3.0 } });
  // 东湖的帆船与画舫绕岛而行
  boats.push({ obj: makeBoat('sail', 1.0, 214, -40, -0.25, 0.6), orbit: { cx: 208, cz: -6, r: 34, speed: 0.055, phase: 0 } });
  boats.push({ obj: makeBoat('sampan', 1.1, 176, 14, -0.25, 1.8), orbit: { cx: 208, cz: -6, r: 26, speed: -0.075, phase: 2.1 } });
  boats.push({ obj: makeBoat('sail', 0.85, 240, 10, -0.25, -1.2), orbit: { cx: 208, cz: -6, r: 42, speed: 0.045, phase: 4.2 } });

  /* ---------- 18. 地标标签 ---------- */
  const landmarks = [
    { id: 'yellowcrane', region: 'yellowcrane', zh: '黄鹤楼', en: 'YELLOW CRANE TOWER', pos: [88, 36, 44] },
    { id: 'bridge', region: 'bridge', zh: '长江大桥', en: 'YANGTZE RIVER BRIDGE', pos: [0, 24, 48] },
    { id: 'jianghan', region: 'jianghan', zh: '江汉关', en: 'CUSTOMS HOUSE', pos: [-42, 32, -20] },
    { id: 'eastlake', region: 'eastlake', zh: '东湖 · 磨山', en: 'EAST LAKE', pos: [252, 30, -34] },
    { id: 'hubu', region: 'hubu', zh: '户部巷', en: 'HUBU ALLEY', pos: [92, 22, 78] },
    { id: 'guiyuan', region: 'guiyuan', zh: '归元禅寺', en: 'GUIYUAN TEMPLE', pos: [-108, 30, 108] },
    { id: 'guanggu', region: 'guanggu', zh: '光谷广场', en: 'OPTICS VALLEY', pos: [178, 62, 156] },
    { id: 'guangguRing', region: 'guanggu', zh: '星河环廊', en: 'GALAXY RING', pos: [178, 12, 184] },
    { id: 'wuda', region: 'wuda', zh: '武汉大学', en: 'WUHAN UNIVERSITY', pos: [154, 32, -80] },
    { id: 'cherryAve', region: 'wuda', zh: '樱花大道', en: 'CHERRY AVENUE', pos: [138, 11, -68] },
    { id: 'tv', region: 'bridge', zh: '龟山电视塔', en: 'TORTOISE HILL TOWER', pos: [-88, 46, 46] },
    { id: 'xingyin', region: 'eastlake', zh: '行吟阁', en: 'XINGYIN PAVILION', pos: [202, 22, -2] },
    { id: 'skyline', region: 'all', zh: '武昌滨江', en: 'RIVERSIDE SKYLINE', pos: [48, 74, -74] },
    { id: 'parrot', region: 'all', zh: '鹦鹉洲大桥', en: 'PARROT CAY BRIDGE', pos: [0, 46, -76] },
    { id: 'hanzheng', region: 'jianghan', zh: '汉正街', en: 'HANZHENG STREET', pos: [-66, 18, -22] },
    { id: 'chuhe', region: 'all', zh: '楚河汉街', en: 'CHUHE HANJIE', pos: [166, 22, 138] },
    { id: 'redhall', region: 'hubu', zh: '武昌红楼', en: 'RED HALL', pos: [58, 18, 70] },
  ];

  return {
    root,
    mats,
    water,
    sky,
    skyU,
    boats,
    landmarks,
    meshes,
    blockers,
    quality: { ...Q },
    stats: {
      triangles: b.triangles,
      meshes: meshes.length,
      materials: Object.keys(MATERIAL_DEFS).length,
    },
  };
}
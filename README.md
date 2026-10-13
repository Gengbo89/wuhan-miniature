# 江城小境 · WUHAN IN MINIATURE

一个**完全程序化生成**的武汉市三维微缩场景：无需任何图片、模型或音频素材，
打开浏览器即可在黄鹤楼、长江大桥、江汉关、东湖与户部巷之间漫游、观景、昼夜切换。

> 本目录是**原创实现**。它参考了第三方站点 `suzhou.liuwa.xyz`（姑苏小境）的
> *产品形态与交互概念*（三维微缩城市 + 地标导航 + 日夜切换 + 漫游），
> **没有复用其任何代码、样式、几何数据、文案或素材**。详见文末「版权边界」。

---

## 一、运行

ES Module + WebGL，必须经 HTTP 提供（`file://` 会被浏览器 CORS 拦截）：

```bash
cd site
python3 -m http.server 8899 --bind 127.0.0.1
# 浏览器打开 http://127.0.0.1:8899/index.html
```

任意静态服务器均可（`npx serve site`、`caddy file-server` 等）。
**零外部请求**：`index.html` / `styles.css` / `js/*.js` 中不存在任何 http(s) 外链、
`@import`、`url()` 或字体/CDN 依赖，离线可用。

浏览器要求：支持 WebGL2 与 ES Module 的现代浏览器（Chrome/Edge 90+、Safari 15+、Firefox 90+）。

---

## 二、操作

| 操作 | 效果 |
| --- | --- |
| 左键拖动 | 环绕旋转（含惯性阻尼） |
| 滚轮 | 推拉镜头 |
| 右键拖动 / 双指 | 平移视点 |
| `N` | 昼 ↔ 夜（1.4 秒渐变） |
| `H` | 回到全景 |
| `L` | 显隐地标标签 |
| `T` | 自动游览（依次巡游 9 处地标） |
| `F` | 全屏 |
| `P` | 保存截图（PNG，`canvas.toDataURL`） |
| `1`–`9` | 直达第 N 处地标 |
| `Esc` | 退出漫游 / 关闭弹窗 |
| 漫游中 `W A S D` | 行走，`Shift` 加速，鼠标拖动看四周 |

界面右栏 9 处目的地：**江城全景 / 黄鹤楼 / 长江大桥 / 江汉关·江汉路 / 东湖·磨山 / 户部巷 /
归元禅寺 / 光谷广场 / 武汉大学**，每处都有独立机位、地面行走点与解说文案（中英双语，
右上角「EN / 中文」切换）。

右上工具条另有**画质**按钮（高 / 中 / 低三档）：首屏检测 GPU 与设备条件自动选档，
运行中若连续掉帧还会自动降档；手动切换会重建整座城市。

---

## 三、自检参数（QA）

URL 查询参数，用于无头验证与截图（正常访问不需要）：

| 参数 | 作用 |
| --- | --- |
| `?probe=1` | 每 60 帧把运行状态写入 `#selfcheck` 并打到控制台（`[selfcheck] {...}`） |
| `?nohud=1` | 隐藏全部 UI，只留三维画面（便于对比截图） |
| `?region=<id>` | 直接落到指定机位，不做开场推进。id：`all` `yellowcrane` `bridge` `jianghan` `eastlake` `hubu` `guiyuan` `guanggu` `wuda` |
| `?night=1` | 直接进入夜间 |
| `?roam=1` | 直接进入漫游模式 |
| `?lang=en` | 直接使用英文 |
| `?quality=high\|mid\|low` | 强制画质档（跳过自动检测） |
| `?roamtest=N` | 无头环境下代替按键：前 N 帧持续向前走，走真实位移解算 |
| `?roamstrafe=N` | 同上，但改为「前进 + 右平移」，用来测贴墙滑动 |

自检 JSON 字段：`ok / webgl / errors / triangles / meshes / materials / drawCalls /
renderedTris / labels / railItems / regions / camera / radius / region / night / tod /
roam / lang / loaderDone / heroHidden / frames / fps / canvas / toast / bodyClass /
quality / qualityReason / qualityGpu / buildMs / pixelRatio / shadows /
roamX / roamZ / roamInArea / roamArea / roamBlockers`。

例：`http://127.0.0.1:8899/index.html?probe=1&nohud=1&region=bridge`

---

## 四、结构

```
site/
├── index.html          DOM 骨架：舞台 / 顶栏 / 首屏 / 信息卡 / 导航栏 / 工具条 / 标签层 / 漫游 HUD / 弹窗 / 载入层 / 轻提示
├── styles.css          纸感视觉体系（807 行）：设计令牌、面板、6 个断点、夜间与漫游态、无障碍
├── favicon.svg         朱红印章 + 金线 + 江水 + 桥 + 塔（纯矢量）
├── js/
│   ├── geom.js        几何与材质工具箱（1544 行）：Batcher 合批、30 个构件（box/cyl/cone/beam/slab/屋顶/斗拱/牌坊/灯笼串/街巷小件/环形天桥/雕塑/造像/轻轨…）、材质工厂、昼夜材质插值、水面与天空着色器
│   ├── city.js        城市总装（1132 行）：98 种材质定义、9 个区域机位、地形与三镇地块、17 处地标标签、街区密排、船/车/火车
│   └── app.js         运行时（1561 行）：画质分档、轨道相机、矩形并集漫游与碰撞解算、昼夜、标签投影、导览、音频、i18n、交互与工具、自检
└── vendor/
    ├── three.module.js   three.js r180（MIT）
    └── three.core.js     three.js r180 核心（MIT，r167+ 拆分）
```

自研部分约 **5 280 行**（`geom.js` 1544 + `city.js` 1132 + `app.js` 1561 + `styles.css` 807 + `index.html` 232），
`vendor/` 为唯一第三方依赖（MIT，未修改）。

### 关键实现

- **合批渲染**：所有静态构件按材质键合并进 `BufferGeometry`，全场约 **100 万三角形** 只用 **~90–135 个 draw call**，
  米级细节（瓦垄、斗拱、栏杆、行道树、船、车）也能保持 60 fps。
- **全程序化几何**：屋顶用带举折的庑殿/歇山生成器，塔身逐层收分，桥梁桁架由参数化分段生成；
  `rng(seed)` 确定性随机保证每次刷新城市完全一致。
- **昼夜系统**：`DAY`/`NIGHT` 两套调色板（阳光/半球光/环境光/雾/天空/水色/曝光）逐帧插值；
  材质用 `applyTimeOfDay()` 在「日间色 ↔ 夜间色」与「自发光强度」之间过渡；
  9 种自发光材质（窗光、灯笼、霓虹、路灯、航标灯、钟面、玻璃幕墙、木格窗）构成夜间灯火。
- **水面与天空**：自写 `ShaderMaterial`。水面 = 顶点波动 + 菲涅尔 + 日光高光 + 夜间灯影 + **空气透视雾**；
  天空 = 渐变天穹 + 日晕/月华 + 夜间星点，且**跟随相机**，地平线渐变始终居中。
  两者都显式接入 three 的 `tonemapping_fragment` / `colorspace_fragment`，
  以免自定义着色器绕过色调映射与输出色彩空间而偏暗。
- **雾与地平线同色**：`scene.fog.color` 与天空底色一致（昼 `#ded9c8` / 夜 `#141f2a`），远处江面与城市自然溶入天际。
- **交互自研**：轨道相机（阻尼、最短弧插值、`flyTo`）与第一人称漫游（碰撞于地块范围与限位半径）均手写，不依赖 three addons。
- **画质分档**：`high / mid / low` 三档控制密度、细节、树木、车辆、`pixelRatio`、阴影与抗锯齿。
  因为抗锯齿与 `pixelRatio` 只能在 `WebGLRenderer` 构造时确定，检测放在建渲染器**之前**：
  先用一次性 canvas 取 `WEBGL_debug_renderer_info`（拿到 GPU 名后立刻 `loseContext()` 释放），
  再结合核心数、内存、指针类型、视口尺寸判定；软件渲染器（SwiftShader / llvmpipe）直接落低档。
  运行中还有掉帧看门狗：连续低于 38 fps 自动降一档。实测高/低档三角形 **1 118 656 / 631 384**。
- **街巷漫游的碰撞**：户部巷这类「有墙有摊」的地方不用圆形限位，而是**矩形并集活动区 + 矩形障碍**
  （几何与碰撞共用同一组数字，避免视觉与判定漂移）。解算方式是「先把落点投影回最近的合法矩形，
  再从障碍里沿最小穿透方向推出」，迭代 3 轮——比逐轴滑动更稳，不会在墙角或摊子边卡死。
  巷子北口另接一条横街，走到巷尾可以拐弯而不是撞死胡同。
- **新地标构件**：`addPaifang`（三间四柱牌坊，含抱鼓石与三顶）、`addLanternString`（悬链线灯笼串）、
  `addStreetProp`（陶缸/酒坛/矮凳/长凳/竹筐/灯箱招牌）、`addRingBridge`（环形天桥 + 内外栏杆 + 斜梯）、
  `addSculpture`（光谷「星河」螺旋）、`addStatue`（归元寺双面观音，双层莲座 + 背光）、`addTram`（有轨电车 + 站台雨棚）。
  全部由既有 Batcher 合批，材质仍是 98 种、draw call 未增加。
- **零素材音频**：环境江声由 WebAudio 实时合成（滤波噪声 + 缓慢起伏），可开关。

---

## 五、验证

无头 Chromium（REA Playwright provider，1280×720）实测：

| 项目 | 结果 |
| --- | --- |
| 启动 / 运行错误 | 0（每次运行 `errors: []`，无 console / page error） |
| 三角形 / 网格 / 材质 | 1 118 656 / 89 / 98 |
| draw call | 133（全景）→ 89–106（地面漫游，视锥剔除生效） |
| 帧率 | 59.8–60.9 fps（Apple M3 Pro / ANGLE Metal，1280×720） |
| 开场 | 相机半径 777 → 543 → 413 平滑推进后停在 `all` 机位 |
| 九处机位 | 逐一截图确认主体入画；四张区域图两两像素差 **42–48 %（>12/255）**，确认各自取景互不相同 |
| 画质三档 | 强制 `?quality=` 实测：低 631 384 / 中 762 296 / 高 1 118 656 三角形；`pixelRatio` 1、低档 `shadows:false`；切断档提示「画质已切换，正在重建江城」；自动检测路径 `qualityReason:"capable"`、`qualityGpu:"ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro…)"`，无报错 |
| 漫游 | 进入：`roam:true`、`bodyClass:"is-roaming"`、相机落到行走点、首屏隐藏；退出：`roam:false`、「已回到俯瞰视角」 |
| 巷内行走 | `?roamtest=600` 驱动：x 恒为 92（不斜撞墙）、z 由 96 走到 62 再进横街到 **56.22**（横街北沿）后停住；全程 `roamInArea:true`、`roamArea:3`、`roamBlockers:18`，没有穿墙也没有卡死 |
| 贴墙滑动 | 前进 + 右平移时走在巷子东侧并停在墙与摊位的夹角处（真实被挡住），不再原地抖动 |
| 昼夜 | 昼 `#a3ad97` / 夜 `#13212a`（同一机位）；切换过程 `tod 0.24 → 0.99`、`bodyClass="is-night"`，反向 `tod 0.62 → 0`，夜景可见窗光、灯笼串与灯箱 |
| 自动游览 | 开启后无人干预地依次巡游，验证期间相机自行推进到 `yellowcrane` |
| 自动环绕 / 缩放 | 「自动环绕已开启」；缩放半径 413 → 338 → 322 |
| 地标标签 | 「地标已隐藏 / 已显示」切换生效；17 处标签的 `region` 全部指向有效区域 |
| 截图导出 | 「已保存此刻的画面」，`toDataURL` + 下载链路无异常 |
| 全屏 | 调用无异常，退出后机位与 draw call 正常回落 |
| 环境音 | 「环境音已开启 / 已关闭」双向切换生效（WebAudio 实时合成，无音频素材） |
| i18n | 中英切换后，连正在显示的轻提示也会同步改写；新增画质按钮与三档提示均已双语 |
| 离线 | 服务器访问日志共 102 次请求、仅 8 个本地路径，无任何外部请求 |

> QA 提示：`[data-action="home"]` 会同时命中顶栏品牌链接与工具条按钮（这是刻意的），
> `[data-action="explore"]` 同理命中两处；用 Playwright strict mode 选择器时请改用
> `.tools [data-action="home"]` 或 `.brand` 这类更具体的写法。

截图见 `_verify/`（`04-overview.png` 白昼全景、`06-night.png` 夜景、
`r-crane/r-bridge/r-jianghan/r-eastlake/r-hubu.png` 各地标机位、`r-default.png` 完整界面、
`n-guanggu/n-wuda/n-guiyuan/n-hubu.png` 本轮新增区域）。

---

## 六、部署（镜像 → 个人版 ACR → k3s）

与 `Gengbo89/home`、`Gengbo89/ansible-canvas` 一致的套路：**镜像只由 GitHub CI 构建**，
本机不产出镜像；CI 推个人版 ACR，再 SSH 到 k3s 主机 apply 清单。

### 涉及文件

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | `nginx:1.27-alpine` 托管 `site/`；构建期断言 6 个入口文件非空 |
| `nginx.conf` | `/healthz` 探针、gzip、`vendor/` 长缓存 / `js/` 短缓存 |
| `.github/workflows/release.yml` | 推 `v*` tag 触发：校验 → 构建推送 → 部署 |
| `deploy/wuhan-miniature.yaml` | Deployment + Service + Ingress（ns `dev`，`wuhan.gengbo.top`） |

### 目标环境

- 集群：单节点 k3s，`k3s-master`，`112.124.63.35`，SSH 端口 **22222**（不是 22）
- namespace：`dev`；入口控制器 `ingress-nginx`；证书 `cert-manager` 的 `letsencrypt-prod`
- 镜像仓库：`crpi-p67sy5t6k9nsmste.cn-hangzhou.personal.cr.aliyuncs.com/gengbo/wuhan-miniature`
- 域名：`wuhan.gengbo.top`（`*.gengbo.top` 为泛解析，指向同一台机器，无需改 DNS）

> 集群侧 `/etc/rancher/k3s/registries.yaml` 把 `docker.io` 镜像到同区域的 ACR **VPC** 端点。
> ACR 允许**匿名拉取**（即先向 `dockerauth.cn-hangzhou.aliyuncs.com` 申请 pull token，无需凭据），
> 所以清单里**不需要 `imagePullSecrets`**。

### 发布流程

```bash
git tag v1.0.0 && git push origin v1.0.0     # 触发 CI：构建 + 推送 + 部署
```

CI 的 `deploy` job 会先 scp 清单到 `/root/wuhan-miniature-deploy/`，用 `sed` 把本次 tag
写进清单**再** apply（而不是 apply 完再 `set image`，后者会先按旧 tag 滚动一次、再多滚一轮），
最后 `kubectl rollout status` 等完成，失败则打印 Pod 描述与日志并以非零退出。

### 需要的 GitHub Secrets

`ALIYUN_USERNAME`、`ALIYUN_PASSWORD`、`K3S_HOST`、`K3S_PORT`、`K3S_USER`、`K3S_SSH_KEY`

### 手工部署（CI 不可用时）

```bash
docker build -t <registry>/gengbo/wuhan-miniature:v1.0.0 .
docker push <registry>/gengbo/wuhan-miniature:v1.0.0
ssh -p 22222 root@112.124.63.35
  kubectl apply -f deploy/wuhan-miniature.yaml
  kubectl rollout status deployment/wuhan-miniature -n dev
```

### 部署前的本地校验（不构建镜像）

```bash
# nginx 配置语法
docker run --rm -v "$PWD/nginx.conf:/etc/nginx/conf.d/wuhan.conf:ro" nginx:1.27-alpine nginx -t

# 清单对真实集群做服务端 dry-run（不创建对象）
kubectl apply --dry-run=server -f deploy/wuhan-miniature.yaml
```

### nginx.conf 里三处不要"顺手简化"

都是实测校正过的，改回去会静默失效：

1. `location ^~ /vendor/` 的 **`^~` 不能去掉**。普通前缀 location 会输给后面的
   正则 location，实测去掉后 `/vendor/three.core.js` 命中的是 1 小时那条规则，
   30 天长缓存形同虚设。
2. `/healthz` 用 **`default_type text/plain`**，不能用 `add_header Content-Type`。
   `return 200 "ok\n"` 自带类型是 `application/octet-stream`，而 `add_header` 是追加语义，
   实测会同时出现 `application/octet-stream` 和 `text/plain` 两个 `Content-Type`。
3. 缓存**只用 `add_header Cache-Control`，不要和 `expires` 并用**。`expires` 自己会发一个
   `Cache-Control: max-age=...`，再配一条 `add_header` 就会变成两个 `Cache-Control`（实测确认）。

实测数据（`nginx:1.27-alpine`，真实 `site/` 文件）：

| 路径 | 响应头 |
| --- | --- |
| `/healthz` | `Content-Type: text/plain`，`Content-Length: 3` |
| `/vendor/three.core.js` | `Cache-Control: public, max-age=2592000, immutable` |
| `/js/app.js`、`/styles.css` | `Cache-Control: public, max-age=3600, must-revalidate` |
| `/` | 200，10,879 字节 |
| `/nope` | 404（真 404，不回退首页） |

gzip：`three.core.js` 传输 **278,598** 字节（原始 1,403,455，约 5:1）。

---

## 七、版权边界

- **参考对象**：`https://suzhou.liuwa.xyz/`（姑苏小境 · SUZHOU IN MINIATURE）。通过 REA 对其**已发布的**
  前端产物做被动静态分析（打包图、模块依赖、字符串、路由）与被动浏览器观测，仅用于理解
  「它是什么、有哪些功能类别、交互模型如何」。
- **仅借鉴**：产品概念（三维微缩城市、多处地标导航、轨道相机 + 漫游、昼夜切换、截图/全屏、关于弹窗、双语）
  与公开可见的**布局类别**（左上首屏文案、右栏目的地列表、底部提示、右上工具）。
- **未使用**：其源代码、算法实现、着色器、几何/材质数据、`localStorage` 键、素材文件、品牌名、
  文案措辞、配色数值、字体与音视频。所有几何、材质、文案、样式、音频均为本次原创；
  地名与地标属于客观事实信息，不受版权保护。
- **依赖**：仅 three.js r180（MIT，见 `vendor/`）。
- `_reference/` 内为分析期间留存的第三方产物，**仅作研究留证，不得再分发或用于生产**；
  `site/` 中不含其中任何内容。

---

## 八、目录说明

| 目录 / 文件 | 内容 |
| --- | --- |
| `site/` | **交付物**：可直接部署的静态站点（8 个文件，3.1MB） |
| `Dockerfile`、`nginx.conf`、`.dockerignore` | 容器化：nginx 静态托管 + 缓存/压缩策略 |
| `deploy/wuhan-miniature.yaml` | k3s 部署清单（ns `dev`，`wuhan.gengbo.top`） |
| `.github/workflows/release.yml` | CI：推 `v*` tag → 校验 → 构建推送 ACR → SSH 部署 |
| `_verify/` | 验证证据：截图、纯 Python PNG 解码/取色/分类脚本（`pngstat.py`）、证据提取脚本（`grab.py`） |
| `_reference/` | 逆向分析留存的第三方产物（不再分发） |
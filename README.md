# 🌌 Kerr Relativistic Black Hole Simulation (克尔旋转黑洞天体物理模拟)

[![WebGL 2.0](https://img.shields.io/badge/WebGL-2.0-00E5FF?style=flat-square&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

基于 **广义相对论克尔时空度规（Kerr Spacetime Metric）** 与 **全屏 GPU 光线步进（GLSL Raymarching）** 构建的实时交互式黑洞天体物理仿真引擎。支持相对论引力透镜弯曲、爱因斯坦光子球、多普勒聚束增亮、引力红移、伴星潮汐瓦解撕裂流（TDE）、超音速邦迪-霍伊尔引力尾流、以及 LIGO 引力波啁啾声学合成。

---

## 🌟 核心特性 (Key Features)

### 1. 🕳️ 真实广义相对论时空与引力透镜 (Relativistic Geodesics & Lensing)
- **克尔度规光子测地线**：采用自适应 Runge-Kutta (RK2) 高精度微积分，求解大质量旋转黑洞时空中的光线弯曲路径。
- **爱因斯坦光子环与多重副环 ($n=1, n=2, n=3$)**：捕捉光子在事件视界边缘回旋多周形成的极致纤细锐利的高阶光子环。
- **参考系拖拽效应（Lense-Thirring Frame Dragging）**：旋转时空对周围吸积盘与光线的切向时空拖拽。

### 2. 🪐 相对论薄盘与多尺度等离子体流 (Astrophysical Accretion Disk & Plasma)
- **Novikov-Thorne 温度梯度与普朗克黑体辐射**：吸积盘色温随轨道半径由内圈白热（$T > 38,000\text{ K}$）平滑渐变为外圈金红。
- **相对论多普勒聚束（Doppler Beaming $\delta^3$）与引力红移**：朝向观测者极速运动的盘面发生极端蓝移与辐射增亮，背向一侧变暗偏红。
- **磁流体动力学（MHD Dynamo）磁绳螺旋编织亮纹**：MRI 磁旋转不稳定性激发的层叠磁力线高亮丝缕与差动开普勒旋转。

### 3. ☄️ 天体物理全息动态系统 (Astrophysical Phenomena)
- **伴星潮汐瓦解撕裂流（Tidal Disruption Event - TDE）**：伴星洛希瓣引力水滴拉丝剥离，形成双层体积等离子体烟云与激波自相交爆发节点。
- **流浪黑洞宇宙巡航与邦迪-霍伊尔尾流（Bondi-Hoyle-Littleton Wake）**：黑洞以超音速在星际介质中航行，后方汇聚形成耀眼的双曲激波锥尾流。
- **极向相对论喷流（Relativistic Jets）**：视界两极喷涌而出的准直高能等离子体束流。
- **LIGO 引力波时空同心涟漪与真实啁啾声合成（GW Burst & Chirp Audio）**：基于 Web Audio API 解析合成黑洞双星合并不对称引力波频率演化脉冲。

### 4. 🎛️ 电影工业级渲染与操控系统 (Cinematic Rendering & UX)
- **IMAX 8K 纳秒级光线步进采样**：自适应加密算法，保障 60 FPS 满帧丝滑流畅。
- **宽银幕变形镜头光晕（Anamorphic Flares）与时空微引力色散**。
- **4K 超清无损壁纸导出**：一键捕获当前相机角度的 3840×2160 原生超清天体壁纸。

---

## ⌨️ 快捷键指南 (Shortcuts)

| 按键 | 功能 | 说明 |
| :---: | :--- | :--- |
| <kbd>Space</kbd> | **播放 / 暂停** | 冻结或恢复黑洞时空演化与轨道运动 |
| <kbd>H</kbd> | **隐藏 / 呼出 HUD** | 切换极简沉浸式全屏观赏模式 |
| <kbd>F</kbd> | **全屏切换** | 切换浏览器无边框全屏模式 |
| <kbd>1</kbd> ~ <kbd>5</kbd> | **运镜预设切换** | 赤道平视、两极俯瞰、星际穿越、撕裂流聚焦、坠入视界 |

---

## 🚀 本地快速运行 (Quick Start)

由于本项目使用了 ES Module 与 WebGL Shader，建议通过本地静态服务器启动：

### 方式 1：使用 VS Code Live Server（最简便）
1. 在 VS Code 中打开本目录；
2. 安装扩展 **Live Server**；
3. 右键 `index.html` 选择 **「Open with Live Server」**。

### 方式 2：使用 Node.js / npx
```bash
# 使用任意轻量静态服务器运行当前目录
npx serve .
# 或使用 http-server
npx http-server . -p 8080
```

### 方式 3：使用 Python
```bash
# Python 3
python -m http.server 8000
```
在浏览器打开 `http://localhost:8000` 即可畅享！

---

## 📦 项目结构 (Project Structure)

```text
├── index.html                  # 主项目入口文件与 HUD 控制面板 DOM
├── blackhole_kerr.html         # 独立单文件即开即用便携版 (Zero-dependency Standalone)
├── src/
│   ├── main.js                 # Three.js 场景渲染循环、相机控制与 Uniforms 管理
│   ├── shaders/
│   │   ├── blackhole.frag.js   # 核心 Kerr 度规相对论光线步进着色器 (GLSL)
│   │   └── postprocessing.frag.js # ACES Filmic 色调映射与 HDR 泛光着色器
│   ├── audio/
│   │   └── sound.js            # 深空环境低频共鸣音与 LIGO 引力波啁啾声合成引擎
│   └── ui/
│       └── controls.js         # HUD 交互绑定、参数滑块与遥测计算
├── styles/
│   └── main.css                # 赛博深空航空 HUD 磨砂玻璃质感 UI 样式表
├── .gitignore                  # Git 忽略配置
└── README.md                   # 项目中英文说明文档
```

---

## 📜 许可证 (License)

本项目采用 [MIT License](LICENSE) 开源协议。

// ==========================================================================
// KERR BLACK HOLE // THREE.JS WEBGL2 RELATIVISTIC RENDER ENGINE
// ==========================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { quadVertexShader } from './shaders/quad.vert.js';
import { blackHoleFragmentShader } from './shaders/blackhole.frag.js';
import { postProcessFragmentShader } from './shaders/postprocess.js';
import { CosmicAudioEngine } from './audio/cosmicAudio.js';
import { UIManager } from './ui/controls.js';

class KerrBlackHoleEngine {
  constructor() {
    this.canvas = document.getElementById('gl-canvas');
    this.audio = new CosmicAudioEngine();
    this.ui = new UIManager(this);

    this.isPlaying = true;
    this.clock = new THREE.Clock();
    this.simTime = 0.0;
    this.fpsFrames = 0;
    this.fpsLastTime = performance.now();

    // 相机动画过渡状态
    this.isTransitioningCamera = false;
    this.camStartPos = new THREE.Vector3();
    this.camTargetPos = new THREE.Vector3();
    this.camStartLookAt = new THREE.Vector3();
    this.camTargetLookAt = new THREE.Vector3();
    this.camTransitionProgress = 1.0;
    this.camTransitionDuration = 1.6;

    // 坠入视界潜水模式
    this.isDiving = false;
    this.diveStartTime = 0;

    this.initScene();
    this.initShaders();
    this.initEvents();
    this.onParamChange();

    // 初始设置赤道机位
    this.setCameraPreset('equatorial', 0.0);

    // 启动主渲染循环
    this.animate();
  }

  initScene() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. WebGL 渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.getPixelRatioForQuality(this.ui.state.quality));

    // 2. 正交与透视相机
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.perspectiveCamera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.perspectiveCamera.position.set(0, 1.2, 14.0);

    // 3. 轨道控制器
    this.controls = new OrbitControls(this.perspectiveCamera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 120.0;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 1.1;

    // 4. HDR 渲染目标缓冲 (Float / HalfFloat RenderTarget)
    const renderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    };
    this.hdrRenderTarget = new THREE.WebGLRenderTarget(
      width * Math.min(window.devicePixelRatio, 2.0),
      height * Math.min(window.devicePixelRatio, 2.0),
      renderTargetOptions
    );

    // 5. 场景容器
    this.bhScene = new THREE.Scene();
    this.postScene = new THREE.Scene();
  }

  initShaders() {
    const pixelRatio = this.renderer.getPixelRatio();
    const resVec = new THREE.Vector2(
      window.innerWidth * pixelRatio,
      window.innerHeight * pixelRatio
    );

    // 1. 黑洞光线步进主材质
    this.bhUniforms = {
      uCameraPos: { value: new THREE.Vector3() },
      uCameraWorldMatrix: { value: new THREE.Matrix4() },
      uCameraProjectionInverse: { value: new THREE.Matrix4() },
      uResolution: { value: resVec },
      uTime: { value: 0.0 },

      uMass: { value: 0.50 },
      uSpin: { value: 0.999 * 0.50 },
      uTemperature: { value: 3000.0 },
      uDensity: { value: 0.20 },
      uJetPower: { value: 4.00 },
      uQualitySteps: { value: 5 },

      uEnableDisk: { value: true },
      uEnableJets: { value: false },
      uEnableLensing: { value: true },
      uEnableDoppler: { value: true },
      uEnableTDE: { value: false },
      uEnableGrid: { value: false },
      uEnableHotspot: { value: true },
      uEnableGW: { value: false },
      uGWBurst: { value: 0.0 },
      uEnableWake: { value: false },
      uWakePower: { value: 1.50 },
      uEnableCinematicFlare: { value: true },
      uFlarePower: { value: 1.0 },
      uEnableDispersion: { value: true },
      uBlackHolePos: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
      uBlackHoleVel: { value: new THREE.Vector3(0.0, 0.0, 1.0) },
    };

    const bhMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVertexShader,
      fragmentShader: blackHoleFragmentShader,
      uniforms: this.bhUniforms,
      depthTest: false,
      depthWrite: false,
    });

    const quadGeom = new THREE.PlaneGeometry(2, 2);
    this.bhQuad = new THREE.Mesh(quadGeom, bhMaterial);
    this.bhScene.add(this.bhQuad);

    // 2. HDR 后处理与 Bloom 材质
    this.postUniforms = {
      tDiffuse: { value: this.hdrRenderTarget.texture },
      uResolution: { value: resVec },
      uEnableBloom: { value: true },
      uBloomIntensity: { value: 0.65 },
      uExposure: { value: 1.25 },
      uTime: { value: 0.0 },
    };

    const postMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVertexShader,
      fragmentShader: postProcessFragmentShader,
      uniforms: this.postUniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.postQuad = new THREE.Mesh(quadGeom, postMaterial);
    this.postScene.add(this.postQuad);
  }

  initEvents() {
    window.addEventListener('resize', () => this.onWindowResize());
  }

  getPixelRatioForQuality(quality) {
    const dpr = window.devicePixelRatio || 1.0;
    if (quality === 1) return Math.min(dpr, 0.85);
    if (quality === 2) return Math.min(dpr, 1.0);
    if (quality === 3) return Math.min(dpr, 1.25);
    return Math.min(dpr, 1.75);
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = this.getPixelRatioForQuality(this.ui.state.quality);

    this.perspectiveCamera.aspect = width / height;
    this.perspectiveCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);

    const actualWidth = Math.floor(width * pixelRatio);
    const actualHeight = Math.floor(height * pixelRatio);

    this.hdrRenderTarget.setSize(actualWidth, actualHeight);
    this.bhUniforms.uResolution.value.set(actualWidth, actualHeight);
    this.postUniforms.uResolution.value.set(actualWidth, actualHeight);
  }

  onParamChange() {
    const s = this.ui.state;
    this.bhUniforms.uMass.value = s.mass;
    this.bhUniforms.uSpin.value = s.spin * s.mass;
    this.bhUniforms.uTemperature.value = s.temperature;
    this.bhUniforms.uDensity.value = s.density;
    this.bhUniforms.uJetPower.value = s.jetPower;
    this.bhUniforms.uQualitySteps.value = s.quality;

    this.bhUniforms.uEnableDisk.value = s.enableDisk;
    this.bhUniforms.uEnableJets.value = s.enableJets;
    this.bhUniforms.uEnableLensing.value = s.enableLensing;
    this.bhUniforms.uEnableDoppler.value = s.enableDoppler;
    this.bhUniforms.uEnableTDE.value = s.enableTDE;
    this.bhUniforms.uEnableGrid.value = s.enableGrid;
    this.bhUniforms.uEnableHotspot.value = s.enableHotspot;
    this.bhUniforms.uEnableGW.value = s.enableGW;
    this.bhUniforms.uEnableWake.value = s.enableWake;
    this.bhUniforms.uWakePower.value = s.wakePower || 1.5;
    this.bhUniforms.uEnableCinematicFlare.value = s.enableCinematicFlare !== undefined ? s.enableCinematicFlare : true;
    this.bhUniforms.uFlarePower.value = s.flarePower !== undefined ? s.flarePower : 1.0;
    this.bhUniforms.uEnableDispersion.value = s.enableDispersion !== undefined ? s.enableDispersion : true;

    this.postUniforms.uEnableBloom.value = s.enableBloom;

    // 当画质档位调节时动态适配最佳分辨率
    this.onWindowResize();
  }

  // 著名天体黑洞预设库 (Astrophysical Profiles)
  applyAstroPreset(presetKey) {
    const s = this.ui.state;
    switch (presetKey) {
      case 'gargantua':
        s.mass = 1.30;
        s.spin = 0.998;
        s.temperature = 4800;
        s.density = 1.65;
        s.jetPower = 0.40;
        s.enableJets = false;
        s.enableTDE = false;
        s.enableHotspot = false;
        this.setCameraPreset('interstellar', 1.8);
        break;
      case 'm87':
        s.mass = 2.40;
        s.spin = 0.920;
        s.temperature = 9200;
        s.density = 1.80;
        s.jetPower = 3.20;
        s.enableJets = true;
        s.enableTDE = false;
        s.enableHotspot = false;
        this.setCameraPreset('equatorial', 1.8);
        break;
      case 'sgra':
        s.mass = 1.00;
        s.spin = 0.650;
        s.temperature = 11000;
        s.density = 0.95;
        s.jetPower = 1.20;
        s.enableJets = true;
        s.enableTDE = true;
        s.enableHotspot = true;
        this.setCameraPreset('equatorial', 1.8);
        break;
      case 'micro':
        s.mass = 0.60;
        s.spin = 0.000;
        s.temperature = 28000;
        s.density = 2.20;
        s.jetPower = 2.60;
        s.enableJets = true;
        s.enableTDE = false;
        s.enableHotspot = true;
        this.setCameraPreset('polar', 1.8);
        break;
    }
    this.ui.syncControlsFromState();
    this.onParamChange();
  }

  // 4K 超清壁纸无损导出 (4K Wallpaper Snapshot Exporter)
  exportSnapshot(width = 3840, height = 2160) {
    const origW = this.renderer.domElement.width;
    const origH = this.renderer.domElement.height;
    const origAspect = this.perspectiveCamera.aspect;

    // 临时切换至 4K HDR 缓冲区
    const snapTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.perspectiveCamera.aspect = width / height;
    this.perspectiveCamera.updateProjectionMatrix();
    this.perspectiveCamera.updateMatrixWorld();

    this.bhUniforms.uResolution.value.set(width, height);
    this.bhUniforms.uCameraPos.value.copy(this.perspectiveCamera.position);
    this.bhUniforms.uCameraWorldMatrix.value.copy(this.perspectiveCamera.matrixWorld);
    this.bhUniforms.uCameraProjectionInverse.value.copy(this.perspectiveCamera.projectionMatrixInverse);

    // 阶段 1: 渲染高分辨率黑洞场景
    this.renderer.setSize(width, height, false);
    this.renderer.setRenderTarget(snapTarget);
    this.renderer.render(this.bhScene, this.orthoCamera);

    // 阶段 2: 渲染后处理
    this.postUniforms.tDiffuse.value = snapTarget.texture;
    this.postUniforms.uResolution.value.set(width, height);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.orthoCamera);

    // 导出无损 PNG
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `kerr_black_hole_4k_${Date.now()}.png`;
    a.href = dataUrl;
    a.click();

    // 恢复正常尺寸与材质引用
    snapTarget.dispose();
    this.postUniforms.tDiffuse.value = this.hdrRenderTarget.texture;
    this.onWindowResize();
  }

  togglePlayPause() {
    this.isPlaying = !this.isPlaying;
  }

  setCameraPreset(presetName, duration = 1.6) {
    this.isDiving = false;
    this.ui.showDiveWarning(false);

    let targetPos = new THREE.Vector3();
    let targetLookAt = new THREE.Vector3(0, 0, 0);

    switch (presetName) {
      case 'equatorial':
        targetPos.set(0.0, 1.8, 14.5);
        break;
      case 'polar':
        targetPos.set(0.0, 19.5, 2.0);
        break;
      case 'interstellar':
        targetPos.set(0.0, 1.2, 14.0);
        break;
      case 'tde-focus':
        targetPos.set(8.5, 2.2, 10.5);
        targetLookAt.set(3.5, 0.2, 3.5);
        break;
      case 'dive':
        this.startDiveSequence();
        return;
      default:
        targetPos.set(0, 2.0, 15.0);
    }

    if (duration <= 0) {
      this.perspectiveCamera.position.copy(targetPos);
      this.controls.target.copy(targetLookAt);
      this.controls.update();
      return;
    }

    // 启动平滑插值过渡
    this.camStartPos.copy(this.perspectiveCamera.position);
    this.camTargetPos.copy(targetPos);
    this.camStartLookAt.copy(this.controls.target);
    this.camTargetLookAt.copy(targetLookAt);
    this.camTransitionProgress = 0.0;
    this.camTransitionDuration = duration;
    this.isTransitioningCamera = true;
    this.controls.enabled = false;
  }

  triggerGWBurst() {
    this.bhUniforms.uGWBurst.value = 1.0;
    this.audio.triggerGravitationalChirp(2.4);
  }

  startDiveSequence() {
    this.isDiving = true;
    this.diveStartTime = this.simTime;
    this.camStartPos.copy(this.perspectiveCamera.position);
    this.camStartLookAt.copy(this.controls.target);
    this.controls.enabled = false;
    this.triggerGWBurst();
  }

  updateCameraAnimation(delta) {
    // 1. 普通运镜预设平滑插值
    if (this.isTransitioningCamera) {
      this.camTransitionProgress += delta / this.camTransitionDuration;
      if (this.camTransitionProgress >= 1.0) {
        this.camTransitionProgress = 1.0;
        this.isTransitioningCamera = false;
        this.controls.enabled = true;
      }

      // Smoothstep 缓动曲线
      const t = this.camTransitionProgress;
      const ease = t * t * (3.0 - 2.0 * t);

      this.perspectiveCamera.position.lerpVectors(this.camStartPos, this.camTargetPos, ease);
      this.controls.target.lerpVectors(this.camStartLookAt, this.camTargetLookAt, ease);
      this.controls.update();
    }

    // 2. 沉浸式坠入事件视界轨道模拟
    if (this.isDiving) {
      const elapsed = this.simTime - this.diveStartTime;
      const diveDuration = 10.0;
      const progress = Math.min(elapsed / diveDuration, 1.0);

      // 对数螺旋内落轨迹 (Infalling Geodesic Spiral)
      const M = this.ui.state.mass;
      const a = this.ui.state.spin * M;
      const rPlus = M + Math.sqrt(Math.max(M * M - a * a, 0.001));

      const rStart = 14.0 * M;
      const rEnd = rPlus * 1.02; // 逼近视界边缘
      const currentR = rStart * Math.pow(rEnd / rStart, progress);

      const spiralAngle = elapsed * 1.8;
      const yPos = Math.sin(progress * Math.PI) * 1.2 * (1.0 - progress);

      this.perspectiveCamera.position.set(
        Math.cos(spiralAngle) * currentR,
        yPos,
        Math.sin(spiralAngle) * currentR
      );
      this.controls.target.set(0, 0, 0);

      // 靠近视界时触发警报
      if (currentR < 2.5 * M) {
        this.ui.showDiveWarning(true);
      }

      if (progress >= 1.0) {
        this.isDiving = false;
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    if (this.isPlaying) {
      this.simTime += delta * this.ui.state.timeRate;
    }

    // FPS 计算与遥测刷新
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsLastTime >= 500) {
      const fps = (this.fpsFrames * 1000) / (now - this.fpsLastTime);
      const M = this.ui.state.mass;
      const a = this.ui.state.spin * M;
      const rPlus = M + Math.sqrt(Math.max(M * M - a * a, 0.001));
      const camDist = this.perspectiveCamera.position.length();
      this.ui.updateTelemetry(fps, camDist, rPlus, M);
      this.fpsFrames = 0;
      this.fpsLastTime = now;
    }

    // 运镜与参考系拖曳 (Lense-Thirring Frame Dragging)
    this.updateCameraAnimation(delta);
    if (!this.isTransitioningCamera && !this.isDiving) {
      const M = this.ui.state.mass;
      const a = this.ui.state.spin * M;
      const camPos = this.perspectiveCamera.position;
      const rCam = camPos.length();

      // 在强引力场/能层附近施加参考系拖曳偏转
      if (rCam < 4.5 * M && Math.abs(a) > 0.01) {
        const omega = (2.0 * M * a) / (Math.pow(rCam, 3.0) + a * a * rCam + 2.0 * M * a * a + 0.1);
        const dragAngle = omega * delta * 0.4;
        camPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), dragAngle);
      }
      this.controls.update();
    }

    // 更新黑洞着色器 Uniforms
    this.perspectiveCamera.updateMatrixWorld();
    this.bhUniforms.uCameraPos.value.copy(this.perspectiveCamera.position);
    this.bhUniforms.uCameraWorldMatrix.value.copy(this.perspectiveCamera.matrixWorld);
    this.bhUniforms.uCameraProjectionInverse.value.copy(this.perspectiveCamera.projectionMatrixInverse);
    this.bhUniforms.uTime.value = this.simTime;
    this.postUniforms.uTime.value = this.simTime;

    // 「流浪黑洞」深空宇宙巡航轨迹与速度计算 (Rogue Black Hole Cosmic Cruise)
    if (this.ui.state.enableCruise) {
      const cSpeed = this.ui.state.cruiseSpeed || 1.0;
      const tCruise = this.simTime * 0.35 * cSpeed;
      const bx = Math.sin(tCruise) * 10.5;
      const by = Math.sin(tCruise * 0.6) * 2.2;
      const bz = Math.cos(tCruise * 0.8) * 8.5;
      
      const vx = Math.cos(tCruise) * 10.5 * 0.35 * cSpeed;
      const vy = Math.cos(tCruise * 0.6) * 2.2 * 0.6 * 0.35 * cSpeed;
      const vz = -Math.sin(tCruise * 0.8) * 8.5 * 0.8 * 0.35 * cSpeed;

      this.bhUniforms.uBlackHolePos.value.set(bx, by, bz);
      this.bhUniforms.uBlackHoleVel.value.set(vx, vy, vz);
    } else {
      this.bhUniforms.uBlackHolePos.value.lerp(new THREE.Vector3(0, 0, 0), delta * 4.0);
      this.bhUniforms.uBlackHoleVel.value.lerp(new THREE.Vector3(0, 0, 1.0), delta * 4.0);
    }

    // 引力波瞬态脉冲阻尼衰减
    if (this.bhUniforms.uGWBurst.value > 0.001) {
      this.bhUniforms.uGWBurst.value = Math.max(0.0, this.bhUniforms.uGWBurst.value - delta * 0.42);
    }

    // 音频引擎参数同步更新 (融入引力红移与时间膨胀频移)
    const camDist = this.perspectiveCamera.position.length();
    const M_curr = this.ui.state.mass;
    const timeDilation = 1.0 / Math.sqrt(Math.max(1.0 - (2.0 * M_curr) / camDist, 0.02));
    this.audio.update(camDist, this.ui.state.spin, this.ui.state.mass, this.ui.state.jetPower, timeDilation);

    // ========================================================================
    // 多通道渲染流水线 (Multi-pass Pipeline)
    // ========================================================================
    // 阶段 1: 渲染克尔黑洞光线步进场景至 HDR 缓冲区
    this.renderer.setRenderTarget(this.hdrRenderTarget);
    this.renderer.render(this.bhScene, this.orthoCamera);

    // 阶段 2: 渲染后处理 HDR Bloom、耀斑与色调映射至屏幕
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.orthoCamera);
  }
}

// 页面加载完成后实例化引擎
window.addEventListener('DOMContentLoaded', () => {
  window.kerrApp = new KerrBlackHoleEngine();
});

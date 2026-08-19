// ==========================================================================
// KERR METRIC // RELATIVISTIC RAYMARCHING FRAGMENT SHADER (HIGH PERFORMANCE)
// ==========================================================================

export const blackHoleFragmentShader = `
precision highp float;

varying vec2 vUv;

// 相机与投影矩阵参数
uniform vec3 uCameraPos;
uniform mat4 uCameraWorldMatrix;
uniform mat4 uCameraProjectionInverse;
uniform vec2 uResolution;
uniform float uTime;

// 相对论与天体物理参数
uniform float uMass;           // 黑洞质量 M
uniform float uSpin;           // 自旋参数 a/M (-0.999 ~ 0.999)
uniform float uTemperature;    // 吸积盘温度 (K)
uniform float uDensity;        // 吸积盘气体密度
uniform float uJetPower;       // 极向喷流强度
uniform int uQualitySteps;     // 采样步数级别 (1: 40, 2: 70, 3: 110, 4: 160)

// 模块化独立开关
uniform bool uEnableDisk;      // 吸积盘开关
uniform bool uEnableJets;      // 相对论喷流开关
uniform bool uEnableLensing;   // 引力透镜开关
uniform bool uEnableDoppler;   // 多普勒效应开关
uniform bool uEnableTDE;       // 伴星潮汐撕裂流开关
uniform bool uEnableGrid;      // 能层与视界线框开关
uniform bool uEnableHotspot;   // 吸积盘相对论动态热斑开关
uniform bool uEnableGW;        // 引力波时空涟漪开关
uniform float uGWBurst;        // 引力波瞬态爆发脉冲强度 (0.0 ~ 1.0)
uniform bool uEnableWake;      // 邦迪-霍伊尔引力尾流开关
uniform float uWakePower;      // 引力尾流强度
uniform bool uEnableCinematicFlare; // 宽银幕变形镜头光晕与星芒
uniform float uFlarePower;          // 镜头光晕强度
uniform bool uEnableDispersion;      // 引力微色散开关
uniform vec3 uBlackHolePos;    // 黑洞在宇宙中的 3D 绝对空间坐标
uniform vec3 uBlackHoleVel;    // 黑洞运动速度矢量 (用于计算尾流方向与动压)

#define PI 3.14159265359
#define TWO_PI 6.28318530718

// ==========================================================================
// 高性能噪声函数 (Optimized Simplex & FBM)
// ==========================================================================
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// 快速 2 阶 FBM 湍流 (用于深空天体)
float fbmFast(vec3 p) {
  return 0.65 * snoise(p) + 0.35 * snoise(p * 2.1 + vec3(1.2, 0.4, 2.3));
}

// 纯净极坐标 2D 噪点与分形布朗运动 (用于超薄丝绸吸积盘与流线)
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm2D(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * noise2D(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return v;
}

// ==========================================================================
// 普朗克黑体辐射色温映射
// ==========================================================================
vec3 blackbodyColor(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  float r, g, b;

  if (t <= 66.0) {
    r = 255.0;
    g = 99.4708025861 * log(t) - 161.1195681661;
    if (t <= 19.0) {
      b = 0.0;
    } else {
      b = 138.5177312231 * log(t - 10.0) - 305.0447927307;
    }
  } else {
    r = 329.698727446 * pow(t - 60.0, -0.1332047592);
    g = 288.1221695283 * pow(t - 60.0, -0.0755148492);
    b = 255.0;
  }

  return clamp(vec3(r, g, b) / 255.0, 0.0, 1.0);
}

// ==========================================================================
// 天文级纯净恒星天球 (Pure Optical Spherical Stars - 零十字/纯净自然圆点)
// ==========================================================================
vec3 sampleSky(vec3 dir) {
  vec3 d = normalize(dir);
  vec3 col = vec3(0.0);
  
  // 1. 幽静深空冷色极淡背景 (Deep Pristine Space Void)
  float galPlane = exp(-abs(d.y * 3.5 + 0.1 * sin(d.x * 2.5)) * 2.2);
  float galNoise = fbmFast(d * 2.5 + vec3(0.5, 0.2, 0.8));
  vec3 spaceDark = vec3(0.002, 0.005, 0.012);
  vec3 spaceGlow = vec3(0.010, 0.012, 0.020);
  col += mix(spaceDark, spaceGlow, clamp(galNoise, 0.0, 1.0)) * (galPlane * 1.5 + 0.3);

  // 2. 亚像素微光星尘 (Sub-pixel Micro Pinpoint Stars - 细密自然的繁星)
  vec3 p1 = d * 160.0;
  vec3 i1 = floor(p1);
  vec3 f1 = fract(p1) - 0.5;
  float rnd1 = fract(sin(dot(i1, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  if (rnd1 > 0.65) {
    vec3 j1 = (vec3(fract(rnd1 * 17.3) - 0.5, fract(rnd1 * 43.7) - 0.5, fract(rnd1 * 91.1) - 0.5)) * 0.75;
    float dist1 = length(f1 - j1);
    // 纯圆形平滑高斯衰减 (Pure Optical Circle)
    float star1 = exp(-pow(dist1 / 0.028, 2.0)) * pow(rnd1, 6.0) * 1.1;
    vec3 col1 = mix(vec3(0.75, 0.88, 1.1), vec3(1.1, 0.95, 0.8), fract(rnd1 * 5.0));
    col += col1 * star1;
  }

  // 3. 中等亮度恒星 (Medium Stellar Field)
  vec3 p2 = d * 70.0;
  vec3 i2 = floor(p2);
  vec3 f2 = fract(p2) - 0.5;
  float rnd2 = fract(sin(dot(i2, vec3(39.345, 11.872, 83.156))) * 43758.5453);
  if (rnd2 > 0.82) {
    vec3 j2 = (vec3(fract(rnd2 * 23.4) - 0.5, fract(rnd2 * 57.8) - 0.5, fract(rnd2 * 81.2) - 0.5)) * 0.7;
    float dist2 = length(f2 - j2);
    // 柔和自然的高斯光学圆点
    float star2 = exp(-pow(dist2 / 0.035, 2.0)) * pow(rnd2, 4.0) * 2.2;
    vec3 col2 = mix(vec3(0.8, 0.92, 1.15), vec3(1.15, 0.92, 0.75), fract(rnd2 * 3.3));
    col += col2 * star2;
  }

  // 4. 少数高亮主恒星 (Bright Anchor Stars - 纯净柔和光晕，严禁十字形)
  vec3 p3 = d * 32.0;
  vec3 i3 = floor(p3);
  vec3 f3 = fract(p3) - 0.5;
  float rnd3 = fract(sin(dot(i3, vec3(67.123, 91.456, 17.891))) * 43758.5453);
  if (rnd3 > 0.92) {
    vec3 j3 = (vec3(fract(rnd3 * 31.7) - 0.5, fract(rnd3 * 73.1) - 0.5, fract(rnd3 * 19.9) - 0.5)) * 0.65;
    float dist3 = length(f3 - j3);
    // 紧致高亮核心 + 柔和外发光扩散圆环 (Pure Smooth Optical Halo)
    float core3 = exp(-pow(dist3 / 0.025, 2.0)) * 3.5;
    float halo3 = exp(-pow(dist3 / 0.090, 2.0)) * 0.7;
    vec3 col3 = mix(vec3(0.85, 0.95, 1.2), vec3(1.2, 0.95, 0.7), fract(rnd3 * 7.7));
    col += col3 * (core3 + halo3);
  }

  return col;
}

// ==========================================================================
// 最内稳定圆轨道 ISCO 半径计算
// ==========================================================================
float getISCO(float a, float M) {
  float a_star = clamp(a / M, -0.9999, 0.9999);
  float s = sign(a_star);
  if (abs(s) < 0.001) s = 1.0;
  float z1 = 1.0 + pow(1.0 - a_star * a_star, 1.0/3.0) * (pow(1.0 + a_star, 1.0/3.0) + pow(1.0 - a_star, 1.0/3.0));
  float z2 = sqrt(3.0 * a_star * a_star + z1 * z1);
  float r_isco = M * (3.0 + z2 - s * sqrt(max((3.0 - z1) * (3.0 + z1 + 2.0 * z2), 0.0)));
  return max(r_isco, 1.05 * M);
}

// ==========================================================================
// 相对论吸积盘采样 (Razor-Thin Silky Interstellar Accretion Disk)
// ==========================================================================
vec4 evaluateDiskPoint(vec3 pos, vec3 rayDir, float M, float a, float isco, float r_out) {
  float r = length(pos.xz);
  if (r < isco * 0.98 || r > r_out * 1.02) return vec4(0.0);

  // 1. Novikov-Thorne 相对论温度分布 (高能白炽基准)
  float tempScale = (uTemperature / 3000.0);
  float T = 38000.0 * tempScale * pow(isco / r, 0.5);
  vec3 baseColor = blackbodyColor(T);

  // 2. 相对论开普勒轨道速度与多普勒频移 (显著区分向相与背相侧)
  float betaMag = sqrt(M / r) / max(1.0 + a * sqrt(M / (r * r * r)), 0.1);
  betaMag = clamp(betaMag, 0.0, 0.90);
  
  float spinSign = a >= 0.0 ? 1.0 : -1.0;
  vec3 tangent = normalize(vec3(-pos.z, 0.0, pos.x)) * spinSign;
  vec3 toCam = -normalize(rayDir);
  float cosAng = dot(toCam, tangent);
  float gamma = 1.0 / sqrt(max(1.0 - betaMag * betaMag, 0.001));
  float doppler = 1.0 / max(gamma * (1.0 - betaMag * cosAng), 0.05);

  // 3. 引力红移
  float gravRed = sqrt(max(1.0 - 2.0 * M / r, 0.02));
  float intensity = pow(max(doppler, 0.0), 3.5) * gravRed;
  if (!uEnableDoppler) {
    intensity = gravRed;
  }

  // 4. 真实相对论差动旋转 (Differential Keplerian Flow - 内圈光速飞旋，外圈从容)
  float omega = (sqrt(M) / (pow(r, 1.5) + a * sqrt(M))) * spinSign;
  float phi = atan(pos.z, pos.x);
  float shearPhase = phi - omega * uTime * 2.2;

  // 5. 纯净极坐标 2D 开普勒丝绸微流线 (彻底消除 3D 垂直厚度导致的台风/积雨云雾感)
  float turb = fbm2D(vec2(r * cos(shearPhase) * 0.8, r * sin(shearPhase) * 0.8));
  float logR_distorted = log(r) * 20.0 + turb * 1.8;

  // 6. 超细腻复合多谐波同心流线 (Ultra-dense Multi-harmonic Filaments)
  float s1 = sin(shearPhase * 8.0 + logR_distorted);
  float s2 = sin(shearPhase * 18.0 - logR_distorted * 1.5 + 1.3);
  float s3 = sin(shearPhase * 36.0 + logR_distorted * 2.6 + 2.7);

  float streak = 0.50 * s1 + 0.32 * s2 + 0.18 * s3;
  streak = 0.5 + 0.5 * streak;

  float pattern = 0.55 + 0.25 * turb + 0.45 * pow(streak, 1.4);

  // 7. 边缘平滑羽化 (消除硬截断阶梯)
  float outerFade = smoothstep(r_out, r_out * 0.70, r);
  float innerFade = smoothstep(isco * 0.98, isco * 1.10, r);
  float edgeMask = outerFade * innerFade;

  // 8. 相对论超高能内圈能量聚集 (r^-1.2 陡峭激波衰减，营造炽热白光 ISCO 内环)
  float radialEnergyDensity = pow(isco / r, 1.2);

  vec3 emitColor = baseColor * intensity * pattern * uDensity * radialEnergyDensity * edgeMask;

  // 9. 吸积盘相对论动态热斑 (Relativistic Orbiting Hot Spot)
  if (uEnableHotspot) {
    float r_spot = isco * 1.35;
    float omega_spot = (sqrt(M) / (pow(r_spot, 1.5) + a * sqrt(M))) * spinSign;
    float phi_spot = omega_spot * uTime * 2.5;
    vec2 spotCenter = vec2(cos(phi_spot), sin(phi_spot)) * r_spot;
    float distToSpot = length(pos.xz - spotCenter);
    float spotGauss = exp(-pow(distToSpot / (0.45 * M), 2.0));
    
    vec3 spotLight = vec3(1.2, 1.6, 2.5) * (spotGauss * 12.0 * intensity * edgeMask);
    emitColor += spotLight;
  }

  return vec4(emitColor, 1.0);
}

// ==========================================================================
// 伴星潮汐撕裂流 (High-Performance Astrophysical Volumetric Stream)
// ==========================================================================
vec4 sampleTDE(vec3 pos, vec3 rayDir, float M, float isco) {
  if (!uEnableTDE) return vec4(0.0);

  float r = length(pos.xz);
  float r_comp = 13.5 * M;
  if (r > r_comp + 2.5 * M || r < isco * 0.8 || abs(pos.y) > 2.5 * M) return vec4(0.0);

  float starAngle = uTime * 0.35;
  vec3 starPos = vec3(cos(starAngle) * r_comp, 0.45 * sin(starAngle * 0.6), sin(starAngle) * r_comp);

  // 1. 伴星三维立体洛希瓣引力形变体
  vec3 dStarVec = pos - starPos;
  vec3 starToCenter = normalize(-starPos);
  float radProj = dot(dStarVec, starToCenter);
  vec3 perpVec = dStarVec - radProj * starToCenter;
  float tearDropFactor = mix(1.8, 0.65, clamp((radProj + 0.8 * M) / (2.0 * M), 0.0, 1.0));
  float deformedDistSq = pow(radProj * tearDropFactor, 2.0) + dot(perpVec, perpVec) * 1.5;

  // 2. 撕裂流参数化中心线与局部坐标
  float u = clamp((r_comp - r) / max(r_comp - isco, 0.01 * M), 0.0, 1.0);
  float winding = 3.6 * pow(u, 1.08);
  float expectedPhi = starAngle - winding;
  float phi = atan(pos.z, pos.x);
  float phiDiff = mod(phi - expectedPhi + PI, TWO_PI) - PI;
  float yStream = 0.45 * sin(starAngle - 2.6 * u) * pow(1.0 - u * 0.4, 0.8);
  
  float dTang = abs(phiDiff) * r;
  float dVert = abs(pos.y - yStream);
  float dist3DSq = dTang * dTang + dVert * dVert;

  // 高性能极速早退：若光线采样点远离伴星核心且远离流束管道，立即 0 开销返回！
  if (deformedDistSq > 2.5 * M * M && dist3DSq > 3.0 * M * M) {
    return vec4(0.0);
  }

  // 仅在有效等离子体区域内执行单次高效 3D 噪声采样
  float dist3D = sqrt(dist3DSq);
  float sCoord = u * 25.0 - uTime * 4.5;
  float fastNoise = snoise(vec3(pos.xz * 0.5, pos.y * 1.5 + sCoord * 0.35));
  float fastTurb = 0.70 + 0.30 * fastNoise;

  // 伴星发光与密度
  float starCore = exp(-deformedDistSq / (0.35 * M * M)) * (0.85 + 0.15 * fastNoise);
  float starCorona = exp(-sqrt(deformedDistSq) / (0.70 * M)) * 0.4;
  vec3 starCol = vec3(1.6, 1.15, 0.6) * (starCore * 6.5 + starCorona * 1.8);
  float starDensity = starCore * 4.2 + starCorona * 1.0;

  // 双层立体体积结构 (外围气层 + 核心高密丝流)
  float sheathRadius = (0.65 * M + 0.85 * M * (1.0 - u));
  float sheathGauss = exp(-pow(dist3D / sheathRadius, 2.0));
  float sheathDensity = sheathGauss * (0.55 + 0.45 * max(fastNoise, 0.0)) * 1.2;

  float coreRadius = (0.18 * M + 0.30 * M * (1.0 - u));
  float strandPattern = pow(sin(atan(dVert, max(dTang, 0.001)) * 3.0 + winding * 5.0 - uTime * 4.5 + fastNoise * 1.8) * 0.5 + 0.5, 2.0);
  float coreGauss = exp(-pow(dist3D / coreRadius, 2.0));
  float coreDensity = coreGauss * (0.65 + 0.75 * strandPattern * fastTurb) * 2.6;

  float streamMask = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u);
  float totalStreamDensity = (sheathDensity + coreDensity) * streamMask;

  // 动态光谱与激波
  float localT = mix(5500.0, 38000.0, pow(u, 1.5));
  vec3 baseBlackbody = blackbodyColor(localT);
  vec3 sheathColor = mix(vec3(1.3, 0.6, 0.2), baseBlackbody, 0.5);
  vec3 coreColor = baseBlackbody * 1.6 + vec3(0.4, 0.8, 1.4) * pow(u, 2.0);
  vec3 streamEmission = (sheathColor * sheathDensity + coreColor * coreDensity) * streamMask;

  float shockNode = exp(-pow((u - 0.78) / 0.10, 2.0)) * exp(-dist3DSq / (0.35 * M * M));
  vec3 shockColor = vec3(0.6, 1.1, 1.8) * (shockNode * 4.5);

  // 相对论多普勒聚束
  vec3 tangentDir = normalize(vec3(-pos.z - pos.x * 0.35, 0.0, pos.x - pos.z * 0.35));
  float vBeta = clamp(sqrt(M / max(r, 0.1)) * 0.78, 0.0, 0.80);
  float cosTheta = dot(-normalize(rayDir), tangentDir);
  float dopplerGamma = 1.0 / sqrt(1.0 - vBeta * vBeta);
  float dopplerStream = 1.0 / max(dopplerGamma * (1.0 - vBeta * cosTheta), 0.1);
  float beaming = uEnableDoppler ? pow(clamp(dopplerStream, 0.4, 2.8), 1.8) : 1.0;

  vec3 finalColor = starCol + (streamEmission * 2.2 + shockColor) * beaming;
  float finalDensity = starDensity + totalStreamDensity + shockNode * 1.5;

  return vec4(finalColor, finalDensity);
}

// ==========================================================================
// 极向相对论喷流
// ==========================================================================
vec4 sampleJets(vec3 pos, vec3 rayDir, float M, float rPlus) {
  if (!uEnableJets || uJetPower <= 0.001) return vec4(0.0);

  float y = pos.y;
  float absY = abs(y);
  if (absY < rPlus * 0.9 || absY > 22.0 * M) return vec4(0.0);

  float rho = length(pos.xz);
  float jetRadius = 0.25 * M + 0.14 * pow(absY, 0.75);
  if (rho > jetRadius * 2.0) return vec4(0.0);

  float jetVelY = sign(y) * 0.92;
  vec3 beta = vec3(0.0, jetVelY, 0.0);
  float gamma = 1.0 / sqrt(1.0 - 0.92 * 0.92);
  vec3 nRay = -normalize(rayDir);
  float jetDoppler = 1.0 / (gamma * (1.0 - dot(beta, nRay)));
  float jetBeaming = uEnableDoppler ? pow(clamp(jetDoppler, 0.25, 3.8), 3.0) : 1.0;

  float coreDensity = exp(-pow(rho / (jetRadius * 0.5), 2.0));
  float shockNodes = pow(sin(absY * 1.8 - uTime * 4.0) * 0.5 + 0.5, 4.0);

  float totalDensity = coreDensity * (1.0 + 1.5 * shockNodes) * exp(-absY / (14.0 * M)) * uJetPower;
  vec3 coreColor = vec3(0.6, 0.9, 1.0) * 4.5;
  vec3 sheathColor = vec3(0.15, 0.45, 0.95) * 2.0;
  vec3 jetColor = mix(sheathColor, coreColor, coreDensity) * jetBeaming;

  return vec4(jetColor, totalDensity);
}

// ==========================================================================
// 邦迪-霍伊尔-利特尔顿引力激波尾流 (Bondi-Hoyle-Littleton Gravitational Wake)
// ==========================================================================
vec4 sampleBondiHoyleWake(vec3 pLocal, vec3 velBH, float M) {
  if (!uEnableWake) return vec4(0.0);

  float vSpeed = length(velBH);
  if (vSpeed < 0.05) return vec4(0.0);

  vec3 vDir = normalize(velBH);
  vec3 wakeAxis = -vDir; // 尾流朝向黑洞运动的反方向

  // 沿尾流轴向的投影距离
  float zWake = dot(pLocal, wakeAxis);
  if (zWake < 1.2 * M || zWake > 38.0 * M) return vec4(0.0);

  // 垂直于尾流轴向的横向距离
  vec3 pPerp = pLocal - zWake * wakeAxis;
  float rPerp = length(pPerp);

  // 激波锥扩散宽度与激波边界 (Shock Cone Profile)
  float shockRadius = (0.45 * M + 0.24 * sqrt(zWake * M)) * (1.0 + 0.35 / (vSpeed + 0.2));
  if (rPerp > shockRadius * 2.5) return vec4(0.0);

  // 尾流激波密度分布
  float radialGauss = exp(-pow(rPerp / shockRadius, 2.0));
  float axialFalloff = 1.0 / sqrt(1.0 + zWake / (3.5 * M));
  float nearFade = smoothstep(1.2 * M, 3.2 * M, zWake);
  
  // 尾流等离子体湍流丝状结构
  float wakeTurb = fbmFast(vec3(pLocal * 0.45 - wakeAxis * (uTime * 1.5))) * 0.4 + 0.8;
  float density = radialGauss * axialFalloff * nearFade * wakeTurb * uWakePower * 2.0;

  // 激波等离子体色彩 (近心端炽热青蓝激波 -> 远端电离氢橙红尾流)
  float tNorm = clamp(1.0 - zWake / (35.0 * M), 0.0, 1.0);
  vec3 hotShockCol = vec3(0.3, 0.85, 1.3) * 3.8;
  vec3 coolTailCol = vec3(1.4, 0.55, 0.18) * 2.2;
  vec3 wakeCol = mix(coolTailCol, hotShockCol, pow(tNorm, 1.5));

  return vec4(wakeCol, density);
}

// ==========================================================================
// 能层与视界线框
// ==========================================================================
vec3 sampleSpacetimeGrid(vec3 pos, float M, float a, float rPlus) {
  if (!uEnableGrid) return vec3(0.0);

  float r = length(pos);
  float cosTheta = pos.y / max(r, 0.001);
  float rErg = M + sqrt(max(M * M - a * a * cosTheta * cosTheta, 0.0));

  float dHorizon = abs(r - rPlus);
  float hGrid = 0.0;
  if (dHorizon < 0.1 * M) {
    float theta = acos(clamp(cosTheta, -1.0, 1.0));
    float phi = atan(pos.z, pos.x);
    float lines = sin(theta * 20.0) * sin(phi * 20.0);
    hGrid = smoothstep(0.75, 0.98, abs(lines)) * exp(-dHorizon / (0.05 * M));
  }

  float dErg = abs(r - rErg);
  float eGrid = 0.0;
  if (dErg < 0.1 * M) {
    float theta = acos(clamp(cosTheta, -1.0, 1.0));
    float phi = atan(pos.z, pos.x);
    float lines = sin(theta * 20.0) * sin(phi * 20.0);
    eGrid = smoothstep(0.75, 0.98, abs(lines)) * exp(-dErg / (0.05 * M));
  }

  return vec3(1.0, 0.7, 0.1) * hGrid * 2.5 + vec3(0.0, 0.9, 1.0) * eGrid * 2.5;
}

// ==========================================================================
// 相对论引力加速度计算
// ==========================================================================
vec3 getGeodesicAcceleration(vec3 pos, vec3 dir, float M, float a) {
  float r = length(pos);
  float r2 = r * r;
  
  float r_dot_d = dot(pos, dir);
  float h2 = max(r2 - r_dot_d * r_dot_d, 0.0);

  vec3 a_grav = -(1.5 * M * h2 / (r2 * r2 * r + 0.0001)) * pos;
  vec3 a_drag = vec3(-pos.z, 0.0, pos.x) * (2.0 * M * a / (r2 * r2 + 0.0001));

  // 引力波四极矩时空度规扰动 (Gravitational Wave Quadrupole Metric Perturbation)
  vec3 a_gw = vec3(0.0);
  if (uEnableGW || uGWBurst > 0.001) {
    float phi = atan(pos.z, pos.x);
    float gwPhase = 2.4 * r - 4.5 * uTime + 2.0 * phi;
    float gwAmp = (uEnableGW ? 0.08 : 0.0) + uGWBurst * 0.35;
    float gwQuad = sin(gwPhase) * (1.0 - pow(pos.y / max(r, 0.01), 2.0)) * exp(-r / (14.0 * M));
    a_gw = vec3(cos(phi) * gwQuad, -sin(gwPhase * 0.5) * gwQuad * 0.5, sin(phi) * gwQuad) * gwAmp;
  }

  return a_grav + a_drag + a_gw;
}

// ==========================================================================
// 主渲染光线步进循环 (High Performance Optimized Moving Black Hole)
// ==========================================================================
void main() {
  vec2 ndc = (vUv - 0.5) * 2.0;
  vec4 viewRay = uCameraProjectionInverse * vec4(ndc, -1.0, 1.0);
  viewRay.xyz /= viewRay.w;
  vec3 rayDir = normalize((uCameraWorldMatrix * vec4(normalize(viewRay.xyz), 0.0)).xyz);
  vec3 rayPos = uCameraPos;

  float M = uMass;
  float a = clamp(uSpin, -0.999 * M, 0.999 * M);
  
  float rPlus = M + sqrt(max(M * M - a * a, 0.001));
  float isco = getISCO(a, M);
  float r_out = isco + 10.0 * M;

  // 采样步数级别 (根据质量档位扩展)
  int maxSteps = 260;
  if (uQualitySteps == 1) { maxSteps = 64; }
  else if (uQualitySteps == 2) { maxSteps = 110; }
  else if (uQualitySteps == 3) { maxSteps = 180; }
  else if (uQualitySteps == 4) { maxSteps = 260; }
  else if (uQualitySteps == 5) { maxSteps = 380; } // IMAX 8K 影院级超精积分

  vec3 accumColor = vec3(0.0);
  float transmittance = 1.0;
  bool capturedByHorizon = false;

  vec3 pos = rayPos;
  vec3 dir = rayDir;

  float minR = 1000.0;
  float totalBending = 0.0;
  float minLz = 0.0;

  // 动态计算光线逃逸半径 (随相机距离自适应扩展，避免远距离截断)
  float startDist = length(rayPos - uBlackHolePos);
  float escapeRadius = max(42.0 * M, startDist * 1.5);

  for (int step = 0; step < 390; step++) {
    if (step >= maxSteps || transmittance < 0.005) break;

    // 相对黑洞中心的局域物理坐标
    vec3 relP = pos - uBlackHolePos;
    float r = length(relP);
    float r_dot_d = dot(relP, dir);

    // 记录光线与奇点的最近掠过距离 (Periapsis / Impact Parameter)
    if (r < minR) {
      minR = r;
      minLz = (relP.x * dir.z - relP.z * dir.x);
    }

    // 1. 检查是否坠入事件视界
    if (r <= rPlus * 1.01) {
      capturedByHorizon = true;
      break;
    }

    // 2. 高效逃逸判定 (光线飞过最近点并远离黑洞引力包围球时安全退出)
    if (r > escapeRadius && r_dot_d > 0.0) {
      break;
    }

    // 3. 高效物理连续自适应积分步长 (彻底消除跳变断崖与扇叶/鱼鳞切片走样)
    float ds = 0.022 * M + 0.020 * r;
    if (r < 3.2 * M) {
      // 视界与光子球极端引力弯折区 (高精模式自适应加密)
      float minStep = (uQualitySteps >= 4) ? 0.008 * M : 0.015 * M;
      ds = max(minStep, 0.009 * r);
    }
    // 外围深空大步长，保证远距离(d=120)能用少量步数逼近黑洞
    ds = min(ds, max(0.38 * M, 0.05 * r));

    // 吸积盘几何体超薄流形高精度加密步长 (Sub-stepping - 紧密贴合刀锋吸积盘平面)
    if (uEnableDisk && abs(relP.y) < (0.12 * M) && r >= isco * 0.85 && r <= (r_out * 1.15)) {
      float diskDS = (uQualitySteps >= 4) ? 0.016 * M : 0.028 * M;
      ds = min(ds, diskDS);
    }

    // 伴星撕裂流与伴星天体加密步长 (仅在接近流束本体时按需加密，性能恢复 60 FPS)
    if (uEnableTDE && abs(relP.y) < 1.4 * M && r >= isco * 0.85 && r <= 14.5 * M) {
      float uTDE = (13.5 * M - r) / max(13.5 * M - isco, 0.1 * M);
      float expPhi = (uTime * 0.35) - 3.6 * pow(clamp(uTDE, 0.0, 1.0), 1.08);
      float curPhi = atan(relP.z, relP.x);
      float pDiff = mod(curPhi - expPhi + PI, TWO_PI) - PI;
      if (abs(pDiff) * r < 1.6 * M) {
        ds = min(ds, 0.052 * M);
      }
    }

    vec3 prevPos = pos;
    vec3 prevRelP = relP;
    vec3 prevDir = dir;

    // 4. RK2 相对论测地线积分
    if (uEnableLensing) {
      vec3 acc1 = getGeodesicAcceleration(relP, dir, M, a);
      vec3 midRelP = relP + dir * (ds * 0.5);
      vec3 midDir = normalize(dir + acc1 * (ds * 0.5));
      vec3 acc2 = getGeodesicAcceleration(midRelP, midDir, M, a);
      
      dir = normalize(dir + acc2 * ds);
      pos += dir * ds;
      totalBending += acos(clamp(dot(prevDir, dir), -1.0, 1.0));
    } else {
      pos += dir * ds;
    }

    // 5. 相对论吸积盘高动态纯净辐射积分 (刀锋级极薄吸积盘，彻底消灭台风云雾感)
    if (uEnableDisk) {
      float rr = length(relP.xz);
      if (rr >= isco * 0.95 && rr <= r_out * 1.05) {
        float halfThick = 0.055 * M;
        if (abs(relP.y) < halfThick * 2.2) {
          float vertDens = exp(-pow(relP.y / max(halfThick, 0.005), 2.0));
          vec4 diskSample = evaluateDiskPoint(relP, dir, M, a, isco, r_out);
          accumColor += diskSample.rgb * vertDens * ds * 2.8;
        }
      }
    }

    // 6. 邦迪-霍伊尔引力尾流采样 (Bondi-Hoyle Wake)
    vec3 midRelP = (prevRelP + (pos - uBlackHolePos)) * 0.5;
    if (uEnableWake) {
      vec4 wakeSample = sampleBondiHoyleWake(midRelP, uBlackHoleVel, M);
      if (wakeSample.a > 0.001) {
        float optDepth = wakeSample.a * ds;
        float alpha = 1.0 - exp(-optDepth);
        accumColor += transmittance * wakeSample.rgb * alpha;
        transmittance *= (1.0 - alpha * 0.4);
      }
    }

    // 7. 极向喷流与伴星撕裂流采样 (仅在有效区域计算)
    if (uEnableJets) {
      vec4 jetSample = sampleJets(midRelP, dir, M, rPlus);
      if (jetSample.a > 0.001) {
        float optDepth = jetSample.a * ds;
        float alpha = 1.0 - exp(-optDepth);
        accumColor += transmittance * jetSample.rgb * alpha;
        transmittance *= (1.0 - alpha * 0.15);
      }
    }

    if (uEnableTDE) {
      vec4 tdeSample = sampleTDE(midRelP, dir, M, isco);
      if (tdeSample.a > 0.001) {
        float optDepth = tdeSample.a * ds;
        float alpha = 1.0 - exp(-optDepth);
        accumColor += transmittance * tdeSample.rgb * alpha;
        transmittance *= (1.0 - alpha * 0.12);
      }
    }

    // 8. 时空线框网格采样
    if (uEnableGrid) {
      vec3 gridCol = sampleSpacetimeGrid(midRelP, M, a, rPlus);
      accumColor += transmittance * gridCol * 0.2;
    }

    // 9. 物理级引力波时空同心涟漪光纹 (Luminous Metric Ripple Crests)
    if (uEnableGW || uGWBurst > 0.001) {
      float midR = length(midRelP);
      if (midR > rPlus * 1.05 && midR < 25.0 * M) {
        float phi = atan(midRelP.z, midRelP.x);
        float gwPhase = 2.4 * midR - 4.5 * uTime + 2.0 * phi;
        float waveCrest = pow(max(cos(gwPhase), 0.0), 5.0) * exp(-abs(midRelP.y) / (2.2 * M));
        float radialFalloff = exp(-midR / (10.0 * M)) / max(midR * 0.2, 0.5);
        float gwIntensity = waveCrest * radialFalloff * ((uEnableGW ? 0.35 : 0.0) + uGWBurst * 1.5);
        vec3 gwColor = mix(vec3(0.2, 0.65, 1.2), vec3(0.7, 0.3, 1.4), 0.5 + 0.5 * sin(gwPhase * 0.5));
        accumColor += transmittance * gwColor * gwIntensity * ds * 2.5;
      }
    }
  }

  // 8. 远距离深空星空背景采样
  vec3 skyColor = sampleSky(dir);

  if (capturedByHorizon) {
    // 视界内部极深黑暗
    accumColor += vec3(0.001, 0.002, 0.004) * transmittance;
  } else {
    // 9. 物理级光子球锐利光环 (Kerr Relativistic Photon Ring & Sub-ring)
    // 真正物理机制: 逃逸光线中最接近奇点(minR)逼近光子球且测地线发生剧烈弯折(totalBending > 1.2 rad)的光子
    if (uEnableLensing) {
      float spinDir = a >= 0.0 ? 1.0 : -1.0;
      float lzNorm = clamp(minLz * spinDir * 0.35, -1.0, 1.0);
      // 克尔各向异性光子球半径: 顺行光子球更靠内，逆行光子球更靠外
      float r_ph = M * (2.8 - 1.1 * (a / M) * lzNorm);
      
      // 主光子环 (Primary Photon Ring n=1) - 极锐利高能光子轨道
      float ringDelta = abs(minR - r_ph);
      float ringSharp = exp(-pow(ringDelta / (0.065 * M), 2.0));
      float ringBendingWeight = smoothstep(1.0, 3.2, totalBending);
      float ringIntensity = ringSharp * ringBendingWeight * 2.4;

      // 次级透镜副光环 (Secondary Sub-ring n=2) - 环绕黑洞超180度的高阶透镜环
      float subRingDelta = abs(minR - (r_ph * 0.94));
      float subRingSharp = exp(-pow(subRingDelta / (0.032 * M), 2.0));
      float subRingIntensity = subRingSharp * smoothstep(2.4, 5.0, totalBending) * 1.5;

      // 三级高阶微光子环 (Tertiary Sub-ring n=3) - 极端精密回旋光环
      float triRingDelta = abs(minR - (r_ph * 0.91));
      float triRingSharp = exp(-pow(triRingDelta / (0.016 * M), 2.0));
      float triRingIntensity = triRingSharp * smoothstep(3.5, 6.2, totalBending) * 1.0;

      // 顺行/逆行多普勒强化 (接近侧更亮更白，远离侧金橙)
      float dopplerBoost = clamp(1.0 + 0.65 * (a / M) * lzNorm, 0.3, 2.5);
      vec3 ringCol = mix(vec3(1.0, 0.90, 0.70), vec3(0.80, 0.92, 1.0), clamp(a / M * lzNorm * 0.5 + 0.5, 0.0, 1.0));

      accumColor += (ringCol * ringIntensity * dopplerBoost + vec3(1.2, 1.2, 1.4) * subRingIntensity + vec3(1.4, 1.4, 1.6) * triRingIntensity) * transmittance;
    }

    accumColor += skyColor * transmittance;
  }

  // 10. 时空微引力光学色散 (Gravitational Chromatic Dispersion)
  if (uEnableDispersion) {
    float edgeDispers = pow(length(vUv - 0.5) * 1.414, 2.0) * 0.045;
    float gravDispers = smoothstep(1.5 * M, 3.5 * M, minR) * (1.0 - smoothstep(3.5 * M, 6.0 * M, minR)) * 0.035;
    float totalDisp = edgeDispers + gravDispers;
    accumColor.r *= (1.0 + totalDisp * 1.2);
    accumColor.b *= (1.0 - totalDisp * 0.8);
  }

  // 11. 宽银幕变形镜头光晕与星芒 (Anamorphic Flare & Starburst)
  if (uEnableCinematicFlare) {
    float lum = dot(accumColor, vec3(0.299, 0.587, 0.114));
    // 宽银幕横向水平蓝青光纹 (Horizontal Anamorphic Blue Streak)
    float horizStreak = pow(max(lum - 1.1, 0.0), 1.8) * exp(-abs(vUv.y - 0.5) * 12.0) * uFlarePower;
    vec3 flareCol = vec3(0.25, 0.65, 1.3) * horizStreak * 0.35;
    accumColor += flareCol;
  }

  gl_FragColor = vec4(accumColor, 1.0);
}
`;

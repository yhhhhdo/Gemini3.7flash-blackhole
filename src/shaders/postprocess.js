// ==========================================================================
// HDR BLOOM, ACES FILMIC TONE MAPPING & OPTICAL FLARES
// ==========================================================================

export const postProcessFragmentShader = `
precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform bool uEnableBloom;
uniform float uTime;

// ACES Filmic 色调映射曲线 (Narkowicz 2015)
vec3 ACESFilmicToneMapping(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// 伪随机散粒噪点 (Film Grain)
float filmNoise(vec2 uv, float t) {
  return fract(sin(dot(uv + sin(t), vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  vec2 texel = 1.0 / uResolution;

  vec3 color = texture2D(tDiffuse, uv).rgb;

  if (uEnableBloom) {
    // 9 点快速高斯散射辉光采样 (Multi-radius Bloom Blur)
    vec3 bloom = vec3(0.0);
    float weights[5];
    weights[0] = 0.227027;
    weights[1] = 0.1945946;
    weights[2] = 0.1216216;
    weights[3] = 0.054054;
    weights[4] = 0.016216;

    // 8-方向全向柔和高斯辉光 (Isotropic Circular Bloom - 零十字/纯净光晕)
    for (int i = 1; i <= 4; i++) {
      float r = float(i) * 3.5;
      float w = weights[i];
      vec2 off1 = vec2(r * texel.x, 0.0);
      vec2 off2 = vec2(0.0, r * texel.y);
      vec2 off3 = vec2(r * 0.707 * texel.x, r * 0.707 * texel.y);
      vec2 off4 = vec2(-r * 0.707 * texel.x, r * 0.707 * texel.y);

      bloom += max(texture2D(tDiffuse, uv + off1).rgb - 0.8, vec3(0.0)) * w * 0.25;
      bloom += max(texture2D(tDiffuse, uv - off1).rgb - 0.8, vec3(0.0)) * w * 0.25;
      bloom += max(texture2D(tDiffuse, uv + off2).rgb - 0.8, vec3(0.0)) * w * 0.25;
      bloom += max(texture2D(tDiffuse, uv - off2).rgb - 0.8, vec3(0.0)) * w * 0.25;
      bloom += max(texture2D(tDiffuse, uv + off3).rgb - 0.8, vec3(0.0)) * w * 0.25;
      bloom += max(texture2D(tDiffuse, uv - off3).rgb - 0.8, vec3(0.0)) * w * 0.25;
      bloom += max(texture2D(tDiffuse, uv + off4).rgb - 0.8, vec3(0.0)) * w * 0.25;
      bloom += max(texture2D(tDiffuse, uv - off4).rgb - 0.8, vec3(0.0)) * w * 0.25;
    }

    color += bloom * 0.75;
  }

  // 微量镜头色散 (Chromatic Aberration 边缘轻微色散)
  float distFromCenter = length(uv - 0.5);
  if (distFromCenter > 0.3) {
    float caOffset = (distFromCenter - 0.3) * 0.003;
    float r = texture2D(tDiffuse, uv + vec2(caOffset, 0.0)).r;
    float b = texture2D(tDiffuse, uv - vec2(caOffset, 0.0)).b;
    color.r = mix(color.r, r, 0.6);
    color.b = mix(color.b, b, 0.6);
  }

  // ACES 电影级色调映射
  color = ACESFilmicToneMapping(color);

  // 伽马校正
  color = pow(color, vec3(1.0 / 2.2));

  // 电影级暗角 (Vignette)
  float vignette = smoothstep(1.2, 0.3, distFromCenter);
  color *= vignette;

  // 微量胶片颗粒感 (Film Grain)
  float grain = (filmNoise(uv, uTime) - 0.5) * 0.02;
  color += grain;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

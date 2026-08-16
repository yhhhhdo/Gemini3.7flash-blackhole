// ==========================================================================
// HUD CONTROLS & STATE MANAGER // 交互控制与状态双向绑定中枢
// ==========================================================================

export class UIManager {
  constructor(app) {
    this.app = app;
    this.hudVisible = true;
    this.sidebarCollapsed = false;

    // 默认天体物理与渲染状态 (默认呈现纯净的经典卡冈图雅黑洞)
    this.state = {
      // 模块开关
      enableDisk: true,
      enableJets: false,
      enableLensing: true,
      enableDoppler: true,
      enableTDE: false,
      enableGrid: false,
      enableHotspot: true,
      enableGW: false,
      enableCruise: true,
      enableWake: false,
      enableBloom: true,
      enableCinematicFlare: true,
      flarePower: 1.00,
      enableDispersion: true,

      // 参数滑块
      spin: 0.999,
      mass: 0.50,
      temperature: 3000,
      density: 0.20,
      jetPower: 4.00,
      timeRate: 0.90,
      cruiseSpeed: 1.00,
      wakePower: 1.50,
      quality: 5, // 1: Std, 2: High, 3: Ultra, 4: Cinema 4K, 5: IMAX 8K
    };

    this.initElements();
    this.bindEvents();
    this.updateTelemetry(60);
  }

  initElements() {
    // 头部与全局按钮
    this.elHeader = document.getElementById('hud-header');
    this.elSidebar = document.getElementById('hud-sidebar');
    this.elFooter = document.getElementById('hud-footer');
    this.elOpenSidebar = document.getElementById('btn-open-sidebar');
    this.elWakeupHint = document.getElementById('hud-wakeup-hint');
    this.elDiveOverlay = document.getElementById('dive-warning-overlay');

    this.btnAudio = document.getElementById('btn-audio-toggle');
    this.iconSoundOn = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.btnHideHud = document.getElementById('btn-hide-hud');
    this.btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
    this.btnResetParams = document.getElementById('btn-reset-params');
    this.btnAbortDive = document.getElementById('btn-abort-dive');
    this.btnExport4K = document.getElementById('btn-export-4k');
    this.btnGWBurst = document.getElementById('btn-gw-burst');

    // 遥测数据读数
    this.valFps = document.getElementById('val-fps');
    this.valRplus = document.getElementById('val-rplus');
    this.valRerg = document.getElementById('val-rerg');
    this.valSpinDisp = document.getElementById('val-spin-disp');
    this.valDopplerDisp = document.getElementById('val-doppler-disp');

    // 开关 DOM
    this.toggles = {
      enableDisk: document.getElementById('toggle-disk'),
      enableJets: document.getElementById('toggle-jets'),
      enableLensing: document.getElementById('toggle-lensing'),
      enableDoppler: document.getElementById('toggle-doppler'),
      enableTDE: document.getElementById('toggle-tde'),
      enableGrid: document.getElementById('toggle-grid'),
      enableHotspot: document.getElementById('toggle-hotspot'),
      enableGW: document.getElementById('toggle-gw'),
      enableCruise: document.getElementById('toggle-cruise'),
      enableWake: document.getElementById('toggle-wake'),
      enableBloom: document.getElementById('toggle-bloom'),
      enableCinematicFlare: document.getElementById('toggle-cinematic-flare'),
      enableDispersion: document.getElementById('toggle-dispersion'),
    };

    // 滑块 DOM 与数值显示
    this.sliders = {
      spin: { input: document.getElementById('param-spin'), disp: document.getElementById('disp-spin') },
      mass: { input: document.getElementById('param-mass'), disp: document.getElementById('disp-mass') },
      temp: { input: document.getElementById('param-temp'), disp: document.getElementById('disp-temp') },
      density: { input: document.getElementById('param-density'), disp: document.getElementById('disp-density') },
      jetPower: { input: document.getElementById('param-jet-power'), disp: document.getElementById('disp-jet-power') },
      timeRate: { input: document.getElementById('param-time-rate'), disp: document.getElementById('disp-time-rate') },
      cruiseSpeed: { input: document.getElementById('param-cruise-speed'), disp: document.getElementById('disp-cruise-speed') },
      wakePower: { input: document.getElementById('param-wake-power'), disp: document.getElementById('disp-wake-power') },
      quality: { input: document.getElementById('param-quality'), disp: document.getElementById('disp-quality') },
    };

    // 预设按钮
    this.presetButtons = document.querySelectorAll('.btn-preset');
    this.astroPresetButtons = document.querySelectorAll('.btn-astro-preset');
  }

  bindEvents() {
    // 1. 独立模块开关事件
    Object.keys(this.toggles).forEach(key => {
      const el = this.toggles[key];
      if (!el) return;
      el.addEventListener('change', (e) => {
        this.state[key] = e.target.checked;
        if (key === 'enableDoppler') {
          this.valDopplerDisp.textContent = e.target.checked ? 'Active' : 'Bypass';
          this.valDopplerDisp.style.color = e.target.checked ? 'var(--text-main)' : 'var(--text-muted)';
        }
        this.app.onParamChange();
      });
    });

    // 2. 参数滑块事件
    this.sliders.spin.input.addEventListener('input', (e) => {
      this.state.spin = parseFloat(e.target.value);
      const sign = this.state.spin >= 0 ? '+' : '';
      this.sliders.spin.disp.textContent = `${sign}${this.state.spin.toFixed(3)}`;
      this.valSpinDisp.textContent = `${sign}${this.state.spin.toFixed(3)}`;
      this.updateHorizonCalculations();
      this.app.onParamChange();
    });

    this.sliders.mass.input.addEventListener('input', (e) => {
      this.state.mass = parseFloat(e.target.value);
      this.sliders.mass.disp.textContent = `${this.state.mass.toFixed(2)}`;
      this.updateHorizonCalculations();
      this.app.onParamChange();
    });

    this.sliders.temp.input.addEventListener('input', (e) => {
      this.state.temperature = parseFloat(e.target.value);
      this.sliders.temp.disp.textContent = `${Math.round(this.state.temperature)} K`;
      this.app.onParamChange();
    });

    this.sliders.density.input.addEventListener('input', (e) => {
      this.state.density = parseFloat(e.target.value);
      this.sliders.density.disp.textContent = `${this.state.density.toFixed(2)}`;
      this.app.onParamChange();
    });

    this.sliders.jetPower.input.addEventListener('input', (e) => {
      this.state.jetPower = parseFloat(e.target.value);
      this.sliders.jetPower.disp.textContent = `${this.state.jetPower.toFixed(2)}`;
      this.app.onParamChange();
    });

    this.sliders.timeRate.input.addEventListener('input', (e) => {
      this.state.timeRate = parseFloat(e.target.value);
      this.sliders.timeRate.disp.textContent = `${this.state.timeRate.toFixed(2)}x`;
      this.app.onParamChange();
    });

    if (this.sliders.cruiseSpeed.input) {
      this.sliders.cruiseSpeed.input.addEventListener('input', (e) => {
        this.state.cruiseSpeed = parseFloat(e.target.value);
        this.sliders.cruiseSpeed.disp.textContent = `${this.state.cruiseSpeed.toFixed(2)}x`;
        this.app.onParamChange();
      });
    }

    if (this.sliders.wakePower.input) {
      this.sliders.wakePower.input.addEventListener('input', (e) => {
        this.state.wakePower = parseFloat(e.target.value);
        this.sliders.wakePower.disp.textContent = `${this.state.wakePower.toFixed(2)}`;
        this.app.onParamChange();
      });
    }

    this.sliders.quality.input.addEventListener('input', (e) => {
      this.state.quality = parseInt(e.target.value, 10);
      const labels = ['标准 (Std 64)', '高画质 (High 110)', '极致 (Ultra 180)', '电影 4K (260)', 'IMAX 8K (380 步)'];
      this.sliders.quality.disp.textContent = labels[this.state.quality - 1] || '电影 4K (260)';
      this.app.onParamChange();
    });

    // 3. 重置按钮
    this.btnResetParams.addEventListener('click', () => {
      this.resetToDefaults();
    });

    // 4. 音频开关
    this.btnAudio.addEventListener('click', () => {
      const playing = this.app.audio.toggle();
      if (playing) {
        this.iconSoundOn.classList.remove('hidden');
        this.iconSoundOff.classList.add('hidden');
      } else {
        this.iconSoundOn.classList.add('hidden');
        this.iconSoundOff.classList.remove('hidden');
      }
    });

    // 5. 全屏切换
    this.btnFullscreen.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // 6. HUD 隐藏与唤起
    this.btnHideHud.addEventListener('click', () => {
      this.toggleHUD(false);
    });

    // 7. 侧边栏展开/折叠
    this.btnCollapseSidebar.addEventListener('click', () => {
      this.toggleSidebar(true);
    });
    this.elOpenSidebar.addEventListener('click', () => {
      this.toggleSidebar(false);
    });

    // 8. 运镜预设按钮
    this.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetName = btn.getAttribute('data-preset');
        this.presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.app.setCameraPreset(presetName);
      });
    });

    // 8.1 著名天体预设按钮 (Astrophysical Profiles)
    this.astroPresetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.getAttribute('data-astro');
        this.astroPresetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.app.applyAstroPreset(presetKey);
      });
    });

    // 8.2 4K 壁纸超清导出
    if (this.btnExport4K) {
      this.btnExport4K.addEventListener('click', () => {
        this.app.exportSnapshot(3840, 2160);
      });
    }

    // 8.3 激发 LIGO 引力波脉冲
    if (this.btnGWBurst) {
      this.btnGWBurst.addEventListener('click', () => {
        this.app.triggerGWBurst();
      });
    }

    // 9. 视界脱离按钮
    this.btnAbortDive.addEventListener('click', () => {
      this.elDiveOverlay.classList.add('hidden');
      this.app.setCameraPreset('equatorial');
      this.presetButtons.forEach(b => b.classList.remove('active'));
      document.querySelector('[data-preset="equatorial"]')?.classList.add('active');
    });

    // 10. 全局键盘快捷键
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'h' || e.key === 'H') {
        this.toggleHUD();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      } else if (e.key === ' ') {
        e.preventDefault();
        this.app.togglePlayPause();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const btn = this.presetButtons[idx];
        if (btn) btn.click();
      }
    });

    // 点击背景唤醒 HUD (在隐藏模式下)
    window.addEventListener('click', (e) => {
      if (!this.hudVisible && !e.target.closest('#hud-sidebar')) {
        this.toggleHUD(true);
      }
    });
  }

  updateHorizonCalculations() {
    const M = this.state.mass;
    const a = this.state.spin * M;
    const rPlus = M + Math.sqrt(Math.max(M * M - a * a, 0.001));
    const rErg = 2.0 * M; // 赤道能层边界

    this.valRplus.textContent = `${(rPlus / M).toFixed(2)} M`;
    this.valRerg.textContent = `${(rErg / M).toFixed(2)} M`;
  }

  updateTelemetry(fps, camDist, rPlus, M) {
    this.valFps.textContent = Math.round(fps);
    if (camDist !== undefined && rPlus !== undefined && M !== undefined) {
      const ratio = camDist / rPlus;
      const rOverM = camDist / M;
      const elDist = document.getElementById('val-cam-dist');
      if (elDist) {
        elDist.textContent = `${rOverM.toFixed(1)} M`;
        // 接近视界时变红警告
        elDist.style.color = ratio < 2.5 ? '#ff4444' : ratio < 4.0 ? '#ffaa22' : 'var(--text-main)';
      }

      // 计算引力时间膨胀率 dt/dτ = 1 / sqrt(1 - 2M/r)
      const elTimeDil = document.getElementById('val-time-dilation');
      if (elTimeDil) {
        const metricFactor = Math.max(1.0 - (2.0 * M) / camDist, 0.0001);
        const gammaT = 1.0 / Math.sqrt(metricFactor);
        if (gammaT > 99.0 || ratio <= 1.02) {
          elTimeDil.textContent = '∞ 冻结';
          elTimeDil.style.color = '#ff4444';
        } else {
          elTimeDil.textContent = `${gammaT.toFixed(2)}×`;
          elTimeDil.style.color = gammaT > 2.0 ? '#ffaa22' : 'var(--accent-amber)';
        }
      }
    }
    this.updateHorizonCalculations();
  }

  toggleHUD(forceState) {
    this.hudVisible = forceState !== undefined ? forceState : !this.hudVisible;
    const panels = [this.elHeader, this.elSidebar, this.elFooter, this.elOpenSidebar];
    panels.forEach(p => {
      if (p) {
        if (this.hudVisible) {
          p.classList.remove('hud-hidden');
        } else {
          p.classList.add('hud-hidden');
        }
      }
    });

    if (!this.hudVisible) {
      this.elWakeupHint.classList.remove('hidden');
      setTimeout(() => {
        this.elWakeupHint.classList.add('hidden');
      }, 4000);
    }
  }

  toggleSidebar(collapse) {
    this.sidebarCollapsed = collapse;
    if (collapse) {
      this.elSidebar.classList.add('collapsed');
      this.elOpenSidebar.classList.remove('hidden');
    } else {
      this.elSidebar.classList.remove('collapsed');
      this.elOpenSidebar.classList.add('hidden');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  syncControlsFromState() {
    // 同步开关到 DOM
    Object.keys(this.toggles).forEach(k => {
      if (this.toggles[k]) this.toggles[k].checked = this.state[k];
    });

    // 同步滑块与读数
    this.sliders.spin.input.value = this.state.spin;
    const sign = this.state.spin >= 0 ? '+' : '';
    this.sliders.spin.disp.textContent = `${sign}${this.state.spin.toFixed(3)}`;
    this.valSpinDisp.textContent = `${sign}${this.state.spin.toFixed(3)}`;

    this.sliders.mass.input.value = this.state.mass;
    this.sliders.mass.disp.textContent = `${this.state.mass.toFixed(2)}`;

    this.sliders.temp.input.value = this.state.temperature;
    this.sliders.temp.disp.textContent = `${Math.round(this.state.temperature)} K`;

    this.sliders.density.input.value = this.state.density;
    this.sliders.density.disp.textContent = `${this.state.density.toFixed(2)}`;

    this.sliders.jetPower.input.value = this.state.jetPower;
    this.sliders.jetPower.disp.textContent = `${this.state.jetPower.toFixed(2)}`;

    this.sliders.timeRate.input.value = this.state.timeRate;
    this.sliders.timeRate.disp.textContent = `${this.state.timeRate.toFixed(2)}x`;

    this.updateHorizonCalculations();
  }

  showDiveWarning(show) {
    if (show) {
      this.elDiveOverlay.classList.remove('hidden');
    } else {
      this.elDiveOverlay.classList.add('hidden');
    }
  }

  resetToDefaults() {
    this.state = {
      enableDisk: true,
      enableJets: false,
      enableLensing: true,
      enableDoppler: true,
      enableTDE: false,
      enableGrid: false,
      enableHotspot: true,
      enableGW: false,
      enableCruise: true,
      enableWake: false,
      enableBloom: true,
      enableCinematicFlare: true,
      flarePower: 1.00,
      enableDispersion: true,
      spin: 0.999,
      mass: 0.50,
      temperature: 3000,
      density: 0.20,
      jetPower: 4.00,
      timeRate: 0.90,
      cruiseSpeed: 1.00,
      wakePower: 1.50,
      quality: 5,
    };

    this.syncControlsFromState();
    this.sliders.quality.input.value = this.state.quality;
    this.sliders.quality.disp.textContent = 'IMAX 8K (380 步)';

    this.app.onParamChange();
    this.presetButtons.forEach(b => b.classList.remove('active'));
    this.astroPresetButtons.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-preset="interstellar"]')?.classList.add('active');
  }
}

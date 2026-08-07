import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ─────────────────────────────────────────────
// 0. QR 코드 및 UI 초기화
// ─────────────────────────────────────────────
window.addEventListener('load', () => {
  const url = window.location.href;
  const urlEl = document.getElementById('qr-url');
  const boxEl = document.getElementById('qr-code-box');
  const panel = document.getElementById('qr-panel');
  const toggle = document.getElementById('qr-toggle');

  if (urlEl) urlEl.textContent = url;

  if (boxEl && typeof QRCode !== 'undefined') {
    new QRCode(boxEl, {
      text: url,
      width: 160,
      height: 160,
      colorDark: '#9d4edd',
      colorLight: '#0d0e18',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } else if (boxEl) {
    boxEl.innerHTML = `<div style="width:160px;height:40px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;padding:8px;text-align:center">위 주소를 직접 입력</div>`;
  }

  if (panel && toggle) {
    toggle.style.display = 'none';

    panel.addEventListener('click', () => {
      panel.style.opacity = '0';
      panel.style.transform = 'scale(0.8)';
      panel.style.pointerEvents = 'none';
      setTimeout(() => { panel.style.display = 'none'; }, 300);
      toggle.style.display = 'flex';
    });

    toggle.addEventListener('click', () => {
      panel.style.display = 'flex';
      requestAnimationFrame(() => {
        panel.style.opacity = '1';
        panel.style.transform = 'scale(1)';
        panel.style.pointerEvents = 'auto';
      });
      toggle.style.display = 'none';
    });
  }
});

// ─────────────────────────────────────────────
// 1. 기본 씬 구성
// ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0e18);
scene.fog = new THREE.Fog(0x0d0e18, 5, 20);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.45, 1.2);
camera.lookAt(0, 1.45, -0.9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// VR 버튼
const existingVRButton = document.getElementById('VRButton');
if (existingVRButton) existingVRButton.remove();

document.body.appendChild(VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor', 'haptics', 'hand-tracking']
}));

// VR 세션 종료
const exitBtn = document.getElementById('exit-vr-btn');
function exitVR() {
  const session = renderer.xr.getSession();
  if (session) session.end();
}
window.__exitVR = exitVR;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') exitVR();
});

renderer.xr.addEventListener('sessionstart', () => {
  if (exitBtn) exitBtn.style.display = 'block';
});
renderer.xr.addEventListener('sessionend', () => {
  if (exitBtn) exitBtn.style.display = 'none';
});

// ─────────────────────────────────────────────
// 2. 조명 및 공간 그리드
// ─────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x9d4edd, 1.2);
dirLight.position.set(3, 8, 5);
scene.add(dirLight);

const fillLight = new THREE.PointLight(0x00ffcc, 1.8, 10);
fillLight.position.set(0, 0.5, -1);
scene.add(fillLight);

const gridHelper = new THREE.GridHelper(10, 20, 0x9d4edd, 0x1f2438);
scene.add(gridHelper);

// ─────────────────────────────────────────────
// 3. Web Audio API 오디오 햅틱 시너지
// ─────────────────────────────────────────────
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function playHapticAudio(intensity, durationMs) {
  try {
    const ctx = _getAudioCtx();
    const now = ctx.currentTime;
    const dur = Math.max(0.02, durationMs / 1000);
    const vol = Math.max(0.05, Math.min(1.0, intensity));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 * vol + 50, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + dur);

    gain.gain.setValueAtTime(vol * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.start(now);
    osc.stop(now + dur + 0.01);
  } catch (e) {}
}

// ─────────────────────────────────────────────
// 4. Meta .haptic 파일 파서 및 타임라인 생성기
// ─────────────────────────────────────────────
let currentClip = null;
let sampleClip1 = null;
let sampleClip2 = null;

function parseMetaHapticFile(jsonText, fileName = 'custom.haptic') {
  try {
    const json = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    let rawPoints = [];

    // 포맷 1: Meta Haptics Studio 표준 (signals.continuous.envelopes.amplitude)
    if (json?.signals?.continuous?.envelopes?.amplitude) {
      rawPoints = json.signals.continuous.envelopes.amplitude.map(p => ({
        time: p.time,
        amplitude: p.value !== undefined ? p.value : (p.amplitude || 0)
      }));
    }
    // 포맷 2: 포인트 배열 (points: [{time, amplitude}, ...])
    else if (Array.isArray(json?.points)) {
      rawPoints = json.points.map(p => ({
        time: p.time,
        amplitude: p.amplitude !== undefined ? p.amplitude : (p.value || 0)
      }));
    }
    // 포맷 3: 진폭 배열
    else if (Array.isArray(json?.envelopes?.amplitude)) {
      rawPoints = json.envelopes.amplitude.map(p => ({
        time: p.time,
        amplitude: p.value !== undefined ? p.value : (p.amplitude || 0)
      }));
    }

    if (rawPoints.length === 0) {
      throw new Error('.haptic 파싱 실패: 진폭 포동 데이터를 찾을 수 없습니다.');
    }

    // 시간 순 정렬
    rawPoints.sort((a, b) => a.time - b.time);

    const startTime = rawPoints[0].time;
    const endTime = rawPoints[rawPoints.length - 1].time;
    const totalDurationSec = Math.max(0.05, endTime - startTime);

    // 타임라인 시퀀스 생성 (WebXR pulse 연동용)
    const timeline = [];
    for (let i = 0; i < rawPoints.length; i++) {
      const pt = rawPoints[i];
      const nextTime = i < rawPoints.length - 1 ? rawPoints[i + 1].time : pt.time + 0.05;
      const durSec = Math.max(0.02, nextTime - pt.time);
      const delayMs = Math.round((pt.time - startTime) * 1000);
      const durMs = Math.round(durSec * 1000);
      const intensity = Math.max(0.05, Math.min(1.0, pt.amplitude));

      if (intensity > 0.02) {
        timeline.push({ intensity, duration: durMs, delay: delayMs });
      }
    }

    return {
      name: fileName,
      durationSec: totalDurationSec,
      keyframePoints: rawPoints,
      timeline: timeline
    };
  } catch (err) {
    console.error(err);
    alert(`파일 파싱 오류: ${err.message}`);
    return null;
  }
}

let continuousMode = 0; // 0=OFF, 1=고정, 2=변동
let continuousIntensity = 0.25;
let lastContinuousPulseTime = 0;
let currentActiveTransientIntensity = 0;
let transientActiveUntil = 0;

let continuousToggleMesh1 = null;
let continuousToggleMesh2 = null;

function setContinuousHapticMode(mode) {
  if (continuousMode === mode) continuousMode = 0;
  else continuousMode = mode;

  const btn1 = document.getElementById('btn-toggle-continuous-1');
  const btn2 = document.getElementById('btn-toggle-continuous-2');

  if (btn1) {
    btn1.textContent = `⚡ 상시 1: 고정 [${continuousMode === 1 ? 'ON' : 'OFF'}]`;
    btn1.style.background = continuousMode === 1
      ? 'linear-gradient(135deg, #00b4d8, #0077b6)'
      : 'linear-gradient(135deg, #2b1055, #7209b7)';
  }

  if (btn2) {
    btn2.textContent = `🌊 상시 2: 변동 [${continuousMode === 2 ? 'ON' : 'OFF'}]`;
    btn2.style.background = continuousMode === 2
      ? 'linear-gradient(135deg, #ff007f, #b5179e)'
      : 'linear-gradient(135deg, #2b1055, #7209b7)';
  }

  if (continuousToggleMesh1) {
    continuousToggleMesh1.material.emissiveIntensity = continuousMode === 1 ? 1.4 : 0.25;
    continuousToggleMesh1.material.color.setHex(continuousMode === 1 ? 0x00ffcc : 0x7209b7);
    continuousToggleMesh1.material.emissive.setHex(continuousMode === 1 ? 0x00ffcc : 0x7209b7);
  }
  if (continuousToggleMesh2) {
    continuousToggleMesh2.material.emissiveIntensity = continuousMode === 2 ? 1.4 : 0.25;
    continuousToggleMesh2.material.color.setHex(continuousMode === 2 ? 0xff007f : 0x7209b7);
    continuousToggleMesh2.material.emissive.setHex(continuousMode === 2 ? 0xff007f : 0x7209b7);
  }

  const intPct = Math.round(continuousIntensity * 100);
  const modeNames = ['🔴 OFF', `🟢 상시진동1 (고정 ${intPct}%)`, `🌊 상시진동2 (주기적 변동 5%~${Math.round(intPct * 1.5)}%)`][continuousMode];
  logDebug(`🔄 백그라운드 햅틱 상태 -> ${modeNames}\n(.haptic 클립 재생 시 진동 끊김 없는 MAX 중첩 구동)`);
}

function updateContinuousHaptic(timestamp, elapsedTime) {
  if (continuousMode === 0) return;
  const session = renderer.xr.getSession();
  if (!session) return;

  if (timestamp - lastContinuousPulseTime > 120) {
    lastContinuousPulseTime = timestamp;

    let targetIntensity = continuousIntensity;
    if (continuousMode === 2) {
      const wave = 0.5 + 0.5 * Math.sin(elapsedTime * 3.5);
      targetIntensity = Math.max(0.06, continuousIntensity * (0.25 + 1.25 * wave));
    }

    const now = Date.now();
    if (now < transientActiveUntil) {
      targetIntensity = Math.max(targetIntensity, currentActiveTransientIntensity);
    }

    const sources = Array.from(session.inputSources);
    sources.forEach((src) => {
      const gp = src?.gamepad;
      const actuator = gp?.hapticActuators?.[0] || gp?.vibrationActuator;
      if (actuator) {
        try {
          if (typeof actuator.pulse === 'function') {
            actuator.pulse(targetIntensity, 150);
          } else if (typeof actuator.playEffect === 'function') {
            actuator.playEffect('dual-rumble', {
              startDelay: 0,
              duration: 150,
              weakMagnitude: targetIntensity,
              strongMagnitude: targetIntensity
            });
          }
        } catch (e) {}
      }
    });
  }
}

// ─────────────────────────────────────────────
// 5. .haptic 클립 햅틱 재생기 (WebXR 모터 전용)
// ─────────────────────────────────────────────
function playHapticClip(clip, src = null) {
  if (!clip || !clip.timeline || clip.timeline.length === 0) {
    logDebug('⚠️ 재생할 .haptic 클립이 없습니다.');
    return;
  }

  const session = renderer.xr.getSession();
  const sources = session ? Array.from(session.inputSources) : [];
  const targetSource = src || sources[0] || null;
  const gp = targetSource?.gamepad;
  const actuator = gp?.hapticActuators?.[0] || gp?.vibrationActuator;

  clip.timeline.forEach((p) => {
    setTimeout(() => {
      let currentContinuousLevel = 0;
      if (continuousMode === 1) {
        currentContinuousLevel = continuousIntensity;
      } else if (continuousMode === 2) {
        const wave = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3.5);
        currentContinuousLevel = Math.max(0.06, continuousIntensity * (0.25 + 1.25 * wave));
      }

      const superposedIntensity = Math.max(p.intensity, currentContinuousLevel);
      currentActiveTransientIntensity = p.intensity;
      transientActiveUntil = Date.now() + p.duration;

      if (actuator) {
        try {
          if (typeof actuator.pulse === 'function') {
            actuator.pulse(superposedIntensity, p.duration);
          } else if (typeof actuator.playEffect === 'function') {
            actuator.playEffect('dual-rumble', {
              startDelay: 0,
              duration: p.duration,
              weakMagnitude: superposedIntensity,
              strongMagnitude: superposedIntensity
            });
          }
        } catch (e) {}
      }
      playHapticAudio(superposedIntensity, p.duration);
    }, p.delay);
  });

  const modeMsg = actuator ? '모터+오디오 시너지' : '오디오 대체';
  const contStatus = continuousMode > 0 ? ' [상시진동 멈춤 없이 100% 심리스 중첩]' : '';
  logDebug(`⚡ [.haptic 재생] ${clip.name}\n(지속시간 ${clip.durationSec.toFixed(2)}초, 키프레임 ${clip.keyframePoints.length}개, ${modeMsg})${contStatus}`);
  animateWaveformPulse();
}

// ─────────────────────────────────────────────
// 🎯 [사용자 설정] 테스트할 .haptic 파일 목록
// 새로운 파일을 폴더에 추가할 때마다 아래 배열에 파일 이름만 등록하면
// 3D VR 공간 오브젝트와 PC 대시보드 버튼이 자동으로 생성됩니다!
// ─────────────────────────────────────────────
export const HAPTIC_FILES = [
  '1_metal_grinder.haptic',
  '2_jackhammer_concrete.haptic',
  '3_pneumatic_riveter.haptic',
  '4_hydraulic_press.haptic',
  '5_heavy_diesel_engine.haptic',
  '6_electric_arc_welder.haptic',
  '7_industrial_conveyor.haptic',
  '8_emergency_siren_alarm.haptic'
];

const PRESET_COLOR_PALETTE = [
  0x00b4d8, // 1번: 청록 (Cyan)
  0x9d4edd, // 2번: 보라 (Purple)
  0xff3300, // 3번: 다홍 (Orange Red)
  0xffdd00, // 4번: 골드 (Gold Yellow)
  0x00e676, // 5번: 네온 라임 (Neon Green)
  0xff007f  // 6번: 핫핑크 (Hot Pink)
];

const loadedClips = {};
const interactableMeshes = [];
const allInteractables = [];

// HAPTIC_FILES 기반 3D 씬 구(Sphere) 및 2D 대시보드 버튼 동적 자동 세팅 (2단 선반 모드 지원)
function initDynamicHapticPipeline() {
  const container = document.getElementById('dynamic-buttons-container');
  const count = HAPTIC_FILES.length;

  // 2단 선반 가로 최대 개수: 한 줄당 8개까지 배치 후 다음 줄(2단)로 층 쌓기
  const maxPerRow = 8;
  const stepX = 0.45;

  HAPTIC_FILES.forEach((fileName, idx) => {
    const color = PRESET_COLOR_PALETTE[idx % PRESET_COLOR_PALETTE.length];

    // 1) 3D VR 2단 선반 좌표 계산
    const rowIndex = Math.floor(idx / maxPerRow); // 0=1단(하단), 1=2단(상단), 2=3단...
    const colIndex = idx % maxPerRow;
    const itemsInThisRow = Math.min(maxPerRow, count - rowIndex * maxPerRow);
    const startX = -((itemsInThisRow - 1) * stepX) / 2;
    const posX = startX + colIndex * stepX;
    const baseY = 1.30 + rowIndex * 0.46; // 1단: 1.30m, 2단: 1.76m, 3단: 2.22m

    const geo = new THREE.SphereGeometry(0.18, 32, 32);
    const mat = new THREE.MeshPhysicalMaterial({
      color: color, emissive: color, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.3, clearcoat: 1.0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, baseY, -0.9);
    mesh.userData = { type: 'dynamic_haptic_asset', fileName: fileName, color: color, baseY: baseY };
    scene.add(mesh);
    allInteractables.push(mesh);
    interactableMeshes.push(mesh);

    // 스탠드 기둥 높이를 층 높이에 맞춰 동적 설정
    const poleGeo = new THREE.CylinderGeometry(0.005, 0.005, baseY, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(posX, baseY / 2, -0.9);
    scene.add(pole);

    // 2) 2D PC 대시보드 버튼 동적 추가
    if (container) {
      const btn = document.createElement('button');
      btn.className = 'btn-play';
      btn.style.background = `linear-gradient(135deg, #${color.toString(16).padStart(6, '0')}, #111)`;
      btn.style.color = '#fff';
      btn.style.boxShadow = `0 4px 15px rgba(0,0,0,0.3)`;
      btn.textContent = `🎯 [오브젝트 ${idx + 1}] ${fileName}`;
      btn.addEventListener('click', () => {
        if (loadedClips[fileName]) {
          currentClip = loadedClips[fileName];
          updateFileCardUI(currentClip);
          playHapticClip(loadedClips[fileName]);
        }
      });
      container.appendChild(btn);
    }

    // 3) .haptic 파일 비동기 fetch 로드 (haptics/ 상대 폴더 경로 적용)
    fetch(`./haptics/${fileName}`)
      .then(res => res.text())
      .then(text => {
        const clip = parseMetaHapticFile(text, fileName);
        if (clip) {
          loadedClips[fileName] = clip;
          if (idx === 0 && !currentClip) {
            currentClip = clip;
            updateFileCardUI(currentClip);
          }
          logDebug(`🎯 [로드완료] 오브젝트 ${idx + 1}: ${fileName}\n(지속시간 ${clip.durationSec.toFixed(2)}초, 키프레임 ${clip.keyframePoints.length}개)`);
        }
      })
      .catch((e) => console.log(`${fileName} 로드 실패:`, e));
  });

  // 4) 3D VR 공간 상시진동 전용 제어 콘솔 (2단 선반 우측에 안전 독립 배치)
  const maxRowItems = Math.min(count, maxPerRow);
  const maxRowWidth = (maxRowItems - 1) * stepX;
  const consoleX = Math.max(1.3, (maxRowWidth / 2) + 0.60);

  // 상시진동 스탠드 기둥 & 백판 (독립된 제어 콘솔 느낌 부여)
  const consoleStandGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.45, 12);
  const consoleStandMat = new THREE.MeshStandardMaterial({ color: 0x7209b7, metalness: 0.8, roughness: 0.2 });
  const consoleStand = new THREE.Mesh(consoleStandGeo, consoleStandMat);
  consoleStand.position.set(consoleX, 0.725, -0.85);
  scene.add(consoleStand);

  const panelBoardGeo = new THREE.BoxGeometry(0.36, 0.55, 0.02);
  const panelBoardMat = new THREE.MeshPhysicalMaterial({
    color: 0x140b24, emissive: 0x7209b7, emissiveIntensity: 0.2, roughness: 0.1, transmission: 0.6, transparent: true, opacity: 0.9
  });
  const panelBoard = new THREE.Mesh(panelBoardGeo, panelBoardMat);
  panelBoard.position.set(consoleX, 1.3, -0.87);
  scene.add(panelBoard);

  // 상시진동 1 스위치 (원기둥 보석 형태)
  const cylGeoC1 = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16);
  const matC1 = new THREE.MeshStandardMaterial({
    color: 0x7209b7, emissive: 0x7209b7, emissiveIntensity: 0.3, roughness: 0.2
  });
  continuousToggleMesh1 = new THREE.Mesh(cylGeoC1, matC1);
  continuousToggleMesh1.position.set(consoleX, 1.45, -0.85);
  continuousToggleMesh1.userData = { type: 'continuous_toggle_1', label: '⚡ 상시진동 1 스위치' };
  scene.add(continuousToggleMesh1);
  allInteractables.push(continuousToggleMesh1);

  // 상시진동 2 스위치 (다이아몬드/옥타헤드론 보석 형태)
  const octGeoC2 = new THREE.OctahedronGeometry(0.09, 0);
  const matC2 = new THREE.MeshStandardMaterial({
    color: 0x7209b7, emissive: 0x7209b7, emissiveIntensity: 0.3, roughness: 0.2
  });
  continuousToggleMesh2 = new THREE.Mesh(octGeoC2, matC2);
  continuousToggleMesh2.position.set(consoleX, 1.15, -0.85);
  continuousToggleMesh2.userData = { type: 'continuous_toggle_2', label: '🌊 상시진동 2 스위치' };
  scene.add(continuousToggleMesh2);
  allInteractables.push(continuousToggleMesh2);
}

initDynamicHapticPipeline();

// ─────────────────────────────────────────────
// 7. VR 컨트롤러 설정
// ─────────────────────────────────────────────
const controllerModelFactory = new XRControllerModelFactory();

function buildController(index) {
  const controller = renderer.xr.getController(index);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x9d4edd, transparent: true, opacity: 0.7 });
  const line = new THREE.Line(lineGeo, lineMat);
  line.name = 'pointer';
  line.scale.z = 0.5;
  controller.add(line);
  scene.add(controller);

  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  return controller;
}

const controller0 = buildController(0);
const controller1 = buildController(1);

// ─────────────────────────────────────────────
// 8. 3D 공간 디버그 전광판
// ─────────────────────────────────────────────
const debugCanvas = document.createElement('canvas');
debugCanvas.width = 1024;
debugCanvas.height = 512;
const debugCtx = debugCanvas.getContext('2d');
const debugTexture = new THREE.CanvasTexture(debugCanvas);

const debugMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1.4, 0.7),
  new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true, side: THREE.DoubleSide })
);
debugMesh.position.set(0, 2.35, -1.2);
scene.add(debugMesh);

function logDebug(msg) {
  debugCtx.fillStyle = 'rgba(10, 12, 22, 0.92)';
  debugCtx.fillRect(0, 0, 1024, 512);
  debugCtx.strokeStyle = '#9d4edd';
  debugCtx.lineWidth = 6;
  debugCtx.strokeRect(10, 10, 1004, 492);

  debugCtx.fillStyle = '#9d4edd';
  debugCtx.font = 'Bold 28px sans-serif';
  debugCtx.fillText('🥽 Meta .haptic WebXR File Player', 30, 50);

  debugCtx.fillStyle = '#ffffff';
  debugCtx.font = '20px monospace';
  const lines = msg.split('\n');
  lines.forEach((line, i) => {
    debugCtx.fillText(line, 30, 95 + i * 32);
  });
  debugTexture.needsUpdate = true;
}

// ─────────────────────────────────────────────
// 9. WebXR 세션 selectstart 핸들러
// ─────────────────────────────────────────────
renderer.xr.addEventListener('sessionstart', () => {
  const session = renderer.xr.getSession();
  if (!session) return;

  session.addEventListener('selectstart', (xrEvent) => {
    const src = xrEvent.inputSource;
    const sources = Array.from(session.inputSources);
    const ctrlIdx = sources.indexOf(src);
    const effectiveIdx = ctrlIdx >= 0 ? ctrlIdx : (src.handedness === 'right' ? 1 : 0);

    const mesh = hoveredMesh[effectiveIdx];
    if (mesh) {
      if (mesh.userData.type === 'continuous_toggle_1') {
        setContinuousHapticMode(1);
        mesh.material.emissiveIntensity = 1.8;
        setTimeout(() => { mesh.material.emissiveIntensity = continuousMode === 1 ? 1.4 : 0.25; }, 200);
        return;
      }
      if (mesh.userData.type === 'continuous_toggle_2') {
        setContinuousHapticMode(2);
        mesh.material.emissiveIntensity = 1.8;
        setTimeout(() => { mesh.material.emissiveIntensity = continuousMode === 2 ? 1.4 : 0.25; }, 200);
        return;
      }
      if (mesh.userData.fileName && loadedClips[mesh.userData.fileName]) {
        const clip = loadedClips[mesh.userData.fileName];
        currentClip = clip;
        updateFileCardUI(currentClip);
        playHapticClip(clip, src);

        mesh.material.emissiveIntensity = 1.8;
        setTimeout(() => { mesh.material.emissiveIntensity = 0.4; }, 200);
      }
    }
  });

  const granted = session.enabledFeatures ? JSON.stringify([...session.enabledFeatures]) : '조회 불가';
  logDebug(`🟢 VR 세션 시작!\nGranted features: ${granted}\n\n오브젝트 구 또는 좌측 상시진동 스위치 큐브를 터치하세요!`);
});

// ─────────────────────────────────────────────
// 10. 2D 파형 Canvas 렌더러 & UI 바인딩
// ─────────────────────────────────────────────
const waveCanvas = document.getElementById('waveform-canvas');
const waveCtx = waveCanvas.getContext('2d');
let waveAnimProgress = 1.0;

function drawWaveform() {
  const w = waveCanvas.width;
  const h = waveCanvas.height;

  waveCtx.clearRect(0, 0, w, h);

  waveCtx.strokeStyle = 'rgba(0, 180, 216, 0.15)';
  waveCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 20) {
    waveCtx.beginPath(); waveCtx.moveTo(x, 0); waveCtx.lineTo(x, h); waveCtx.stroke();
  }
  for (let y = 0; y < h; y += 20) {
    waveCtx.beginPath(); waveCtx.moveTo(0, y); waveCtx.lineTo(w, y); waveCtx.stroke();
  }

  if (!currentClip || !currentClip.keyframePoints || currentClip.keyframePoints.length === 0) return;

  const pts = currentClip.keyframePoints;
  const totalDur = currentClip.durationSec;

  waveCtx.beginPath();
  waveCtx.strokeStyle = waveAnimProgress < 1.0 ? '#ff007f' : '#00b4d8';
  waveCtx.lineWidth = 3;
  waveCtx.shadowColor = waveAnimProgress < 1.0 ? '#ff007f' : '#00b4d8';
  waveCtx.shadowBlur = 8;

  pts.forEach((pt, i) => {
    const x = (pt.time / totalDur) * (w - 20) + 10;
    const y = h - (pt.amplitude * (h - 20) + 10);
    if (i === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
  });

  waveCtx.stroke();
  waveCtx.shadowBlur = 0;
}

function animateWaveformPulse() {
  waveAnimProgress = 0;
  const anim = () => {
    waveAnimProgress += 0.08;
    drawWaveform();
    if (waveAnimProgress < 1.0) requestAnimationFrame(anim);
  };
  anim();
}

function updateFileCardUI(clip) {
  if (!clip) return;
  const lblName = document.getElementById('lbl-filename');
  const lblMeta = document.getElementById('lbl-filemeta');

  if (lblName) lblName.textContent = `📁 ${clip.name}`;
  if (lblMeta) lblMeta.textContent = `키프레임 ${clip.keyframePoints.length}개 \| 지속시간 ${clip.durationSec.toFixed(2)}초 \| Meta Studio Format`;

  drawWaveform();
}

// 파일 업로드 및 드롭존 핸들러
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');

if (dropzone && fileInput) {
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });
}

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target.result;
    const parsed = parseMetaHapticFile(text, file.name);
    if (parsed) {
      currentClip = parsed;
      updateFileCardUI(currentClip);
      logDebug(`📁 새로운 .haptic 파일 로드 완료:\n${file.name} (${parsed.durationSec.toFixed(2)}초, ${parsed.keyframePoints.length}개 키프레임)`);
    }
  };
  reader.readAsText(file);
}

document.getElementById('btn-play-current')?.addEventListener('click', () => {
  playHapticClip(currentClip);
});

// PC 2D 상시진동 토글 및 슬라이더 이벤트
const btnToggleContinuous1 = document.getElementById('btn-toggle-continuous-1');
const btnToggleContinuous2 = document.getElementById('btn-toggle-continuous-2');
const sliderContinuousIntensity = document.getElementById('slider-continuous-intensity');
const valContinuousIntensity = document.getElementById('val-continuous-intensity');

if (btnToggleContinuous1) {
  btnToggleContinuous1.addEventListener('click', () => setContinuousHapticMode(1));
}
if (btnToggleContinuous2) {
  btnToggleContinuous2.addEventListener('click', () => setContinuousHapticMode(2));
}
if (sliderContinuousIntensity) {
  sliderContinuousIntensity.addEventListener('input', (e) => {
    continuousIntensity = parseInt(e.target.value) / 100;
    if (valContinuousIntensity) valContinuousIntensity.textContent = `${parseInt(e.target.value)}%`;
  });
}

// ─────────────────────────────────────────────
// 11. 레이캐스팅 & 근접 터치
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
const hoveredMesh = [null, null];

function getIntersectedMesh(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const hits = raycaster.intersectObjects(allInteractables);
  return hits.length > 0 ? hits[0].object : null;
}

function updateHover(controller, controllerIndex) {
  const hit = getIntersectedMesh(controller);

  if (hoveredMesh[controllerIndex] && hoveredMesh[controllerIndex] !== hit) {
    hoveredMesh[controllerIndex].material.emissiveIntensity = 0.4;
  }

  hoveredMesh[controllerIndex] = hit;
  if (hit) {
    hit.material.emissiveIntensity = 0.95;
    controller.getObjectByName('pointer').scale.z = 1.5;
  } else {
    controller.getObjectByName('pointer').scale.z = 0.5;
  }
}

const HAPTIC_TOUCH_COOLDOWN_MS = 600;
const touchCooldownMap = {};
const ctrlPos = new THREE.Vector3();
const objPos = new THREE.Vector3();

function checkProximityTouch(controller, controllerIndex) {
  controller.getWorldPosition(ctrlPos);
  const session = renderer.xr.getSession();
  const sources = session ? Array.from(session.inputSources) : [];
  const src = sources[controllerIndex] || sources[0];

  allInteractables.forEach((mesh, meshIndex) => {
    mesh.getWorldPosition(objPos);
    const dist = ctrlPos.distanceTo(objPos);
    const hitThreshold = 0.22;
    const key = `${controllerIndex}_${meshIndex}`;

    if (dist < hitThreshold) {
      const now = Date.now();
      if (!touchCooldownMap[key] || now - touchCooldownMap[key] > HAPTIC_TOUCH_COOLDOWN_MS) {
        touchCooldownMap[key] = now;

        if (mesh.userData.type === 'continuous_toggle_1') {
          setContinuousHapticMode(1);
          mesh.material.emissiveIntensity = 1.8;
          setTimeout(() => { mesh.material.emissiveIntensity = continuousMode === 1 ? 1.4 : 0.25; }, 200);
          return;
        }
        if (mesh.userData.type === 'continuous_toggle_2') {
          setContinuousHapticMode(2);
          mesh.material.emissiveIntensity = 1.8;
          setTimeout(() => { mesh.material.emissiveIntensity = continuousMode === 2 ? 1.4 : 0.25; }, 200);
          return;
        }

        if (mesh.userData.fileName && loadedClips[mesh.userData.fileName]) {
          const clip = loadedClips[mesh.userData.fileName];
          currentClip = clip;
          updateFileCardUI(currentClip);
          playHapticClip(clip, src);
        }

        mesh.material.emissiveIntensity = 1.6;
        setTimeout(() => { mesh.material.emissiveIntensity = 0.4; }, 180);
      }
    }
  });
}

// ─────────────────────────────────────────────
// 12. 최적화된 90FPS 애니메이션 루프
// ─────────────────────────────────────────────
const clock = new THREE.Clock();

renderer.setAnimationLoop((time) => {
  const t = clock.getElapsedTime();

  interactableMeshes.forEach((mesh, idx) => {
    const baseY = mesh.userData.baseY || 1.45;
    mesh.position.y = baseY + Math.sin(t * 1.2 + idx * 1.0) * 0.04;
    mesh.rotation.y = t * 0.4 + idx * 0.5;
  });

  if (continuousToggleMesh1) {
    continuousToggleMesh1.rotation.y = t * 0.6;
  }
  if (continuousToggleMesh2) {
    continuousToggleMesh2.rotation.y = t * 0.6;
    if (continuousMode === 2) {
      const pulseScale = 1.0 + 0.2 * Math.sin(t * 3.5);
      continuousToggleMesh2.scale.set(pulseScale, pulseScale, pulseScale);
    } else {
      continuousToggleMesh2.scale.set(1, 1, 1);
    }
  }

  if (renderer.xr.getSession()) {
    updateHover(controller0, 0);
    updateHover(controller1, 1);
    checkProximityTouch(controller0, 0);
    checkProximityTouch(controller1, 1);
    updateContinuousHaptic(time, t);
  }

  renderer.render(scene, camera);
});

// ─────────────────────────────────────────────
// 13. 리사이즈 대응
// ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─────────────────────────────────────────────
// 🤖 14. AI 실시간 햅틱 소켓 수신기 (Real-time Live Haptic Stream)
// ─────────────────────────────────────────────
if (import.meta.hot) {
  import.meta.hot.on('ai-live-haptic', (data) => {
    const fileName = data.name || 'ai_live_waveform.haptic';
    logDebug(`🤖 [AI 실시간 햅틱 수신] ${fileName}\n(0.05초 만에 퀘스트 3 컨트롤러로 즉시 전송됨!)`);
    
    const clipString = typeof data.content === 'string' ? data.content : JSON.stringify(data.content || data);
    const clip = parseMetaHapticFile(clipString, fileName);
    if (clip) {
      currentClip = clip;
      updateFileCardUI(currentClip);
      playHapticClip(clip);
    }
  });
}

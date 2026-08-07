# Haptic File Player

WebXR 및 웹 환경에서 커스텀 햅틱 진동 패턴(.haptic)을 재생하고 테스트할 수 있는 웹 기반 햅틱 플레이어 프로젝트입니다.

---

## 데모 웹사이트 (다운로드 없이 즉시 실행)

Meta Quest 전용 브라우저, 스마트폰, 또는 PC 웹 브라우저에서 아래 주소로 접속하시면 별도의 다운로드나 설치 없이 즉시 WebXR 햅틱 플레이어를 테스트하실 수 있습니다.

[https://kimhohyeon0324.github.io/Haptic_test/](https://kimhohyeon0324.github.io/Haptic_test/)

*(※ WebXR 햅틱 기능은 보안 규정상 HTTPS 주소인 위 데모 링크에서 정상 작동합니다.)*

---

## 주요 기능 (Features)

* Meta Quest WebXR 지원: Quest 2/3 전용 컨트롤러 진동 모터 및 Web Audio 햅틱 시너지 재생
* 2D 파형 실시간 시각화: 진폭(Amplitude)과 시간 축을 실시간 파형 그래프로 시각화
* 커스텀 파일 드래그 앤 드롭: Meta Haptics Studio 등에서 제작한 사용자 정의 .haptic 파일 즉시 로드 및 테스트
* 백그라운드 상시 진동 중첩 모드: 고정/변동 상시 진동과 과도기 효과 진동의 심리스 중첩 레이어링
* 3D VR 공간 오브젝트 상호작용: 3D 공간 상에서 컨트롤러 레이캐스팅 및 근접 터치로 햅틱 재생

---

## 프로젝트 구성

본 프로젝트에는 플레이어 화면과 다음과 같은 8가지 산업용/알람 햅틱 진동 패턴 파일이 포함되어 있습니다.

1. `1_metal_grinder.haptic` (금속 그라인더 작업 진동)
2. `2_jackhammer_concrete.haptic` (콘크리트 착암기 진동)
3. `3_pneumatic_riveter.haptic` (공압 리베터 진동)
4. `4_hydraulic_press.haptic` (유압 프레스 진동)
5. `5_heavy_diesel_engine.haptic` (대형 디젤 엔진 진동)
6. `6_electric_arc_welder.haptic` (전기 아크 용접기 진동)
7. `7_industrial_conveyor.haptic` (산업용 컨베이어 진동)
8. `8_emergency_siren_alarm.haptic` (비상 사이렌 알람 진동)

---

## 기술 스택 (Tech Stack)

* Three.js (3D Graphics & WebXR Rendering)
* WebXR Device API (Haptics Actuator & Controller Tracking)
* Web Audio API (Haptic Audio Synergy)
* Vite (Frontend Build Tool)

---

## 로컬 개발 및 수정 방법 (Getting Started)

직접 코드를 수정하거나 로컬 환경에서 개발하고 싶은 경우의 실행 순서입니다.

### 1. 프로젝트 다운로드 (Clone)
```bash
git clone https://github.com/kimhohyeon0324/Haptic_test.git
cd Haptic_test
```

### 2. 필요한 라이브러리 설치 (Install)
```bash
npm install
```

### 3. 플레이어 실행 (Run)
```bash
npm run dev
```

# 안음 — 자동 안부 확인 시험 앱

부모님이 처음 한 번 동의·설정한 뒤, 휴대폰이 수집한 활동 신호를 가족 확인 화면에 보내는 기술 검증용 프로젝트입니다. **완성된 안부 서비스나 설치가 검증된 앱이 아닙니다.**

## 지금 실행할 수 있는 것

- 가족 확인 화면: 실제 수집 데이터만 표시하며, 데이터가 없으면 연결 대기 표시
- 수집 서버: 휴대폰 등록, 개별 연결 키 발급, 기록 수신, 연결 해제·기록 삭제
- 상태 판정: 연결 대기 / 활동 확인 / 활동 미확인 / 권한 확인 필요 / 측정 불가 / 갱신 지연
- Android 소스: 사용정보 권한으로 오늘 다른 앱이 화면 앞으로 나온 이벤트 수를 집계하고 WorkManager로 주기 전송 요청
- iOS 소스: Core Motion 걸음 합계를 조회하고 BGAppRefreshTask로 자동 전송 요청

**미포함:** 통화·문자 횟수, iPhone 잠금 해제 감지, 개인별 패턴 학습, 자녀 휴대폰 푸시 알림, 응급 감지. 현재 서버는 최신 측정 1건만 보관합니다. 화면의 갱신 지연 기준 90분은 실험용 고정값이며 개인별 평소 패턴이 아닙니다.

**웹 확인 화면:** https://aneum.vercel.app

Vercel에 배포했습니다. 가상 가족 데이터는 제거했습니다. 저장소 설정 전에는 연결 대기 상태로 열립니다. 실제 기기 연결을 위한 서버 환경변수와 설정은 [VERCEL.md](VERCEL.md)를 참고하세요.

기존 Supabase `aneum` 프로젝트에 연결했습니다. 실제 등록·저장·조회·삭제를 검증했고 시험 기록은 삭제했습니다. 연결 구조와 서버 설정은 [SUPABASE.md](SUPABASE.md)에 정리했습니다. 휴대폰 앱 설치와 자동 수집 검증은 별도로 필요합니다.

## 확인 화면 실행

Node.js 20 이상이 필요합니다. 별도 npm 패키지 설치는 필요 없습니다.

Windows에서는 압축을 푼 뒤 `START.cmd`를 더블클릭해 확인 화면을 열 수 있습니다. 실제 연결에 사용할 관리자 키는 별도로 열린 서버 실행 창에 표시됩니다. 서버 창을 닫으면 서버도 종료됩니다. 이미 시험 서버가 실행 중이면 기존 서버를 사용하세요.

```powershell
cd "안음 프로젝트 폴더"
npm start
```

브라우저에서 http://127.0.0.1:8787 을 엽니다. 실행 창의 **관리자 연결 키**를 아래 연결 입력란에 입력합니다. 실제 기기에서 받은 기록만 표시하며 가상 값으로 대체하지 않습니다.

1. 관리자 연결 키로 확인 화면을 연결합니다.
2. 부모님 호칭과 기종을 선택해 휴대폰 연결 키를 만듭니다.
3. 해당 휴대폰 앱에 서버 주소와 **휴대폰 연결 키**를 입력합니다. 관리자 키를 넣으면 안 됩니다.
4. 부모님이 수집·전송에 동의하고 권한을 허용합니다.
5. 최초 전송과 이후 자동 전송을 별도로 확인합니다.

키는 실제 연결 권한입니다. 가족 연결 키는 생성 직후 한 번만 표시됩니다. 분실하면 해당 연결을 삭제한 뒤 새로 등록하세요. 관리자 키는 `data/admin-token`, 최신 데이터는 `data/devices.json`에 저장됩니다. 데이터 폴더를 공유하거나 공개 저장소에 올리지 마세요. 관리자 키는 현재 브라우저 탭 세션에 저장됩니다.

## 갤럭시 설치 시험

필요: Android Studio, Android SDK 35, JDK 17, Gradle 8.9. 이 프로젝트에는 Gradle wrapper 바이너리가 포함되어 있지 않습니다. 설치된 Gradle 8.9로 아래 명령을 실행하거나 Android Studio에서 Gradle 8.9를 지정하세요.

```powershell
cd android
gradle wrapper --gradle-version 8.9
.\gradlew.bat assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8787 tcp:8787
```

USB 디버깅을 허용한 시험 휴대폰에서 앱을 엽니다. 서버 주소는 `http://127.0.0.1:8787`입니다. 사용정보 접근 허용 → 연결 키 입력 → 동의하고 자동 수집 시작 순서입니다. USB 연결이나 adb reverse가 끊기면 이 로컬 시험 서버에 전송할 수 없습니다. 앱을 열지 않아도 자동 작업을 요청하지만 절전·강제 중지·권한 해제로 작업이 지연되거나 중단될 수 있습니다.

집계 단위는 ‘다른 앱의 foreground 전환 이벤트’입니다. 통화 횟수, 잠금 해제 횟수, 서로 다른 앱 수가 아닙니다. 앱 이름·통화 상대방·문자 내용은 전송하지 않습니다. 사용정보 접근 권한 자체는 기기 내 앱 사용 이력을 조회할 수 있는 권한임을 최초 동의 화면에서 설명합니다.

## 아이폰 설치 시험

필요: Mac, Xcode, XcodeGen, Apple 개발 서명. Windows에서는 iOS 빌드·설치가 불가능합니다.

프로젝트를 Mac으로 옮겨 같은 Mac에서 Node 서버를 실행합니다.

```bash
cd ios
xcodegen generate
open AneumPilot.xcodeproj
```

Signing & Capabilities에서 본인의 개발 팀과 고유한 Bundle Identifier를 설정하고 실행합니다. 번들 ID를 변경하더라도 백그라운드 작업 식별자 `kr.aneum.pilot.refresh`는 소스와 plist에서 동일하게 유지하세요. iOS 시뮬레이터에서는 `http://localhost:8787`로 Mac 서버에 연결할 수 있지만 걸음 센서는 지원되지 않을 수 있으므로 실제 수집 검증은 실기기가 필요합니다.

실제 iPhone은 이 컴퓨터의 localhost에 연결할 수 없습니다. 원격 실기기 시험은 별도의 HTTPS 서버·인증·운영 설정이 추가로 필요하며 이 프로젝트에서는 배포하지 않았습니다. 현재 수집 서버는 의도적으로 로컬 주소에서만 수신하며 다른 Host/Origin을 거부합니다. 단순히 서버 주소만 바꾸면 원격 서비스가 되지 않습니다.

아이폰은 오늘 걸음 합계를 보냅니다. 측정 범위 끝 시각은 ‘마지막으로 걸은 시각’이 아닙니다. 휴대폰을 두고 움직이면 활동이 잡히지 않으므로 걸음 0을 위험으로 판단하지 않습니다. BGAppRefreshTask는 15분 이후 실행을 요청할 뿐 실제 실행 시점을 보장하지 않습니다. 시뮬레이터에서 강제로 백그라운드 작업을 실행한 성공도 실기기에서 매일 자동 전송된다는 증거는 아닙니다.

## 중지와 삭제

부모님 앱의 ‘동의 철회 · 수집 중지’는 이후 수집 예약과 저장된 연결 정보를 지웁니다. 이미 서버에 도착한 데이터와 전송 중인 요청은 소급 취소할 수 없습니다. 확인 화면에서 ‘연결 해제 및 기록 삭제’를 누르면 서버의 해당 최신 기록과 인증 키 해시를 삭제하고 이후 전송도 거부합니다.

## 검증

```powershell
npm test
```

자동 테스트는 상태 판정과 서버 등록·인증·전송·삭제를 검사합니다. 모바일 소스는 Android SDK/Xcode가 없는 제작 환경에서 컴파일하지 못했습니다. APK/IPA는 포함하지 않습니다. 구체적인 실기기 검증 순서는 `DEVICE-TEST.md`를 참고하세요.

## 공식 기술 근거

- [Android UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager)
- [Android WorkManager 주기 작업](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)
- [Android Gradle Plugin 8.7 호환성: Gradle 8.9 / JDK 17 / API 35](https://developer.android.com/build/releases/agp-8-7-0-release-notes)
- [Apple CMPedometer](https://developer.apple.com/documentation/coremotion/cmpedometer)
- [Apple 백그라운드 실행 전략](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app)

기준일: 2026-10-26. 공식 문서 확인과 실제 기기에서의 검증은 서로 다릅니다.

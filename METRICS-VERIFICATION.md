# 요청한 세 항목의 수집 검증 — 2026-10-28

## 결론과 현재 범위

| 요구 | 갤럭시(Android 9 이상) | 아이폰 일반 배포 앱 |
|---|---|---|
| 아침 언제 휴대폰을 켰나 | 사용정보 접근 허용 시 오늘 첫 `SCREEN_INTERACTIVE` 시각과 첫 `KEYGUARD_HIDDEN` 시각을 각각 조회하는 시험 구현 | 요청한 시각의 원격 자동 수집 경로 미확보 |
| 하루 몇 번 사용했나 | 화면 켜짐 횟수와 잠금 해제 횟수를 따로 집계하는 시험 구현 | 요청한 횟수의 원격 자동 수집 경로 미확보 |
| 전화 몇 번 했나 | 별도 `callTrial` 빌드에서 통화기록 권한이 허용될 때 수신·발신·부재중을 각각 집계하는 시험 구현 | 일반 API 경로 미확보. SensorKit 연구 승인 경로는 별도 검토 대상 |

문서 확인·소스 구현과 실제 휴대폰 검증은 다릅니다. 기종별 실기기 시험은 아직 하지 않았습니다. Android 두 빌드는 컴파일 및 집계 단위 테스트를 통과했고 설치용 APK를 생성했습니다.

### 완료한 검증

- Android 빌드 기준 커밋: `97708cbcf20ec68e91babe06016d0ca6f6248871`
- [두 빌드·단위 테스트 성공 기록](https://github.com/cjw25/aneum/actions/runs/40651770745)
- 일반 빌드 Manifest에 `READ_CALL_LOG`가 없고 통화 시험 빌드에만 있는 것을 APK에서 확인
- 서버·화면 처리 자동 테스트 33개 통과
- 운영 Supabase/Vercel에서 새 지표 저장·조회 및 권한 미허용/null, 아이폰 unsupported 상태 검증 후 시험 기록 삭제
- 운영 브라우저에서 실제 키 인증·기기 등록·발급·삭제와 모바일 화면 검증 통과
- 실기기 화면·잠금 해제·전화 대조 및 장시간 자동 전송 검증: 아직 미실시

## 측정의 정확한 의미

- 시간 범위: 한국 시간 당일 00:00부터 측정 시각까지. 새벽 사용도 포함하며 사용자가 깨어난 시각이나 전원 부팅 시각을 뜻하지 않습니다.
- 첫 화면 켜짐: `SCREEN_INTERACTIVE` 이벤트. 알림·전화 등으로 화면이 켜질 수도 있으므로 본인의 조작을 확정하지 않습니다. AOD/수동 밝기 표시와 동일한 정의가 아닙니다.
- 첫 잠금 해제: `KEYGUARD_HIDDEN` 이벤트. Android 문서는 일반적으로 화면을 켠 뒤 잠금을 해제할 때 발생한다고 설명합니다. 잠금 설정이 없는 기기에서는 유용한 기록이 없을 수 있습니다.
- 사용 횟수: 앱 화면 전환 횟수 대신 화면 켜짐·잠금 해제 각각의 상태 전환 횟수를 셉니다. 같은 상태의 연속 중복 이벤트는 한 번만 셉니다.
- 받은 전화: `INCOMING_TYPE`(수신해 응답한 기록), 건 전화: `OUTGOING_TYPE`(발신 기록이며 연결되지 않은 시도도 포함할 수 있음), 부재중: `MISSED_TYPE`으로 따로 표시합니다.
- 전화번호·이름·통화 내용은 조회·전송하지 않습니다. 통화 조회 projection은 `TYPE` 한 열이고 날짜는 기기 내 필터로만 사용합니다. 다른 앱의 인터넷 전화가 모두 포함된다고 보장하지 않습니다.
- 첫 활동 시각과 서버 수신 시각은 다릅니다. WorkManager 전송은 지연될 수 있으며 오전 특정 시간까지 도착함을 보장하지 않습니다.

## Android 두 빌드

- `usageDebug`: 화면·잠금 해제 수집. 통화기록 권한이 Manifest에 없습니다. 통화 횟수는 ‘이 빌드에서 미수집’으로 표시합니다.
- `callTrialDebug`: 위 기능 + 선택적 `READ_CALL_LOG` 요청. 직접 설치하는 동의된 실기기 검증용이며 Google Play 승인을 받은 빌드가 아닙니다.

`READ_CALL_LOG`는 Android에서 제한되는 권한이며 OS 버전·설치 경로·기기 정책에 따라 허용되지 않을 수 있습니다. 사용자 동의만으로 Play 배포 자격이 생기지는 않습니다. Google Play는 기본 전화 앱 등의 허용 목적과 예외를 심사합니다. ‘안전 확인 앱이니까 통화기록도 자동 허용된다’고 가정하지 않습니다. 설치자가 권한을 허용하지 않으면 앱은 ‘권한 미허용’으로 전송합니다. 역할을 속이거나 제한을 우회하는 기능은 없습니다.

## 아이폰에서 확인한 제한

Screen Time의 DeviceActivityReport는 사용 보고서를 보여줄 수 있지만, Apple은 보고서 확장의 네트워크 요청 및 민감한 데이터의 확장 외부 이동을 막는다고 명시합니다. 따라서 보고서에 데이터가 있다는 이유로 자녀의 원격 화면으로 자동 전송할 수 있다고 결론내리지 않습니다.

SensorKit은 device-usage·phone-usage 등 데이터를 다루지만 Apple의 사전 승인된 연구와 별도 entitlement가 필요합니다. 일반 상용 안부 앱이 바로 사용할 수 있는 권한이 아닙니다. 이번 시험에서 Apple 연구 승인을 신청하거나 받은 것은 아닙니다.

아이폰 소스의 걸음 수 수집을 제거했습니다. 아이폰은 요청한 항목에 ‘지원 안 됨’을 명시하며 연결 상태만 전송합니다. 걸음 기록이나 앱 접속 기록을 원래 요구한 지표로 바꾸어 표시하지 않습니다.

## 실기기에서 반드시 확인할 항목

1. 설정을 마친 뒤 시험 앱을 열지 않고 화면을 켜고 끄기·잠금 해제를 3회 실시해 기기 로그와 서버 결과 대조
2. 화면만 켜고 잠금을 풀지 않은 경우 두 횟수가 구분되는지 확인
3. 실제 수신 1회·발신 1회·부재중 1회 후 각각 대조(발신 실패도 별도 확인)
4. 사용정보·통화기록 권한 철회 시 0회가 아니라 미허용으로 표시되는지 확인
5. 밤새 절전·앱 강제 중지·재부팅·네트워크 단절 후 지연과 복구 시간 측정
6. 한국 시간 자정 전후 데이터가 섞이지 않는지 확인

## 공식 근거

- [Android 사용 이벤트 및 이벤트의 의미](https://developer.android.com/reference/android/app/usage/UsageEvents.Event)
- [Android 통화기록 필드와 TYPE 정의](https://developer.android.com/reference/android/provider/CallLog.Calls)
- [Google Play 통화·문자 권한 정책](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en)
- [Apple DeviceActivityReport의 개인정보 보호 샌드박스](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport)
- [Apple SensorKit 연구 승인 entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.sensorkit.reader.allow)
- [Apple Sensor & Usage Data 연구 이용 조건](https://www.apple.com/legal/privacy/data/en/sensor-usage-data/)

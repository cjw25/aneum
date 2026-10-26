# Vercel 배포

## 배포 구성

- Framework: Other (`null`)
- Build command: `npm test`
- Output directory: `web`
- Functions: `api/status.js`, `api/devices.js`, `api/device.js`, `api/report.js`
- GitHub: `cjw25/aneum`, `main`

별도 npm 의존성은 없습니다. `vercel.json`에 빌드·라우팅·응답 보안 헤더를 정의했습니다. Android/iOS 소스, 로컬 `data/`, 연결 키, `.env`는 배포 업로드에서 제외합니다.

## 기본 배포는 예시 화면

아래 서버 환경변수가 모두 설정되기 전에는 `/api/status`가 `preview`를 반환합니다. 확인 화면은 가상 가족 데이터로 열리며 실제 가족 연결 폼을 숨깁니다. 데이터 등록·수신 API는 503으로 거부합니다. 실제 가족 데이터를 메모리나 임시 파일에 저장해 성공한 것처럼 보이지 않습니다.

## 실제 기기 연결을 위한 서버 설정

Vercel 프로젝트의 서버 환경변수에 다음을 설정합니다. 비밀값을 GitHub나 클라이언트 JavaScript에 넣지 않습니다.

| 환경변수 | 값 |
|---|---|
| `ANEUM_ADMIN_TOKEN` | 무작위 32바이트를 소문자 16진수로 표현한 관리자 키 (64자) |
| `UPSTASH_REDIS_REST_URL` | 해당 프로젝트용 Upstash Redis HTTPS REST 주소 |
| `UPSTASH_REDIS_REST_TOKEN` | 해당 Redis의 쓰기 가능한 REST 인증 키 |
| `ANEUM_REDIS_NAMESPACE` | 선택 사항, 기본 `aneum-pilot` |

무료 또는 유료 저장소 개설과 계약은 별도이며 이 배포 구성만으로 생성되지 않습니다. 기존 Redis를 사용하는 경우 다른 프로젝트와 namespace가 겹치지 않게 하세요. Production/Preview 환경을 분리할 때 namespace도 분리하세요.

환경변수 설정 후 재배포합니다. 관리자 키로 웹 확인 화면을 연결하고 각 휴대폰에 별도의 기기 키를 발급합니다. 앱의 서버 주소는 실제 HTTPS 배포 주소입니다. 휴대폰 앱 빌드와 실기기 검증은 별도로 필요합니다.

## 저장·삭제 방식

Redis 해시 하나에 기기별 최신 기록만 저장합니다. 등록·측정 갱신에는 Lua 스크립트를 사용해 동시 등록 한도와 과거 기록의 덮어쓰기 방지, 연결 해제 후 기록 부활 방지를 처리합니다. 삭제는 해당 기기 레코드와 인증 키 해시를 함께 지웁니다. 저장소 장애는 503으로 표시하며 임시 저장으로 대체하지 않습니다.

서버리스 API 테스트는 저장소 모형을 주입해 인증·등록·수신·삭제·장애 경로를 검사합니다. 실제 Upstash 연결과 Redis Lua 실행은 저장소가 연결된 뒤 별도로 검증해야 합니다.

## 공식 문서

- [Vercel 프로젝트 설정](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel 함수 런타임](https://vercel.com/docs/functions/runtimes)
- [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi)

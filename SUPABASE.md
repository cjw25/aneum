# 기존 Supabase 프로젝트 연결

현재 상태: 서버 어댑터·마이그레이션 SQL 준비 및 자동 테스트 완료. 실제 프로젝트 연결·SQL 적용·실제 저장 검증은 아직 수행하지 않았습니다.

## 사용할 프로젝트에서 확인할 것

기존 프로젝트 주소 또는 프로젝트 참조 ID를 먼저 확인합니다. 기존 서비스와 분리한 `public.aneum_devices` 테이블 및 `public.aneum_register_device`, `public.aneum_report_activity` 함수만 추가합니다. 해당 이름의 객체가 이미 있다면 SQL을 그대로 실행하지 말고 현재 스키마를 확인해야 합니다. 마이그레이션은 트랜잭션으로 실행하며 기존 객체를 덮어쓰지 않습니다.

SQL: `supabase/migrations/202610260001_aneum_devices.sql`

- RLS 활성화, 일반 공개·로그인 사용자에 대한 테이블 권한 차단
- 서버의 `service_role`만 테이블 접근 및 RPC 실행 허용
- 등록 한도 20대, 등록 경합 처리
- 과거 측정값의 덮어쓰기 방지, 삭제·전송 경합 처리
- 연결 키 원문은 데이터베이스에 저장하지 않고 SHA-256 해시만 저장

## Vercel 서버 환경변수

| 이름 | 용도 |
|---|---|
| `SUPABASE_URL` | 기존 프로젝트 HTTPS 주소 |
| `SUPABASE_SECRET_KEY` | 서버 전용 `sb_secret_…` 키 |
| `ANEUM_ADMIN_TOKEN` | 안음 확인 화면에서 사용하는 별도의 무작위 관리자 키, 소문자 16진수 64자 |

기존 프로젝트가 legacy 키를 사용하면 `SUPABASE_SERVICE_ROLE_KEY`도 지원합니다. 프로젝트 주소는 `NEXT_PUBLIC_SUPABASE_URL`도 읽습니다. 비밀 키에는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. Supabase 설정이 모두 있으면 Redis 대신 Supabase를 사용합니다. 기존 Redis 데이터를 자동 복사하지 않습니다.

Supabase secret을 화면의 관리자 입력란에 넣지 마세요. 서버 환경변수에만 설정합니다. 채팅·공개 저장소·브라우저 JavaScript·휴대폰 앱에는 넣지 않습니다. `sb_secret_…`는 JWT가 아니므로 REST 호출의 `apikey` 헤더로 전달하고 JWT Bearer 토큰으로 보내지 않습니다.

## 실제 연결 후 검증 순서

1. 전용 테이블과 함수가 생성됐는지, 공개 키로 테이블과 함수 접근이 차단되는지 확인
2. Vercel Production 환경변수 설정 및 재배포
3. 관리자 키로 조회·기기 등록, 별도 연결 키 발급 확인
4. 명확하게 구분한 시험 기기로 서버 수신·저장·조회 확인
5. 시험 기록 삭제 및 삭제된 기기 키의 재사용 거부 확인
6. 이후 부모님 휴대폰 앱의 실제 장시간 자동 수집 검증

자동 테스트 22개 통과는 실제 Supabase 연결 성공을 의미하지 않습니다. 테스트용 데이터는 실제 부모님 활동으로 표시하거나 남겨두지 않습니다.

# 익명 스토리 커뮤니티 연결

## 구현 범위

- 앱의 커뮤니티 탭: 전체/좋아요한 스토리, 최신/인기순, 제목 검색, 페이지 추가 로딩.
- 라이브러리 카드 `… → 공개하기`: 공개 내용과 개인정보 확인 후 게시. 닉네임/로그인 화면 없음.
- 게시글에서 저장된 채팅과 스토리 감상, 좋아요/취소, 댓글, 본인 게시글/댓글 삭제, 게시글 신고.
- 커뮤니티 스토리를 내 라이브러리에 저장하는 기능은 없음.
- 댓글 300자(공백 포함), 제목 100자. 대본+채팅 합계 5만 Unicode 코드 포인트·UTF-8 200,000바이트 이하.
- 한국 시간 자정 기준 익명 사용자당 공개 5개, 댓글 10개. 공개 간격 60초, 댓글 간격 10초. 삭제해도 당일 횟수는 복구되지 않음.
- 첫 줄 타이틀/title, 마지막 줄 endEvent, 중간 명령/선택지/지원 화자/에셋과 길이 검증. 잘못된 줄을 조용히 무시하지 않고 공개 차단.
- 대본 최대 1,000줄, 채팅 최대 300개/개별 3,000자, 선택지 최대 4개/개별 300자. waitSecond는 1~30초 정수, 합계 120초 이하.
- `waitSecond : 2`와 `waitSecond = 2`를 모두 지원한다. 오류 줄 번호는 빈 줄을 포함한 원본 기준이다.
- 대사·나레이션·선택지에서 emotion/expression/animation/bg/music/sound 연출을 공통으로 지원한다. 나레이션·선택지의 효과는 현재 초상에 적용되며 emotion으로 초상을 지정할 수도 있다. 여러 `[ ]` 블록과 확장자를 생략한 등록 emotion도 허용한다. 독립 `[expression : Headpat.png]`, `expression : Headpat.png`, `emotion : hoshino_smile` 줄도 사용할 수 있다. 없는 에셋·명령, 중복 키와 용량 제한은 계속 검사한다.
- 라이브러리 편집기는 공개 검증과 같은 규칙으로 자동 검사한다. 웹/Windows에서는 빨간 물결 밑줄, 모바일에서는 오류 목록과 해당 줄 선택을 지원한다. 로컬 저장은 오류가 있어도 가능하며 공개 시에는 서버가 다시 검사한다. 대본 형식 검사가 통과해도 저장된 채팅 길이 등 게시물 전체 제한은 별도로 적용된다.
- 게시글의 좋아요는 익명 사용자당 1개. 조회는 한국 날짜별 사용자당 1회. 조회 중복 방지 기록은 정기 삭제하고 누적 조회수는 보존.

## 사용자가 준비할 것

1. 본인 Supabase 계정에서 프로젝트 생성. 이 코드만으로 실제 DB가 생성되거나 과금 플랜이 활성화되지는 않는다.
2. Authentication 설정에서 Anonymous Sign-ins 활성화. 이메일/닉네임 입력은 필요 없다.
3. SQL Editor에서 `supabase/migrations/202610180001_community.sql`, `supabase/migrations/202610180002_community_rankings.sql` 순서로 각각 한 번씩 실행. 이미 001을 실행했다면 002만 추가 실행한다. 또는 CLI 마이그레이션 이력이 연결된 프로젝트는 `supabase db push` 실행.
4. CLI에서 `supabase functions deploy community --project-ref <PROJECT_REF>` 실행. 함수는 Auth 서버에 토큰을 검증한 다음에만 DB 함수를 호출한다. `verify_jwt = false`는 무인증 허용이 아니다.
5. 프로젝트 URL과 **publishable key**를 `.env.example`에서 안내한 이름으로 `.env.local`에 입력. 기존 anon public key도 SDK에서 사용 가능하다. **secret/service_role key는 앱·EXPO_PUBLIC 변수·Git에 절대 넣지 않는다.** 함수 내부 service role 키는 Supabase 기본 환경에서만 읽는다.
6. `npx expo start --clear`로 재시작. APK/Windows 배포본은 환경 변수가 포함되도록 다시 빌드해야 한다.
7. Supabase Dashboard의 Cron에서 아래 쿼리를 하루 한 번 실행하도록 등록한다. CLI 배포만으로 Cron이 자동 등록되지는 않는다.

```sql
select public.community_cleanup();
```

CLI가 없는 경우 먼저 공식 Supabase CLI 설치 안내를 따른다. 함수 디렉터리 외부의 `shared/community`도 함께 배포 번들에 포함되므로 반드시 저장소 루트에서 배포한다.

## 릴리즈 빌드 연결

공식 릴리즈 워크플로에는 공개 커뮤니티의 클라이언트 연결 기본값이 있다. 다른 프로젝트를 사용하려면 GitHub Actions 저장소 Variables에 아래 두 값을 등록해 기본값을 덮어쓴다.

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

둘은 공개 클라이언트 설정이다. DB 보호는 키를 숨기는 방식이 아니라 서버 검증과 접근 권한으로 한다. 소스에서 로컬 실행/직접 빌드할 때는 여전히 `.env.local` 설정이 필요하며, 연결 설정이 없으면 기존 채팅/라이브러리는 정상 동작하고 커뮤니티에 연결 안내가 표시된다.

## 운영·보안 주의

- 모든 테이블에 RLS를 켜고 anon/authenticated의 직접 접근·RPC 실행을 금지했다. 쓰기는 Edge Function만 가능하며 인증된 토큰의 사용자 ID를 사용한다. 클라이언트가 author/actor/좋아요 수/조회수를 지정할 수 없다.
- 하루 한도는 DB 원자적 UPSERT로 강제한다. 앱에서 버튼만 막는 방식이 아니다. DB 함수는 service_role 전용이며 비밀 키가 유출되면 이 보호를 우회할 수 있으므로 키를 엄격히 관리한다.
- 세션은 웹 브라우저 저장소/네이티브 AsyncStorage에 유지된다. 익명 ID는 본인 삭제와 좋아요 목록에 쓰며 다른 사용자에게 반환하지 않는다. 기기 간 동기화·세션 삭제 후 복구는 지원하지 않는다.
- **익명 ID를 새로 만들면 횟수 제한을 우회할 수 있다.** 현재 구현은 신원 보증이나 강력한 봇 방어가 아니다. 인증된 사용자별 API 일일 한도도 두었지만, 공개 서비스 전 익명 가입 rate limit을 설정하고 IP 기반 게이트웨이 제한을 추가할 것을 권장한다. 프록시 검증 없이 클라이언트가 보낸 IP 헤더를 신뢰하지 않는다.
- Supabase는 익명 가입에 CAPTCHA를 권장한다. 현재 앱에는 CAPTCHA UI가 없으므로 Dashboard에서 CAPTCHA를 켜면 익명 세션 생성이 실패한다. 공개 트래픽을 받기 전에 웹·APK·Windows 공통 CAPTCHA 흐름 또는 별도 게이트웨이 방어를 구현해야 한다.
- 신고는 `community_reports`에 저장된다. 운영자는 Dashboard에서 신고/원문을 확인하고 `community_posts`/`community_comments`를 삭제할 수 있다. 자동 검열·자동 차단·관리자 앱 화면은 구현 범위에 포함되지 않는다.
- 업로드에는 대본·채팅만 포함된다. 앱의 Gemini 키·설정은 보내지 않지만 **대사 자체에 사용자가 적은 개인정보는 자동 탐지하지 못하므로** 공개 확인창에서 내용을 점검해야 한다.
- Cron 실행과 DB 백업/사용량 모니터링을 별도로 운영한다. 익명 사용자 정리를 자동으로 켜면 해당 사용자의 게시글/좋아요도 외래 키에 의해 삭제되므로 운영 정책 없이 사용자 삭제를 예약하지 않는다.

## 검증

인기순은 전체 기간/일간/주간/월간/연간을 지원한다. 기간별 순위는 게시일이 아닌 **현재 남아 있는 좋아요의 생성 시각**으로 집계한다. 한국 시간 기준 오늘 0시, 이번 주 월요일 0시, 이번 달 1일 0시, 올해 1월 1일 0시부터 현재까지이며 동률은 게시일 최신순·ID 순이다. 좋아요 취소 시 집계에서 빠지고 다시 누르면 새 좋아요 시각으로 집계된다. 순위용 별도 영구 로그는 만들지 않는다. 카드의 총 좋아요와 기간 내 좋아요는 구분해서 표시한다.

`npm run test:community`: 공유 검증기, HTTP 인증/입력 제한, 로컬 PostgreSQL(PGlite)의 마이그레이션·권한·하루 제한·삭제 후 횟수 유지·좋아요/조회 중복 방지, UI 상태를 검증한다. 실제 Supabase 프로젝트로의 배포와 실제 단말 온라인 통신은 별도 확인이 필요하다.

참고: [React Native 연결](https://supabase.com/docs/guides/auth/quickstarts/react-native), [익명 인증](https://supabase.com/docs/guides/auth/auth-anonymous), [Edge Function 인증](https://supabase.com/docs/guides/functions/auth).

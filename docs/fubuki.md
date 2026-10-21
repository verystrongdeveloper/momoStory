# 후부키 추가

네무가키 후부키(발키리 경찰학교 1학년·생활안전국)의 기본 제복 모습을 지원한다.
캐릭터 선택, 일반 채팅과 인연 대화, 스토리 등장 인물 선정, 대본 편집기의 표정 목록,
스토리 재생·영상 추출, 공개 스토리 검증 및 캐릭터 필터에 연결했다.
표정 15종은 `assets/images/fubuki`의 원본 PNG를 사용하며 비율은 371×673이다.

## 설정 참고

- [프로필](https://game8.jp/blue-archive/655210): 소속과 학년, 한가로운 공무원 생활에 대한 동경, 도넛·라디오·크로스워드 취향.
- [게임 대사 모음](https://bluearchive.fandom.com/wiki/Nemugaki_Fubuki/Audio): 나른한 태도, 키리노에 대한 반응, 휴식과 도넛에 대한 관심, 선생과 함께하는 편안한 일상.

페르소나의 예시 대사는 원작 인용이 아니라 위 특징에 맞춰 새로 작성한 문장이다.
호시노의 자기 지칭과 추임새를 섞지 않도록 구분한다.

## 공개 서버 반영

클라이언트만 업데이트하면 기존 공개 서버에서 후부키를 거부한다. 앱 배포 전에 다음 두 변경을 함께 적용한다.

1. `supabase/migrations/202610210003_add_fubuki.sql`을 실행해 DB의 캐릭터 제한에 후부키를 추가한다.
2. 저장소 루트에서 `supabase functions deploy community --project-ref <PROJECT_REF>`를 실행한다.
   함수가 사용하는 `shared/community/validation.ts`와 `shared/community/assets.json`에도 후부키가 들어 있어야 한다.

에셋 목록은 `npm run community:assets`로 생성한다.
생성 단계에서 메인 캐릭터와 중복 없는 추가 인물 최대 2명만 허용한다. 선정되지 않은 화자의 대사·선택지 화자와 표정은 결과에서 제외하여 공개 서버의 최대 3인 제한과 맞춘다. 잘못된 인물 선정 JSON은 메인 캐릭터 중심의 기본 전개로 처리한다.
`npm run test:prompt`, `npm run test:community`로 프롬프트와 표정 목록 일치,
4개 언어 화자 검증, Edge 핸들러, 로컬 PostgreSQL 공개·필터·상세 조회를 검증한다.
기존 앱에는 후부키 이미지가 없으므로 후부키 공개 스토리 재생에는 새 앱/웹 빌드가 필요하다.

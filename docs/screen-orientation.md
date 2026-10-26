# 모바일 화면 방향 설정

휴대폰 앱의 기본 방향은 세로 고정이다. 설정의 **화면 방향 → 세로 / 가로**에서
선택하면 현재 화면과 스토리 재생 화면에 즉시 적용하고, 다음 앱 실행에도 유지한다.
기존 설치와 잘못된 저장값은 세로로 처리한다. 브라우저에는 네이티브 전용 설정을
표시하지 않는다.

`app/event.tsx`의 `OrientationLock.ALL`과 종료 시 세로 복원 처리를 제거했다.
`app/_layout.tsx`의 네이티브 스택이 저장된 설정을 받아 모든 경로에
`portrait_up` 또는 `landscape`를 적용한다. 스토리를 열고 닫아도 선택값을 바꾸지 않는다.
화면 크기 변경에 따른 기존 반응형 레이아웃은 그대로 사용한다.

화면 방향은 다른 사용자 설정과 함께 저장한다. UI 문구는 4개 언어를 지원한다.
iOS 빌드에서는 두 방향을 모두 허용하고, 시작 방향은 세로로 설정한다.
Android의 현재 네이티브 매니페스트도 초기 세로 방향을 유지한다.
iOS 네이티브 설정 변경은 새 앱 빌드가 필요하다.

구현 참고: [Expo의 스택 화면 방향 안내](https://docs.expo.dev/versions/latest/sdk/screen-orientation/#per-screen-orientation-with-expo-router).
설치된 `expo-screen-orientation`의 iOS 구현에서도 명시적인 RNScreens 화면 방향을
우선하는 처리를 확인했다.

`npm run test:orientation`은 기존/잘못된 설정, 저장·재실행 복구, Android/iOS 설정 버튼,
스택에 전달하는 방향, 스토리 진입·종료, 웹 설정 제외와 번역을 검증한다.
네이티브 화면 회전 자체는 기기에서 별도 확인이 필요하며 이번 작업에서 실기기 검증이나
APK/iOS 빌드는 실행하지 않았다.

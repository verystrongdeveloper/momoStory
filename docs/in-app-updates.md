# 앱 내 업데이트 운영

## 사용자 흐름

- 설정과 시작 시 업데이트 안내에서 `앱에서 업데이트`를 선택합니다. 브라우저의 다운로드 페이지는 대안으로 유지합니다.
- 다운로드 전 임시 채팅/AI 대화 기억과 진행 중인 작업에 대한 안내를 확인합니다. 다운로드가 끝나면 별도로 `설치 계속하기`를 눌러 설치합니다.
- Windows는 Tauri updater로 서명을 검증한 NSIS 설치 파일을 실행합니다. 앱이 종료되고 설치 후 다시 실행됩니다. 설치형 배포본 기준이며, 단독 EXE 사용자는 설치형으로 전환될 수 있습니다.
- Android는 GitHub의 `MomoStory.apk`를 앱 캐시에 다운로드합니다. SHA-256·파일 크기·패키지명·버전명·versionCode·기존 앱과 같은 APK 서명을 확인합니다. 시스템 설치 허용이 필요하면 설정을 연 뒤 돌아와 설치를 계속합니다. 취소한 설치는 다시 열 수 있습니다.
- 브라우저와 이전 APK(네이티브 업데이트 모듈 없음)는 기존 다운로드 페이지를 사용합니다. 이 기능이 포함된 버전까지는 한 번 수동 설치해야 합니다.
- 저장된 라이브러리는 유지하지만 임시 채팅 등 메모리 상태는 설치/재실행 후 보존되지 않습니다. 다운로드는 앱 실행 상태에서 진행하며 종료 후 이어받기는 지원하지 않습니다.

## Windows 서명키

- 공개키: `src-tauri/tauri.conf.json`의 `plugins.updater.pubkey`.
- 개인키: Git 제외 폴더 `.update-signing/momostory.key`. 이 폴더를 삭제/정리하지 말고 별도 안전한 위치에 백업하세요. 개인키를 Git이나 릴리즈에 올리지 마세요.
- GitHub Actions Secret: `TAURI_SIGNING_PRIVATE_KEY`. 현재 키는 암호가 없으므로 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`는 비워 둡니다.
- 로컬 빌드는 PowerShell에서 `$env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path .update-signing/momostory.key).Path`를 설정한 후 실행합니다. `.env` 파일은 Tauri 서명에 사용되지 않습니다.
- 키를 교체하면 이전 공개키를 포함한 설치본이 새 서명을 검증할 수 없습니다. 기존 키를 계속 사용하세요.

## 릴리즈

태그 릴리즈 워크플로는 NSIS 설치 파일과 `.sig`, `latest.json`을 함께 첨부합니다. `latest.json`은 동일 릴리즈의 정확한 버전과 서명을 가리킵니다. Android는 기존 릴리즈 서명키를 계속 사용하고 versionCode를 반드시 올려야 합니다. GitHub API의 APK SHA-256 digest가 없으면 앱 내 다운로드는 실패 안내와 웹 다운로드 대안으로 전환됩니다.

검증: `npm run test:update`. 실제 업데이트 설치 검증은 저장할 데이터를 보존한 테스트 설치본과 같은 서명으로 만든 더 높은 버전에서 수행하세요. 테스트 중 현재 개발 앱을 자동 설치/종료하지 않습니다.

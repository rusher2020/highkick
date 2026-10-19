# 하이킥 팀 밸런서

하이킥 축구회의 출석 체크, 공격·미드·수비 티어 관리, 6인 팀 자동 조합, 팀 편성 이미지 공유를 위한 웹앱입니다.

- 화면: GitHub Pages (`index.html`)
- 데이터: Firebase Firestore (실시간 반영)
- 수정 권한: 운영진 PIN을 입력한 기기만 (`firestore.rules`)
- 보기: 링크만 있으면 누구나, 로그인 없이

## 처음 설정

1. Firebase 콘솔에서 프로젝트를 만들고 **Firestore**(서울, 프로덕션 모드)와 **Authentication > 로그인 방법 > 익명**을 켭니다.
2. Authentication > 설정 > 승인된 도메인에 `rusher2020.github.io`를 추가합니다.
3. 웹 앱을 등록하고 `firebaseConfig` 값을 `config.js`에 넣습니다.
4. `firestore.rules`를 Firestore > 규칙에 붙여 넣고, `PIN_HERE`를 운영진 PIN으로 바꿔 게시합니다. (PIN은 저장소에 올리지 마세요)
5. 사이트에서 운영진 로그인(PIN 입력) → 회원 티어 탭 → **기존 데이터 불러오기**로 백업 파일(.json)을 올립니다.

## 사용 팁

- 운영진 PIN은 기기마다 한 번만 입력하면 유지됩니다. 카카오톡 안에서 열어도 로그인됩니다.
- PIN을 바꾸려면 Firestore > 규칙에서 PIN만 고쳐 다시 게시하세요. 기존 기기는 자동으로 권한이 해제됩니다.

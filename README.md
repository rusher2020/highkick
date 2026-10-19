# 하이킥 팀 밸런서

하이킥 축구회의 출석 체크, 공격·미드·수비 티어 관리, 6인 팀 자동 조합, 팀 편성 이미지 공유를 위한 웹앱입니다.

- 화면: GitHub Pages (`index.html`)
- 데이터: Firebase Firestore (실시간 반영)
- 수정 권한: 운영진 구글 계정만 (`firestore.rules`)
- 보기: 링크만 있으면 누구나, 로그인 없이

## 처음 설정

1. Firebase 콘솔에서 프로젝트를 만들고 **Firestore**(서울, 프로덕션 모드)와 **Authentication > Google**을 켭니다.
2. Authentication > 설정 > 승인된 도메인에 `rusher2020.github.io`를 추가합니다.
3. 웹 앱을 등록하고 `firebaseConfig` 값을 `config.js`에 넣습니다.
4. `firestore.rules`의 운영진 이메일 3개를 바꾼 뒤, Firestore > 규칙에 붙여 넣고 게시합니다.
5. 사이트에서 운영진 로그인 → 회원 티어 탭 → **기존 데이터 불러오기**로 백업 파일(.json)을 올립니다.

## 사용 팁

- 카카오톡에서 링크를 열면 구글 로그인이 막힙니다. 운영진은 크롬 등 다른 브라우저로 열어 로그인하세요. 보기만 하는 회원은 상관없습니다.
- 운영진이 바뀌면 `firestore.rules`의 이메일 목록만 고쳐 다시 게시하면 됩니다.

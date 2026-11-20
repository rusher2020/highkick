// 홈 화면 앱 설치용 최소 서비스 워커 — 아무것도 저장하지 않고 항상 최신 화면을 불러옵니다.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () {});

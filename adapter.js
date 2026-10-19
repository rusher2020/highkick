/*
 * 하이킥 팀 밸런서 — Firebase 연결부
 * 앱 본문은 window.claude.use("db" | "downloads" | "sample") 로 저장소·다운로드·이미지 인식을 씁니다.
 * 여기서 그 자리를 Firebase Firestore / 브라우저 다운로드로 채웁니다.
 */
(function () {
  "use strict";
  const cfg = window.HIGHKICK_FIREBASE || {};
  const configured = !!(cfg.apiKey && cfg.projectId && !String(cfg.apiKey).startsWith("여기에"));
  let fs = null, auth = null, currentUser = null;

  if (configured && window.firebase) {
    firebase.initializeApp(cfg);
    fs = firebase.firestore();
    auth = firebase.auth();
    auth.getRedirectResult().catch(function () {});
    auth.onAuthStateChanged(function (u) { currentUser = u; paintWho(); });
  }

  function paintWho() {
    const b = document.getElementById("whoBtn");
    if (!b) return;
    b.hidden = !configured;
    b.textContent = currentUser ? (currentUser.displayName || currentUser.email || "운영진") + " · 로그아웃" : "운영진 로그인";
  }

  async function login() {
    if (!auth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
    if (inApp) {
      alertBox("카카오톡 안 브라우저에서는 구글 로그인이 막혀 있어요. 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 크롬에서 로그인해 주세요.");
      return;
    }
    try { await auth.signInWithPopup(provider); }
    catch (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
        await auth.signInWithRedirect(provider);
      } else if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        alertBox("로그인하지 못했어요: " + (e.message || e.code));
      }
    }
  }
  async function logout() { if (auth) await auth.signOut(); }

  function alertBox(msg) {
    const r = document.getElementById("toastRoot");
    if (!r) return;
    r.innerHTML = '<div class="toast" role="status"></div>';
    r.firstChild.textContent = msg;
    setTimeout(function () { r.innerHTML = ""; }, 5000);
  }

  document.addEventListener("click", function (e) {
    const b = e.target.closest && e.target.closest("#whoBtn");
    if (!b) return;
    e.stopPropagation();
    currentUser ? logout() : login();
  }, true);

  /* 이미지 저장: 휴대폰은 공유 시트(카톡으로 바로), 그 외는 파일 다운로드 */
  const downloads = {
    save: async function (req) {
      const blob = req.data instanceof Blob ? req.data : new Blob([req.data]);
      const file = new File([blob], req.filename, { type: blob.type || "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: req.filename }); return { status: "saved" }; }
        catch (e) { if (e && e.name === "AbortError") throw { code: "declined" }; }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = req.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return { status: "saved" };
    }
  };

  window.HK = { login: login, user: function () { return currentUser; }, ocr: false, configured: configured };
  window.claude = {
    use: async function (name) {
      if (name === "db") return fs;
      if (name === "downloads") return downloads;
      return null; // 이미지 인식(sample)은 외부 호스팅에서 아직 꺼 둠 → '이름 붙여넣기' 사용
    }
  };

  /* 기존 데이터(.json) 불러오기 — 저장소가 비어 있을 때 회원 탭에 버튼이 나옵니다 */
  document.addEventListener("change", async function (e) {
    if (!e.target || e.target.id !== "seedIn") return;
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f || !fs) return;
    if (!currentUser) { alertBox("먼저 운영진 로그인을 해 주세요"); login(); return; }
    try {
      const data = JSON.parse(await f.text());
      let n = 0, batch = fs.batch();
      for (const col of Object.keys(data)) {
        for (const id of Object.keys(data[col] || {})) {
          batch.set(fs.collection(col).doc(id), data[col][id]);
          if (++n % 400 === 0) { await batch.commit(); batch = fs.batch(); }
        }
      }
      await batch.commit();
      alertBox(n + "개 항목을 불러왔어요");
    } catch (err) {
      alertBox(err && err.code === "permission-denied" ? "이 계정은 수정 권한이 없어요" : "파일을 불러오지 못했어요");
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    paintWho();
    if (!configured) {
      const m = document.getElementById("v-make");
      if (m) setTimeout(function () {
        m.innerHTML = '<div class="notice">아직 Firebase가 연결되지 않았어요. 저장소의 config.js에 Firebase 설정을 넣으면 바로 동작합니다. (README 참고)</div>';
      }, 50);
    }
  });
})();

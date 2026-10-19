/*
 * 하이킥 팀 밸런서 — Firebase 연결부
 * 앱 본문은 window.claude.use("db" | "downloads" | "sample") 로 저장소·다운로드·이미지 인식을 씁니다.
 * 여기서 그 자리를 Firebase Firestore / 브라우저 다운로드로 채웁니다.
 */
(function () {
  "use strict";
  const cfg = window.HIGHKICK_FIREBASE || {};
  const configured = !!(cfg.apiKey && cfg.projectId && !String(cfg.apiKey).startsWith("여기에"));
  let fs = null, auth = null, isAdmin = false;
  const OPERATORS = ["이진환", "이상연", "조경범", "조윤규"];
  const getName = function () { try { return localStorage.getItem("hkName") || ""; } catch (e) { return ""; } };
  const setName = function (v) { try { v ? localStorage.setItem("hkName", v) : localStorage.removeItem("hkName"); } catch (e) {} };

  /*
   * 운영진 PIN 로그인
   * 1) 익명 로그인으로 기기별 ID를 받고
   * 2) admins/{그 ID} 문서에 입력한 PIN을 저장 → Firestore 규칙이 PIN이 맞을 때만 저장을 허용
   * 3) 이후 쓰기는 규칙이 admins/{ID}의 PIN을 다시 확인 (PIN을 바꾸면 기존 기기는 자동으로 권한 해제)
   */
  /* 운영진만 볼 수 있음: 로그인 확인이 끝난 뒤에야 저장소를 앱에 넘겨줌 */
  let readyResolve; const authReady = new Promise(function (r) { readyResolve = r; });
  if (configured && window.firebase) {
    firebase.initializeApp(cfg);
    fs = firebase.firestore();
    auth = firebase.auth();
    auth.onAuthStateChanged(async function (u) {
      isAdmin = false;
      if (u) {
        try {
          const d = await fs.collection("admins").doc(u.uid).get();
          // PIN이 바뀌었으면 admins 문서가 있어도 회원 데이터를 못 읽으므로 한 번 더 확인
          if (d.exists) { await fs.collection("members").limit(1).get(); isAdmin = true; }
        } catch (e) { isAdmin = false; }
      }
      paintWho(); paintLock();
      readyResolve();
    });
  } else { readyResolve(); }

  function paintLock() {
    const main = document.getElementById("main"), tabs = document.querySelector(".tabs");
    if (!main) return;
    let lock = document.getElementById("lockPanel");
    if (isAdmin || !configured) { if (lock) lock.remove(); main.hidden = false; if (tabs) tabs.hidden = false; return; }
    main.hidden = true; if (tabs) tabs.hidden = true;
    if (!lock) {
      lock = document.createElement("div"); lock.id = "lockPanel"; lock.className = "wrap";
      lock.innerHTML = '<section class="view"><div class="panel empty" style="padding:36px 20px">' +
        '<div style="font-size:2.2rem;line-height:1">🔒</div>' +
        '<strong style="margin-top:10px">운영진 전용 페이지예요</strong>' +
        '<p style="margin:6px 0 18px">티어표, 라인업, 경기 기록은 운영진 로그인 후에 볼 수 있어요.</p>' +
        '<button class="btn primary" id="lockLogin">운영진 로그인</button></div></section>';
      main.parentNode.insertBefore(lock, main);
      document.getElementById("lockLogin").onclick = function () { login(); };
    }
  }

  function paintWho() {
    const b = document.getElementById("whoBtn");
    if (!b) return;
    b.hidden = !configured;
    b.textContent = isAdmin ? (getName() || "운영진") + " · 로그아웃" : "운영진 로그인";
  }

  function login() {
    if (!auth) return;
    const root = document.getElementById("sheetRoot");
    root.innerHTML = '<div class="scrim" id="pinScrim"><form class="sheet" id="pinForm">' +
      '<div class="row spread"><h2>운영진 로그인</h2><button type="button" class="btn ghost small" id="pinClose">닫기</button></div>' +
      '<p class="small muted" style="margin:0">운영진 PIN을 입력하면 이 기기에서 출석·점수·조합을 수정할 수 있어요. 한 번 입력하면 계속 유지됩니다.</p>' +
      '<div class="row" style="flex-wrap:nowrap"><input id="pinInput" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" ' +
      'style="flex:1;min-width:0;border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:12px;font-size:1.2rem;letter-spacing:.3em;text-align:center">' +
      '<button class="btn primary" type="submit">확인</button></div></form></div>';
    const close = function () { root.innerHTML = ""; };
    document.getElementById("pinScrim").onclick = function (e) { if (e.target.id === "pinScrim") close(); };
    document.getElementById("pinClose").onclick = close;
    setTimeout(function () { const i = document.getElementById("pinInput"); if (i) i.focus(); }, 50);
    document.getElementById("pinForm").onsubmit = async function (e) {
      e.preventDefault();
      const pin = document.getElementById("pinInput").value.trim();
      if (!pin) return;
      try {
        if (!auth.currentUser) await auth.signInAnonymously();
        await fs.collection("admins").doc(auth.currentUser.uid).set({ pin: pin, at: Date.now() });
        isAdmin = true; paintWho();
        pickName(pin, close);
      } catch (err) {
        if (err && err.code === "permission-denied") alertBox("PIN이 맞지 않아요");
        else if (err && (err.code === "auth/operation-not-allowed" || err.code === "auth/admin-restricted-operation"))
          alertBox("Firebase에서 '익명' 로그인이 꺼져 있어요. Authentication > 로그인 방법에서 켜 주세요.");
        else alertBox("로그인하지 못했어요: " + ((err && (err.code || err.message)) || "알 수 없는 오류"));
        const i = document.getElementById("pinInput"); if (i) i.select();
      }
    };
  }
  /* PIN이 맞으면 두 번째 단계: 누구인지 고르기 (변경 기록에 이 이름이 남음) */
  function pickName(pin, close) {
    const form = document.getElementById("pinForm");
    form.onsubmit = function (e) { e.preventDefault(); };
    form.innerHTML = '<div class="row spread"><h2>누구세요?</h2></div>' +
      '<p class="small muted" style="margin:0">PIN이 확인됐어요. 이름을 고르면 점수를 바꿀 때 변경 기록에 자동으로 남아요.</p>' +
      '<div class="chips" style="grid-template-columns:repeat(2,1fr)">' +
      OPERATORS.map(function (n) { return '<button type="button" class="chip" data-op="' + n + '" style="justify-content:center;padding:14px 8px;font-size:1rem"><span class="nm" style="text-align:center">' + n + '</span></button>'; }).join("") +
      '</div>';
    form.querySelectorAll("[data-op]").forEach(function (b) {
      b.onclick = async function () {
        const n = b.getAttribute("data-op");
        setName(n);
        try { await fs.collection("admins").doc(auth.currentUser.uid).set({ pin: pin, name: n, at: Date.now() }); } catch (e) {}
        paintWho(); close();
        alertBox(n + "님, 운영진으로 로그인했어요");
        setTimeout(function () { location.reload(); }, 600); // 운영진 권한으로 데이터를 다시 불러옴
      };
    });
  }

  async function logout() {
    if (!auth || !auth.currentUser) return;
    try { await fs.collection("admins").doc(auth.currentUser.uid).delete(); } catch (e) {}
    await auth.signOut();
    setName("");
    alertBox("로그아웃했어요");
    setTimeout(function () { location.reload(); }, 600);
  }

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
    isAdmin ? logout() : login();
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

  window.HK = { login: login, user: function () { return isAdmin; }, ocr: false, configured: configured };
  window.claude = {
    use: async function (name) {
      if (name === "db") { await authReady; return isAdmin ? fs : null; }
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
    if (!isAdmin) { alertBox("먼저 운영진 로그인을 해 주세요"); login(); return; }
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
      alertBox(err && err.code === "permission-denied" ? "수정 권한이 없어요. 다시 로그인해 주세요" : "파일을 불러오지 못했어요");
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    paintWho(); authReady.then(paintLock);
    if (!configured) {
      const m = document.getElementById("v-make");
      if (m) setTimeout(function () {
        m.innerHTML = '<div class="notice">아직 Firebase가 연결되지 않았어요. 저장소의 config.js에 Firebase 설정을 넣으면 바로 동작합니다. (README 참고)</div>';
      }, 50);
    }
  });
})();

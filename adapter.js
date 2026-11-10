/*
 * 하이킥FC 팀 밸런서 — Firebase 연결부
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
    const main = document.getElementById("main") || document.querySelector("main"), tabs = document.querySelector(".tabs");
    if (!main) return;
    let lock = document.getElementById("lockPanel");
    if (isAdmin || !configured) { if (lock) lock.remove(); main.hidden = false; if (tabs) tabs.hidden = false; document.body.classList.remove("locked"); return; }
    main.hidden = true; if (tabs) tabs.hidden = true; document.body.classList.add("locked");
    if (!lock) {
      lock = document.createElement("div"); lock.id = "lockPanel"; lock.className = "wrap";
      lock.innerHTML = '<section class="view" id="pubView"><div class="empty">다음 경기 정보를 불러오는 중…</div></section>';
      main.parentNode.insertBefore(lock, main);
      if (fs && !unsubPub) unsubPub = fs.collection("public").doc("next").onSnapshot(function (d) { renderPublic(d.exists ? d.data() : null); }, function () { renderPublic(null); });
    }
  }

  /* 로그인 안 한 회원용: 다음 경기 날짜 + 확정된 팀별 명단 (점수·티어 없음) */
  let unsubPub = null;
  const BIBC = ["var(--bib1)", "var(--bib2)", "var(--bib3)", "var(--bib4)", "var(--bib5)", "var(--bib6)"];
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dateLabel(ds) {
    const p = String(ds).split("-"); if (p.length < 3) return ds;
    const d = new Date(+p[0], p[1] - 1, +p[2]), t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / 86400000);
    const dd = diff === 0 ? "오늘" : diff === 1 ? "내일" : diff > 0 ? "D-" + diff : "지난 경기";
    return { text: (+p[1]) + "월 " + (+p[2]) + "일 (" + "일월화수목금토"[d.getDay()] + ")", dd: dd };
  }
  function timeKo(t) { const p = String(t).split(":").map(Number); return (p[0] < 12 ? "오전 " : "오후 ") + ((p[0] % 12) || 12) + "시" + (p[1] ? " " + p[1] + "분" : ""); }
  function leftKo(ds, t) {
    const a = String(ds).split("-").map(Number), b = String(t).split(":").map(Number);
    const diff = new Date(a[0], a[1] - 1, a[2], b[0], b[1]).getTime() - Date.now();
    if (diff <= 0) return diff > -3 * 3600e3 ? "경기 중" : "경기 끝남";
    const m = Math.floor(diff / 60000), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
    return "시작까지 " + (d ? d + "일 " + h + "시간" : h ? h + "시간 " + (m % 60) + "분" : (m % 60) + "분");
  }
  let lastPub = null;
  setInterval(function () { if (lastPub && document.getElementById("pubView")) renderPublic(lastPub); }, 60000);
  // 공개 화면 전용 꾸밈
  (function () {
    if (document.getElementById("pubCss")) return;
    const st = document.createElement("style"); st.id = "pubCss";
    st.textContent = `
body.locked .band .stats,body.locked .band .nextm{display:none}
#pubView{gap:14px}
.pv-hero{position:relative;overflow:hidden;border-radius:22px;padding:22px 20px 18px;color:#F3F7F1;background:linear-gradient(160deg,#1F6B41 0%,#154A2D 55%,#0F3721 100%);box-shadow:0 14px 30px -18px rgba(10,40,22,.7)}
.pv-hero:before{content:"";position:absolute;right:-70px;top:-70px;width:220px;height:220px;border-radius:50%;border:2px solid rgba(255,255,255,.12)}
.pv-kick{font-size:.78rem;letter-spacing:.14em;opacity:.75;font-weight:700}
.pv-date{font-family:var(--f-display);font-size:2.1rem;line-height:1.1;margin:6px 0 2px}
.pv-time{font-size:1rem;font-weight:600;opacity:.92}
.pv-cd{display:inline-flex;align-items:center;gap:6px;margin-top:12px;background:#F5C542;color:#14211A;border-radius:999px;padding:6px 14px;font-weight:800;font-size:.95rem}
.pv-cd.live{background:#FF6B57;color:#fff}.pv-cd.done{background:rgba(255,255,255,.18);color:#fff}
.pv-dd{position:absolute;right:18px;top:18px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:8px 12px;font:800 1.1rem var(--f-num)}
.pv-stats{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;position:relative;z-index:1}
.pv-stats span{background:rgba(255,255,255,.12);border-radius:12px;padding:6px 10px;font-size:.84rem}
.pv-stats b{font:800 1.05rem var(--f-num);margin-right:2px}
.pv-teams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pv-team{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 6px 16px -12px rgba(0,0,0,.35)}
.pv-team header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;color:#fff;font-weight:800;font-family:var(--f-display);font-size:1.15rem}
.pv-team header small{font:600 .78rem var(--f-body);opacity:.9}
.pv-team ol{list-style:none;margin:0;padding:4px 12px 10px;counter-reset:n}
.pv-team li{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-weight:600;font-size:.95rem}
.pv-team li:last-child{border-bottom:0}
.pv-team li:before{counter-increment:n;content:counter(n);width:20px;height:20px;border-radius:50%;background:var(--sunk);color:var(--muted);font:700 .7rem/20px var(--f-num);text-align:center;flex:none}
.pv-team li.g{color:var(--muted);font-weight:500}
.pv-team li .tag{margin-left:auto;font-size:.68rem;background:var(--sunk);color:var(--muted);border-radius:6px;padding:1px 6px;font-weight:600}
.pv-sec{display:flex;align-items:baseline;justify-content:space-between;margin:4px 2px 0}
.pv-sec h2{margin:0}
.pv-note{font-size:.8rem;color:var(--muted);text-align:center;line-height:1.6}
.pv-empty{text-align:center;padding:30px 18px;border:1.5px dashed var(--line);border-radius:18px;background:var(--surface)}
.pv-empty .ic{font-size:2.2rem}
.pv-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
@media (max-width:360px){.pv-teams{grid-template-columns:1fr}}
@media (prefers-reduced-motion:no-preference){.pv-team{animation:pvin .35s ease-out both}.pv-team:nth-child(2){animation-delay:.06s}.pv-team:nth-child(3){animation-delay:.12s}.pv-team:nth-child(4){animation-delay:.18s}}
@keyframes pvin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`;
    document.head.appendChild(st);
  })();
  const BIBHEX = BIBC;
  function renderPublic(pub) {
    lastPub = pub;
    const v = document.getElementById("pubView"); if (!v) return;
    const loginBtn = '<button class="btn ghost small" id="lockLogin">🔒 운영진 로그인</button>';
    let h = "";
    if (!pub || !pub.date) {
      h = '<div class="pv-empty"><div class="ic">⚽</div><b style="display:block;margin:8px 0 4px">다음 경기가 아직 정해지지 않았어요</b><span class="small muted">운영진이 경기 날짜와 팀을 정하면 여기에 나와요.</span></div>';
    } else {
      const dl = dateLabel(pub.date), left = pub.time ? leftKo(pub.date, pub.time) : "";
      const cdCls = /경기 중/.test(left) ? " live" : /끝남/.test(left) ? " done" : "";
      const sizes = pub.teams && pub.teams.length ? pub.teams.map(function (t) { return t.names.length; }).join("·") : "";
      h = '<section class="pv-hero"><div class="pv-kick">하이킥FC · 다음 경기</div>' +
        '<div class="pv-date">' + esc(dl.text) + '</div>' +
        (pub.time ? '<div class="pv-time">' + esc(timeKo(pub.time)) + ' 킥오프</div>' : '<div class="pv-time" style="opacity:.7">시작 시간은 곧 안내돼요</div>') +
        (left ? '<div class="pv-cd' + cdCls + '">' + (cdCls === " live" ? "🔴 " : cdCls ? "" : "⏱ ") + esc(left) + '</div>' : "") +
        '<span class="pv-dd">' + esc(dl.dd) + '</span>' +
        '<div class="pv-stats"><span><b>' + (pub.count || 0) + '</b>명 참석</span>' + (pub.teams ? '<span><b>' + pub.teams.length + '</b>팀</span><span>' + esc(sizes) + '</span>' : '') + '</div></section>';
      if (pub.teams && pub.teams.length) {
        h += '<div class="pv-sec"><h2>팀 편성</h2><span class="small muted">조끼 색 대신 팀 번호로 불러요</span></div><div class="pv-teams">' + pub.teams.map(function (t, i) {
          return '<article class="pv-team"><header style="background:' + BIBHEX[i % 6] + '">' + (i + 1) + '팀<small>' + t.names.length + '명</small></header><ol>' +
            t.names.map(function (n, j) { const g = (t.guest || [])[j]; return '<li class="' + (g ? "g" : "") + '">' + esc(n) + ((t.gk || [])[j] ? " 🧤" : "") + (g ? '<span class="tag">용병</span>' : "") + '</li>'; }).join("") + '</ol></article>';
        }).join("") + '</div>';
        h += '<div class="pv-btns"><button class="btn primary big" id="pubShare" style="flex:1;max-width:420px">📣 팀 명단 공유하기 (카톡 등)</button></div>';
        h += '<p class="pv-note">팀은 운영진이 능력치와 포지션을 고려해 고르게 나눴어요.<br>즐겁게, 다치지 않게! 💚</p>';
      } else {
        h += '<div class="pv-empty"><div class="ic">🧩</div><b style="display:block;margin:8px 0 4px">팀 편성 준비 중이에요</b><span class="small muted">운영진이 팀을 확정하면 바로 여기에 나와요.</span></div>';
      }
    }
    v.innerHTML = h + '<div class="pv-btns">' + loginBtn + '</div>';
    document.getElementById("lockLogin").onclick = function () { login(); };
    const sb = document.getElementById("pubShare");
    if (sb) sb.onclick = async function () {
      const dl = dateLabel(pub.date);
      const txt = "⚽ 하이킥FC " + dl.text + (pub.time ? " " + timeKo(pub.time) : "") + " 팀 편성\n\n" + pub.teams.map(function (t, i) { return (i + 1) + "팀: " + t.names.map(function (n, j) { return n + ((t.guest || [])[j] ? "(용병)" : ""); }).join(", "); }).join("\n") + "\n\n" + location.href.split("?")[0];
      try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(txt); alertMsg("명단을 복사했어요. 카카오톡에 붙여 넣으세요"); } catch (e) { alertMsg("공유를 지원하지 않는 브라우저예요"); }
    };
  }
  function alertMsg(m) { const r = document.getElementById("toastRoot"); if (r) { r.innerHTML = '<div class="toast" role="status">' + esc(m) + '</div>'; setTimeout(function () { r.innerHTML = ""; }, 2600); } }

  function paintWho() {
    const b = document.getElementById("whoBtn");
    if (!b) return;
    b.hidden = !configured;
    b.textContent = isAdmin ? (getName() || "운영진") + " · 로그아웃" : "운영진 로그인";
    let bk = document.getElementById("backupBtn");
    if (!bk && b.parentNode) {
      bk = document.createElement("button"); bk.id = "backupBtn"; bk.className = "who"; bk.textContent = "백업";
      bk.style.marginLeft = "6px"; b.parentNode.insertBefore(bk, b);
      bk.onclick = backup;
    }
    if (bk) bk.hidden = !isAdmin;
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

  /* 운영진 전용: 회원·경기 기록·출석·묶기·공개 안내·변경 기록을 JSON 파일 하나로 내려받기 */
  async function backup() {
    if (!fs || !isAdmin) return;
    try {
      alertBox("백업 파일을 만드는 중…");
      const out = { exportedAt: new Date().toISOString() };
      for (const col of ["members", "matches", "games", "weeks", "lineups", "state", "public", "logs"]) {
        const snap = await fs.collection(col).get();
        out[col] = {}; snap.forEach(function (d) { out[col][d.id] = d.data(); });
      }
      const d = new Date(), stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
      await downloads.save({ filename: "하이킥_백업_" + stamp + ".json", data: new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }) });
      alertBox("백업 파일을 저장했어요");
    } catch (e) { if (!(e && e.code === "declined")) alertBox("백업하지 못했어요: " + ((e && (e.code || e.message)) || "")); }
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
      // 카카오톡·인스타 등 앱 안 브라우저는 파일 저장이 안 됨 → 화면에 이미지를 띄워 길게 눌러 저장하게 함
      if (/KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent)) throw { code: "unavailable" };
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
    paintWho(); paintLock(); authReady.then(paintLock);
    if (configured && !window.firebase) {
      setTimeout(function () {
        const v = document.getElementById("pubView");
        if (v) v.innerHTML = '<div class="panel empty"><strong>데이터를 불러오지 못했어요</strong>인터넷 연결을 확인하고 새로고침해 주세요. 카카오톡에서 열었다면 오른쪽 위 메뉴에서 다른 브라우저로 열어 보세요.</div>';
      }, 300);
    }
    if (!configured) {
      const m = document.getElementById("v-make");
      if (m) setTimeout(function () {
        m.innerHTML = '<div class="notice">아직 Firebase가 연결되지 않았어요. 저장소의 config.js에 Firebase 설정을 넣으면 바로 동작합니다. (README 참고)</div>';
      }, 50);
    }
  });
})();

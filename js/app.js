/* ==========================================================================
   app.js — Interactive Application Controller
   Educational & Classroom Action Research Exam Prep (Aj. Por)
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "ajpor_research_exam_v1";

  // Default persistent state in localStorage
  const defaultState = {
    theme: "light",
    readTopics: [],          // array of topic IDs marked read
    masteredCards: [],       // array of flashcard IDs marked mastered
    reviewCards: [],         // array of flashcard IDs marked for review
    ajPorHistory: [],        // [{ date, score, total, mode }]
    mockExamHistory: []      // [{ date, score, total, durationSec, categoryStats }]
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      const parsed = JSON.parse(raw);
      return Object.assign({}, JSON.parse(JSON.stringify(defaultState)), parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage quota errors
    }
    updateHeaderProgress();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ========================================================================
     1. THEME & NAVIGATION
     ======================================================================== */
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
      btn.innerHTML = theme === "dark" ? "☀️" : "🌙";
      btn.title = theme === "dark" ? "สลับเป็นโหมดสว่าง (Light Mode)" : "สลับเป็นโหมดมืด (Dark Mode)";
    }
  }

  function switchTab(tabId) {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === tabId);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (tabId === "tab-tools") {
      renderProgressDashboard();
    }
  }

  function updateHeaderProgress() {
    const totalTopics = window.AppData.studyTopics.length;
    const readCount = state.readTopics.length;
    const totalCards = window.AppData.flashcards.length;
    const masteredCount = state.masteredCards.length;
    const hasQuiz = state.ajPorHistory.length > 0 ? 1 : 0;
    const hasMock = state.mockExamHistory.length > 0 ? 1 : 0;

    // Weighted readiness percentage: 40% reading + 20% flashcards + 20% Aj.Por quiz + 20% Mock exam
    const pct = Math.round(
      (readCount / totalTopics) * 40 +
      (masteredCount / totalCards) * 20 +
      hasQuiz * 20 +
      hasMock * 20
    );

    const fill = document.getElementById("headerProgressFill");
    const text = document.getElementById("headerProgressText");
    if (fill) fill.style.width = pct + "%";
    if (text) text.textContent = pct + "%";
  }

  /* ========================================================================
     2. TAB 1: DETAILED STUDY GUIDE (Search, Category Filter, Accordions)
     ======================================================================== */
  let currentStudyCat = "all";
  let currentSearchQuery = "";
  let openTopicIds = new Set(["topic-1"]);

  function highlightMatches(htmlString, query) {
    if (!query || query.trim().length < 2) return htmlString;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})(?![^<]*>)`, "gi");
    return htmlString.replace(regex, '<mark class="search-hl">$1</mark>');
  }

  function renderStudyCategoryPills() {
    const container = document.getElementById("studyCategoryPills");
    if (!container) return;
    container.innerHTML = window.AppData.studyCategories
      .map(
        (cat) => `
        <button type="button" class="filter-pill ${cat.id === currentStudyCat ? "active" : ""}" data-cat="${cat.id}">
          ${escapeHtml(cat.label)}
        </button>`
      )
      .join("");

    container.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentStudyCat = btn.dataset.cat;
        renderStudyCategoryPills();
        renderStudyGuide();
      });
    });
  }

  function renderStudyGuide() {
    const listEl = document.getElementById("studyAccordionList");
    const countEl = document.getElementById("studyMatchCount");
    if (!listEl) return;

    const q = currentSearchQuery.trim().toLowerCase();
    const filtered = window.AppData.studyTopics.filter((topic) => {
      const catMatch = currentStudyCat === "all" || topic.category === currentStudyCat;
      if (!catMatch) return false;
      if (!q) return true;
      const plainText = topic.html.replace(/<[^>]+>/g, " ").toLowerCase();
      return (
        topic.title.toLowerCase().includes(q) ||
        topic.subtitle.toLowerCase().includes(q) ||
        topic.keywords.some((k) => k.toLowerCase().includes(q)) ||
        plainText.includes(q)
      );
    });

    if (countEl) {
      const readCount = state.readTopics.length;
      countEl.textContent = `แสดง ${filtered.length} จาก ${window.AppData.studyTopics.length} หัวข้อ • อ่านจบแล้ว ${readCount}/${window.AppData.studyTopics.length} บท`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="comparison-card" style="text-align:center; padding:2.5rem 1rem;">
          <h3>🔍 ไม่พบคำค้นหา "${escapeHtml(currentSearchQuery)}"</h3>
          <p style="color:var(--text-muted); margin-top:0.4rem;">ลองค้นหาด้วยคำสำคัญอื่น เช่น IOC, t-test, สมมติฐาน, เครจซี่, E1/E2, อภิปรายผล</p>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((topic) => {
        const isRead = state.readTopics.includes(topic.id);
        const isOpen = q.length >= 2 || openTopicIds.has(topic.id);
        const catObj = window.AppData.studyCategories.find((c) => c.id === topic.category);
        const catLabel = catObj ? catObj.label : "";
        const titleHtml = highlightMatches(escapeHtml(topic.title), currentSearchQuery);
        const subHtml = highlightMatches(escapeHtml(topic.subtitle), currentSearchQuery);
        const bodyHtml = highlightMatches(topic.html, currentSearchQuery);

        return `
        <article class="accordion-item ${isOpen ? "open" : ""} ${isRead ? "is-read" : ""}" id="card-${topic.id}">
          <button type="button" class="accordion-header" data-topic-toggle="${topic.id}">
            <div class="accordion-title-group">
              <div class="topic-num-badge">${isRead ? "✓" : topic.num}</div>
              <div class="accordion-title-text">
                <h3>${titleHtml}</h3>
                <div class="accordion-subtitle">${subHtml}</div>
              </div>
            </div>
            <div class="accordion-meta">
              <span class="badge ${isRead ? "badge-teal" : "badge-indigo"}">${isRead ? "อ่านจบแล้ว" : escapeHtml(catLabel)}</span>
              <span class="chevron-icon">▾</span>
            </div>
          </button>
          <div class="accordion-body">
            <div class="study-content">${bodyHtml}</div>
            <div class="study-footer-bar">
              <div class="kw-chips">
                ${topic.keywords.map((kw) => `<span class="kw-chip">#${escapeHtml(kw)}</span>`).join("")}
              </div>
              <button type="button" class="btn btn-sm ${isRead ? "btn-secondary" : "btn-outline"}" data-mark-read="${topic.id}">
                ${isRead ? "✅ อ่านจบแล้ว (กดเพื่อยกเลิก)" : "☑️ ทำเครื่องหมายว่าอ่านจบแล้ว"}
              </button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    // Bind toggle events
    listEl.querySelectorAll("[data-topic-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.topicToggle;
        const item = document.getElementById("card-" + id);
        if (!item) return;
        const nowOpen = !item.classList.contains("open");
        item.classList.toggle("open", nowOpen);
        if (nowOpen) openTopicIds.add(id);
        else openTopicIds.delete(id);
      });
    });

    // Bind mark-as-read events
    listEl.querySelectorAll("[data-mark-read]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.markRead;
        const idx = state.readTopics.indexOf(id);
        if (idx === -1) state.readTopics.push(id);
        else state.readTopics.splice(idx, 1);
        saveState();
        renderStudyGuide();
      });
    });
  }

  /* ========================================================================
     3. TAB 2: QUICK SUMMARY / MIND MAP CARDS & COMPARISON TABLES
     ======================================================================== */
  function renderQuickSummary() {
    const cardsEl = document.getElementById("mindMapGrid");
    const tablesEl = document.getElementById("comparisonTablesContainer");
    if (cardsEl) {
      cardsEl.innerHTML = window.AppData.mindMapCards
        .map(
          (c) => `
          <div class="mindmap-card">
            <div class="mindmap-card-head">
              <div class="mindmap-icon ${c.colorClass}">${c.icon}</div>
              <h3>${escapeHtml(c.title)}</h3>
            </div>
            <div class="kw-chips">
              ${c.keywords.map((k) => `<span class="kw-chip">${escapeHtml(k)}</span>`).join("")}
            </div>
            <ul class="mindmap-list">
              ${c.bullets.map((b) => `<li>${b}</li>`).join("")}
            </ul>
          </div>`
        )
        .join("");
    }

    if (tablesEl) {
      tablesEl.innerHTML = window.AppData.comparisonTables
        .map(
          (tbl) => `
          <div class="comparison-card">
            <h3>${escapeHtml(tbl.title)}</h3>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>${tbl.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
                </thead>
                <tbody>
                  ${tbl.rows
                    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>`
        )
        .join("");
    }
  }

  /* ========================================================================
     4. TAB 3: LAST-MINUTE CHEAT SHEET / ONE-PAGE CRAM
     ======================================================================== */
  function renderCheatSheet() {
    const formulasEl = document.getElementById("cramFormulasList");
    const thresholdsEl = document.getElementById("cramThresholdsList");
    const tricksEl = document.getElementById("cramFiveSecGrid");

    if (formulasEl) {
      formulasEl.innerHTML = window.AppData.cheatSheet.formulas
        .map(
          (f) => `
          <div style="padding:0.65rem 0.8rem; background:var(--bg-surface-alt); border-radius:var(--radius-sm); margin-bottom:0.6rem; border-left:3px solid var(--primary);">
            <div style="font-weight:700; font-size:0.93rem;">${escapeHtml(f.label)}</div>
            <div class="font-heading" style="color:var(--primary); font-weight:700; font-size:1rem; margin:0.2rem 0;">${escapeHtml(f.value)}</div>
            <div style="font-size:0.84rem; color:var(--text-secondary);">${escapeHtml(f.note)}</div>
          </div>`
        )
        .join("");
    }

    if (thresholdsEl) {
      thresholdsEl.innerHTML = window.AppData.cheatSheet.thresholds
        .map(
          (t) => `
          <div class="metric-row">
            <span class="metric-label">${escapeHtml(t.label)}</span>
            <span class="metric-val">${escapeHtml(t.value)}</span>
          </div>`
        )
        .join("");
    }

    if (tricksEl) {
      tricksEl.innerHTML = window.AppData.cheatSheet.fiveSecTricks
        .map(
          (tr) => `
          <div class="trick-card">
            <h4>${escapeHtml(tr.title)}</h4>
            ${tr.items
              .map(
                (it) => `
                <div class="trick-pair">
                  <div class="trick-if">${escapeHtml(it.q)}</div>
                  <div class="trick-then">${escapeHtml(it.a)}</div>
                </div>`
              )
              .join("")}
          </div>`
        )
        .join("");
    }
  }

  /* ========================================================================
     5. TAB 4: AJ. POR'S PRACTICE QUIZ (20 QUESTIONS)
     ======================================================================== */
  let ajQuizState = {
    feedbackMode: "instant",   // "instant" | "end"
    part2Style: "both",        // "written" | "mcq" | "both"
    answers: {},               // { [id]: "A"|"B"|"C"|"D" }
    writtenInputs: {},         // { [id]: string }
    checkedIds: {},            // { [id]: boolean }
    submittedAll: false
  };

  function evaluateHybridWritten(qObj, textInput) {
    if (!textInput || !textInput.trim()) return false;
    const normalized = textInput.trim().toLowerCase();
    if (qObj.mustNotContain && qObj.mustNotContain.some((bad) => normalized.includes(bad.toLowerCase()))) {
      return false;
    }
    return qObj.acceptedKeywords.some((kw) => normalized.includes(kw.toLowerCase()));
  }

  function isAjQuestionCorrect(qObj) {
    if (qObj.type === "mcq") {
      return ajQuizState.answers[qObj.id] === qObj.answer;
    }
    // For hybrid Q18-20: correct if MCQ choice matches OR written input passes check
    const mcqOk = ajQuizState.answers[qObj.id] === qObj.answer;
    const writtenOk = evaluateHybridWritten(qObj, ajQuizState.writtenInputs[qObj.id]);
    if (ajQuizState.part2Style === "mcq") return mcqOk;
    if (ajQuizState.part2Style === "written") return writtenOk;
    return mcqOk || writtenOk;
  }

  function renderAjPorQuiz() {
    const container = document.getElementById("ajPorQuizContainer");
    const banner = document.getElementById("ajPorScoreBanner");
    if (!container) return;

    // Score banner if submittedAll or all 20 checked in instant mode
    const totalCount = window.AppData.ajPorQuiz.length;
    const checkedCount = Object.keys(ajQuizState.checkedIds).length;
    const showFinalBanner = ajQuizState.submittedAll || (ajQuizState.feedbackMode === "instant" && checkedCount === totalCount);

    if (banner) {
      if (showFinalBanner) {
        let correctTotal = 0;
        window.AppData.ajPorQuiz.forEach((q) => {
          if (isAjQuestionCorrect(q)) correctTotal++;
        });
        const pct = Math.round((correctTotal / totalCount) * 100);
        banner.style.display = "block";
        banner.innerHTML = `
          <div class="score-result-card">
            <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem;">
              <div>
                <span class="badge badge-teal">สรุปผลแบบทดสอบของอาจารย์ปอ (20 ข้อ)</span>
                <div class="score-big" style="margin-top:0.35rem;">${correctTotal} / ${totalCount} คะแนน (${pct}%)</div>
                <p style="color:var(--text-secondary); margin-top:0.25rem;">
                  ${pct >= 80 ? "🎉 ยอดเยี่ยมมาก! แม่นยำทั้งทฤษฎีและการคำนวณ พร้อมลงสนามสอบจริง!" : pct >= 60 ? "👍 ทำได้ดี! ทบทวนข้อที่ยังพลาดด้านล่างอีกนิดเพื่ออัพคะแนนทะลุ 80%" : "💪 ไม่เป็นไรนะ! อ่านคำอธิบายเฉลยละเอียดทุกข้อด้านล่างแล้วลองกดทำใหม่อีกรอบ"}
                </p>
              </div>
              <button type="button" class="btn btn-primary" id="ajQuizRetryBannerBtn">🔄 เริ่มทำใหม่ทั้งหมด</button>
            </div>
          </div>`;
        const retryBtn = document.getElementById("ajQuizRetryBannerBtn");
        if (retryBtn) retryBtn.addEventListener("click", resetAjPorQuiz);
      } else {
        banner.style.display = "none";
        banner.innerHTML = "";
      }
    }

    let html = "";
    window.AppData.ajPorQuiz.forEach((q) => {
      if (q.id === 1) {
        html += `<h3 class="section-heading" style="margin-top:0.5rem;">📌 ส่วนที่ 1: ข้อสอบปรนัย 4 ตัวเลือก (ข้อ 1 – 17)</h3>`;
      } else if (q.id === 18) {
        html += `
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:0.75rem; margin:2rem 0 1rem;">
            <h3 class="section-heading" style="margin:0;">🧮 ส่วนที่ 2: ข้อสอบวิเคราะห์และคำนวณ (ข้อ 18 – 20)</h3>
            <div class="mode-switch-group">
              <button type="button" class="mode-switch-btn ${ajQuizState.part2Style === "both" ? "active" : ""}" data-p2style="both">ทั้งพิมพ์ตอบ + ตัวเลือกจำลอง</button>
              <button type="button" class="mode-switch-btn ${ajQuizState.part2Style === "written" ? "active" : ""}" data-p2style="written">พิมพ์ตอบอย่างเดียว</button>
              <button type="button" class="mode-switch-btn ${ajQuizState.part2Style === "mcq" ? "active" : ""}" data-p2style="mcq">4 ตัวเลือกจำลอง</button>
            </div>
          </div>`;
      }

      const isRevealed = ajQuizState.submittedAll || (ajQuizState.feedbackMode === "instant" && ajQuizState.checkedIds[q.id]);
      const isCorrect = isRevealed ? isAjQuestionCorrect(q) : null;
      const cardStatusClass = isRevealed ? (isCorrect ? "answered-correct" : "answered-wrong") : "";

      const showMcqOptions = q.type === "mcq" || ajQuizState.part2Style === "mcq" || ajQuizState.part2Style === "both";
      const showWrittenBox = q.type === "hybrid" && (ajQuizState.part2Style === "written" || ajQuizState.part2Style === "both");

      html += `
        <div class="question-card ${cardStatusClass}" id="ajq-${q.id}">
          <div class="q-header">
            <span class="q-number">ข้อที่ ${q.id} / 20</span>
            <div style="display:flex; gap:0.45rem; align-items:center;">
              <span class="badge badge-indigo">${escapeHtml(q.category)}</span>
              ${isRevealed ? `<span class="badge ${isCorrect ? "badge-teal" : "badge-rose"}">${isCorrect ? "✓ ตอบถูก" : "✗ ตอบผิด"}</span>` : ""}
            </div>
          </div>
          <div class="q-text">${escapeHtml(q.question)}</div>

          ${
            showMcqOptions
              ? `<div class="options-grid">
                  ${["A", "B", "C", "D"]
                    .map((letter) => {
                      const selected = ajQuizState.answers[q.id] === letter;
                      let stateCls = selected ? "selected" : "";
                      if (isRevealed) {
                        if (letter === q.answer) stateCls += " correct";
                        else if (selected && letter !== q.answer) stateCls += " wrong";
                      }
                      return `
                        <button type="button" class="option-btn ${stateCls}" data-aj-opt="${q.id}" data-letter="${letter}" ${ajQuizState.submittedAll ? "disabled" : ""}>
                          <span class="opt-letter">${letter}</span>
                          <span>${escapeHtml(q.options[letter])}</span>
                        </button>`;
                    })
                    .join("")}
                </div>`
              : ""
          }

          ${
            showWrittenBox
              ? `<div class="written-answer-box" style="${showMcqOptions ? "margin-top:0.9rem;" : ""}">
                  <div style="font-family:var(--font-heading); font-size:0.86rem; font-weight:600; color:var(--secondary);">
                    ✍️ ฝึกพิมพ์คำตอบ / วิธีคิดด้วยตนเอง:
                  </div>
                  <div class="written-input-row">
                    <input type="text" class="written-input" data-aj-written="${q.id}" value="${escapeHtml(ajQuizState.writtenInputs[q.id] || "")}" placeholder="${escapeHtml(q.placeholder)}" ${ajQuizState.submittedAll ? "disabled" : ""}>
                    <button type="button" class="btn btn-secondary btn-sm" data-aj-check-written="${q.id}" ${ajQuizState.submittedAll ? "disabled" : ""}>ตรวจคำตอบข้อนี้</button>
                  </div>
                </div>`
              : ""
          }

          ${
            isRevealed
              ? `<div class="explanation-box">
                  <strong class="exp-title">💡 เฉลย: ${q.type === "hybrid" ? escapeHtml(q.modelAnswer) + " (ตัวเลือก " + q.answer + ")" : "ตัวเลือก " + q.answer}</strong>
                  <div>${escapeHtml(q.explanation)}</div>
                </div>`
              : ""
          }
        </div>`;
    });

    if (ajQuizState.feedbackMode === "end" && !ajQuizState.submittedAll) {
      const answeredSoFar = window.AppData.ajPorQuiz.filter(
        (q) => ajQuizState.answers[q.id] || (ajQuizState.writtenInputs[q.id] && ajQuizState.writtenInputs[q.id].trim())
      ).length;
      html += `
        <div class="comparison-card" style="text-align:center;">
          <p style="margin-bottom:0.85rem; font-family:var(--font-heading);">ตอบไปแล้ว <strong>${answeredSoFar} / 20</strong> ข้อ</p>
          <button type="button" class="btn btn-primary" id="ajSubmitAllBtn">📝 ส่งตรวจคำตอบทั้ง 20 ข้อพร้อมดูเฉลยละเอียด</button>
        </div>`;
    }

    container.innerHTML = html;

    // Bind Part 2 style switch
    container.querySelectorAll("[data-p2style]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ajQuizState.part2Style = btn.dataset.p2style;
        renderAjPorQuiz();
      });
    });

    // Bind MCQ option clicks
    container.querySelectorAll("[data-aj-opt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const qId = Number(btn.dataset.ajOpt);
        const letter = btn.dataset.letter;
        ajQuizState.answers[qId] = letter;
        if (ajQuizState.feedbackMode === "instant") {
          ajQuizState.checkedIds[qId] = true;
          maybeRecordAjQuizScore();
        }
        renderAjPorQuiz();
      });
    });

    // Bind Written input & check button
    container.querySelectorAll("[data-aj-written]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const qId = Number(inp.dataset.ajWritten);
        ajQuizState.writtenInputs[qId] = inp.value;
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const qId = Number(inp.dataset.ajWritten);
          ajQuizState.checkedIds[qId] = true;
          maybeRecordAjQuizScore();
          renderAjPorQuiz();
        }
      });
    });

    container.querySelectorAll("[data-aj-check-written]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const qId = Number(btn.dataset.ajCheckWritten);
        ajQuizState.checkedIds[qId] = true;
        maybeRecordAjQuizScore();
        renderAjPorQuiz();
      });
    });

    const submitAllBtn = document.getElementById("ajSubmitAllBtn");
    if (submitAllBtn) {
      submitAllBtn.addEventListener("click", () => {
        ajQuizState.submittedAll = true;
        saveAjQuizAttempt();
        renderAjPorQuiz();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  function maybeRecordAjQuizScore() {
    if (Object.keys(ajQuizState.checkedIds).length === window.AppData.ajPorQuiz.length) {
      saveAjQuizAttempt();
    }
  }

  function saveAjQuizAttempt() {
    let score = 0;
    window.AppData.ajPorQuiz.forEach((q) => {
      if (isAjQuestionCorrect(q)) score++;
    });
    state.ajPorHistory.unshift({
      date: new Date().toLocaleString("th-TH"),
      score,
      total: window.AppData.ajPorQuiz.length,
      mode: ajQuizState.feedbackMode === "instant" ? "ตรวจทันที" : "ส่งตรวจเมื่อเสร็จ"
    });
    state.ajPorHistory = state.ajPorHistory.slice(0, 10);
    saveState();
  }

  function resetAjPorQuiz() {
    ajQuizState.answers = {};
    ajQuizState.writtenInputs = {};
    ajQuizState.checkedIds = {};
    ajQuizState.submittedAll = false;
    renderAjPorQuiz();
  }

  /* ========================================================================
     6. TAB 5: MOCK FINAL EXAM SIMULATOR (40 QUESTIONS)
     ======================================================================== */
  let mockState = {
    started: false,
    submitted: false,
    durationMinutes: 60,
    shuffleEnabled: false,
    remainingSec: 3600,
    elapsedSec: 0,
    timerInterval: null,
    questions: [],           // ordered list of 40 questions
    currentIndex: 0,
    answers: {},             // { [q.id]: "A"|"B"|"C"|"D" }
    flagged: {},             // { [q.id]: true }
    reviewFilter: "all"      // "all" | "wrong" | "flagged"
  };

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function formatClock(sec) {
    if (sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function startMockExam() {
    clearInterval(mockState.timerInterval);
    const durSel = document.getElementById("mockDurationSelect");
    const shufChk = document.getElementById("mockShuffleToggle");
    mockState.durationMinutes = durSel ? Number(durSel.value) : 60;
    mockState.shuffleEnabled = shufChk ? shufChk.checked : false;

    mockState.questions = mockState.shuffleEnabled
      ? shuffleArray(window.AppData.mockExamQuestions)
      : window.AppData.mockExamQuestions.slice();
    mockState.started = true;
    mockState.submitted = false;
    mockState.currentIndex = 0;
    mockState.answers = {};
    mockState.flagged = {};
    mockState.elapsedSec = 0;
    mockState.remainingSec = mockState.durationMinutes * 60;
    mockState.reviewFilter = "all";

    if (mockState.durationMinutes > 0) {
      mockState.timerInterval = setInterval(() => {
        mockState.elapsedSec++;
        mockState.remainingSec--;
        updateMockTimerUI();
        if (mockState.remainingSec <= 0) {
          submitMockExam(true);
        }
      }, 1000);
    } else {
      mockState.timerInterval = setInterval(() => {
        mockState.elapsedSec++;
        updateMockTimerUI();
      }, 1000);
    }

    renderMockExamView();
  }

  function updateMockTimerUI() {
    const clockEl = document.getElementById("mockTimerClock");
    if (!clockEl) return;
    if (mockState.durationMinutes > 0) {
      clockEl.textContent = formatClock(mockState.remainingSec);
      clockEl.classList.toggle("warning", mockState.remainingSec <= 300);
    } else {
      clockEl.textContent = formatClock(mockState.elapsedSec);
      clockEl.classList.remove("warning");
    }
  }

  function submitMockExam(autoTimeout) {
    clearInterval(mockState.timerInterval);
    mockState.submitted = true;

    let score = 0;
    const catMap = {};
    mockState.questions.forEach((q) => {
      if (!catMap[q.category]) catMap[q.category] = { correct: 0, total: 0 };
      catMap[q.category].total++;
      if (mockState.answers[q.id] === q.answer) {
        score++;
        catMap[q.category].correct++;
      }
    });

    state.mockExamHistory.unshift({
      date: new Date().toLocaleString("th-TH"),
      score,
      total: mockState.questions.length,
      durationSec: mockState.elapsedSec,
      autoTimeout: !!autoTimeout,
      categoryStats: catMap
    });
    state.mockExamHistory = state.mockExamHistory.slice(0, 10);
    saveState();

    renderMockExamView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderMockExamView() {
    const root = document.getElementById("mockExamRoot");
    if (!root) return;

    // 1. Pre-start lobby screen
    if (!mockState.started) {
      const lastAttempt = state.mockExamHistory[0];
      root.innerHTML = `
        <div class="comparison-card" style="max-width:780px; margin:0 auto; padding:2rem;">
          <span class="badge badge-indigo">Final Exam Simulation • 40 ข้อ</span>
          <h3 style="font-size:1.35rem; margin-top:0.6rem; color:var(--text-primary);">สนามจำลองสอบปลายภาคเสมือนจริง (4 ตัวเลือก จำนวน 40 ข้อ)</h3>
          <p style="color:var(--text-secondary); margin-bottom:1.25rem;">
            ข้อสอบชุดใหม่ 40 ข้อ ครอบคลุมครบทุกหัวข้อตามขอบเขตการสอบปลายภาคของอาจารย์ปอ พร้อมระบบจับเวลา คั่นหน้าข้อที่ไม่มั่นใจ (Flag) และรายงานวิเคราะห์จุดอ่อนรายหมวดหมู่เมื่อส่งข้อสอบ
          </p>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:1rem; margin-bottom:1.35rem;">
            <div class="form-group">
              <label for="mockDurationSelect">⏱️ เวลาในการทำข้อสอบ</label>
              <select id="mockDurationSelect" class="form-input">
                <option value="60" selected>60 นาที (มาตรฐานห้องสอบ)</option>
                <option value="45">45 นาที (ฝึกสปีดทำข้อสอบไว)</option>
                <option value="90">90 นาที (อ่านวิเคราะห์สบายๆ)</option>
                <option value="0">ไม่จำกัดเวลา (จับเวลาเดินหน้า)</option>
              </select>
            </div>
            <div class="form-group" style="justify-content:end;">
              <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; padding:0.62rem 0.85rem; background:var(--bg-body); border:1px solid var(--border-strong); border-radius:var(--radius-sm);">
                <input type="checkbox" id="mockShuffleToggle" style="width:18px; height:18px;">
                <span>🔀 สุ่มลำดับข้อสอบใหม่ทุกครั้ง</span>
              </label>
            </div>
          </div>

          ${
            lastAttempt
              ? `<div style="padding:0.85rem 1rem; background:var(--bg-teal-soft); border-radius:var(--radius-sm); margin-bottom:1.25rem; font-size:0.92rem;">
                  📊 <strong>สถิติครั้งล่าสุดของคุณ:</strong> ได้คะแนน <strong>${lastAttempt.score}/${lastAttempt.total} (${Math.round((lastAttempt.score / lastAttempt.total) * 100)}%)</strong> เมื่อ ${escapeHtml(lastAttempt.date)}
                </div>`
              : ""
          }

          <button type="button" class="btn btn-primary" id="startMockExamBtn" style="width:100%; padding:0.85rem; font-size:1rem;">
            🚀 เริ่มทำข้อสอบจำลองปลายภาค 40 ข้อ
          </button>
        </div>`;

      document.getElementById("startMockExamBtn").addEventListener("click", startMockExam);
      return;
    }

    // 2. Active Exam Screen (1 question at a time + Full Grid Navigator for clean focus, plus option to view all)
    if (!mockState.submitted) {
      const q = mockState.questions[mockState.currentIndex];
      const answeredCount = Object.keys(mockState.answers).length;
      const flaggedCount = Object.keys(mockState.flagged).filter((k) => mockState.flagged[k]).length;
      const isFlagged = !!mockState.flagged[q.id];

      root.innerHTML = `
        <div class="mock-layout">
          <div class="mock-main">
            <div class="question-card ${isFlagged ? "flagged" : ""}">
              <div class="q-header">
                <div style="display:flex; align-items:center; gap:0.55rem;">
                  <span class="q-number">ข้อที่ ${mockState.currentIndex + 1} / ${mockState.questions.length}</span>
                  <span class="badge badge-indigo">${escapeHtml(q.category)}</span>
                </div>
                <button type="button" class="btn btn-sm ${isFlagged ? "btn-secondary" : "btn-outline"}" id="mockFlagBtn">
                  ${isFlagged ? "🚩 คั่นหน้าไว้แล้ว (กดเพื่อเอาออก)" : "🏳️ คั่นหน้าทบทวนทีหลัง (Flag)"}
                </button>
              </div>

              <div class="q-text">${escapeHtml(q.question)}</div>

              <div class="options-grid">
                ${["A", "B", "C", "D"]
                  .map((letter) => {
                    const selected = mockState.answers[q.id] === letter;
                    return `
                      <button type="button" class="option-btn ${selected ? "selected" : ""}" data-mock-choice="${letter}">
                        <span class="opt-letter">${letter}</span>
                        <span>${escapeHtml(q.options[letter])}</span>
                      </button>`;
                  })
                  .join("")}
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border-color); gap:0.75rem; flex-wrap:wrap;">
                <button type="button" class="btn btn-outline" id="mockPrevBtn" ${mockState.currentIndex === 0 ? "disabled" : ""}>← ข้อก่อนหน้า</button>
                <span style="font-size:0.88rem; color:var(--text-muted);">คลิกตัวเลือก A–D เพื่อบันทึกคำตอบอัตโนมัติ</span>
                ${
                  mockState.currentIndex < mockState.questions.length - 1
                    ? `<button type="button" class="btn btn-primary" id="mockNextBtn">ข้อถัดไป →</button>`
                    : `<button type="button" class="btn btn-secondary" id="mockFinishInlineBtn">✅ ส่งกระดาษคำตอบ</button>`
                }
              </div>
            </div>
          </div>

          <aside class="mock-sidebar">
            <div class="timer-display">
              <div style="font-size:0.78rem; color:var(--text-muted); font-family:var(--font-heading);">
                ${mockState.durationMinutes > 0 ? "⏳ เวลาที่เหลือ" : "⏱️ เวลาที่ใช้ไป"}
              </div>
              <div class="timer-clock" id="mockTimerClock">
                ${formatClock(mockState.durationMinutes > 0 ? mockState.remainingSec : mockState.elapsedSec)}
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:0.83rem; color:var(--text-secondary); margin-bottom:0.4rem;">
              <span>ตอบแล้ว: <strong>${answeredCount}/40</strong></span>
              <span>ปักธง: <strong>${flaggedCount}</strong> ข้อ</span>
            </div>

            <div class="q-nav-grid">
              ${mockState.questions
                .map((item, idx) => {
                  const ans = !!mockState.answers[item.id];
                  const flg = !!mockState.flagged[item.id];
                  const cur = idx === mockState.currentIndex;
                  return `<button type="button" class="q-nav-dot ${cur ? "current" : ""} ${ans ? "answered" : ""} ${flg ? "flagged" : ""}" data-mock-jump="${idx}">${idx + 1}</button>`;
                })
                .join("")}
            </div>

            <button type="button" class="btn btn-primary" id="mockSubmitSidebarBtn" style="width:100%; margin-top:0.8rem;">
              📨 ส่งข้อสอบประเมินผล (${answeredCount}/40)
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="mockCancelBtn" style="width:100%; margin-top:0.5rem;">
              ยกเลิกและกลับหน้าตั้งค่า
            </button>
          </aside>
        </div>`;

      // Bind choice selection
      root.querySelectorAll("[data-mock-choice]").forEach((btn) => {
        btn.addEventListener("click", () => {
          mockState.answers[q.id] = btn.dataset.mockChoice;
          renderMockExamView();
        });
      });

      // Flag button
      document.getElementById("mockFlagBtn").addEventListener("click", () => {
        mockState.flagged[q.id] = !mockState.flagged[q.id];
        renderMockExamView();
      });

      // Prev / Next
      const prevBtn = document.getElementById("mockPrevBtn");
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          if (mockState.currentIndex > 0) {
            mockState.currentIndex--;
            renderMockExamView();
          }
        });
      }
      const nextBtn = document.getElementById("mockNextBtn");
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          if (mockState.currentIndex < mockState.questions.length - 1) {
            mockState.currentIndex++;
            renderMockExamView();
          }
        });
      }

      // Grid jump
      root.querySelectorAll("[data-mock-jump]").forEach((dot) => {
        dot.addEventListener("click", () => {
          mockState.currentIndex = Number(dot.dataset.mockJump);
          renderMockExamView();
        });
      });

      // Submit handlers
      const handleConfirmSubmit = () => {
        const unanswered = mockState.questions.length - Object.keys(mockState.answers).length;
        if (unanswered > 0) {
          const ok = window.confirm(`คุณยังไม่ได้ตอบข้อสอบอีก ${unanswered} ข้อ ยืนยันที่จะส่งกระดาษคำตอบเลยหรือไม่?`);
          if (!ok) return;
        }
        submitMockExam(false);
      };

      document.getElementById("mockSubmitSidebarBtn").addEventListener("click", handleConfirmSubmit);
      const inlineFinish = document.getElementById("mockFinishInlineBtn");
      if (inlineFinish) inlineFinish.addEventListener("click", handleConfirmSubmit);

      document.getElementById("mockCancelBtn").addEventListener("click", () => {
        if (window.confirm("ต้องการยกเลิกการสอบรอบนี้และกลับไปยังหน้าตั้งค่าหรือไม่?")) {
          clearInterval(mockState.timerInterval);
          mockState.started = false;
          renderMockExamView();
        }
      });
      return;
    }

    // 3. Post-Submit Weakness Analysis & Full Detailed Solutions View
    const latest = state.mockExamHistory[0];
    const score = latest ? latest.score : 0;
    const total = mockState.questions.length;
    const pct = Math.round((score / total) * 100);
    const catStats = latest ? latest.categoryStats : {};

    // Identify weakest categories (< 70%)
    const weakCats = Object.entries(catStats)
      .filter(([, st]) => st.correct / st.total < 0.7)
      .map(([name]) => name);

    const reviewList = mockState.questions.filter((q) => {
      if (mockState.reviewFilter === "wrong") return mockState.answers[q.id] !== q.answer;
      if (mockState.reviewFilter === "flagged") return !!mockState.flagged[q.id];
      return true;
    });

    root.innerHTML = `
      <div class="score-result-card">
        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem;">
          <div>
            <span class="badge badge-indigo">ผลการสอบปลายภาคจำลอง (Mock Final Exam)</span>
            <div class="score-big" style="margin-top:0.35rem;">${score} / ${total} คะแนน (${pct}%)</div>
            <p style="color:var(--text-secondary); margin-top:0.3rem;">
              เวลาที่ใช้: <strong>${formatClock(mockState.elapsedSec)} นาที</strong> •
              ${pct >= 80 ? "🏆 ระดับดีเยี่ยม (A) — พร้อมสอบปลายภาคจริงแบบมั่นใจเต็มร้อย!" : pct >= 65 ? "✨ ระดับดี (B) — เก็บตกจุดอ่อนอีกนิดมีสิทธิ์คว้า A สบายๆ!" : "📚 แนะนำทบทวนหมวดที่คะแนนต่ำกว่า 70% ด้านล่าง แล้วลองสอบซ้ำอีกครั้ง"}
            </p>
          </div>
          <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="mockNewExamBtn">🔄 สอบใหม่อีกรอบ</button>
            <button type="button" class="btn btn-outline" id="mockGoCheatSheetBtn">⚡ เปิดดูสรุปก่อนสอบ</button>
          </div>
        </div>

        <h4 style="margin-top:1.4rem; font-size:1rem;">📊 วิเคราะห์จุดแข็ง-จุดอ่อนรายหมวดเนื้อหา</h4>
        <div class="weakness-grid">
          ${Object.entries(catStats)
            .map(([catName, st]) => {
              const catPct = Math.round((st.correct / st.total) * 100);
              const barColor = catPct >= 75 ? "var(--accent-emerald)" : catPct >= 50 ? "var(--accent-amber)" : "var(--accent-rose)";
              return `
                <div class="cat-stat-item">
                  <div class="cat-stat-head">
                    <span>${escapeHtml(catName)}</span>
                    <span>${st.correct}/${st.total} (${catPct}%)</span>
                  </div>
                  <div class="cat-bar-track">
                    <div class="cat-bar-fill" style="width:${catPct}%; background:${barColor};"></div>
                  </div>
                </div>`;
            })
            .join("")}
        </div>

        ${
          weakCats.length > 0
            ? `<div style="margin-top:1rem; padding:0.85rem 1rem; background:var(--bg-amber-soft); border-left:4px solid var(--accent-amber); border-radius:6px; font-size:0.93rem;">
                🎯 <strong>จุดที่ควรทบทวนเพิ่มก่อนเข้าห้องสอบ:</strong> ${weakCats.map(escapeHtml).join(" , ")}
              </div>`
            : `<div style="margin-top:1rem; padding:0.85rem 1rem; background:var(--bg-teal-soft); border-left:4px solid var(--accent-emerald); border-radius:6px; font-size:0.93rem;">
                🌟 <strong>ยอดเยี่ยม!</strong> คุณทำคะแนนผ่านเกณฑ์ 70% ขึ้นไปในทุกหมวดเนื้อหาการสอบ!
              </div>`
        }
      </div>

      <div class="quiz-controls-bar">
        <div style="font-family:var(--font-heading); font-weight:600;">📖 เฉลยละเอียดรายข้อ (${reviewList.length} ข้อ)</div>
        <div class="mode-switch-group">
          <button type="button" class="mode-switch-btn ${mockState.reviewFilter === "all" ? "active" : ""}" data-mock-rev="all">ดูทั้งหมด (40)</button>
          <button type="button" class="mode-switch-btn ${mockState.reviewFilter === "wrong" ? "active" : ""}" data-mock-rev="wrong">เฉพาะข้อที่ผิด (${total - score})</button>
          <button type="button" class="mode-switch-btn ${mockState.reviewFilter === "flagged" ? "active" : ""}" data-mock-rev="flagged">ข้อที่ปักธงไว้</button>
        </div>
      </div>

      ${reviewList
        .map((q) => {
          const origIdx = mockState.questions.indexOf(q) + 1;
          const userAns = mockState.answers[q.id];
          const isOk = userAns === q.answer;
          return `
            <div class="question-card ${isOk ? "answered-correct" : "answered-wrong"}">
              <div class="q-header">
                <span class="q-number">ข้อที่ ${origIdx}</span>
                <div style="display:flex; gap:0.45rem; align-items:center;">
                  <span class="badge badge-indigo">${escapeHtml(q.category)}</span>
                  ${mockState.flagged[q.id] ? `<span class="badge badge-amber">🚩 ปักธง</span>` : ""}
                  <span class="badge ${isOk ? "badge-teal" : "badge-rose"}">${isOk ? "✓ ถูกต้อง" : userAns ? "✗ ตอบ " + userAns : "✗ ไม่ได้ตอบ"}</span>
                </div>
              </div>
              <div class="q-text">${escapeHtml(q.question)}</div>
              <div class="options-grid">
                ${["A", "B", "C", "D"]
                  .map((letter) => {
                    let cls = "";
                    if (letter === q.answer) cls = "correct";
                    else if (userAns === letter) cls = "wrong";
                    return `
                      <div class="option-btn ${cls}" style="cursor:default;">
                        <span class="opt-letter">${letter}</span>
                        <span>${escapeHtml(q.options[letter])}</span>
                      </div>`;
                  })
                  .join("")}
              </div>
              <div class="explanation-box">
                <strong class="exp-title">💡 เฉลย: ตัวเลือก ${q.answer}</strong>
                <div>${escapeHtml(q.explanation)}</div>
              </div>
            </div>`;
        })
        .join("")}
    `;

    document.getElementById("mockNewExamBtn").addEventListener("click", () => {
      mockState.started = false;
      mockState.submitted = false;
      renderMockExamView();
    });

    document.getElementById("mockGoCheatSheetBtn").addEventListener("click", () => {
      switchTab("tab-cram");
    });

    root.querySelectorAll("[data-mock-rev]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mockState.reviewFilter = btn.dataset.mockRev;
        renderMockExamView();
      });
    });
  }

  /* ========================================================================
     7. TAB 6: FLASHCARDS, MINI CALCULATORS & PROGRESS DASHBOARD
     ======================================================================== */
  let fcState = {
    filter: "all",       // "all" | "review" | "unmastered"
    deck: window.AppData.flashcards.slice(),
    index: 0,
    flipped: false
  };

  function rebuildFlashcardDeck() {
    let base = window.AppData.flashcards.slice();
    if (fcState.filter === "review") {
      base = base.filter((c) => state.reviewCards.includes(c.id));
    } else if (fcState.filter === "unmastered") {
      base = base.filter((c) => !state.masteredCards.includes(c.id));
    }
    fcState.deck = base;
    fcState.index = 0;
    fcState.flipped = false;
    renderFlashcardUI();
  }

  function renderFlashcardUI() {
    const stageEl = document.getElementById("flashcardStageArea");
    const statsEl = document.getElementById("flashcardStatsLine");
    if (!stageEl) return;

    if (statsEl) {
      statsEl.textContent = `จำได้แม่นแล้ว ${state.masteredCards.length}/${window.AppData.flashcards.length} ใบ • ต้องทบทวนซ้ำ ${state.reviewCards.length} ใบ`;
    }

    if (fcState.deck.length === 0) {
      stageEl.innerHTML = `
        <div class="comparison-card" style="text-align:center; max-width:640px; margin:0 auto; padding:2rem;">
          <h3>🎉 ไม่มีแฟลชการ์ดค้างในหมวดที่เลือกแล้ว!</h3>
          <p style="color:var(--text-muted); margin:0.5rem 0 1rem;">คุณสามารถสลับกลับไปดูการ์ดทั้งหมด (${window.AppData.flashcards.length} ใบ) เพื่อทบทวนซ้ำได้ทุกเมื่อ</p>
          <button type="button" class="btn btn-primary" id="fcResetFilterBtn">ดูการ์ดทั้งหมด</button>
        </div>`;
      const btn = document.getElementById("fcResetFilterBtn");
      if (btn) {
        btn.addEventListener("click", () => {
          fcState.filter = "all";
          document.querySelectorAll("[data-fc-filter]").forEach((b) => b.classList.toggle("active", b.dataset.fcFilter === "all"));
          rebuildFlashcardDeck();
        });
      }
      return;
    }

    const card = fcState.deck[fcState.index];
    const isMastered = state.masteredCards.includes(card.id);
    const isReview = state.reviewCards.includes(card.id);

    stageEl.innerHTML = `
      <div class="flashcard-stage">
        <div class="flashcard-3d ${fcState.flipped ? "flipped" : ""}" id="activeFlashcard3D" tabindex="0" role="button" aria-label="คลิกเพื่อพลิกการ์ด">
          <div class="fc-face fc-front">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="badge badge-indigo">${escapeHtml(card.category)}</span>
              <span class="font-heading" style="font-size:0.85rem; color:var(--text-muted);">ใบที่ ${fcState.index + 1} / ${fcState.deck.length}</span>
            </div>
            <div class="fc-center">
              <div class="fc-term">${escapeHtml(card.term)}</div>
              <p style="color:var(--text-muted); font-size:0.98rem;">${escapeHtml(card.hint)}</p>
            </div>
            <div style="text-align:center; font-size:0.82rem; color:var(--primary); font-family:var(--font-heading);">
              👆 คลิกที่การ์ดเพื่อพลิกดูคำตอบ &nbsp; ${isMastered ? "• ✅ จำได้แล้ว" : isReview ? "• 🔁 รอทบทวนซ้ำ" : ""}
            </div>
          </div>
          <div class="fc-face fc-back">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="badge badge-teal">คำอธิบาย / คำตอบ</span>
              <span class="font-heading" style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(card.term)}</span>
            </div>
            <div class="fc-center">
              <div class="fc-answer" style="white-space:pre-line; text-align:left;">${escapeHtml(card.answer)}</div>
            </div>
            <div style="text-align:center; font-size:0.82rem; color:var(--text-muted); font-family:var(--font-heading);">
              👆 คลิกอีกครั้งเพื่อพลิกกลับด้านหน้า
            </div>
          </div>
        </div>
      </div>

      <div class="fc-controls">
        <button type="button" class="btn btn-outline" id="fcPrevBtn">← ก่อนหน้า</button>
        <button type="button" class="btn btn-danger-outline" id="fcMarkReviewBtn">🔁 ทบทวนซ้ำ</button>
        <button type="button" class="btn btn-secondary" id="fcMarkMasteredBtn">✅ จำได้แล้ว!</button>
        <button type="button" class="btn btn-outline" id="fcNextBtn">ถัดไป →</button>
      </div>
    `;

    document.getElementById("activeFlashcard3D").addEventListener("click", () => {
      fcState.flipped = !fcState.flipped;
      document.getElementById("activeFlashcard3D").classList.toggle("flipped", fcState.flipped);
    });

    document.getElementById("fcPrevBtn").addEventListener("click", () => {
      fcState.index = (fcState.index - 1 + fcState.deck.length) % fcState.deck.length;
      fcState.flipped = false;
      renderFlashcardUI();
    });

    document.getElementById("fcNextBtn").addEventListener("click", () => {
      fcState.index = (fcState.index + 1) % fcState.deck.length;
      fcState.flipped = false;
      renderFlashcardUI();
    });

    document.getElementById("fcMarkMasteredBtn").addEventListener("click", () => {
      if (!state.masteredCards.includes(card.id)) state.masteredCards.push(card.id);
      state.reviewCards = state.reviewCards.filter((id) => id !== card.id);
      saveState();
      if (fcState.index < fcState.deck.length - 1) fcState.index++;
      else fcState.index = 0;
      fcState.flipped = false;
      if (fcState.filter !== "all") rebuildFlashcardDeck();
      else renderFlashcardUI();
    });

    document.getElementById("fcMarkReviewBtn").addEventListener("click", () => {
      if (!state.reviewCards.includes(card.id)) state.reviewCards.push(card.id);
      state.masteredCards = state.masteredCards.filter((id) => id !== card.id);
      saveState();
      if (fcState.index < fcState.deck.length - 1) fcState.index++;
      else fcState.index = 0;
      fcState.flipped = false;
      renderFlashcardUI();
    });
  }

  /* ========================================================================
     8. MINI RESEARCH CALCULATORS (Gain %, E1/E2, IOC, Krejcie & Morgan)
     ======================================================================== */
  let iocExpertScores = [1, 1, 1]; // Default 3 experts

  function initCalculators() {
    // 1. Gain Score Calculator
    const runGainCalc = () => {
      const full = parseFloat(document.getElementById("calcFullScore").value);
      const pre = parseFloat(document.getElementById("calcPreScore").value);
      const post = parseFloat(document.getElementById("calcPostScore").value);
      const out = document.getElementById("calcGainOutput");
      if (!out) return;

      if (isNaN(full) || full <= 0 || isNaN(pre) || isNaN(post)) {
        out.innerHTML = `<span style="color:var(--accent-rose);">กรุณากรอกคะแนนเต็ม คะแนนก่อนเรียน และคะแนนหลังเรียนให้ถูกต้อง</span>`;
        return;
      }
      if (pre > full || post > full || pre < 0 || post < 0) {
        out.innerHTML = `<span style="color:var(--accent-rose);">⚠️ คะแนนก่อนเรียนและหลังเรียนต้องไม่เกินคะแนนเต็ม (${full}) และไม่ติดลบ</span>`;
        return;
      }

      const diff = post - pre;
      const gainFullPct = ((diff / full) * 100).toFixed(2);
      const relativeGainPct = full - pre > 0 ? ((diff / (full - pre)) * 100).toFixed(2) : "100.00";

      out.innerHTML = `
        <div style="font-family:var(--font-heading); font-size:1.15rem; font-weight:700; color:var(--primary);">
          ร้อยละของคะแนนพัฒนาการ (คิดจากคะแนนเต็ม) = ${gainFullPct}%
        </div>
        <div style="margin-top:0.35rem; font-size:0.9rem; color:var(--text-secondary);">
          • วิธีทำ: <code>((${post} − ${pre}) ÷ ${full}) × 100 = (${diff} ÷ ${full}) × 100 = ${gainFullPct}%</code><br>
          • คะแนนก่อนเรียนคิดเป็น ${((pre / full) * 100).toFixed(2)}% → หลังเรียนคิดเป็น ${((post / full) * 100).toFixed(2)}%<br>
          • <em>(เสริม) คะแนนพัฒนาการสัมพัทธ์ (Relative Gain) = ${relativeGainPct}%</em>
        </div>`;
    };

    ["calcFullScore", "calcPreScore", "calcPostScore"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", runGainCalc);
    });
    runGainCalc();

    // 2. E1 / E2 Efficiency Calculator (±2.5%)
    const runE1E2Calc = () => {
      const std1 = parseFloat(document.getElementById("calcStdE1").value);
      const std2 = parseFloat(document.getElementById("calcStdE2").value);
      const val1 = parseFloat(document.getElementById("calcValE1").value);
      const val2 = parseFloat(document.getElementById("calcValE2").value);
      const tol = parseFloat(document.getElementById("calcTolPct").value);
      const out = document.getElementById("calcE1E2Output");
      if (!out) return;

      if ([std1, std2, val1, val2, tol].some((v) => isNaN(v))) {
        out.innerHTML = `<span style="color:var(--accent-rose);">กรุณากรอกค่าตัวเลขให้ครบทุกช่อง</span>`;
        return;
      }

      const minE1 = std1 - tol;
      const minE2 = std2 - tol;
      const passE1 = val1 >= minE1;
      const passE2 = val2 >= minE2;
      const passAll = passE1 && passE2;

      out.innerHTML = `
        <div style="font-family:var(--font-heading); font-size:1.12rem; font-weight:700; color:${passAll ? "var(--accent-emerald)" : "var(--accent-rose)"};">
          ${passAll ? "✅ ผ่านเกณฑ์ประสิทธิภาพที่กำหนด!" : "❌ ไม่ผ่านเกณฑ์ประสิทธิภาพที่กำหนด"}
        </div>
        <div style="margin-top:0.35rem; font-size:0.9rem; color:var(--text-secondary);">
          • เกณฑ์ตั้งไว้: <strong>${std1}/${std2}</strong> (ความคลาดเคลื่อนยอมรับได้ ±${tol}%)<br>
          • ขอบล่างต่ำสุดที่ยอมรับได้: <strong>E₁ ≥ ${minE1.toFixed(2)}%</strong> และ <strong>E₂ ≥ ${minE2.toFixed(2)}%</strong><br>
          • ค่าที่ได้จริง: <strong>E₁ = ${val1.toFixed(2)}%</strong> (${passE1 ? "ผ่าน" : "ต่ำกว่า " + minE1.toFixed(2) + "%"}) / <strong>E₂ = ${val2.toFixed(2)}%</strong> (${passE2 ? "ผ่าน" : "ต่ำกว่า " + minE2.toFixed(2) + "%"})
        </div>`;
    };

    ["calcStdE1", "calcStdE2", "calcValE1", "calcValE2", "calcTolPct"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", runE1E2Calc);
    });
    runE1E2Calc();

    // 3. IOC Multi-Expert Calculator
    const renderIOCExperts = () => {
      const listEl = document.getElementById("iocExpertsContainer");
      const outEl = document.getElementById("calcIOCOutput");
      if (!listEl || !outEl) return;

      listEl.innerHTML = iocExpertScores
        .map(
          (sc, i) => `
          <div class="ioc-expert-row">
            <span style="font-size:0.9rem; font-weight:600;">ผู้เชี่ยวชาญคนที่ ${i + 1}</span>
            <div class="ioc-radio-group">
              <button type="button" class="ioc-score-btn ${sc === 1 ? "active-plus" : ""}" data-ioc-idx="${i}" data-ioc-val="1">+1 (สอดคล้อง)</button>
              <button type="button" class="ioc-score-btn ${sc === 0 ? "active-zero" : ""}" data-ioc-idx="${i}" data-ioc-val="0">0 (ไม่แน่ใจ)</button>
              <button type="button" class="ioc-score-btn ${sc === -1 ? "active-minus" : ""}" data-ioc-idx="${i}" data-ioc-val="-1">-1 (ไม่ตรง)</button>
            </div>
          </div>`
        )
        .join("");

      listEl.querySelectorAll("[data-ioc-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.iocIdx);
          const val = Number(btn.dataset.iocVal);
          iocExpertScores[idx] = val;
          renderIOCExperts();
        });
      });

      const sumR = iocExpertScores.reduce((acc, v) => acc + v, 0);
      const n = iocExpertScores.length;
      const ioc = sumR / n;
      const pass = ioc >= 0.5;

      outEl.innerHTML = `
        <div style="font-family:var(--font-heading); font-size:1.12rem; font-weight:700; color:${pass ? "var(--accent-emerald)" : "var(--accent-rose)"};">
          IOC = ${ioc.toFixed(2)} — ${pass ? "✅ ผ่านเกณฑ์ (≥ 0.50) นำข้อคำถามไปใช้ได้" : "⚠️ ไม่ผ่านเกณฑ์ (< 0.50) ควรปรับปรุงหรือตัดทิ้ง"}
        </div>
        <div style="margin-top:0.3rem; font-size:0.88rem; color:var(--text-secondary);">
          สูตร: <code>IOC = ΣR ÷ N = (${sumR}) ÷ ${n} = ${ioc.toFixed(2)}</code>
        </div>`;
    };

    const expertCountSel = document.getElementById("iocExpertCountSelect");
    if (expertCountSel) {
      expertCountSel.addEventListener("change", () => {
        const count = Number(expertCountSel.value);
        iocExpertScores = Array(count).fill(1);
        renderIOCExperts();
      });
    }
    renderIOCExperts();

    // 4. Krejcie & Morgan + Likert 5-Level Interpreter
    const runKMAndMeanCalc = () => {
      const popN = parseInt(document.getElementById("calcPopN").value, 10);
      const meanVal = parseFloat(document.getElementById("calcMeanVal").value);
      const out = document.getElementById("calcKMOutput");
      if (!out) return;

      let kmText = "กรุณาระบุขนาดประชากร N ≥ 10";
      if (!isNaN(popN) && popN >= 10) {
        // Formula of Krejcie & Morgan: S = (X^2 * N * P * (1-P)) / (d^2*(N-1) + X^2*P*(1-P))
        // Also match exact lookup table if present
        const table = window.AppData.krejcieMorganTable;
        let exact = table.find((pair) => pair[0] === popN);
        let sampleS;
        if (exact) {
          sampleS = exact[1];
        } else if (popN >= 100000) {
          sampleS = 384;
        } else {
          const chi2 = 3.841;
          const p = 0.5;
          const d = 0.05;
          sampleS = Math.ceil((chi2 * popN * p * (1 - p)) / (d * d * (popN - 1) + chi2 * p * (1 - p)));
        }
        const pctOfPop = ((sampleS / popN) * 100).toFixed(1);
        kmText = `ประชากร N = <strong>${popN.toLocaleString()}</strong> คน → กลุ่มตัวอย่างตามเกณฑ์ Krejcie & Morgan = <strong>${sampleS.toLocaleString()} คน</strong> (คิดเป็น ${pctOfPop}% ของประชากร)`;
      }

      let meanLevelEqual = "กรอกค่าระหว่าง 1.00 – 5.00";
      let meanLevelBest = "-";
      if (!isNaN(meanVal) && meanVal >= 1 && meanVal <= 5) {
        if (meanVal >= 4.21) meanLevelEqual = "มากที่สุด (4.21–5.00)";
        else if (meanVal >= 3.41) meanLevelEqual = "มาก (3.41–4.20)";
        else if (meanVal >= 2.61) meanLevelEqual = "ปานกลาง (2.61–3.40)";
        else if (meanVal >= 1.81) meanLevelEqual = "น้อย (1.81–2.60)";
        else meanLevelEqual = "น้อยที่สุด (1.00–1.80)";

        if (meanVal >= 4.5) meanLevelBest = "มากที่สุด (4.50–5.00)";
        else if (meanVal >= 3.5) meanLevelBest = "มาก (3.50–4.49)";
        else if (meanVal >= 2.5) meanLevelBest = "ปานกลาง (2.50–3.49)";
        else if (meanVal >= 1.5) meanLevelBest = "น้อย (1.50–2.49)";
        else meanLevelBest = "น้อยที่สุด (1.00–1.49)";
      }

      out.innerHTML = `
        <div style="margin-bottom:0.55rem;">👥 ${kmText}</div>
        <div style="padding-top:0.5rem; border-top:1px dashed var(--border-color); font-size:0.9rem;">
          ⭐ <strong>แปลผลค่าเฉลี่ย (${isNaN(meanVal) ? "-" : meanVal.toFixed(2)}):</strong><br>
          • เกณฑ์สากลช่วงชั้นละ 0.80: <strong style="color:var(--primary);">${meanLevelEqual}</strong><br>
          • เกณฑ์ของ Best: <strong style="color:var(--secondary);">${meanLevelBest}</strong>
        </div>`;
    };

    ["calcPopN", "calcMeanVal"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", runKMAndMeanCalc);
    });
    runKMAndMeanCalc();
  }

  /* ========================================================================
     9. PROGRESS DASHBOARD (LocalStorage Stats & History)
     ======================================================================== */
  function renderProgressDashboard() {
    const container = document.getElementById("progressDashboardArea");
    if (!container) return;

    const totalTopics = window.AppData.studyTopics.length;
    const readCount = state.readTopics.length;
    const totalCards = window.AppData.flashcards.length;
    const masteredCount = state.masteredCards.length;

    const bestAj = state.ajPorHistory.reduce((max, h) => Math.max(max, h.score), 0);
    const bestMock = state.mockExamHistory.reduce((max, h) => Math.max(max, h.score), 0);

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">📖 ความก้าวหน้าการอ่านเนื้อหา</div>
          <div class="kpi-val">${readCount} / ${totalTopics}</div>
          <div class="kpi-sub">คิดเป็น ${Math.round((readCount / totalTopics) * 100)}% ของขอบเขตสอบทั้งหมด</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">🗂️ Flashcards ที่จำได้แม่นแล้ว</div>
          <div class="kpi-val">${masteredCount} / ${totalCards}</div>
          <div class="kpi-sub">รอทบทวนซ้ำ ${state.reviewCards.length} ใบ</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">🎯 คะแนนสูงสุด Quiz อาจารย์ปอ</div>
          <div class="kpi-val">${state.ajPorHistory.length ? bestAj + " / 20" : "ยังไม่ทำ"}</div>
          <div class="kpi-sub">ทำแบบทดสอบแล้ว ${state.ajPorHistory.length} ครั้ง</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">🏆 คะแนนสูงสุด Mock Exam 40 ข้อ</div>
          <div class="kpi-val">${state.mockExamHistory.length ? bestMock + " / 40" : "ยังไม่สอบ"}</div>
          <div class="kpi-sub">จำลองสอบแล้ว ${state.mockExamHistory.length} ครั้ง</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
        <div class="comparison-card" style="margin:0;">
          <h3>📝 ประวัติคะแนนแบบทดสอบอาจารย์ปอ (20 ข้อ)</h3>
          ${
            state.ajPorHistory.length === 0
              ? `<p style="color:var(--text-muted); font-size:0.92rem;">ยังไม่มีประวัติการทำแบบทดสอบ ลองไปฝึกทำในแท็บที่ 4 ได้เลย!</p>`
              : `<div class="table-responsive"><table class="data-table">
                  <thead><tr><th>วัน-เวลา</th><th>โหมด</th><th>คะแนน</th></tr></thead>
                  <tbody>
                    ${state.ajPorHistory
                      .map(
                        (h) => `<tr><td>${escapeHtml(h.date)}</td><td>${escapeHtml(h.mode)}</td><td><strong>${h.score}/${h.total}</strong> (${Math.round((h.score / h.total) * 100)}%)</td></tr>`
                      )
                      .join("")}
                  </tbody>
                </table></div>`
          }
        </div>

        <div class="comparison-card" style="margin:0;">
          <h3>🎓 ประวัติคะแนนจำลองสอบปลายภาค (40 ข้อ)</h3>
          ${
            state.mockExamHistory.length === 0
              ? `<p style="color:var(--text-muted); font-size:0.92rem;">ยังไม่มีประวัติการจำลองสอบปลายภาค ลองไปทดสอบในแท็บที่ 5 ได้เลย!</p>`
              : `<div class="table-responsive"><table class="data-table">
                  <thead><tr><th>วัน-เวลา</th><th>เวลาที่ใช้</th><th>คะแนน</th></tr></thead>
                  <tbody>
                    ${state.mockExamHistory
                      .map(
                        (h) => `<tr><td>${escapeHtml(h.date)}</td><td>${formatClock(h.durationSec)} น.</td><td><strong>${h.score}/${h.total}</strong> (${Math.round((h.score / h.total) * 100)}%)</td></tr>`
                      )
                      .join("")}
                  </tbody>
                </table></div>`
          }
        </div>
      </div>

      <div style="margin-top:1.25rem; text-align:right;">
        <button type="button" class="btn btn-danger-outline btn-sm" id="resetAllProgressBtn">🗑️ ล้างข้อมูลความก้าวหน้าทั้งหมด (Reset Progress)</button>
      </div>
    `;

    const resetBtn = document.getElementById("resetAllProgressBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (window.confirm("ต้องการล้างประวัติการอ่าน แฟลชการ์ด และคะแนนสอบทั้งหมดที่บันทึกไว้ในเครื่องใช่หรือไม่?")) {
          const currentTheme = state.theme;
          state = JSON.parse(JSON.stringify(defaultState));
          state.theme = currentTheme;
          saveState();
          renderStudyGuide();
          rebuildFlashcardDeck();
          renderProgressDashboard();
        }
      });
    }
  }

  /* ========================================================================
     10. BOOTSTRAP & EVENT WIRING
     ======================================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(state.theme);
    updateHeaderProgress();

    // Theme toggle
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
        saveState();
      });
    }

    // Header progress pill jumps to Dashboard inside Tab 6
    const progPill = document.getElementById("headerProgressPill");
    if (progPill) {
      progPill.addEventListener("click", () => {
        switchTab("tab-tools");
        document.querySelectorAll("[data-subtool]").forEach((b) => b.classList.toggle("active", b.dataset.subtool === "sub-dashboard"));
        document.querySelectorAll(".subtool-panel").forEach((p) => (p.style.display = p.id === "sub-dashboard" ? "block" : "none"));
        renderProgressDashboard();
      });
    }

    // Main 6 Tab Buttons
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Tab 1: Search & Expand/Collapse All
    const searchInput = document.getElementById("studySearchInput");
    const clearSearchBtn = document.getElementById("clearStudySearchBtn");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        currentSearchQuery = searchInput.value;
        if (clearSearchBtn) clearSearchBtn.style.display = currentSearchQuery ? "block" : "none";
        renderStudyGuide();
      });
    }
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        currentSearchQuery = "";
        searchInput.value = "";
        clearSearchBtn.style.display = "none";
        renderStudyGuide();
      });
    }

    const expandAllBtn = document.getElementById("expandAllTopicsBtn");
    const collapseAllBtn = document.getElementById("collapseAllTopicsBtn");
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", () => {
        window.AppData.studyTopics.forEach((t) => openTopicIds.add(t.id));
        renderStudyGuide();
      });
    }
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener("click", () => {
        openTopicIds.clear();
        renderStudyGuide();
      });
    }

    // Tab 3: Print Cheat Sheet button
    const printBtn = document.getElementById("printCheatSheetBtn");
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }

    // Tab 4: Aj. Por Quiz Mode Switch & Reset
    document.querySelectorAll("[data-aj-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ajQuizState.feedbackMode = btn.dataset.ajMode;
        document.querySelectorAll("[data-aj-mode]").forEach((b) => b.classList.toggle("active", b === btn));
        resetAjPorQuiz();
      });
    });

    const resetAjBtn = document.getElementById("resetAjPorQuizBtn");
    if (resetAjBtn) resetAjBtn.addEventListener("click", resetAjPorQuiz);

    // Tab 6: Sub-navigation (Flashcards / Calculators / Dashboard)
    document.querySelectorAll("[data-subtool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.subtool;
        document.querySelectorAll("[data-subtool]").forEach((b) => b.classList.toggle("active", b === btn));
        document.querySelectorAll(".subtool-panel").forEach((p) => {
          p.style.display = p.id === target ? "block" : "none";
        });
        if (target === "sub-dashboard") renderProgressDashboard();
      });
    });

    // Flashcard deck filters & shuffle
    document.querySelectorAll("[data-fc-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        fcState.filter = btn.dataset.fcFilter;
        document.querySelectorAll("[data-fc-filter]").forEach((b) => b.classList.toggle("active", b === btn));
        rebuildFlashcardDeck();
      });
    });

    const fcShuffleBtn = document.getElementById("fcShuffleBtn");
    if (fcShuffleBtn) {
      fcShuffleBtn.addEventListener("click", () => {
        fcState.deck = shuffleArray(fcState.deck);
        fcState.index = 0;
        fcState.flipped = false;
        renderFlashcardUI();
      });
    }

    // Initial Renders for all tabs
    renderStudyCategoryPills();
    renderStudyGuide();
    renderQuickSummary();
    renderCheatSheet();
    renderAjPorQuiz();
    renderMockExamView();
    rebuildFlashcardDeck();
    initCalculators();
    renderProgressDashboard();
  });
})();

const app = document.getElementById("app");

const STORAGE_KEY = "coachSportif.logs.v1";
let view = "home";
let detailSessionId = null;
let active = null;
let restTimer = null;
let restRemaining = 0;
let selectedDifficulty = 3;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(value));
}

function formatFullDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function minutesBetween(startMs, endMs) {
  return Math.max(1, Math.round((endMs - startMs) / 60000));
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isiPhoneLike() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function installPromptHtml() {
  if (isStandaloneMode()) return "";
  return `
    <section class="card compact stack install-callout">
      <div class="between">
        <div>
          <span class="kicker">Version iPhone</span>
          <h3>Installer sur l'ecran d'accueil</h3>
          <p class="small">Ouvre l'app dans Safari, puis ajoute-la a l'ecran d'accueil pour l'utiliser comme une app.</p>
        </div>
        <span class="badge">PWA</span>
      </div>
      <button class="btn secondary" onclick="showInstallGuide()">Voir les etapes</button>
    </section>
  `;
}

function showInstallGuide() {
  const existing = document.getElementById("installModal");
  if (existing) existing.remove();
  const wrapper = document.createElement("div");
  wrapper.id = "installModal";
  wrapper.className = "modal-backdrop";
  wrapper.innerHTML = `
    <div class="modal">
      <div class="between">
        <div>
          <span class="kicker">Installation iPhone</span>
          <h3>Ajouter Coach a l'ecran d'accueil</h3>
        </div>
        <button class="icon-btn" onclick="closeInstallGuide()">×</button>
      </div>
      <ol class="ios-steps">
        <li>Heberge le dossier de l'app en HTTPS.</li>
        <li>Ouvre l'adresse dans Safari sur ton iPhone.</li>
        <li>Touche le bouton Partager.</li>
        <li>Choisis "Sur l'ecran d'accueil".</li>
        <li>Active "Ouvrir comme app web" si l'option apparait.</li>
        <li>Touche "Ajouter".</li>
      </ol>
      <p class="small">Les donnees restent stockees localement sur cet appareil. Pense a exporter l'historique de temps en temps, parce que les navigateurs ont la memoire d'un poisson rouge administratif.</p>
      <button class="btn" onclick="closeInstallGuide()">Compris</button>
    </div>
  `;
  document.body.appendChild(wrapper);
}

function closeInstallGuide() {
  const modal = document.getElementById("installModal");
  if (modal) modal.remove();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function totalSets(session) {
  return session.exercises.reduce((sum, ex) => sum + ex.sets, 0);
}

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function logsThisWeek() {
  const start = weekStart().getTime();
  return getLogs().filter(log => new Date(log.date).getTime() >= start);
}

function completedThisWeek(sessionId) {
  return logsThisWeek().some(log => log.sessionId === sessionId && log.completed);
}

function weeklyItems() {
  return [
    { label: "Lundi", sessionId: "mini-routine" },
    { label: "Mercredi", sessionId: "session-a" },
    { label: "Vendredi", sessionId: "session-b" }
  ];
}

function getRecommendedSession() {
  const day = new Date().getDay();
  const done = id => completedThisWeek(id);

  if (day === 1 && !done("mini-routine")) return findSession("mini-routine");
  if ((day === 3 || day === 4) && !done("session-a")) return findSession("session-a");
  if ((day === 5 || day === 6) && !done("session-b")) return findSession("session-b");
  if (!done("mini-routine")) return findSession("mini-routine");
  if (!done("session-a")) return findSession("session-a");
  if (!done("session-b")) return findSession("session-b");
  return findSession("urgence");
}

function findSession(id) {
  return SESSIONS.find(s => s.id === id);
}

function mediaHtml(exercise) {
  if (!exercise.media) return `<div class="media-box"><span class="muted">Media a ajouter</span></div>`;
  if (exercise.mediaType === "video") {
    return `<div class="media-box"><video src="${exercise.media}" autoplay loop muted playsinline controls></video></div>`;
  }
  return `<div class="media-box"><img src="${exercise.media}" alt="${escapeHtml(exercise.name)}" /></div>`;
}

function appHeader(title = "Coach") {
  return `
    <div class="header">
      <div class="brand"><span class="logo"></span><span>${title}</span></div>
      <button class="icon-btn" onclick="renderHome()" aria-label="Accueil">⌂</button>
    </div>
  `;
}

function bottomNav() {
  if (active) return "";
  const items = [
    ["home", "Accueil"],
    ["program", "Programme"],
    ["history", "Historique"],
    ["settings", "Reglages"]
  ];
  return `
    <nav class="bottom-nav">
      ${items.map(([id, label]) => `<button class="nav-btn ${view === id ? "active" : ""}" onclick="navigate('${id}')">${label}</button>`).join("")}
    </nav>
  `;
}

function navigate(nextView) {
  view = nextView;
  detailSessionId = null;
  if (nextView === "home") renderHome();
  if (nextView === "program") renderProgram();
  if (nextView === "history") renderHistory();
  if (nextView === "settings") renderSettings();
}

function renderShell(content) {
  app.innerHTML = content + bottomNav();
}

function renderHome() {
  view = "home";
  active = null;
  stopRestTimer();
  const recommended = getRecommendedSession();
  const weekLogs = logsThisWeek();
  const count = ["mini-routine", "session-a", "session-b"].filter(completedThisWeek).length;
  const percent = Math.min(100, Math.round((count / 3) * 100));

  renderShell(`
    ${appHeader("Coach")}
    <main class="screen">
      <section class="card hero-card">
        <div class="stack">
          <span class="kicker">Prochaine seance</span>
          <div>
            <h1>${recommended.title}</h1>
            <p class="muted">${recommended.subtitle}</p>
          </div>
          <div class="row">
            <span class="badge">${recommended.plannedDuration}</span>
            <span class="badge">${recommended.recommendedDay}</span>
          </div>
        </div>
        <button class="btn" onclick="startSession('${recommended.id}')">Commencer</button>
      </section>

      ${installPromptHtml()}

      <section class="card compact stack">
        <div class="between">
          <h3>Cette semaine</h3>
          <span class="badge good">${count} / 3</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="week-list">
          ${weeklyItems().map(item => {
            const session = findSession(item.sessionId);
            const done = completedThisWeek(item.sessionId);
            return `<div class="week-item"><div><strong>${item.label}</strong><p class="small">${session.title} - ${session.subtitle}</p></div><span class="badge ${done ? "good" : ""}">${done ? "Fait" : "A faire"}</span></div>`;
          }).join("")}
        </div>
      </section>

      <section class="card compact stack">
        <div class="between">
          <div>
            <h3>Pas le temps ?</h3>
            <p class="small">Version minimale pour garder la routine en vie. Heroisme discret, mais heroisme quand meme.</p>
          </div>
          <span class="badge warn">10 min</span>
        </div>
        <button class="btn secondary" onclick="startSession('urgence')">Lancer la version urgence</button>
      </section>

      <section class="row">
        <button class="btn secondary" onclick="navigate('program')">Choisir une autre seance</button>
        <button class="btn ghost" onclick="navigate('history')">Voir l'historique</button>
      </section>
    </main>
  `);
}

function renderProgram() {
  view = "program";
  renderShell(`
    ${appHeader("Programme")}
    <main class="screen">
      <section class="stack">
        <span class="kicker">Programme V1</span>
        <h2>Choisir une seance</h2>
        <p class="muted">Planning souple. Tu peux lancer n'importe quelle seance, meme si le calendrier fait semblant de commander ta vie.</p>
      </section>
      <section class="session-grid">
        ${SESSIONS.map(session => `
          <article class="card compact session-card">
            <div class="between">
              <div class="stack">
                <span class="badge">${session.recommendedDay}</span>
                <div>
                  <h3>${session.title}</h3>
                  <p class="muted">${session.subtitle}</p>
                </div>
              </div>
              <span class="badge">${session.plannedDuration}</span>
            </div>
            <p class="small">${session.description}</p>
            <div class="row">
              <span class="badge">${session.exercises.length} exercices</span>
              <span class="badge">${totalSets(session)} series</span>
            </div>
            <div class="row">
              <button class="btn secondary small-btn" onclick="renderSessionDetail('${session.id}')">Voir detail</button>
              <button class="btn small-btn" onclick="startSession('${session.id}')">Commencer</button>
            </div>
          </article>
        `).join("")}
      </section>
    </main>
  `);
}

function renderSessionDetail(sessionId) {
  view = "program";
  detailSessionId = sessionId;
  const session = findSession(sessionId);
  renderShell(`
    ${appHeader("Detail")}
    <main class="screen">
      <button class="btn ghost small-btn" onclick="renderProgram()">Retour au programme</button>
      <section class="card stack-lg">
        <div class="stack">
          <span class="kicker">${session.recommendedDay} - ${session.plannedDuration}</span>
          <h1>${session.title}</h1>
          <p class="muted">${session.subtitle}</p>
        </div>
        <p>${session.description}</p>
        <button class="btn" onclick="startSession('${session.id}')">Demarrer cette seance</button>
      </section>

      ${session.warmup.length ? `
        <section class="card compact stack">
          <h3>Echauffement</h3>
          <ul class="list">${session.warmup.map(item => `<li>${item}</li>`).join("")}</ul>
        </section>
      ` : ""}

      <section class="card compact stack">
        <h3>Exercices</h3>
        <ul class="list">
          ${session.exercises.map(ex => `<li><strong>${ex.name}</strong><br><span class="small">${ex.sets} serie(s) - ${ex.target} - repos ${ex.restSeconds}s</span></li>`).join("")}
        </ul>
      </section>

      ${session.cooldown.length ? `
        <section class="card compact stack">
          <h3>Retour au calme</h3>
          <ul class="list">${session.cooldown.map(item => `<li>${item}</li>`).join("")}</ul>
        </section>
      ` : ""}
    </main>
  `);
}

function startSession(sessionId) {
  const session = findSession(sessionId);
  active = {
    id: uid(),
    session,
    mode: session.warmup.length ? "warmup" : "exercise",
    exerciseIndex: 0,
    setIndex: 0,
    startMs: Date.now(),
    completedSets: [],
    painNotes: []
  };
  selectedDifficulty = 3;
  renderActiveSession();
}

function renderActiveSession() {
  if (!active) return renderHome();
  stopRestTimer();
  if (active.mode === "warmup") return renderWarmup();
  if (active.mode === "exercise") return renderExercise();
  if (active.mode === "rest") return renderRest();
  if (active.mode === "cooldown") return renderCooldown();
  if (active.mode === "summary") return renderSummary();
}

function renderTrainingHeader(label) {
  const session = active.session;
  const done = active.completedSets.length;
  const total = totalSets(session);
  const percent = Math.min(100, Math.round((done / total) * 100));
  return `
    <div class="training-top stack">
      <div class="between">
        <button class="btn ghost small-btn" onclick="confirmQuitSession()">Quitter</button>
        <span class="badge">${label}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
    </div>
  `;
}

function renderWarmup() {
  const session = active.session;
  renderShell(`
    ${renderTrainingHeader("Echauffement")}
    <main class="screen">
      <section class="card stack-lg">
        <span class="kicker">${session.title}</span>
        <h1>Echauffement</h1>
        <ul class="list">${session.warmup.map(item => `<li>${item}</li>`).join("")}</ul>
        <button class="btn" onclick="finishWarmup()">Echauffement termine</button>
      </section>
    </main>
  `);
}

function finishWarmup() {
  active.mode = "exercise";
  renderActiveSession();
}

function currentExercise() {
  return active.session.exercises[active.exerciseIndex];
}

function renderExercise() {
  const ex = currentExercise();
  const session = active.session;
  const currentSet = active.setIndex + 1;
  const done = active.completedSets.length;
  const total = totalSets(session);

  renderShell(`
    ${renderTrainingHeader(`${done} / ${total} series`)}
    <main class="screen">
      <section class="stack">
        <span class="kicker">Exercice ${active.exerciseIndex + 1} / ${session.exercises.length}</span>
        <h1>${ex.name}</h1>
        <p class="muted">${ex.instructions}</p>
      </section>

      ${mediaHtml(ex)}

      <section class="card compact stack-lg">
        <div class="between">
          <div>
            <span class="kicker">Serie</span>
            <div class="big-number">${currentSet}/${ex.sets}</div>
          </div>
          <div class="stack" style="text-align:right">
            <span class="badge">${ex.target}</span>
            <span class="badge">Repos ${ex.restSeconds}s</span>
          </div>
        </div>
        <button class="btn" onclick="completeSet(true)">Serie faite</button>
        <div class="row">
          <button class="btn secondary small-btn" onclick="showPainModal()">Douleur / gene</button>
          <button class="btn ghost small-btn" onclick="completeSet(false)">Ignorer serie</button>
        </div>
      </section>
    </main>
  `);
}

function completeSet(done) {
  const ex = currentExercise();
  active.completedSets.push({
    exerciseId: ex.id,
    exerciseName: ex.name,
    set: active.setIndex + 1,
    done,
    at: new Date().toISOString()
  });

  const isLastSet = active.setIndex + 1 >= ex.sets;
  const isLastExercise = active.exerciseIndex + 1 >= active.session.exercises.length;
  if (done && ex.restSeconds > 0 && !(isLastSet && isLastExercise)) {
    active.mode = "rest";
    restRemaining = ex.restSeconds;
    renderRest();
    startRestTimer();
    return;
  }
  advanceAfterSet();
}

function advanceAfterSet() {
  const ex = currentExercise();
  if (active.setIndex + 1 < ex.sets) {
    active.setIndex += 1;
    active.mode = "exercise";
  } else if (active.exerciseIndex + 1 < active.session.exercises.length) {
    active.exerciseIndex += 1;
    active.setIndex = 0;
    active.mode = "exercise";
  } else if (active.session.cooldown.length) {
    active.mode = "cooldown";
  } else {
    active.mode = "summary";
  }
  renderActiveSession();
}

function renderRest() {
  const ex = currentExercise();
  const nextText = getNextStepLabel();
  renderShell(`
    ${renderTrainingHeader("Repos")}
    <main class="screen">
      <section class="card stack-lg" style="text-align:center">
        <span class="kicker">Repos apres ${ex.name}</span>
        <div class="timer-circle"><div id="timerText" class="timer-text">${formatClock(restRemaining)}</div></div>
        <p class="muted">Prochaine etape : ${nextText}</p>
        <button class="btn" onclick="skipRest()">Passer le repos</button>
        <button class="btn secondary" onclick="showPainModal()">Douleur / gene</button>
      </section>
    </main>
  `);
}

function getNextStepLabel() {
  const ex = currentExercise();
  if (active.setIndex + 1 < ex.sets) return `${ex.name} - serie ${active.setIndex + 2}/${ex.sets}`;
  if (active.exerciseIndex + 1 < active.session.exercises.length) return active.session.exercises[active.exerciseIndex + 1].name;
  if (active.session.cooldown.length) return "Retour au calme";
  return "Fin de seance";
}

function startRestTimer() {
  stopRestTimer();
  restTimer = setInterval(() => {
    restRemaining -= 1;
    const el = document.getElementById("timerText");
    if (el) el.textContent = formatClock(Math.max(0, restRemaining));
    if (restRemaining <= 0) {
      stopRestTimer();
      advanceAfterSet();
    }
  }, 1000);
}

function stopRestTimer() {
  if (restTimer) clearInterval(restTimer);
  restTimer = null;
}

function skipRest() {
  stopRestTimer();
  advanceAfterSet();
}

function renderCooldown() {
  const session = active.session;
  renderShell(`
    ${renderTrainingHeader("Retour au calme")}
    <main class="screen">
      <section class="card stack-lg">
        <span class="kicker">Presque termine</span>
        <h1>Retour au calme</h1>
        <ul class="list">${session.cooldown.map(item => `<li>${item}</li>`).join("")}</ul>
        <button class="btn" onclick="finishCooldown()">Terminer la seance</button>
      </section>
    </main>
  `);
}

function finishCooldown() {
  active.mode = "summary";
  renderSummary();
}

function renderSummary() {
  stopRestTimer();
  const session = active.session;
  const duration = minutesBetween(active.startMs, Date.now());
  const doneSets = active.completedSets.filter(s => s.done).length;
  const allSets = totalSets(session);
  renderShell(`
    <main class="screen">
      <section class="card hero-card">
        <div class="stack">
          <span class="kicker">Seance terminee</span>
          <h1>${session.title}</h1>
          <p class="muted">${session.subtitle}</p>
        </div>
        <div class="row">
          <span class="badge">${duration} min</span>
          <span class="badge good">${doneSets} / ${allSets} series faites</span>
          <span class="badge ${active.painNotes.length ? "warn" : "good"}">${active.painNotes.length ? active.painNotes.length + " note(s) douleur" : "Aucune douleur"}</span>
        </div>
      </section>

      <section class="card compact stack-lg">
        <h3>Difficulte globale</h3>
        <div class="rating" id="difficultyRating">
          ${[1,2,3,4,5].map(n => `<button class="${n === selectedDifficulty ? "active" : ""}" onclick="setDifficulty(${n})">${n}</button>`).join("")}
        </div>
        <div class="field">
          <label for="finalPain">Resume douleur / gene</label>
          <textarea id="finalPain" placeholder="Ex : rien, ou legere gene epaule droite">${active.painNotes.map(note => `${note.zone} ${note.intensity}/5 - ${note.comment}`).join("\n")}</textarea>
        </div>
        <div class="field">
          <label for="finalComment">Commentaire</label>
          <textarea id="finalComment" placeholder="Ex : bonne seance, repos trop court, fatigue correcte"></textarea>
        </div>
        <button class="btn" onclick="saveWorkout()">Enregistrer la seance</button>
      </section>
    </main>
  `);
}

function setDifficulty(n) {
  selectedDifficulty = n;
  const buttons = document.querySelectorAll("#difficultyRating button");
  buttons.forEach((btn, index) => btn.classList.toggle("active", index + 1 === n));
}

function saveWorkout() {
  const logs = getLogs();
  const finalPain = document.getElementById("finalPain")?.value || "";
  const finalComment = document.getElementById("finalComment")?.value || "";
  const duration = minutesBetween(active.startMs, Date.now());
  const doneSets = active.completedSets.filter(s => s.done).length;
  const allSets = totalSets(active.session);

  logs.unshift({
    id: active.id,
    date: new Date().toISOString(),
    sessionId: active.session.id,
    sessionTitle: active.session.title,
    sessionSubtitle: active.session.subtitle,
    completed: true,
    durationMinutes: duration,
    difficulty: selectedDifficulty,
    pain: finalPain.trim(),
    comment: finalComment.trim(),
    setsDone: doneSets,
    setsTotal: allSets,
    painNotes: active.painNotes,
    completedSets: active.completedSets
  });
  saveLogs(logs);
  active = null;
  view = "history";
  renderHistory();
}

function renderHistory() {
  view = "history";
  active = null;
  stopRestTimer();
  const logs = getLogs();
  renderShell(`
    ${appHeader("Historique")}
    <main class="screen">
      <section class="stack">
        <span class="kicker">Suivi</span>
        <h2>Seances realisees</h2>
        <p class="muted">Historique local sur cet appareil. Sublime fragilite du stockage navigateur.</p>
      </section>
      ${logs.length ? logs.map(log => `
        <article class="card compact stack">
          <div class="between">
            <div>
              <h3>${log.sessionTitle}</h3>
              <p class="small">${log.sessionSubtitle} - ${formatFullDate(log.date)}</p>
            </div>
            <span class="badge good">Terminee</span>
          </div>
          <div class="row">
            <span class="badge">${log.durationMinutes} min</span>
            <span class="badge">Difficulte ${log.difficulty}/5</span>
            <span class="badge">${log.setsDone}/${log.setsTotal} series</span>
          </div>
          ${log.pain ? `<p class="small"><strong>Douleur / gene :</strong> ${escapeHtml(log.pain)}</p>` : `<p class="small"><strong>Douleur / gene :</strong> aucune note</p>`}
          ${log.comment ? `<p class="small"><strong>Commentaire :</strong> ${escapeHtml(log.comment)}</p>` : ""}
        </article>
      `).join("") : `<section class="card empty">Aucune seance enregistree pour l'instant.</section>`}
    </main>
  `);
}

function renderSettings() {
  view = "settings";
  const logs = getLogs();
  renderShell(`
    ${appHeader("Reglages")}
    <main class="screen">
      <section class="card stack-lg">
        <span class="kicker">Application</span>
        <h1>Reglages</h1>
        <p class="muted">Version locale V1. Donnees sauvegardees dans le navigateur de cet appareil.</p>
        <div class="row">
          <span class="badge">${logs.length} seance(s)</span>
          <span class="badge">V1 prototype</span>
        </div>
      </section>

      ${installPromptHtml()}

      <section class="card compact stack">
        <h3>Exporter les donnees</h3>
        <p class="small">Telecharge un fichier JSON avec ton historique. Pas glamour, mais utile. Comme une roue de secours.</p>
        <button class="btn secondary" onclick="exportData()">Exporter</button>
      </section>

      <section class="card compact stack">
        <h3>Zone dangereuse</h3>
        <p class="small">Supprime l'historique local. Aucun serveur magique ne viendra le sauver.</p>
        <button class="btn danger" onclick="resetData()">Reinitialiser l'historique</button>
      </section>
    </main>
  `);
}

function exportData() {
  const blob = new Blob([JSON.stringify(getLogs(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historique-coach-sportif-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetData() {
  const ok = confirm("Supprimer tout l'historique local ?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  renderSettings();
}

function confirmQuitSession() {
  const ok = confirm("Quitter la seance en cours ? Elle ne sera pas enregistree.");
  if (!ok) return;
  active = null;
  stopRestTimer();
  renderHome();
}

function showPainModal() {
  const existing = document.getElementById("painModal");
  if (existing) existing.remove();
  const ex = active ? currentExercise() : null;
  const wrapper = document.createElement("div");
  wrapper.id = "painModal";
  wrapper.className = "modal-backdrop";
  wrapper.innerHTML = `
    <div class="modal">
      <div class="between">
        <div>
          <span class="kicker">Douleur / gene</span>
          <h3>${ex ? ex.name : "Seance"}</h3>
        </div>
        <button class="icon-btn" onclick="closePainModal()">×</button>
      </div>
      <div class="field">
        <label for="painZone">Zone</label>
        <select id="painZone">
          <option>Epaule</option>
          <option>Dos</option>
          <option>Genou</option>
          <option>Cheville</option>
          <option>Poignet</option>
          <option>Autre</option>
        </select>
      </div>
      <div class="field">
        <label for="painIntensity">Intensite</label>
        <select id="painIntensity">
          <option value="1">1 - leger</option>
          <option value="2">2</option>
          <option value="3">3 - notable</option>
          <option value="4">4</option>
          <option value="5">5 - fort</option>
        </select>
      </div>
      <div class="field">
        <label for="painComment">Commentaire</label>
        <textarea id="painComment" placeholder="Ex : gene courte, douleur nette, instabilite..."></textarea>
      </div>
      <button class="btn" onclick="savePainNote()">Enregistrer la note</button>
    </div>
  `;
  document.body.appendChild(wrapper);
}

function closePainModal() {
  const modal = document.getElementById("painModal");
  if (modal) modal.remove();
}

function savePainNote() {
  if (!active) return closePainModal();
  const zone = document.getElementById("painZone").value;
  const intensity = document.getElementById("painIntensity").value;
  const comment = document.getElementById("painComment").value.trim();
  const ex = currentExercise();
  active.painNotes.push({
    zone,
    intensity,
    comment,
    exerciseId: ex.id,
    exerciseName: ex.name,
    set: active.setIndex + 1,
    at: new Date().toISOString()
  });
  closePainModal();
}

registerServiceWorker();
renderHome();

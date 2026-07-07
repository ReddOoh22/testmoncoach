const app = document.getElementById("app");
const STORE_KEY = "monCoach.state.v11";
const OLD_LOGS_KEY = "coachSportif.logs.v1";

let state = loadState();
let view = "home";
let active = null;
let restTimer = null;
let restRemaining = 0;
let selectedDifficulty = 3;
let onboarding = null;
let builder = null;

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.profiles)) {
        parsed.version = "1.4.0";
        return parsed;
      }
    }
  } catch (error) {}

  let oldLogs = [];
  try { oldLogs = JSON.parse(localStorage.getItem(OLD_LOGS_KEY) || "[]"); } catch (error) {}

  const initial = {
    version: "1.4.0",
    introSeen: oldLogs.length > 0,
    activeProfileId: null,
    profiles: []
  };

  if (oldLogs.length > 0) {
    const profile = createProfileFromProgram({
      name: "Moi",
      goal: "reprise",
      level: "reprise",
      sessionsPerWeek: 3,
      duration: "35-50",
      days: ["Lundi", "Mercredi", "Vendredi"],
      equipment: ["tapis", "haltere", "velo", "barre"],
      limitations: [],
      preferences: ["renforcement", "gainage"]
    }, clone(DEFAULT_PROGRAM));
    profile.logs = oldLogs;
    initial.profiles.push(profile);
    initial.activeProfileId = profile.id;
  }
  return initial;
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function activeProfile() {
  return state.profiles.find(p => p.id === state.activeProfileId) || null;
}

function requireProfile() {
  const profile = activeProfile();
  if (!profile) {
    renderProfileSelect();
    return null;
  }
  return profile;
}

function createProfileFromProgram(answers, program) {
  return {
    id: uid("profile"),
    name: answers.name || "Profil",
    createdAt: new Date().toISOString(),
    answers,
    program,
    logs: [],
    customExercises: []
  };
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

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function mediaHtml(exercise) {
  if (!exercise.media) {
    return `<div class="media-box"><div class="empty-media"><strong>${escapeHtml(exercise.name)}</strong><br><span class="small">Media a ajouter plus tard</span></div></div>`;
  }
  if (exercise.mediaType === "video") {
    return `<div class="media-box"><video src="${exercise.media}" autoplay loop muted playsinline controls></video></div>`;
  }
  return `<div class="media-box"><img src="${exercise.media}" alt="${escapeHtml(exercise.name)}"></div>`;
}

function getLibrary() {
  const profile = activeProfile();
  return [...EXERCISE_LIBRARY, ...((profile && profile.customExercises) || [])];
}

function exerciseById(id) {
  return getLibrary().find(ex => ex.id === id) || EXERCISE_LIBRARY.find(ex => ex.id === id);
}

function toSessionExercise(ex, opts = {}) {
  return {
    id: opts.id || `${ex.id}-${uid("ex")}`,
    name: ex.name,
    media: ex.media || null,
    mediaType: ex.mediaType || "none",
    sets: Number(opts.sets || 2),
    target: opts.target || ex.defaultTarget || "8-12 reps",
    restSeconds: Number(opts.restSeconds ?? ex.defaultRest ?? 45),
    category: ex.category || "general",
    equipment: ex.equipment || [],
    instructions: ex.instructions || "Mouvement controle, sans douleur nette."
  };
}

function totalSets(session) {
  return session.exercises.reduce((sum, ex) => sum + Number(ex.sets || 0), 0);
}

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function logsThisWeek(profile = activeProfile()) {
  if (!profile) return [];
  const start = weekStart().getTime();
  return (profile.logs || []).filter(log => new Date(log.date).getTime() >= start);
}

function completedThisWeek(sessionId, profile = activeProfile()) {
  return logsThisWeek(profile).some(log => log.sessionId === sessionId && log.completed);
}

function lastWorkout(profile) {
  const logs = (profile && profile.logs) || [];
  if (!logs.length) return null;
  return logs.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

function profileWeekStats(profile) {
  const items = weeklySessions(profile);
  const done = items.filter(item => completedThisWeek(item.id, profile)).length;
  return { done, target: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

function profileSummaryHtml(profile) {
  const recommended = getRecommendedSession(profile);
  const last = lastWorkout(profile);
  const stats = profileWeekStats(profile);
  return `
    <div class="profile-summary">
      <span class="badge good">${stats.done}/${stats.target || 0} cette semaine</span>
      ${recommended ? `<span class="badge">Prochaine : ${escapeHtml(recommended.title)}</span>` : `<span class="badge">Aucune seance</span>`}
      ${last ? `<span class="badge">Derniere : ${formatDate(last.date)}</span>` : `<span class="badge">Aucun historique</span>`}
    </div>`;
}

function sessionCompletionLabel(session, profile = activeProfile()) {
  return completedThisWeek(session.id, profile) ? "Fait" : "A faire";
}

function weeklySessions(profile = activeProfile()) {
  if (!profile) return [];
  const sessions = profile.program.sessions.filter(s => s.id !== "urgence" && s.type !== "court");
  return sessions.slice(0, profile.program.weeklyTarget || sessions.length);
}

function findSession(id) {
  const profile = activeProfile();
  if (!profile) return null;
  return profile.program.sessions.find(s => s.id === id);
}

function getRecommendedSession(profile = activeProfile()) {
  if (!profile) return null;
  const candidates = weeklySessions(profile);
  const day = new Date().getDay();
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const today = dayNames[day];
  const todayMatch = candidates.find(s => s.recommendedDay === today && !completedThisWeek(s.id, profile));
  if (todayMatch) return todayMatch;
  const missing = candidates.find(s => !completedThisWeek(s.id, profile));
  if (missing) return missing;
  return profile.program.sessions.find(s => s.id === "urgence") || candidates[0] || profile.program.sessions[0];
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function appHeader(title = "Mon Coach") {
  const profile = activeProfile();
  return `
    <div class="header">
      <div class="brand"><span class="logo"></span><span>${title}</span></div>
      <div class="row" style="align-items:center">
        ${profile ? `<button class="profile-chip" onclick="renderProfileSelect()">${escapeHtml(profile.name)}</button>` : ""}
        <button class="icon-btn" onclick="goHome()" aria-label="Accueil">⌂</button>
      </div>
    </div>
  `;
}

function bottomNav() {
  if (active || !activeProfile() || ["readiness", "profiles", "landing"].includes(view)) return "";
  const items = [["home", "Accueil"], ["program", "Programme"], ["library", "Exos"], ["history", "Historique"], ["settings", "Reglages"]];
  return `<nav class="bottom-nav">${items.map(([id, label]) => `<button class="nav-btn ${view === id ? "active" : ""}" onclick="navigate('${id}')">${label}</button>`).join("")}</nav>`;
}

function renderShell(content) {
  app.innerHTML = content + bottomNav();
}

function goHome() {
  if (!state.introSeen) return renderLanding();
  if (!activeProfile()) return renderProfileSelect();
  renderHome();
}

function navigate(next) {
  view = next;
  if (next === "home") renderHome();
  if (next === "program") renderProgram();
  if (next === "library") renderLibrary();
  if (next === "history") renderHistory();
  if (next === "settings") renderSettings();
}

function renderLanding() {
  view = "landing";
  renderShell(`
    <main class="screen">
      <section class="card hero-card stack-lg">
        <div class="stack">
          <span class="kicker">Mon Coach</span>
          <h1>Ton programme. Tes seances. Tes donnees.</h1>
          <p class="muted">Une app personnelle pour creer un profil, construire un programme simple et suivre les seances sur iPhone. Sans compte en ligne. Sans magie IA planquee dans un coin sombre.</p>
        </div>
        <div class="stack">
          <button class="btn" onclick="startOnboarding()">Creer mon premier profil</button>
          ${state.profiles.length ? `<button class="btn secondary" onclick="renderProfileSelect()">J'ai deja un profil</button>` : ""}
        </div>
      </section>
      <section class="card compact stack good-note">
        <h3>Confidentialite</h3>
        <p class="small">Les profils et historiques restent dans le stockage local de l'app sur cet appareil. Pas de compte ChatGPT, pas de cle API dans GitHub, pas de grand cirque connecte.</p>
      </section>
      <section class="card compact stack warning">
        <h3>Regle de securite</h3>
        <p class="small">Douleur articulaire nette, gene qui augmente ou sensation d'instabilite : on arrete ou on adapte. Le corps humain est deja assez mal documente comme ca.</p>
      </section>
    </main>
  `);
}

function renderProfileSelect() {
  view = "profiles";
  state.introSeen = true;
  saveState();
  const hasProfiles = state.profiles.length > 0;
  renderShell(`
    <main class="screen profile-select-screen">
      <section class="card hero-card stack-lg">
        <div class="stack">
          <span class="kicker">Mon Coach</span>
          <h1>Choisis ton profil</h1>
          <p class="muted">Chaque profil garde son programme, ses seances et son historique. Rien ne se melange, enfin une decision que meme un tableur respecterait.</p>
        </div>
        <button class="btn" onclick="startOnboarding()">Creer un nouveau profil</button>
      </section>

      ${hasProfiles ? `<section class="profile-list">
        ${state.profiles.map(profile => {
          const last = lastWorkout(profile);
          const recommended = getRecommendedSession(profile);
          const stats = profileWeekStats(profile);
          return `
            <article class="card compact profile-card">
              <div class="between profile-card-top">
                <div>
                  <span class="kicker">Profil local</span>
                  <h2>${escapeHtml(profile.name)}</h2>
                  <p class="small">${escapeHtml(profile.program.name)}</p>
                </div>
                <button class="btn small-btn" onclick="selectProfile('${profile.id}')">Entrer</button>
              </div>
              <div class="profile-stats">
                <div><strong>${stats.done}/${stats.target || 0}</strong><span>cette semaine</span></div>
                <div><strong>${(profile.logs || []).length}</strong><span>seances</span></div>
                <div><strong>${last ? formatDate(last.date) : "-"}</strong><span>derniere</span></div>
              </div>
              <div class="stack">
                <p class="small"><strong>Prochaine :</strong> ${recommended ? `${escapeHtml(recommended.title)} - ${escapeHtml(recommended.subtitle)}` : "Aucune seance"}</p>
                <div class="progress-bar"><div class="progress-fill" style="width:${stats.percent}%"></div></div>
              </div>
              <div class="row profile-actions">
                <button class="btn secondary small-btn" onclick="selectProfile('${profile.id}')">Choisir</button>
                <button class="btn ghost small-btn danger-text" onclick="deleteProfile('${profile.id}')">Supprimer</button>
              </div>
            </article>`;
        }).join("")}
      </section>` : `<section class="card compact stack"><h3>Aucun profil</h3><p class="muted">Cree ton premier profil pour generer un programme local et suivre les seances.</p></section>`}
    </main>
  `);
}
function selectProfile(profileId) {
  state.activeProfileId = profileId;
  state.introSeen = true;
  saveState();
  renderHome();
}

function deleteProfile(profileId) {
  const profile = state.profiles.find(p => p.id === profileId);
  if (!profile) return;
  const profileCount = state.profiles.length;
  const message = profileCount > 1
    ? `Supprimer le profil "${profile.name}" ? Son programme et son historique seront supprimes, sans toucher aux autres profils.`
    : `Supprimer le dernier profil "${profile.name}" ? L'application reviendra a l'ecran d'accueil initial.`;
  if (!confirm(message)) return;
  state.profiles = state.profiles.filter(p => p.id !== profileId);
  if (state.activeProfileId === profileId) state.activeProfileId = null;
  if (state.profiles.length === 0) {
    state.introSeen = false;
    saveState();
    renderLanding();
    return;
  }
  state.introSeen = true;
  saveState();
  renderProfileSelect();
}

function startOnboarding() {
  onboarding = {
    step: 0,
    answers: {
      name: "",
      age: "",
      sex: "non-renseigne",
      goal: "reprise",
      level: "reprise",
      sessionsPerWeek: 3,
      duration: "35-50",
      days: ["Lundi", "Mercredi", "Vendredi"],
      equipment: ["tapis", "haltere"],
      limitations: [],
      injuryText: "",
      preferences: ["renforcement", "gainage"],
      cardio: "optionnel"
    }
  };
  renderOnboarding();
}

function toggleArrayChoice(field, value) {
  const arr = onboarding.answers[field] || [];
  if (arr.includes(value)) onboarding.answers[field] = arr.filter(item => item !== value);
  else onboarding.answers[field] = [...arr, value];
  renderOnboarding();
}

function setChoice(field, value) {
  onboarding.answers[field] = value;
  renderOnboarding();
}

function readOnboardingInputs() {
  if (!onboarding) return;
  document.querySelectorAll("[data-answer]").forEach(input => {
    onboarding.answers[input.dataset.answer] = input.value;
  });
}

function nextOnboarding() {
  readOnboardingInputs();
  if (onboarding.step === 0 && !String(onboarding.answers.name || "").trim()) {
    alert("Il faut au moins un prenom. Oui, meme une app locale aime savoir a qui elle parle.");
    return;
  }
  if (onboarding.step < 6) {
    onboarding.step += 1;
    renderOnboarding();
  } else {
    finishOnboarding();
  }
}

function prevOnboarding() {
  readOnboardingInputs();
  if (onboarding.step > 0) onboarding.step -= 1;
  renderOnboarding();
}

function choiceButton(field, value, label) {
  const selected = onboarding.answers[field] === value;
  return `<button class="choice ${selected ? "selected" : ""}" onclick="setChoice('${field}','${value}')">${label}</button>`;
}

function pillButton(field, value, label) {
  const selected = (onboarding.answers[field] || []).includes(value);
  return `<button class="check-pill ${selected ? "selected" : ""}" onclick="toggleArrayChoice('${field}','${value}')">${label}</button>`;
}

function renderOnboarding() {
  const a = onboarding.answers;
  const step = onboarding.step;
  const steps = [renderOnboardingIdentity, renderOnboardingGoal, renderOnboardingTime, renderOnboardingEquipment, renderOnboardingLimits, renderOnboardingPrefs, renderOnboardingReview];
  renderShell(`
    ${appHeader("Creation profil")}
    <main class="screen">
      <section class="card compact stack">
        <div class="between"><span class="kicker">Etape ${step + 1} / 7</span><span class="badge">Local</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(((step + 1) / 7) * 100)}%"></div></div>
      </section>
      ${steps[step](a)}
      <section class="row">
        ${step > 0 ? `<button class="btn ghost small-btn" onclick="prevOnboarding()">Retour</button>` : `<button class="btn ghost small-btn" onclick="renderProfileSelect()">Annuler</button>`}
        <button class="btn small-btn" onclick="nextOnboarding()">${step === 6 ? "Creer le programme" : "Continuer"}</button>
      </section>
    </main>
  `);
}

function renderOnboardingIdentity(a) {
  return `
    <section class="card stack-lg">
      <div class="stack"><span class="kicker">Profil</span><h2>On commence par qui ?</h2><p class="muted">Profil personnel, stocke localement. Pas de connexion, pas d'exposition de compte. Enfin une decision raisonnable.</p></div>
      <div class="form">
        <div class="field"><label>Prenom</label><input class="input" data-answer="name" value="${escapeHtml(a.name)}" placeholder="Ex : Romain"></div>
        <div class="field"><label>Age optionnel</label><input class="input" data-answer="age" type="number" inputmode="numeric" value="${escapeHtml(a.age)}" placeholder="Ex : 37"></div>
        <div class="field"><label>Profil</label><select class="select" data-answer="sex"><option value="non-renseigne" ${a.sex === "non-renseigne" ? "selected" : ""}>Non renseigne</option><option value="homme" ${a.sex === "homme" ? "selected" : ""}>Homme</option><option value="femme" ${a.sex === "femme" ? "selected" : ""}>Femme</option></select></div>
      </div>
    </section>`;
}

function renderOnboardingGoal() {
  return `
    <section class="card stack-lg">
      <div class="stack"><span class="kicker">Objectif</span><h2>Quel est le but principal ?</h2></div>
      <div class="choice-grid">
        ${choiceButton("goal", "reprise", "Reprendre le sport")}
        ${choiceButton("goal", "regularite", "Etre regulier")}
        ${choiceButton("goal", "renforcement", "Me renforcer")}
        ${choiceButton("goal", "forme", "Ameliorer la forme")}
        ${choiceButton("goal", "mobilite", "Mobilite et gainage")}
        ${choiceButton("goal", "perte-ventre", "Perdre le petit ventre")}
      </div>
      <hr>
      <div class="stack"><label class="kicker">Niveau actuel</label><div class="choice-grid">${choiceButton("level", "debutant", "Debutant")}${choiceButton("level", "reprise", "Reprise")}${choiceButton("level", "intermediaire", "Intermediaire")}${choiceButton("level", "avance", "Avance")}</div></div>
    </section>`;
}

function renderOnboardingTime(a) {
  return `
    <section class="card stack-lg">
      <div class="stack"><span class="kicker">Planning</span><h2>Combien de temps reel ?</h2><p class="muted">On choisit un programme qui survit a la vraie vie, ce vieux bug non corrige.</p></div>
      <div class="field"><label>Seances par semaine</label><select class="select" data-answer="sessionsPerWeek"><option value="1" ${a.sessionsPerWeek == 1 ? "selected" : ""}>1 seance</option><option value="2" ${a.sessionsPerWeek == 2 ? "selected" : ""}>2 seances</option><option value="3" ${a.sessionsPerWeek == 3 ? "selected" : ""}>3 seances</option><option value="4" ${a.sessionsPerWeek == 4 ? "selected" : ""}>4 seances</option></select></div>
      <div class="field"><label>Duree moyenne</label><select class="select" data-answer="duration"><option value="10-20" ${a.duration === "10-20" ? "selected" : ""}>10-20 min</option><option value="20-35" ${a.duration === "20-35" ? "selected" : ""}>20-35 min</option><option value="35-50" ${a.duration === "35-50" ? "selected" : ""}>35-50 min</option><option value="50-60" ${a.duration === "50-60" ? "selected" : ""}>50-60 min</option></select></div>
      <div class="field"><label>Jours possibles</label><div class="check-list">${["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"].map(d => pillButton("days", d, d)).join("")}</div></div>
    </section>`;
}

function renderOnboardingEquipment() {
  return `
    <section class="card stack-lg">
      <div class="stack"><span class="kicker">Materiel</span><h2>Qu'est-ce qui est disponible ?</h2></div>
      <div class="check-list">
        ${pillButton("equipment", "poids-corps", "Poids du corps")}
        ${pillButton("equipment", "tapis", "Tapis")}
        ${pillButton("equipment", "haltere", "Haltere")}
        ${pillButton("equipment", "velo", "Velo d'appartement")}
        ${pillButton("equipment", "barre", "Barre de traction")}
      </div>
      <p class="small">Le poids du corps sera toujours considere disponible. Sauf evenement gravitationnel majeur, evidemment.</p>
    </section>`;
}

function renderOnboardingLimits(a) {
  return `
    <section class="card stack-lg warning">
      <div class="stack"><span class="kicker">Contraintes</span><h2>Blessures, douleurs, zones sensibles ?</h2></div>
      <div class="check-list">
        ${pillButton("limitations", "epaule", "Epaule")}
        ${pillButton("limitations", "dos", "Dos")}
        ${pillButton("limitations", "genou", "Genou")}
        ${pillButton("limitations", "cheville", "Cheville")}
        ${pillButton("limitations", "poignet", "Poignet")}
        ${pillButton("limitations", "aucune", "Aucune")}
      </div>
      <div class="field"><label>Commentaire optionnel</label><textarea data-answer="injuryText" placeholder="Ex : ancienne foulure cheville, douleur epaule sur certains mouvements...">${escapeHtml(a.injuryText)}</textarea></div>
    </section>`;
}

function renderOnboardingPrefs(a) {
  return `
    <section class="card stack-lg">
      <div class="stack"><span class="kicker">Preferences</span><h2>Que doit privilegier le programme ?</h2></div>
      <div class="check-list">
        ${pillButton("preferences", "renforcement", "Renforcement")}
        ${pillButton("preferences", "gainage", "Gainage")}
        ${pillButton("preferences", "mobilite", "Mobilite")}
        ${pillButton("preferences", "jambes", "Jambes")}
        ${pillButton("preferences", "haut", "Haut du corps")}
        ${pillButton("preferences", "cardio", "Cardio doux")}
      </div>
      <div class="field"><label>Cardio</label><select class="select" data-answer="cardio"><option value="non" ${a.cardio === "non" ? "selected" : ""}>Pas pour l'instant</option><option value="optionnel" ${a.cardio === "optionnel" ? "selected" : ""}>Optionnel</option><option value="oui" ${a.cardio === "oui" ? "selected" : ""}>Oui, cardio doux</option></select></div>
    </section>`;
}

function renderOnboardingReview(a) {
  return `
    <section class="card stack-lg">
      <div class="stack"><span class="kicker">Recapitulatif</span><h2>Programme pret a generer</h2><p class="muted">L'app va creer un programme local a partir de tes reponses. Pas d'IA, pas d'envoi en ligne, pas de compte ChatGPT expose sur GitHub. On respire.</p></div>
      <ul class="list">
        <li><strong>Profil :</strong> ${escapeHtml(a.name || "Profil")}</li>
        <li><strong>Objectif :</strong> ${escapeHtml(a.goal)}</li>
        <li><strong>Niveau :</strong> ${escapeHtml(a.level)}</li>
        <li><strong>Frequence :</strong> ${escapeHtml(a.sessionsPerWeek)} seance(s) / semaine</li>
        <li><strong>Duree :</strong> ${escapeHtml(a.duration)} min</li>
        <li><strong>Materiel :</strong> ${(a.equipment || []).join(", ") || "poids du corps"}</li>
        <li><strong>Contraintes :</strong> ${(a.limitations || []).join(", ") || "aucune"}</li>
      </ul>
    </section>`;
}

function finishOnboarding() {
  readOnboardingInputs();
  const answers = onboarding.answers;
  if (!(answers.equipment || []).includes("poids-corps")) answers.equipment.push("poids-corps");
  if ((answers.limitations || []).includes("aucune")) answers.limitations = ["aucune"];
  const program = generateProgram(answers);
  const profile = createProfileFromProgram(answers, program);
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  state.introSeen = true;
  onboarding = null;
  saveState();
  renderHome();
}

function generateProgram(answers) {
  const program = clone(DEFAULT_PROGRAM);
  const days = (answers.days || []).length ? answers.days : ["Lundi", "Mercredi", "Vendredi"];
  const sessionsPerWeek = Number(answers.sessionsPerWeek || 3);
  const equipment = new Set([...(answers.equipment || []), "poids-corps"]);
  const limitations = new Set(answers.limitations || []);
  const shortMode = answers.duration === "10-20";
  const mediumMode = answers.duration === "20-35";

  program.id = uid("program");
  program.name = `${answers.name || "Profil"} - programme personnel`;
  program.weeklyTarget = Math.max(1, Math.min(4, sessionsPerWeek));
  program.notes = [
    "Programme genere localement depuis le questionnaire.",
    "Regularite avant performance.",
    "Douleur articulaire nette = arret ou adaptation."
  ];

  let sessions = clone(DEFAULT_PROGRAM.sessions);
  sessions.forEach((session, index) => {
    session.recommendedDay = days[index % days.length] || session.recommendedDay;
    session.plannedDuration = answers.duration === "10-20" ? "10-20 min" : answers.duration === "20-35" ? "20-35 min" : session.plannedDuration;
    if (shortMode) {
      session.exercises.forEach(ex => { if (ex.sets > 2) ex.sets = 2; if (ex.restSeconds > 60) ex.restSeconds = 60; });
    }
    if (mediumMode) {
      session.exercises.forEach(ex => { if (ex.sets > 3) ex.sets = 3; });
    }
  });

  if (!equipment.has("velo")) {
    sessions.forEach(session => {
      session.warmup = session.warmup.map(item => item.toLowerCase().includes("velo") ? "Marche active sur place : 3 min" : item);
      session.exercises = session.exercises.filter(ex => ex.id !== "velo-appartement");
    });
    program.notes.push("Velo retire car non disponible.");
  }

  if (!equipment.has("haltere")) {
    sessions.forEach(session => {
      session.exercises = session.exercises.map(ex => {
        if (ex.name.toLowerCase().includes("rowing")) return toSessionExercise(exerciseById("superman"), { id: `${ex.id}-remplacement`, sets: Math.min(ex.sets, 3), target: "10-12 reps", restSeconds: 45 });
        if (ex.id.includes("developpe-epaules")) return toSessionExercise(exerciseById("pompes-inclinees"), { id: `${ex.id}-remplacement`, sets: Math.min(ex.sets, 3), target: "8-10 reps", restSeconds: 60 });
        if (ex.id.includes("souleve-terre")) return toSessionExercise(exerciseById("glute-bridge"), { id: `${ex.id}-remplacement`, sets: Math.min(ex.sets, 3), target: "12-15 reps", restSeconds: 45 });
        return ex;
      });
    });
    program.notes.push("Exercices avec haltere remplaces par des variantes au poids du corps.");
  }

  if (!equipment.has("barre")) {
    sessions.forEach(session => {
      session.exercises = session.exercises.map(ex => {
        if (ex.id === "tractions") {
          const replacement = equipment.has("haltere") ? exerciseById("rowing-haltere") : exerciseById("superman");
          return toSessionExercise(replacement, { id: "tractions-remplacement", sets: 4, target: replacement.defaultTarget, restSeconds: replacement.defaultRest });
        }
        return ex;
      });
    });
    program.notes.push("Tractions remplacees car barre non disponible.");
  }

  if (limitations.has("genou") || limitations.has("cheville")) {
    sessions.forEach(session => {
      session.exercises = session.exercises.map(ex => {
        if (ex.id.includes("fentes")) return toSessionExercise(exerciseById("glute-bridge"), { id: `${ex.id}-remplacement`, sets: 2, target: "12 reps", restSeconds: 45 });
        if (ex.name.toLowerCase().includes("squats")) { ex.target = "8-10 reps controlees"; ex.instructions += " Amplitude reduite si gene."; }
        return ex;
      });
    });
    program.notes.push("Adaptation genou/cheville : amplitude reduite, fentes remplacees si besoin.");
  }

  if (limitations.has("epaule") || limitations.has("poignet")) {
    sessions.forEach(session => {
      session.exercises = session.exercises.map(ex => {
        if (ex.name.toLowerCase().includes("developpe")) return toSessionExercise(exerciseById("dead-bug"), { id: `${ex.id}-remplacement`, sets: 3, target: "8 reps par cote", restSeconds: 45 });
        if (ex.name.toLowerCase().includes("pompes")) { ex.target = "6-10 reps adaptees"; ex.instructions += " Fais la version inclinee si l'epaule ou le poignet proteste."; }
        return ex;
      });
    });
    program.notes.push("Adaptation epaule/poignet : presses reduites ou remplacees, pompes adaptables.");
  }

  if (limitations.has("dos")) {
    sessions.forEach(session => {
      session.exercises = session.exercises.map(ex => {
        if (ex.id.includes("souleve-terre")) return toSessionExercise(exerciseById("glute-bridge"), { id: `${ex.id}-remplacement`, sets: 3, target: "12 reps", restSeconds: 45 });
        return ex;
      });
    });
    program.notes.push("Adaptation dos : charniere de hanche lourde remplacee par pont fessier si besoin.");
  }

  const mobilitySession = {
    id: "mobilite-gainage",
    title: "Mobilite + gainage",
    subtitle: "Seance douce",
    type: "mobilite",
    recommendedDay: days[3 % days.length] || "Dimanche",
    plannedDuration: shortMode ? "10-20 min" : "20-30 min",
    description: "Seance douce pour bouger, respirer et renforcer le centre.",
    warmup: ["Respiration lente : 1 min", "Mobilite epaules : 10 mouvements", "Mobilite hanches : 10 mouvements"],
    exercises: [
      toSessionExercise(exerciseById("dead-bug"), { id: "mob-dead-bug", sets: shortMode ? 2 : 3, target: "8 reps par cote", restSeconds: 30 }),
      toSessionExercise(exerciseById("bird-dog"), { id: "mob-bird-dog", sets: shortMode ? 2 : 3, target: "8 reps par cote", restSeconds: 30 }),
      toSessionExercise(exerciseById("planche"), { id: "mob-planche", sets: 2, target: "20-30 sec", restSeconds: 45 }),
      toSessionExercise(exerciseById("glute-bridge"), { id: "mob-glute", sets: 2, target: "12 reps", restSeconds: 45 })
    ],
    cooldown: ["Respiration lente : 1 min", "Etirement doux : 2 min"]
  };

  if (sessionsPerWeek <= 1) sessions = [sessions.find(s => s.id === "mini-routine"), sessions.find(s => s.id === "urgence")].filter(Boolean);
  if (sessionsPerWeek === 2) sessions = [sessions.find(s => s.id === "session-a"), sessions.find(s => s.id === "session-b"), sessions.find(s => s.id === "urgence")].filter(Boolean);
  if (sessionsPerWeek === 3) sessions = [sessions.find(s => s.id === "mini-routine"), sessions.find(s => s.id === "session-a"), sessions.find(s => s.id === "session-b"), sessions.find(s => s.id === "urgence")].filter(Boolean);
  if (sessionsPerWeek >= 4) sessions = [sessions.find(s => s.id === "mini-routine"), sessions.find(s => s.id === "session-a"), sessions.find(s => s.id === "session-b"), mobilitySession, sessions.find(s => s.id === "urgence")].filter(Boolean);

  sessions.forEach((session, index) => {
    if (session.id !== "urgence") session.recommendedDay = days[index % days.length] || session.recommendedDay;
  });

  program.sessions = sessions;
  return program;
}

function renderHome() {
  view = "home";
  active = null;
  stopRestTimer();
  const profile = requireProfile();
  if (!profile) return;
  const recommended = getRecommendedSession(profile);
  const items = weeklySessions(profile);
  const count = items.filter(item => completedThisWeek(item.id, profile)).length;
  const percent = items.length ? Math.round((count / items.length) * 100) : 0;
  const last = lastWorkout(profile);
  renderShell(`
    ${appHeader("Mon Coach")}
    <main class="screen">
      <section class="card hero-card">
        <div class="stack">
          <span class="kicker">Bonjour ${escapeHtml(profile.name)}</span>
          <h1>${recommended ? recommended.title : "Programme"}</h1>
          <p class="muted">${recommended ? recommended.subtitle : "Aucune seance disponible"}</p>
          ${recommended ? `<div class="row"><span class="badge">${recommended.plannedDuration}</span><span class="badge">${recommended.recommendedDay}</span><span class="badge good">Mode fatigue dispo</span></div>` : ""}
        </div>
        ${recommended ? `<button class="btn" onclick="startSession('${recommended.id}')">Preparer la seance</button>` : `<button class="btn" onclick="renderSessionBuilder()">Creer une seance</button>`}
      </section>

      <section class="quick-stats">
        <article class="stat-card"><strong>${count}/${items.length}</strong><span>seances cette semaine</span></article>
        <article class="stat-card"><strong>${(profile.logs || []).length}</strong><span>seances terminees</span></article>
        <article class="stat-card"><strong>${last ? formatDate(last.date) : "-"}</strong><span>derniere seance</span></article>
      </section>

      <section class="card compact stack">
        <div class="between"><h3>Cette semaine</h3><span class="badge good">${count} / ${items.length}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="week-list">
          ${items.map(item => `<button class="week-item clickable" onclick="startSession('${item.id}')"><div><strong>${item.recommendedDay}</strong><p class="small">${item.title} - ${item.subtitle}</p></div><span class="badge ${completedThisWeek(item.id, profile) ? "good" : ""}">${sessionCompletionLabel(item, profile)}</span></button>`).join("")}
        </div>
      </section>

      <section class="card compact stack good-note">
        <div class="between"><div><h3>Adapter aujourd'hui</h3><p class="small">Avant chaque seance, choisis ton etat : forme normale, fatigue moyenne ou journee chargee. L'app reduit le volume au lieu de te transformer en robot casse.</p></div><span class="badge good">Nouveau</span></div>
      </section>

      ${profile.program.notes && profile.program.notes.length ? `<section class="card compact stack warning"><h3>Notes du programme</h3><ul class="list">${profile.program.notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul></section>` : ""}
      ${profile.program.sessions.find(s => s.id === "urgence") ? `<section class="card compact stack"><div class="between"><div><h3>Pas le temps ?</h3><p class="small">Version courte pour sauver la routine. Petite victoire, gros rendement psychologique.</p></div><span class="badge warn">10 min</span></div><button class="btn secondary" onclick="startSession('urgence')">Preparer la version urgence</button></section>` : ""}
    </main>
  `);
}
function renderProgram() {
  view = "program";
  const profile = requireProfile();
  if (!profile) return;
  renderShell(`
    ${appHeader("Programme")}
    <main class="screen">
      <section class="stack"><span class="kicker">${escapeHtml(profile.program.name)}</span><h2>Seances</h2><p class="muted">Tu peux lancer, consulter ou ajouter une seance. Le calendrier conseille, il ne commande pas. Il a ete recadre.</p></section>
      <button class="btn" onclick="renderSessionBuilder()">Ajouter une seance</button>
      <section class="session-grid">
        ${profile.program.sessions.map(session => `
          <article class="card compact session-card">
            <div class="between"><div class="stack"><span class="badge">${session.recommendedDay}</span><div><h3>${session.title}</h3><p class="muted">${session.subtitle}</p></div></div><span class="badge">${session.plannedDuration}</span></div>
            <p class="small">${session.description}</p>
            <div class="row"><span class="badge">${session.exercises.length} exos</span><span class="badge">${totalSets(session)} series</span></div>
            <div class="row"><button class="btn secondary small-btn" onclick="renderSessionDetail('${session.id}')">Voir detail</button><button class="btn small-btn" onclick="startSession('${session.id}')">Preparer</button></div>
          </article>
        `).join("")}
      </section>
    </main>
  `);
}

function renderSessionDetail(sessionId) {
  const session = findSession(sessionId);
  if (!session) return renderProgram();
  view = "program";
  renderShell(`
    ${appHeader("Detail")}
    <main class="screen">
      <button class="btn ghost small-btn" onclick="renderProgram()">Retour</button>
      <section class="card stack-lg"><div class="stack"><span class="kicker">${session.recommendedDay} - ${session.plannedDuration}</span><h1>${session.title}</h1><p class="muted">${session.subtitle}</p></div><p>${session.description}</p><button class="btn" onclick="startSession('${session.id}')">Preparer cette seance</button></section>
      ${session.warmup.length ? `<section class="card compact stack"><h3>Echauffement</h3><ul class="list">${session.warmup.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
      <section class="card compact stack"><h3>Exercices</h3><ul class="list">${session.exercises.map(ex => `<li><strong>${escapeHtml(ex.name)}</strong><br><span class="small">${ex.sets} serie(s) - ${escapeHtml(ex.target)} - repos ${ex.restSeconds}s</span></li>`).join("")}</ul></section>
      ${session.cooldown.length ? `<section class="card compact stack"><h3>Retour au calme</h3><ul class="list">${session.cooldown.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
    </main>
  `);
}

function renderLibrary() {
  view = "library";
  const profile = requireProfile();
  if (!profile) return;
  const library = getLibrary();
  renderShell(`
    ${appHeader("Exercices")}
    <main class="screen">
      <section class="stack"><span class="kicker">Bibliotheque</span><h2>Exercices disponibles</h2><p class="muted">Base commune + exercices personnalises. Certains n'ont pas encore de media, parce que la perfection visuelle attendra poliment son tour.</p></section>
      <button class="btn" onclick="showCustomExerciseModal()">Ajouter un exercice</button>
      <section class="library-grid">
        ${library.map(ex => `
          <article class="card compact stack">
            <div class="between"><div><h3>${escapeHtml(ex.name)}</h3><p class="small">${escapeHtml(ex.category)} · ${(ex.equipment || []).join(", ")}</p></div><span class="badge">${escapeHtml(ex.defaultTarget || "Libre")}</span></div>
            <p class="small">${escapeHtml(ex.instructions)}</p>
          </article>
        `).join("")}
      </section>
    </main>
  `);
}

function showCustomExerciseModal() {
  const wrapper = document.createElement("div");
  wrapper.className = "modal-backdrop";
  wrapper.innerHTML = `
    <div class="modal">
      <div class="between"><div><span class="kicker">Exercice perso</span><h3>Ajouter un exercice</h3></div><button class="icon-btn" onclick="closeModal()">×</button></div>
      <div class="form">
        <div class="field"><label>Nom</label><input id="customName" class="input" placeholder="Ex : Curl biceps"></div>
        <div class="field"><label>Categorie</label><select id="customCategory" class="select"><option value="haut">Haut du corps</option><option value="jambes">Jambes</option><option value="dos">Dos</option><option value="gainage">Gainage</option><option value="mobilite">Mobilite</option><option value="cardio">Cardio</option></select></div>
        <div class="field"><label>Objectif par defaut</label><input id="customTarget" class="input" placeholder="Ex : 10-12 reps"></div>
        <div class="field"><label>Repos en secondes</label><input id="customRest" class="input" type="number" value="45"></div>
        <div class="field"><label>Consigne</label><textarea id="customInstructions" placeholder="Consigne simple"></textarea></div>
      </div>
      <button class="btn" onclick="saveCustomExercise()">Ajouter</button>
    </div>`;
  document.body.appendChild(wrapper);
}

function closeModal() {
  const modal = document.querySelector(".modal-backdrop");
  if (modal) modal.remove();
}

function saveCustomExercise() {
  const profile = activeProfile();
  if (!profile) return;
  const name = document.getElementById("customName").value.trim();
  if (!name) return alert("Nom obligatoire. Une case vide, ce n'est pas encore un exercice.");
  const exercise = {
    id: uid("custom-ex"),
    name,
    category: document.getElementById("customCategory").value,
    equipment: ["personnel"],
    media: null,
    mediaType: "none",
    defaultTarget: document.getElementById("customTarget").value.trim() || "8-12 reps",
    defaultRest: Number(document.getElementById("customRest").value || 45),
    instructions: document.getElementById("customInstructions").value.trim() || "Mouvement controle, sans douleur nette."
  };
  profile.customExercises.push(exercise);
  saveState();
  closeModal();
  renderLibrary();
}

function renderSessionBuilder() {
  view = "program";
  if (!builder) builder = { title: "Seance perso", subtitle: "Libre", day: "Libre", duration: "20-30 min", exercises: [] };
  const library = getLibrary();
  renderShell(`
    ${appHeader("Nouvelle seance")}
    <main class="screen">
      <button class="btn ghost small-btn" onclick="builder=null;renderProgram()">Annuler</button>
      <section class="card stack-lg">
        <div class="stack"><span class="kicker">Construction</span><h2>Ajouter une seance</h2></div>
        <div class="form">
          <div class="field"><label>Titre</label><input id="builderTitle" class="input" value="${escapeHtml(builder.title)}"></div>
          <div class="field"><label>Sous-titre</label><input id="builderSubtitle" class="input" value="${escapeHtml(builder.subtitle)}"></div>
          <div class="field"><label>Jour conseille</label><input id="builderDay" class="input" value="${escapeHtml(builder.day)}"></div>
          <div class="field"><label>Duree</label><input id="builderDuration" class="input" value="${escapeHtml(builder.duration)}"></div>
        </div>
      </section>
      <section class="card compact stack">
        <h3>Ajouter un exercice</h3>
        <div class="form">
          <select id="builderExercise" class="select">${library.map(ex => `<option value="${ex.id}">${escapeHtml(ex.name)} - ${escapeHtml(ex.category)}</option>`).join("")}</select>
          <div class="row"><input id="builderSets" class="input" style="flex:1" type="number" value="2" placeholder="Series"><input id="builderRest" class="input" style="flex:1" type="number" value="45" placeholder="Repos"></div>
          <input id="builderTarget" class="input" placeholder="Objectif ex : 10 reps">
          <button class="btn secondary" onclick="addExerciseToBuilder()">Ajouter a la seance</button>
        </div>
      </section>
      <section class="card compact stack"><h3>Exercices choisis</h3>${builder.exercises.length ? builder.exercises.map((ex, index) => `<div class="exercise-row"><div><strong>${escapeHtml(ex.name)}</strong><p class="small">${ex.sets} serie(s) · ${escapeHtml(ex.target)} · repos ${ex.restSeconds}s</p></div><button class="btn ghost small-btn" onclick="removeBuilderExercise(${index})">Retirer</button></div>`).join("") : `<p class="small">Aucun exercice pour l'instant. Ambitieux, mais peu fatigant.</p>`}</section>
      <button class="btn" onclick="saveBuiltSession()">Enregistrer la seance</button>
    </main>
  `);
}

function readBuilderHeader() {
  if (!builder) return;
  const title = document.getElementById("builderTitle");
  if (title) builder.title = title.value.trim() || "Seance perso";
  const subtitle = document.getElementById("builderSubtitle");
  if (subtitle) builder.subtitle = subtitle.value.trim() || "Libre";
  const day = document.getElementById("builderDay");
  if (day) builder.day = day.value.trim() || "Libre";
  const duration = document.getElementById("builderDuration");
  if (duration) builder.duration = duration.value.trim() || "20-30 min";
}

function addExerciseToBuilder() {
  readBuilderHeader();
  const ex = exerciseById(document.getElementById("builderExercise").value);
  const sets = Number(document.getElementById("builderSets").value || 2);
  const rest = Number(document.getElementById("builderRest").value || ex.defaultRest || 45);
  const target = document.getElementById("builderTarget").value.trim() || ex.defaultTarget || "8-12 reps";
  builder.exercises.push(toSessionExercise(ex, { sets, restSeconds: rest, target }));
  renderSessionBuilder();
}

function removeBuilderExercise(index) {
  readBuilderHeader();
  builder.exercises.splice(index, 1);
  renderSessionBuilder();
}

function saveBuiltSession() {
  readBuilderHeader();
  const profile = activeProfile();
  if (!profile) return;
  if (!builder.exercises.length) return alert("Ajoute au moins un exercice. Sinon c'est juste un titre avec de l'espoir.");
  profile.program.sessions.push({
    id: uid("session"),
    title: builder.title,
    subtitle: builder.subtitle,
    type: "personnel",
    recommendedDay: builder.day,
    plannedDuration: builder.duration,
    description: "Seance personnalisee creee depuis la bibliotheque.",
    warmup: [],
    exercises: builder.exercises,
    cooldown: []
  });
  builder = null;
  saveState();
  renderProgram();
}

function startSession(sessionId) {
  const session = findSession(sessionId);
  if (!session) return;
  renderReadiness(sessionId);
}

function readinessOptions(session) {
  const hasUrgence = !!findSession("urgence");
  return [
    {
      id: "normal",
      title: "Forme normale",
      badge: "Complet",
      description: "Seance prevue, volume complet, repos normaux.",
      details: `${totalSets(session)} series · ${session.plannedDuration}`
    },
    {
      id: "fatigue",
      title: "Fatigue moyenne",
      badge: "Reduit",
      description: "Maximum 2 series par exercice, repos conserves ou raccourcis legerement.",
      details: "On reduit, on n'annule pas"
    },
    {
      id: "chargee",
      title: "Journee chargee",
      badge: "Court",
      description: hasUrgence && session.id !== "urgence" ? "Basculer vers la version urgence de 10 minutes." : "Une seule serie par exercice, repos courts.",
      details: hasUrgence && session.id !== "urgence" ? "Version urgence" : "Volume minimal"
    }
  ];
}

function renderReadiness(sessionId) {
  const session = findSession(sessionId);
  if (!session) return renderHome();
  view = "readiness";
  const options = readinessOptions(session);
  renderShell(`
    ${appHeader("Preparation")}
    <main class="screen">
      <button class="btn ghost small-btn" onclick="renderHome()">Retour</button>
      <section class="card hero-card stack-lg">
        <div class="stack">
          <span class="kicker">Avant de commencer</span>
          <h1>Ton etat aujourd'hui ?</h1>
          <p class="muted">${escapeHtml(session.title)} - ${escapeHtml(session.subtitle)}. Choisis le volume realiste. La regularite bat la performance, ce qui est moins spectaculaire mais nettement plus durable.</p>
        </div>
        <div class="row"><span class="badge">${session.plannedDuration}</span><span class="badge">${totalSets(session)} series prevues</span></div>
      </section>
      <section class="session-grid">
        ${options.map(opt => `
          <article class="card compact stack readiness-card">
            <div class="between"><div><h3>${opt.title}</h3><p class="small">${opt.description}</p></div><span class="badge ${opt.id === "chargee" ? "warn" : opt.id === "fatigue" ? "" : "good"}">${opt.badge}</span></div>
            <p class="small"><strong>${opt.details}</strong></p>
            <button class="btn ${opt.id === "normal" ? "" : "secondary"}" onclick="startSessionWithMode('${sessionId}','${opt.id}')">Choisir</button>
          </article>
        `).join("")}
      </section>
      <section class="card compact stack warning">
        <h3>Rappel securite</h3>
        <p class="small">Douleur articulaire nette, gene qui augmente ou sensation d'instabilite : tu arretes ou tu adaptes. Le courage idiot n'est toujours pas une fonctionnalite.</p>
      </section>
    </main>
  `);
}

function adaptSessionForReadiness(session, readiness) {
  const adapted = clone(session);
  adapted.originalId = session.id;
  adapted.readiness = readiness;
  if (readiness === "normal") {
    adapted.readinessLabel = "Forme normale";
    return adapted;
  }
  if (readiness === "fatigue") {
    adapted.readinessLabel = "Fatigue moyenne";
    adapted.title = `${adapted.title} - adapte`;
    adapted.subtitle = `${adapted.subtitle} · volume reduit`;
    adapted.description = `${adapted.description} Volume reduit automatiquement : maximum 2 series par exercice.`;
    adapted.exercises = adapted.exercises.map(ex => ({ ...ex, sets: Math.max(1, Math.min(Number(ex.sets || 1), 2)), restSeconds: Math.min(Number(ex.restSeconds || 0), 60) }));
    adapted.cooldown = adapted.cooldown || [];
    return adapted;
  }
  if (readiness === "chargee") {
    const urgent = session.id !== "urgence" ? findSession("urgence") : null;
    if (urgent) {
      const cloneUrgent = clone(urgent);
      cloneUrgent.originalId = session.id;
      cloneUrgent.readiness = readiness;
      cloneUrgent.readinessLabel = "Journee chargee";
      cloneUrgent.title = `${cloneUrgent.title} - a la place de ${session.title}`;
      return cloneUrgent;
    }
    adapted.readinessLabel = "Journee chargee";
    adapted.title = `${adapted.title} - express`;
    adapted.subtitle = `${adapted.subtitle} · minimum viable humain`;
    adapted.exercises = adapted.exercises.map(ex => ({ ...ex, sets: 1, restSeconds: Math.min(Number(ex.restSeconds || 0), 30) }));
    adapted.warmup = (adapted.warmup || []).slice(0, 2);
    adapted.cooldown = [];
    return adapted;
  }
  adapted.readinessLabel = "Forme normale";
  return adapted;
}

function startSessionWithMode(sessionId, readiness) {
  const session = findSession(sessionId);
  if (!session) return;
  const prepared = adaptSessionForReadiness(session, readiness);
  active = { id: uid("log"), session: prepared, sourceSessionId: session.id, readiness, mode: prepared.warmup.length ? "warmup" : "exercise", exerciseIndex: 0, setIndex: 0, startMs: Date.now(), completedSets: [], painNotes: [] };
  selectedDifficulty = 3;
  renderActiveSession();
}
function renderActiveSession() {
  if (!active) return renderHome();
  stopRestTimer();
  if (active.mode === "warmup") renderWarmup();
  if (active.mode === "exercise") renderExercise();
  if (active.mode === "rest") renderRest();
  if (active.mode === "cooldown") renderCooldown();
  if (active.mode === "summary") renderSummary();
}

function renderTrainingHeader(label) {
  const done = active.completedSets.length;
  const total = totalSets(active.session);
  const percent = total ? Math.round((done / total) * 100) : 0;
  return `<div class="training-top stack"><div class="between"><button class="btn ghost small-btn" onclick="confirmQuitSession()">Quitter</button><div class="row" style="justify-content:flex-end"><span class="badge">${label}</span>${active.session.readinessLabel ? `<span class="badge good">${escapeHtml(active.session.readinessLabel)}</span>` : ""}</div></div><div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div></div>`;
}

function renderWarmup() {
  const session = active.session;
  renderShell(`${renderTrainingHeader("Echauffement")}<main class="screen"><section class="card stack-lg"><span class="kicker">${session.title}</span><h1>Echauffement</h1><ul class="list">${session.warmup.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul><button class="btn" onclick="finishWarmup()">Echauffement termine</button></section></main>`);
}

function finishWarmup() { active.mode = "exercise"; renderActiveSession(); }
function currentExercise() { return active.session.exercises[active.exerciseIndex]; }

function renderExercise() {
  const ex = currentExercise();
  const done = active.completedSets.length;
  const total = totalSets(active.session);
  renderShell(`
    ${renderTrainingHeader(`${done} / ${total} series`)}
    <main class="screen">
      <section class="stack"><span class="kicker">Exercice ${active.exerciseIndex + 1} / ${active.session.exercises.length}</span><h1>${escapeHtml(ex.name)}</h1><p class="muted">${escapeHtml(ex.instructions)}</p></section>
      ${mediaHtml(ex)}
      <section class="card compact stack-lg"><div class="between"><div><span class="kicker">Serie</span><div class="big-number">${active.setIndex + 1}/${ex.sets}</div></div><div class="stack" style="text-align:right"><span class="badge">${escapeHtml(ex.target)}</span><span class="badge">Repos ${ex.restSeconds}s</span></div></div><button class="btn" onclick="completeSet(true)">Serie faite</button><div class="row"><button class="btn secondary small-btn" onclick="showPainModal()">Douleur / gene</button><button class="btn ghost small-btn" onclick="completeSet(false)">Ignorer serie</button></div></section>
    </main>`);
}

function completeSet(done) {
  const ex = currentExercise();
  active.completedSets.push({ exerciseId: ex.id, exerciseName: ex.name, set: active.setIndex + 1, done, at: new Date().toISOString() });
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
  if (active.setIndex + 1 < ex.sets) { active.setIndex += 1; active.mode = "exercise"; }
  else if (active.exerciseIndex + 1 < active.session.exercises.length) { active.exerciseIndex += 1; active.setIndex = 0; active.mode = "exercise"; }
  else if (active.session.cooldown.length) active.mode = "cooldown";
  else active.mode = "summary";
  renderActiveSession();
}

function renderRest() {
  renderShell(`${renderTrainingHeader("Repos")}<main class="screen"><section class="card stack-lg" style="text-align:center"><span class="kicker">Repos</span><div class="timer-circle"><div id="timerText" class="timer-text">${formatClock(restRemaining)}</div></div><p class="muted">Prochaine etape : ${escapeHtml(getNextStepLabel())}</p><button class="btn" onclick="skipRest()">Passer le repos</button><button class="btn secondary" onclick="showPainModal()">Douleur / gene</button></section></main>`);
}

function getNextStepLabel() {
  const ex = currentExercise();
  if (active.setIndex + 1 < ex.sets) return `${ex.name} - serie ${active.setIndex + 2}/${ex.sets}`;
  const next = active.session.exercises[active.exerciseIndex + 1];
  if (next) return `${next.name} - serie 1/${next.sets}`;
  return active.session.cooldown.length ? "Retour au calme" : "Fin de seance";
}

function startRestTimer() {
  stopRestTimer();
  restTimer = setInterval(() => {
    restRemaining -= 1;
    const timerText = document.getElementById("timerText");
    if (timerText) timerText.textContent = formatClock(Math.max(0, restRemaining));
    if (restRemaining <= 0) skipRest();
  }, 1000);
}

function stopRestTimer() { if (restTimer) clearInterval(restTimer); restTimer = null; }
function skipRest() { stopRestTimer(); advanceAfterSet(); }

function renderCooldown() {
  const session = active.session;
  renderShell(`${renderTrainingHeader("Retour au calme")}<main class="screen"><section class="card stack-lg"><span class="kicker">${session.title}</span><h1>Retour au calme</h1><ul class="list">${session.cooldown.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul><button class="btn" onclick="finishCooldown()">Terminer</button></section></main>`);
}
function finishCooldown() { active.mode = "summary"; renderSummary(); }

function showPainModal() {
  const wrapper = document.createElement("div");
  wrapper.className = "modal-backdrop";
  wrapper.innerHTML = `<div class="modal"><div class="between"><div><span class="kicker">Signalement</span><h3>Douleur ou gene</h3></div><button class="icon-btn" onclick="closeModal()">×</button></div><div class="form"><div class="field"><label>Zone</label><select id="painZone" class="select"><option>Epaule</option><option>Dos</option><option>Genou</option><option>Cheville</option><option>Poignet</option><option>Autre</option></select></div><div class="field"><label>Intensite 1 a 5</label><select id="painLevel" class="select"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div><div class="field"><label>Commentaire</label><textarea id="painComment" placeholder="Ex : gene legere sur la derniere serie"></textarea></div></div><button class="btn warn" onclick="savePainNote()">Enregistrer la gene</button></div>`;
  document.body.appendChild(wrapper);
}

function savePainNote() {
  if (!active) return closeModal();
  active.painNotes.push({ zone: document.getElementById("painZone").value, level: Number(document.getElementById("painLevel").value), comment: document.getElementById("painComment").value.trim(), exercise: currentExercise() ? currentExercise().name : null, at: new Date().toISOString() });
  closeModal();
  alert("Note ajoutee. Si la douleur est nette ou augmente, on arrete. Le courage idiot n'est pas un objectif produit.");
}

function renderSummary() {
  const doneCount = active.completedSets.filter(s => s.done).length;
  const total = totalSets(active.session);
  const duration = minutesBetween(active.startMs, Date.now());
  renderShell(`
    ${renderTrainingHeader("Resume")}
    <main class="screen">
      <section class="card stack-lg"><span class="kicker">Seance terminee</span><h1>${active.session.title}</h1><p class="muted">${doneCount} / ${total} series faites · ${duration} min</p></section>
      <section class="card compact stack"><h3>Difficulte globale</h3><div class="choice-grid">${[1,2,3,4,5].map(n => `<button class="choice ${selectedDifficulty === n ? "selected" : ""}" onclick="setDifficulty(${n})">${n}</button>`).join("")}</div></section>
      <section class="card compact stack"><h3>Douleurs / genes</h3>${active.painNotes.length ? `<ul class="list">${active.painNotes.map(note => `<li>${escapeHtml(note.zone)} ${note.level}/5 - ${escapeHtml(note.comment || "sans commentaire")}</li>`).join("")}</ul>` : `<p class="small">Aucune note pendant la seance.</p>`}</section>
      <section class="card compact stack"><h3>Commentaire</h3><textarea id="summaryComment" placeholder="Ex : bonne seance, fatigue moyenne..."></textarea><button class="btn" onclick="saveWorkoutLog()">Enregistrer</button></section>
    </main>`);
}

function setDifficulty(value) { selectedDifficulty = value; renderSummary(); }

function saveWorkoutLog() {
  const profile = activeProfile();
  if (!profile || !active) return;
  const log = { id: active.id, profileId: profile.id, sessionId: active.sourceSessionId || active.session.originalId || active.session.id, sessionTitle: active.session.title, readiness: active.readiness || active.session.readiness || "normal", readinessLabel: active.session.readinessLabel || "Forme normale", date: new Date().toISOString(), completed: true, durationMinutes: minutesBetween(active.startMs, Date.now()), difficulty: selectedDifficulty, painNotes: active.painNotes, comment: document.getElementById("summaryComment").value.trim(), completedSets: active.completedSets };
  profile.logs.unshift(log);
  saveState();
  active = null;
  renderHistory();
}

function confirmQuitSession() {
  if (confirm("Quitter la seance en cours ? Elle ne sera pas enregistree.")) { active = null; stopRestTimer(); renderHome(); }
}

function renderHistory() {
  view = "history";
  const profile = requireProfile();
  if (!profile) return;
  renderShell(`
    ${appHeader("Historique")}
    <main class="screen">
      <section class="stack"><span class="kicker">${escapeHtml(profile.name)}</span><h2>Seances terminees</h2><p class="muted">Historique local de ce profil uniquement. Pas de melange conjugal des pompes, un minimum de civilisation.</p></section>
      ${(profile.logs || []).length ? profile.logs.map(log => `<article class="card compact stack history-item" style="align-items:flex-start"><div><h3>${escapeHtml(log.sessionTitle)}</h3><p class="small">${formatFullDate(log.date)} · ${log.durationMinutes} min · difficulte ${log.difficulty}/5${log.readinessLabel ? ` · ${escapeHtml(log.readinessLabel)}` : ""}</p>${log.comment ? `<p class="small">${escapeHtml(log.comment)}</p>` : ""}${log.painNotes && log.painNotes.length ? `<p class="small">Gene : ${log.painNotes.map(p => `${escapeHtml(p.zone)} ${p.level}/5`).join(", ")}</p>` : `<p class="small">Douleur : aucune note</p>`}</div></article>`).join("") : `<section class="card compact"><p class="muted">Aucune seance enregistree pour ce profil.</p></section>`}
    </main>`);
}

function renderSettings() {
  view = "settings";
  const profile = requireProfile();
  if (!profile) return;
  renderShell(`
    ${appHeader("Reglages")}
    <main class="screen">
      <section class="card stack"><span class="kicker">Profil actif</span><h2>${escapeHtml(profile.name)}</h2><p class="muted">${escapeHtml(profile.program.name)}</p><div class="row"><button class="btn secondary small-btn" onclick="renderProfileSelect()">Changer de profil</button><button class="btn small-btn" onclick="startOnboarding()">Nouveau profil</button></div></section>
      <section class="card compact stack"><h3>Donnees</h3><button class="btn secondary" onclick="exportData()">Exporter tous les profils</button><label class="btn ghost" for="importFile">Importer une sauvegarde</label><input id="importFile" type="file" accept="application/json" style="display:none" onchange="importData(event)"><button class="btn ghost" onclick="resetCurrentLogs()">Vider l'historique du profil</button></section>
      <section class="card compact stack warning"><h3>Zone dangereuse</h3><button class="btn warn" onclick="deleteProfile('${profile.id}')">Supprimer ce profil uniquement</button><button class="btn ghost" onclick="resetAllData()">Reinitialiser toute l'app</button><p class="small">Supprimer ce profil ne touche pas aux autres comptes locaux. Reinitialiser efface tout, parce que certains boutons aiment dramatiser.</p></section>
      <section class="card compact stack"><h3>Version</h3><p class="small">Mon Coach v1.4.0 · PWA locale · GitHub Pages</p></section>
    </main>`);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mon-coach-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.profiles)) throw new Error("format");
      state = imported;
      saveState();
      alert("Sauvegarde importee.");
      renderProfileSelect();
    } catch (error) {
      alert("Fichier invalide. La sauvegarde a visiblement decide de faire du sabotage.");
    }
  };
  reader.readAsText(file);
}

function resetCurrentLogs() {
  const profile = activeProfile();
  if (!profile) return;
  if (!confirm("Vider l'historique de ce profil ?")) return;
  profile.logs = [];
  saveState();
  renderHistory();
}

function resetAllData() {
  if (!confirm("Tout supprimer : profils, programmes, historiques ?")) return;
  localStorage.removeItem(STORE_KEY);
  state = { version: "1.4.0", introSeen: false, activeProfileId: null, profiles: [] };
  renderLanding();
}

function returnToProfileSelect() {
  if (active) return;
  if (view === "profiles" || view === "landing") return;
  if (!state.profiles.length) return renderLanding();
  state.activeProfileId = null;
  saveState();
  renderProfileSelect();
}

function setupProfileSelectOnResume() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") returnToProfileSelect();
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) returnToProfileSelect();
  });
}

function init() {
  registerServiceWorker();
  setupProfileSelectOnResume();
  active = null;
  stopRestTimer();
  if (state.profiles.length) {
    state.activeProfileId = null;
    state.introSeen = true;
    saveState();
    renderProfileSelect();
  } else {
    renderLanding();
  }
}

init();

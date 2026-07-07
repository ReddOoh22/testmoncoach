const app = document.getElementById("app");
const STORE_KEY = "monCoach.state.v11";
const APP_VERSION = "2.5.0";
const OLD_LOGS_KEY = "coachSportif.logs.v1";

let state = loadState();
let view = "home";
let active = null;
let restTimer = null;
let restRemaining = 0;
let selectedDifficulty = 3;
let onboarding = null;
let builder = null;
let importDraft = null;
let badgeFilter = "all";

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
        parsed.version = APP_VERSION;
        migrateState(parsed);
        return parsed;
      }
    }
  } catch (error) {}

  let oldLogs = [];
  try { oldLogs = JSON.parse(localStorage.getItem(OLD_LOGS_KEY) || "[]"); } catch (error) {}

  const initial = {
    version: APP_VERSION,
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
function migrateState(targetState) {
  if (!targetState || !Array.isArray(targetState.profiles)) return;
  targetState.profiles.forEach(profile => {
    profile.logs = profile.logs || [];
    profile.customExercises = profile.customExercises || [];
    profile.answers = profile.answers || {};
    profile.program = profile.program || clone(DEFAULT_PROGRAM);
    profile.program.startDate = profile.program.startDate || profile.createdAt || new Date().toISOString();
    profile.program.durationWeeks = profile.program.durationWeeks || profile.answers.programDurationWeeks || 4;
    profile.program.durationMode = profile.program.durationMode || (profile.program.durationWeeks === "none" ? "open" : "fixed");
    profile.program.progressionPlan = profile.program.progressionPlan || buildProgressionPlan(profile.program.durationWeeks, profile.answers || {});
    profile.program.rewardSeed = profile.program.rewardSeed || [];
    profile.achievements = profile.achievements || [];
    profile.xp = Number(profile.xp || 0);
    if (!Array.isArray(profile.rewards) || profile.rewards.length === 0) profile.rewards = defaultRewardMilestones();
    profile.program.completedAt = profile.program.completedAt || null;
  });
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

function miniMediaHtml(exercise, className = "mini-media") {
  if (!exercise || !exercise.media) return `<div class="${className} empty-mini"><span>${escapeHtml((exercise && exercise.name || "?").slice(0, 1))}</span></div>`;
  if (exercise.mediaType === "video") return `<div class="${className}"><video src="${exercise.media}" muted playsinline preload="metadata"></video></div>`;
  return `<div class="${className}"><img src="${exercise.media}" alt="${escapeHtml(exercise.name)}"></div>`;
}

function sessionCoverHtml(session) {
  const first = session && Array.isArray(session.exercises) ? session.exercises.find(ex => ex.media) || session.exercises[0] : null;
  return miniMediaHtml(first, "session-cover");
}

function sessionTypeLabel(session) {
  const type = (session && session.type) || "seance";
  const map = { renforcement: "Renforcement", routine: "Routine", court: "Court", mobilite: "Mobilite", cardio: "Cardio" };
  return map[type] || type;
}

function sessionDoneText(session, profile = activeProfile()) {
  return completedThisWeek(session.id, profile) ? "Deja fait cette semaine" : "A faire";
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
function programDurationLabel(program) {
  if (!program) return "Programme";
  if (program.durationWeeks === "none" || program.durationMode === "open") return "Programme sans fin";
  return `${program.durationWeeks || 4} semaines`;
}

function currentProgramWeek(program) {
  if (!program || !program.startDate) return 1;
  const start = new Date(program.startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.max(0, Math.floor((now - start) / 86400000));
  const week = Math.floor(diffDays / 7) + 1;
  if (program.durationWeeks === "none" || program.durationMode === "open") return week;
  return Math.min(week, Number(program.durationWeeks || 4));
}

function programProgressInfo(profile) {
  const program = profile && profile.program;
  if (!program) return { label: "Aucun programme", percent: 0, week: 1, total: 1 };
  const week = currentProgramWeek(program);
  if (program.durationWeeks === "none" || program.durationMode === "open") {
    return { label: `Semaine ${week} · sans fin`, percent: 100, week, total: null };
  }
  const total = Number(program.durationWeeks || 4);
  return { label: `Semaine ${week} / ${total}`, percent: Math.min(100, Math.round((week / total) * 100)), week, total };
}

function currentProgressionPhase(program) {
  const week = currentProgramWeek(program);
  const plan = (program && program.progressionPlan) || [];
  return plan.find(item => week >= item.from && week <= item.to) || plan[plan.length - 1] || null;
}

function buildProgressionPlan(durationWeeks, answers = {}) {
  const total = durationWeeks === "none" ? 8 : Math.max(4, Number(durationWeeks || 4));
  const style = answers.progressionStyle || "progressif";
  const cautious = style === "doux" || (answers.limitations || []).some(x => x !== "aucune");
  const phases = [];
  phases.push({ from: 1, to: Math.min(2, total), title: "Installation", description: cautious ? "Technique propre, volume prudent, aucune bravoure articulaire." : "Apprendre les mouvements et installer la routine." });
  if (total >= 4) phases.push({ from: 3, to: Math.min(4, total), title: "Progression douce", description: "Ajouter 1-2 repetitions sur les exercices faciles ou garder le volume si la difficulte monte." });
  if (total >= 6) phases.push({ from: 5, to: Math.min(6, total), title: "Volume controle", description: "Stabiliser, ajouter un peu de volume sur les mouvements maitrises." });
  if (total >= 8) phases.push({ from: 7, to: total, title: "Consolidation", description: "Variantes legerement plus difficiles ou qualite d'execution avant ego." });
  if (durationWeeks === "none") phases.push({ from: 9, to: 999, title: "Cycle libre", description: "Continuer par cycles de 4 semaines, en augmentant seulement si les seances passent proprement." });
  return phases;
}

function progressionMessageForLog(log) {
  if (!log) return "La prochaine progression attend sagement, contrairement a ton canapé.";
  const painStrong = (log.painNotes || []).some(note => Number(note.level || 0) >= 4);
  if (painStrong) return "Douleur forte signalee : on maintient ou on reduit. La bravoure stupide reste interdite.";
  if (Number(log.difficulty || 3) <= 3) return "Seance propre : progression legere possible la prochaine fois. Pas besoin de fanfare, mais c'est bien.";
  if (Number(log.difficulty || 3) === 4) return "Seance solide mais exigeante : on maintient avant d'augmenter. Le corps n'est pas une startup.";
  return "Seance tres dure : on reduit ou on adapte la prochaine fois. Survivre compte aussi.";
}

function completionMessage(log) {
  const count = (activeProfile()?.logs || []).length + 1;
  const readiness = log.readiness || "normal";
  if (readiness === "busy") return "Version courte validee. Ce n'est pas Versailles, mais la routine est vivante.";
  if (count === 1) return "Premiere seance enregistree. Le canapé vient de perdre une petite bataille.";
  if (count % 10 === 0) return `${count} seances. Le canapé commence a consulter un avocat.`;
  if (log.difficulty <= 2) return "Seance propre. Presque suspect, mais on accepte.";
  return "Seance validee. Ton futur toi vient d'arreter de râler pendant trente secondes.";
}

const LEVELS = [
  { min: 0, name: "Niveau 1 - Reveil musculaire", shortName: "Reveil musculaire" },
  { min: 200, name: "Niveau 2 - Humain fonctionnel", shortName: "Humain fonctionnel" },
  { min: 500, name: "Niveau 3 - Regulier suspect", shortName: "Regulier suspect" },
  { min: 900, name: "Niveau 4 - Machine a habitudes", shortName: "Machine a habitudes" },
  { min: 1400, name: "Niveau 5 - Danger modere pour le canape", shortName: "Danger modere pour le canape" },
  { min: 2100, name: "Niveau 6 - Structure presque stable", shortName: "Structure presque stable" },
  { min: 3000, name: "Niveau 7 - Legende domestique", shortName: "Legende domestique" },
  { min: 4200, name: "Niveau 8 - Creature de constance", shortName: "Creature de constance" },
  { min: 5600, name: "Niveau 9 - Force tranquille", shortName: "Force tranquille" },
  { min: 7500, name: "Niveau 10 - Mythe de salon", shortName: "Mythe de salon" }
];

const BADGE_CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "sessions", label: "Seances" },
  { id: "regularite", label: "Regularite" },
  { id: "calories", label: "Calories" },
  { id: "recuperation", label: "Recuperation" },
  { id: "courage", label: "Courage" },
  { id: "programme", label: "Programme" }
];

function badgeProgressText(badge, stats) {
  const value = Math.min(badge.threshold, badge.value(stats));
  return `${value} / ${badge.threshold}`;
}

function badgeUnlocked(badge, stats) { return badge.value(stats) >= badge.threshold; }

const ACHIEVEMENTS = [
  { id: "first_workout", title: "Premiere goutte de sueur", icon: "💧", category: "sessions", rarity: "common", threshold: 1, description: "1 seance terminee. Le debut d'une relation compliquee avec la gravite.", unlockMessage: "Le canape vient de perdre une petite bataille.", value: s => s.totalWorkouts },
  { id: "three_workouts", title: "Ca ressemble a une routine", icon: "🔁", category: "sessions", rarity: "common", threshold: 3, description: "3 seances terminees. Accident ou debut d'habitude, l'histoire jugera.", unlockMessage: "Trois seances. Le hasard commence a avoir des doutes.", value: s => s.totalWorkouts },
  { id: "ten_workouts", title: "Le canape s'inquiete", icon: "🛋️", category: "sessions", rarity: "rare", threshold: 10, description: "10 seances terminees. Le mobilier commence a perdre son influence.", unlockMessage: "Dix seances. Le canape regarde la situation se degrader.", value: s => s.totalWorkouts },
  { id: "twentyfive_workouts", title: "Presence repetee suspecte", icon: "🕵️", category: "sessions", rarity: "rare", threshold: 25, description: "25 seances terminees. Tu reviens trop souvent pour appeler ca un accident.", unlockMessage: "On frôle l'organisation. Terrifiant, mais efficace.", value: s => s.totalWorkouts },
  { id: "fifty_workouts", title: "Machine domestique", icon: "⚙️", category: "sessions", rarity: "epic", threshold: 50, description: "50 seances terminees. Le tapis commence a te reconnaitre.", unlockMessage: "Cinquante seances. Le meuble a linge appelle ca une menace.", value: s => s.totalWorkouts },
  { id: "hundred_workouts", title: "Mythe de salon", icon: "🏛️", category: "sessions", rarity: "legendary", threshold: 100, description: "100 seances terminees. Meme les meubles respectent l'effort.", unlockMessage: "Cent seances. Les statistiques ont besoin d'une chaise.", value: s => s.totalWorkouts },
  { id: "week_saved", title: "Semaine sauvee", icon: "📆", category: "regularite", rarity: "common", threshold: 1, description: "Objectif hebdo atteint au moins une fois. Pas parfait, tenu.", unlockMessage: "Une semaine tenue. Pas une epopee, juste une base solide.", value: s => s.weeksWithTarget },
  { id: "two_active_weeks", title: "Recidive sportive", icon: "🔥", category: "regularite", rarity: "common", threshold: 2, description: "2 semaines actives. L'habitude tente une entree discrete.", unlockMessage: "Deux semaines. La routine a trouve une adresse temporaire.", value: s => s.activeWeeks },
  { id: "four_active_weeks", title: "Routine en construction", icon: "🧱", category: "regularite", rarity: "rare", threshold: 4, description: "4 semaines actives. La regularite commence a faire semblant d'exister.", unlockMessage: "Quatre semaines. Ce n'est plus uniquement de la motivation, heureusement.", value: s => s.activeWeeks },
  { id: "eight_active_weeks", title: "Discipline domestique", icon: "🏠", category: "regularite", rarity: "epic", threshold: 8, description: "8 semaines actives. Le chaos familial n'a pas tout gagne.", unlockMessage: "Huit semaines actives. Le calendrier commence a respecter ton nom.", value: s => s.activeWeeks },
  { id: "twelve_active_weeks", title: "Creature de constance", icon: "🦾", category: "regularite", rarity: "legendary", threshold: 12, description: "12 semaines actives. C'est presque inquietant.", unlockMessage: "Douze semaines actives. Les excuses ont depose un preavis.", value: s => s.activeWeeks },
  { id: "kcal_250", title: "Biscuit symbolique brule", icon: "🍪", category: "calories", rarity: "common", threshold: 250, description: "250 kcal estimees cumulees. Le biscuit n'a pas souffert en vain.", unlockMessage: "Un biscuit theorique a disparu. Paix a son ame.", value: s => s.totalCalories },
  { id: "kcal_1000", title: "Petit barbecue metabolique", icon: "🔥", category: "calories", rarity: "common", threshold: 1000, description: "1000 kcal estimees cumulees. Ca commence a chauffer.", unlockMessage: "Mille calories estimees. Le corps fait enfin autre chose que protester.", value: s => s.totalCalories },
  { id: "kcal_2500", title: "Four domestique", icon: "♨️", category: "calories", rarity: "rare", threshold: 2500, description: "2500 kcal estimees. Le thermostat humain repond.", unlockMessage: "Deux mille cinq cents calories. Modeste fournaise, mais fournaise quand meme.", value: s => s.totalCalories },
  { id: "kcal_5000", title: "Chaudiere humaine moderee", icon: "🏭", category: "calories", rarity: "epic", threshold: 5000, description: "5000 kcal estimees. Tu produis presque une facture d'energie.", unlockMessage: "Cinq mille calories. Le reseau local est intrigantement silencieux.", value: s => s.totalCalories },
  { id: "kcal_10000", title: "Centrale de quartier", icon: "⚡", category: "calories", rarity: "legendary", threshold: 10000, description: "10000 kcal estimees. Le quartier n'a rien demande, mais il observe.", unlockMessage: "Dix mille calories. On frise l'infrastructure publique.", value: s => s.totalCalories },
  { id: "water_5l", title: "Plante verte responsable", icon: "🌿", category: "recuperation", rarity: "common", threshold: 5000, description: "5 litres d'eau conseilles cumules. Hydratation, cette sorcellerie basique.", unlockMessage: "Une plante verte serait fiere. Enfin, si elle avait des attentes.", value: s => s.totalWaterMl },
  { id: "easy_sessions", title: "Respect du lendemain", icon: "🌙", category: "recuperation", rarity: "common", threshold: 5, description: "5 seances avec difficulte geree. Tu t'entraines sans detruire demain.", unlockMessage: "Bonne gestion de l'effort. Concept revolutionnaire chez les humains.", value: s => s.easySessions },
  { id: "fatigue_manager", title: "Gestionnaire de fatigue", icon: "🔋", category: "recuperation", rarity: "rare", threshold: 5, description: "5 seances en mode fatigue. Fatigue, mais present.", unlockMessage: "Le corps ralait. Tu as negocie. Administrativement impressionnant.", value: s => s.fatigueWorkouts },
  { id: "pain_logged", title: "Corps pas completement ignore", icon: "🩹", category: "recuperation", rarity: "rare", threshold: 5, description: "5 douleurs ou genes notees proprement. Presque adulte.", unlockMessage: "Tu ecoutes les signaux. Le corps envoie un mail de remerciement.", value: s => s.painNotes },
  { id: "first_urgence", title: "Minimum syndical heroique", icon: "⚡", category: "courage", rarity: "common", threshold: 1, description: "Une version urgence terminee. Court, mais pas nul. Nuance capitale.", unlockMessage: "Dix minutes sauvees. Minimum, mais debout.", value: s => s.urgentWorkouts },
  { id: "five_urgence", title: "Meme pas annule", icon: "🚒", category: "courage", rarity: "rare", threshold: 5, description: "5 versions urgence. Tu as transforme le chaos en cases cochees.", unlockMessage: "Cinq seances sauvees du neant. Respect tiede mais reel.", value: s => s.urgentWorkouts },
  { id: "three_fatigue", title: "Fatigue, mais present", icon: "🥱", category: "courage", rarity: "rare", threshold: 3, description: "3 seances en mode fatigue. Le corps ralait, tu as adapte.", unlockMessage: "Fatigue geree sans annulation. Le minimum intelligent, enfin.", value: s => s.fatigueWorkouts },
  { id: "comeback", title: "Retour des morts administratives", icon: "📎", category: "courage", rarity: "epic", threshold: 1, description: "Reprise apres 10 jours sans seance. Tu es revenu, c'est le sujet.", unlockMessage: "Retour valide. Le drame avant n'est pas invite a la reunion.", value: s => s.comebacks },
  { id: "program_4", title: "Cycle boucle", icon: "🏁", category: "programme", rarity: "rare", threshold: 1, description: "Fin d'un programme de 4 semaines. Court, mais pas imaginaire.", unlockMessage: "Quatre semaines terminees. Petite boucle, vraie boucle.", value: s => s.finished4 },
  { id: "program_8", title: "Mission tenue", icon: "🏅", category: "programme", rarity: "epic", threshold: 1, description: "Fin d'un programme de 8 semaines. La, on parle d'une vraie base.", unlockMessage: "Huit semaines terminees. Le canape demande une reunion de crise.", value: s => s.finished8 },
  { id: "program_12", title: "Tu es encore la ?", icon: "🏆", category: "programme", rarity: "legendary", threshold: 1, description: "Fin d'un programme de 12 semaines. Les statistiques transpirent.", unlockMessage: "Douze semaines terminees. Les bonnes resolutions sont jalouses.", value: s => s.finished12 },
  { id: "open_16", title: "Mode sans fin assume", icon: "∞", category: "programme", rarity: "legendary", threshold: 16, description: "16 semaines en programme libre. Plus de fin, juste la routine qui rode.", unlockMessage: "Seize semaines en libre. Il n'y a plus de ligne d'arrivee, juste toi et le planning.", value: s => s.openWeeks }
];

function achievementById(id) { return ACHIEVEMENTS.find(b => b.id === id); }

function intensityMultiplier(log) {
  const diff = Number(log.difficulty || selectedDifficulty || 3);
  if (diff <= 2) return 0.85;
  if (diff === 4) return 1.15;
  if (diff >= 5) return 1.3;
  return 1;
}

function estimateCaloriesForLog(log) {
  const minutes = Math.max(1, Number(log.durationMinutes || 1));
  const title = `${log.sessionTitle || ""}`.toLowerCase();
  let perMin = 4.5;
  if (title.includes("velo")) perMin = 6;
  if (title.includes("urgence") || title.includes("mini")) perMin = 4;
  if (title.includes("jambes")) perMin = 5.2;
  const low = Math.max(10, Math.round(minutes * perMin * 0.85 * intensityMultiplier(log)));
  const high = Math.max(low + 10, Math.round(minutes * perMin * 1.2 * intensityMultiplier(log)));
  return { low, high, display: `${low}-${high}` };
}

function estimateWaterForLog(log) {
  const minutes = Math.max(1, Number(log.durationMinutes || 1));
  const diff = Number(log.difficulty || 3);
  let ml = Math.round(minutes * (diff >= 4 ? 18 : 14));
  ml = Math.max(250, Math.min(900, ml));
  const low = Math.max(200, Math.round(ml * 0.85 / 50) * 50);
  const high = Math.max(low + 100, Math.round(ml * 1.25 / 50) * 50);
  return { low, high, display: `${low}-${high} ml` };
}

function xpForLog(log) {
  const title = `${log.sessionTitle || ""}`.toLowerCase();
  if (title.includes("urgence")) return 30;
  if (title.includes("mini")) return 50;
  return 100;
}

function levelForXp(xp) {
  let current = LEVELS[0];
  LEVELS.forEach(level => { if (xp >= level.min) current = level; });
  const next = LEVELS.find(level => level.min > xp) || null;
  return { current, next };
}

function profileAchievementStats(profile) {
  const logs = profile.logs || [];
  const week = profileWeekStats(profile);
  const totalCalories = Math.round(logs.reduce((sum, l) => sum + Number((l.calories && l.calories.high) || l.caloriesHigh || 0), 0));
  const totalWaterMl = Math.round(logs.reduce((sum, l) => sum + Number((l.water && l.water.high) || l.waterHigh || 0), 0));
  const uniqueWeeks = new Set(logs.map(l => weekStart(new Date(l.date)).toISOString().slice(0, 10)));
  const weekCounts = {};
  logs.forEach(l => { const k = weekStart(new Date(l.date)).toISOString().slice(0, 10); weekCounts[k] = (weekCounts[k] || 0) + 1; });
  const target = Math.max(1, Number((profile.program && profile.program.weeklyTarget) || (profile.program && profile.program.sessionsPerWeek) || 3));
  const weeksWithTarget = Object.values(weekCounts).filter(count => count >= target).length;
  const fatigueWorkouts = logs.filter(l => l.readiness === "fatigue" || l.readiness === "chargee" || (l.readinessLabel || "").toLowerCase().includes("fatigue")).length;
  const painNotes = logs.reduce((sum, l) => sum + ((l.painNotes || []).length), 0);
  const easySessions = logs.filter(l => Number(l.difficulty || 3) <= 3).length;
  let comebacks = 0;
  logs.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach((log, index, ordered) => {
    if (index > 0 && (new Date(log.date) - new Date(ordered[index - 1].date)) / 86400000 >= 10) comebacks += 1;
  });
  const info = programProgressInfo(profile);
  const fixedFinished = info.total && info.week >= info.total && logs.length > 0;
  const duration = Number(profile.program && profile.program.durationWeeks || 0);
  return {
    totalWorkouts: logs.length,
    weekDone: week.done,
    weekTarget: week.target,
    urgentWorkouts: logs.filter(l => `${l.sessionTitle || ""}`.toLowerCase().includes("urgence") || l.readiness === "chargee").length,
    fatigueWorkouts,
    painNotes,
    easySessions,
    comebacks,
    activeWeeks: uniqueWeeks.size,
    weeksWithTarget,
    totalCalories,
    totalWaterMl,
    finished4: fixedFinished && duration === 4 ? 1 : 0,
    finished8: fixedFinished && duration === 8 ? 1 : 0,
    finished12: fixedFinished && duration === 12 ? 1 : 0,
    openWeeks: !info.total ? info.week : 0
  };
}

function updateRewardsAfterLog(profile, log) {
  profile.achievements = profile.achievements || [];
  profile.xp = Number(profile.xp || 0) + xpForLog(log);
  const stats = profileAchievementStats(profile);
  const unlocked = [];
  ACHIEVEMENTS.forEach(badge => {
    if (!profile.achievements.some(item => item.id === badge.id) && badgeUnlocked(badge, stats)) {
      const earned = { id: badge.id, title: badge.title, icon: badge.icon, category: badge.category, rarity: badge.rarity, description: badge.description, message: badge.unlockMessage, earnedAt: new Date().toISOString() };
      profile.achievements.push(earned);
      unlocked.push(earned);
    }
  });
  return unlocked;
}

function hydrationTip(log) {
  if ((log.painNotes || []).some(note => Number(note.level || 0) >= 4)) return "Douleur forte notee : hydrate-toi, mais surtout adapte la prochaine seance. L'eau ne repare pas l'ego.";
  if (Number(log.difficulty || 3) >= 4) return "Seance exigeante : bois tranquillement sur l'heure qui vient. Pas besoin de noyer l'organisme non plus.";
  return "Hydratation simple : quelques gorgees maintenant, puis le reste calmement. Revolutionnaire, apparemment.";
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


function totalMinutesTrained(profile = activeProfile()) {
  const logs = (profile && profile.logs) || [];
  return logs.reduce((sum, log) => sum + Number(log.durationMinutes || 0), 0);
}

function currentWeeklyStreak(profile = activeProfile()) {
  const logs = (profile && profile.logs) || [];
  if (!logs.length) return 0;
  const weekKeys = Array.from(new Set(logs.map(log => weekStart(new Date(log.date)).toISOString().slice(0, 10)))).sort();
  if (!weekKeys.length) return 0;
  const currentWeekKey = weekStart(new Date()).toISOString().slice(0, 10);
  const lastWeekDate = new Date(weekStart(new Date()));
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const previousWeekKey = lastWeekDate.toISOString().slice(0, 10);
  let cursor = weekKeys.includes(currentWeekKey) ? new Date(currentWeekKey) : weekKeys.includes(previousWeekKey) ? new Date(previousWeekKey) : null;
  if (!cursor) return 0;
  let streak = 0;
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!weekKeys.includes(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function latestAchievement(profile = activeProfile()) {
  const items = ((profile && profile.achievements) || []).slice();
  if (!items.length) return null;
  items.sort((a, b) => new Date(b.earnedAt || 0) - new Date(a.earnedAt || 0));
  return items[0];
}

function levelProgress(profile = activeProfile()) {
  const xp = Number((profile && profile.xp) || 0);
  const level = levelForXp(xp);
  if (!level.next) return { percent: 100, text: 'Tous les niveaux locaux sont atteints.' };
  const span = Math.max(1, level.next.min - level.current.min);
  const progress = Math.max(0, xp - level.current.min);
  return {
    percent: Math.min(100, Math.round((progress / span) * 100)),
    text: `${level.next.min - xp} XP avant ${level.next.shortName || level.next.name}`
  };
}

function homeMotivation(profile = activeProfile()) {
  const week = profileWeekStats(profile);
  const last = lastWorkout(profile);
  if (!last) return "On commence simple. Le plus dur, c'est souvent d'ouvrir l'app.";
  if (week.target && week.done >= week.target) return "Objectif hebdo atteint. Le chaos n'a pas tout emporte.";
  if (week.target && week.done === Math.max(0, week.target - 1)) return "Encore une seance et la semaine est sauvee.";
  const diffDays = Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000);
  if (diffDays >= 7) return "On reprend sans drame. Pas besoin d'etre parfait, juste de revenir.";
  if (diffDays >= 3) return "Petite reprise conseillee. Le planning adore les retours simples.";
  return "Petit pas, vraie progression. La constance fait le gros du travail.";
}

function homeGreeting(profile = activeProfile()) {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon apres-midi';
  return 'Bonsoir';
}

function programSessionsForCurrentWeek(profile = activeProfile()) {
  if (!profile || !profile.program) return [];
  const program = profile.program;
  if (Array.isArray(program.weeks) && program.weeks.length) {
    const week = currentProgramWeek(program);
    const current = program.weeks.find(w => Number(w.weekNumber) === Number(week)) || program.weeks[0];
    return current && Array.isArray(current.sessions) ? current.sessions : [];
  }
  return Array.isArray(program.sessions) ? program.sessions : [];
}

function allProgramSessions(profile = activeProfile()) {
  if (!profile || !profile.program) return [];
  const direct = Array.isArray(profile.program.sessions) ? profile.program.sessions : [];
  const weeks = Array.isArray(profile.program.weeks) ? profile.program.weeks.flatMap(w => Array.isArray(w.sessions) ? w.sessions : []) : [];
  return [...direct, ...weeks];
}

function weeklySessions(profile = activeProfile()) {
  if (!profile) return [];
  const sessions = programSessionsForCurrentWeek(profile).filter(s => s.id !== "urgence" && s.type !== "court");
  return sessions.slice(0, profile.program.weeklyTarget || sessions.length);
}

function findSession(id) {
  const profile = activeProfile();
  if (!profile) return null;
  return allProgramSessions(profile).find(s => s.id === id);
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

function appHeader(title = "Alfred") {
  const profile = activeProfile();
  return `
    <div class="header">
      <div class="brand"><span class="logo logo-alfred"></span><span>${title}</span></div>
      <div class="row" style="align-items:center">
        ${profile ? `<button class="profile-chip" onclick="renderProfileSelect()">${escapeHtml(profile.name)}</button>` : ""}
        <button class="icon-btn" onclick="goHome()" aria-label="Accueil">⌂</button>
      </div>
    </div>
  `;
}

function bottomNav() {
  if (active || !activeProfile() || ["readiness", "profiles", "landing"].includes(view)) return "";
  const items = [["home", "Accueil"], ["dashboard", "Dashboard"], ["program", "Programme"], ["library", "Exos"], ["import", "Importer"], ["history", "Historique"], ["rewards", "Badges"], ["settings", "Reglages"]];
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
  if (next === "dashboard") renderDashboard();
  if (next === "program") renderProgram();
  if (next === "library") renderLibrary();
  if (next === "import") renderImportCenter();
  if (next === "history") renderHistory();
  if (next === "rewards") renderRewards();
  if (next === "settings") renderSettings();
}

function routeAfterSplash() {
  if (state.profiles.length) {
    state.activeProfileId = null;
    state.introSeen = true;
    saveState();
    renderProfileSelect();
  } else {
    renderLanding();
  }
}

function renderSplash() {
  view = "splash";
  app.innerHTML = `
    <main class="splash-screen" aria-label="Ouverture Alfred">
      <div class="splash-logo-wrap">
        <img class="splash-logo" src="./assets/brand/alfred-logo.svg" alt="Alfred - Fitness, Wellness, You">
      </div>
      <p class="splash-version">version ${APP_VERSION}</p>
    </main>
  `;
  window.setTimeout(routeAfterSplash, 1550);
}

function renderLanding() {
  view = "landing";
  renderShell(`
    <main class="screen">
      <section class="card hero-card stack-lg">
        <div class="stack">
          <span class="kicker">Alfred</span>
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
          <span class="kicker">Alfred</span>
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
                  <p class="small">${escapeHtml(profile.program.name)} · ${programProgressInfo(profile).label}</p>
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
      cardio: "optionnel",
      programDurationWeeks: "8",
      startDate: new Date().toISOString().slice(0, 10),
      progressionStyle: "progressif",
      advanced: false,
      height: "",
      weight: "",
      currentPushups: "",
      currentPlank: ""
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
  if (onboarding.step < 7) {
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
  const steps = [renderOnboardingIdentity, renderOnboardingGoal, renderOnboardingTime, renderOnboardingProgramDuration, renderOnboardingEquipment, renderOnboardingLimits, renderOnboardingPrefs, renderOnboardingReview];
  renderShell(`
    ${appHeader("Creation profil")}
    <main class="screen">
      <section class="card compact stack">
        <div class="between"><span class="kicker">Etape ${step + 1} / 8</span><span class="badge">Local</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(((step + 1) / 8) * 100)}%"></div></div>
      </section>
      ${steps[step](a)}
      <section class="row">
        ${step > 0 ? `<button class="btn ghost small-btn" onclick="prevOnboarding()">Retour</button>` : `<button class="btn ghost small-btn" onclick="renderProfileSelect()">Annuler</button>`}
        <button class="btn small-btn" onclick="nextOnboarding()">${step === 7 ? "Creer le programme" : "Continuer"}</button>
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

function renderOnboardingProgramDuration(a) {
  return `
    <section class="card stack-lg">
      <div class="stack"><span class="kicker">Duree du programme</span><h2>On construit pour combien de temps ?</h2><p class="muted">Un programme avec une duree permet de savoir ou tu en es. Un programme sans fin permet de continuer sans ceremonie administrative.</p></div>
      <div class="choice-grid">
        ${choiceButton("programDurationWeeks", "4", "4 semaines")}
        ${choiceButton("programDurationWeeks", "6", "6 semaines")}
        ${choiceButton("programDurationWeeks", "8", "8 semaines · recommande")}
        ${choiceButton("programDurationWeeks", "12", "12 semaines")}
        ${choiceButton("programDurationWeeks", "none", "Sans fin definie")}
      </div>
      <p class="small"><strong>8 semaines recommande :</strong> le meilleur equilibre pour reprendre, progresser et installer une routine sans promettre une transformation Marvel.</p>
      <div class="field"><label>Date de debut</label><input class="input" data-answer="startDate" type="date" value="${escapeHtml(a.startDate || new Date().toISOString().slice(0, 10))}"></div>
      <div class="field"><label>Style de progression</label><select class="select" data-answer="progressionStyle"><option value="doux" ${a.progressionStyle === "doux" ? "selected" : ""}>Doux / reprise prudente</option><option value="progressif" ${a.progressionStyle === "progressif" ? "selected" : ""}>Progressif</option><option value="court" ${a.progressionStyle === "court" ? "selected" : ""}>Court et efficace</option><option value="force" ${a.progressionStyle === "force" ? "selected" : ""}>Renforcement plus ambitieux</option></select></div>
      <details class="details-box"><summary>Ajouter des details optionnels</summary><div class="form details-form"><div class="field"><label>Taille optionnelle</label><input class="input" data-answer="height" inputmode="numeric" value="${escapeHtml(a.height || "")}" placeholder="Ex : 171"></div><div class="field"><label>Poids optionnel</label><input class="input" data-answer="weight" inputmode="decimal" value="${escapeHtml(a.weight || "")}" placeholder="Ex : 60"></div><div class="field"><label>Pompes actuelles optionnel</label><input class="input" data-answer="currentPushups" inputmode="numeric" value="${escapeHtml(a.currentPushups || "")}" placeholder="Ex : 20"></div><div class="field"><label>Gainage actuel optionnel</label><input class="input" data-answer="currentPlank" value="${escapeHtml(a.currentPlank || "")}" placeholder="Ex : 45 sec"></div></div></details>
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
        <li><strong>Duree seance :</strong> ${escapeHtml(a.duration)} min</li>
        <li><strong>Duree programme :</strong> ${a.programDurationWeeks === "none" ? "sans fin" : `${escapeHtml(a.programDurationWeeks)} semaines`}</li>
        <li><strong>Debut :</strong> ${escapeHtml(a.startDate || "aujourd hui")}</li>
        <li><strong>Progression :</strong> ${escapeHtml(a.progressionStyle || "progressif")}</li>
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
  program.startDate = answers.startDate ? new Date(answers.startDate).toISOString() : new Date().toISOString();
  program.durationWeeks = answers.programDurationWeeks || "8";
  program.durationMode = answers.programDurationWeeks === "none" ? "open" : "fixed";
  program.progressionStyle = answers.progressionStyle || "progressif";
  program.progressionPlan = buildProgressionPlan(program.durationWeeks, answers);
  program.rewardSeed = ["premiere-seance", "premiere-semaine", "canape-inquiet"];
  program.notes = [
    "Programme genere localement depuis le questionnaire.",
    "Regularite avant performance.",
    "Douleur articulaire nette = arret ou adaptation.",
    `Duree : ${answers.programDurationWeeks === "none" ? "programme sans fin" : `${answers.programDurationWeeks} semaines`}.`,
    "Progression : augmentation douce si les seances sont validees sans douleur forte."
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


function logsInLastDays(profile = activeProfile(), days = 30) {
  if (!profile) return [];
  const since = Date.now() - days * 86400000;
  return (profile.logs || []).filter(log => new Date(log.date).getTime() >= since);
}

function formatDurationMinutes(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes || 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return `${h}h ${String(m).padStart(2, "0")}`;
}

function averageDifficulty(profile = activeProfile(), days = 30) {
  const logs = logsInLastDays(profile, days).filter(log => Number(log.difficulty));
  if (!logs.length) return null;
  return (logs.reduce((sum, log) => sum + Number(log.difficulty || 0), 0) / logs.length).toFixed(1);
}

function painSummary(profile = activeProfile()) {
  const counts = {};
  ((profile && profile.logs) || []).forEach(log => (log.painNotes || []).forEach(note => {
    const key = note.zone || "Autre";
    counts[key] = (counts[key] || 0) + 1;
  }));
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

function monthlyTrainingStats(profile = activeProfile()) {
  const logs = logsInLastDays(profile, 30);
  const minutes = logs.reduce((sum, log) => sum + Number(log.durationMinutes || 0), 0);
  const calories = logs.reduce((sum, log) => sum + Number((log.calories && log.calories.high) || log.caloriesHigh || 0), 0);
  const sessions = logs.length;
  const difficulty = averageDifficulty(profile, 30);
  return { logs, minutes, calories, sessions, difficulty };
}

function weekHistory(profile = activeProfile(), count = 6) {
  const weeks = [];
  const current = weekStart(new Date());
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(current);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const logs = ((profile && profile.logs) || []).filter(log => {
      const t = new Date(log.date).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    weeks.push({
      label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      count: logs.length,
      minutes: logs.reduce((sum, log) => sum + Number(log.durationMinutes || 0), 0)
    });
  }
  return weeks;
}

function renderMiniBars(items, maxValue, valueKey = "count") {
  const max = Math.max(1, maxValue || Math.max(...items.map(item => Number(item[valueKey] || 0)), 1));
  return `<div class="mini-bars">${items.map(item => `<div class="mini-bar-item"><div class="mini-bar-track"><div class="mini-bar-fill" style="height:${Math.max(6, Math.round((Number(item[valueKey] || 0) / max) * 100))}%"></div></div><span>${escapeHtml(item.label)}</span></div>`).join("")}</div>`;
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
  const stats = profileAchievementStats(profile);
  const level = levelForXp(Number(profile.xp || 0));
  const levelProg = levelProgress(profile);
  const latestBadge = latestAchievement(profile);
  const programInfo = programProgressInfo(profile);
  const phase = currentProgressionPhase(profile.program);
  const streak = currentWeeklyStreak(profile);
  const totalMinutes = totalMinutesTrained(profile);
  const quickCalories = stats.totalCalories || 0;
  const hasProgram = profile.program && Array.isArray(profile.program.sessions) && profile.program.sessions.length;
  const progressText = programInfo.total ? `Semaine ${programInfo.week} / ${programInfo.total}` : `Semaine ${programInfo.week} · mode libre`;

  renderShell(`
    ${appHeader("Accueil")}
    <main class="screen screen-home">
      ${renderProgramCompleteCard(profile)}

      <section class="card hero-card dark-card home-hero stack-lg">
        <div class="stack-lg">
          <div class="between home-hero-top">
            <div class="stack" style="gap:8px;">
              <span class="kicker">${homeGreeting(profile)} ${escapeHtml(profile.name)}</span>
              <h1>On garde le cap aujourd'hui.</h1>
              <p class="muted-light welcome-copy">${escapeHtml(homeMotivation(profile))}</p>
            </div>
            <span class="badge light-badge">${escapeHtml(level.current.shortName || level.current.name)}</span>
          </div>

          <div class="hero-progress-grid">
            <article class="glass-card stat-surface">
              <span class="kicker">Programme</span>
              <strong>${escapeHtml(progressText)}</strong>
              <p class="small muted-light">${escapeHtml(programDurationLabel(profile.program))}</p>
            </article>
            <article class="glass-card stat-surface">
              <span class="kicker">Cette semaine</span>
              <strong>${count}/${items.length || 0} seances</strong>
              <p class="small muted-light">${percent}% valide</p>
            </article>
          </div>

          <div class="stack" style="gap:10px;">
            <div class="between"><span class="small muted-light">Progression niveau</span><span class="small muted-light">${Number(profile.xp || 0)} XP</span></div>
            <div class="progress-bar light-bar"><div class="progress-fill light-fill" style="width:${levelProg.percent}%"></div></div>
            <p class="small muted-light">${escapeHtml(levelProg.text)}</p>
          </div>
        </div>

        <div class="row hero-actions">
          ${recommended ? `<button class="btn light" onclick="startSession('${recommended.id}')">Commencer la prochaine seance</button>` : `<button class="btn light" onclick="renderSessionBuilder()">Creer une seance</button>`}
          <button class="btn ghost light-ghost small-btn" onclick="renderProgram()">Voir le programme</button>
        </div>
      </section>

      ${hasProgram && recommended ? `
      <section class="card compact stack next-session-card">
        <div class="between">
          <div>
            <span class="kicker">Prochaine seance</span>
            <h3>${escapeHtml(recommended.title)}</h3>
            <p class="small">${escapeHtml(recommended.subtitle)}</p>
          </div>
          <span class="badge good">A faire</span>
        </div>
        <div class="row">
          <span class="badge">${escapeHtml(recommended.plannedDuration)}</span>
          <span class="badge">${escapeHtml(recommended.recommendedDay || 'Cette semaine')}</span>
          <span class="badge">${recommended.exercises.length} exos</span>
        </div>
        <p class="small">${escapeHtml(recommended.description || 'Seance recommandee en priorite pour poursuivre la progression.')}</p>
        <div class="row actions-inline">
          <button class="btn" onclick="startSession('${recommended.id}')">Preparer la seance</button>
          <button class="btn secondary small-btn" onclick="renderSessionDetail('${recommended.id}')">Voir le detail</button>
        </div>
      </section>` : `
      <section class="card compact stack empty-home-card">
        <span class="kicker">Bienvenue</span>
        <h3>Aucun programme actif</h3>
        <p class="small">Tu n'as pas encore de programme pret. On peut en creer un, en importer un, ou bricoler proprement sans panique.</p>
        <div class="row actions-inline"><button class="btn" onclick="startOnboarding()">Creer un programme</button><button class="btn secondary small-btn" onclick="renderImportCenter()">Importer</button></div>
      </section>`}

      <section class="home-two-col">
        <article class="card compact stack progress-card panel-card">
          <div class="between"><h3>Progression de la semaine</h3><span class="badge good">${count} / ${items.length || 0}</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
          <p class="small">${percent >= 100 ? "Semaine validee. Tres propre." : percent >= 66 ? "Tu es proche du compte. Une petite seance et c'est propre." : "On avance seance par seance. Rien de dramatique."}</p>
          <div class="week-list home-week-list">
            ${items.map(item => `<button class="week-item clickable" onclick="startSession('${item.id}')"><div><strong>${escapeHtml(item.title)}</strong><p class="small">${escapeHtml(item.recommendedDay || 'Cette semaine')} · ${escapeHtml(item.plannedDuration || '')}</p></div><span class="badge ${completedThisWeek(item.id, profile) ? 'good' : ''}">${sessionCompletionLabel(item, profile)}</span></button>`).join("") || `<div class="small">Aucune seance planifiee.</div>`}
          </div>
        </article>

        <article class="card compact stack panel-card">
          <div class="between"><h3>Cycle actuel</h3><span class="badge">${escapeHtml(programDurationLabel(profile.program))}</span></div>
          <p class="small">${escapeHtml(programInfo.label)}</p>
          <div class="progress-bar"><div class="progress-fill" style="width:${programInfo.percent}%"></div></div>
          ${phase ? `<div class="mini-note"><strong>${escapeHtml(phase.title)}</strong><p class="small">${escapeHtml(phase.description)}</p></div>` : ``}
          ${last ? `<div class="mini-note"><strong>Derniere seance</strong><p class="small">${formatFullDate(last.date)} · ${last.durationMinutes} min</p></div>` : `<div class="mini-note"><strong>Derniere seance</strong><p class="small">Aucune seance enregistree pour le moment.</p></div>`}
        </article>
      </section>

      <section class="stats-overview-grid">
        <article class="stat-card premium-stat"><span>Calories</span><strong>${quickCalories}</strong><small>kcal estimees</small></article>
        <article class="stat-card premium-stat"><span>Badges</span><strong>${(profile.achievements || []).length}</strong><small>debloques</small></article>
        <article class="stat-card premium-stat"><span>Serie</span><strong>${streak}</strong><small>semaines actives</small></article>
        <article class="stat-card premium-stat"><span>Temps</span><strong>${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2,'0')}</strong><small>cumule</small></article>
      </section>

      <section class="home-two-col">
        <article class="card compact stack panel-card ${latestBadge ? 'reward-strip' : ''}">
          <div class="between">
            <div>
              <span class="kicker">${latestBadge ? 'Dernier badge' : 'Motivation'}</span>
              <h3>${latestBadge ? escapeHtml(latestBadge.title) : 'Continue comme ca'}</h3>
            </div>
            <span class="badge ${latestBadge ? 'good' : ''}">${latestBadge ? (latestBadge.icon || '★') : 'Alfred'}</span>
          </div>
          <p class="small">${latestBadge ? escapeHtml(latestBadge.message || latestBadge.description || '') : 'La regularite fait le gros du travail. Le glamour viendra eventuellement plus tard.'}</p>
          <div class="row actions-inline">
            <button class="btn secondary small-btn" onclick="renderRewards()">Voir les badges</button>
          </div>
        </article>

        <article class="card compact stack panel-card quick-actions-card">
          <div class="between"><h3>Actions rapides</h3><span class="badge">Raccourcis</span></div>
          <div class="action-grid">
            <button class="action-tile" onclick="renderProgram()"><strong>Programme</strong><span>Seances, progression</span></button>
            <button class="action-tile" onclick="renderImportCenter()"><strong>Importer</strong><span>IA, texte, modele</span></button>
            <button class="action-tile" onclick="renderHistory()"><strong>Historique</strong><span>Seances et notes</span></button>
            <button class="action-tile" onclick="renderSettings()"><strong>Reglages</strong><span>Profil et donnees</span></button>
          </div>
        </article>
      </section>

      ${profile.program.notes && profile.program.notes.length ? `<section class="card compact stack warning"><h3>Notes du programme</h3><ul class="list">${profile.program.notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul></section>` : ``}
      ${profile.program.sessions.find(s => s.id === "urgence") ? `<section class="card compact stack"><div class="between"><div><h3>Pas le temps ?</h3><p class="small">Version courte pour sauver la routine. Petite victoire, gros rendement psychologique.</p></div><span class="badge warn">10 min</span></div><button class="btn secondary" onclick="startSession('urgence')">Preparer la version urgence</button></section>` : ``}
    </main>
  `);
}
function renderDashboard() {
  view = "dashboard";
  const profile = requireProfile();
  if (!profile) return;
  const stats = profileAchievementStats(profile);
  const monthly = monthlyTrainingStats(profile);
  const week = profileWeekStats(profile);
  const programInfo = programProgressInfo(profile);
  const level = levelForXp(Number(profile.xp || 0));
  const levelProg = levelProgress(profile);
  const weeks = weekHistory(profile, 6);
  const maxWeek = Math.max(...weeks.map(w => w.count), 1);
  const pains = painSummary(profile);
  const recentLogs = (profile.logs || []).slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const latestBadge = latestAchievement(profile);
  const totalMinutes = totalMinutesTrained(profile);

  renderShell(`
    ${appHeader("Dashboard")}
    <main class="screen dashboard-screen">
      <section class="card dark-card dashboard-hero stack-lg">
        <div class="between dashboard-hero-top">
          <div class="stack">
            <span class="kicker">Vue d'ensemble</span>
            <h1>${escapeHtml(level.current.shortName || level.current.name)}</h1>
            <p class="muted-light">${Number(profile.xp || 0)} XP · ${stats.totalWorkouts} seance(s) terminee(s). Pas encore les Jeux olympiques, ce qui tombe bien, personne n'a demande.</p>
          </div>
          <span class="badge light-badge">${escapeHtml(programInfo.label)}</span>
        </div>
        <div class="progress-bar light-bar"><div class="progress-fill light-fill" style="width:${levelProg.percent}%"></div></div>
        <p class="small muted-light">${escapeHtml(levelProg.text)}</p>
      </section>

      <section class="dashboard-grid-4">
        <article class="stat-card premium-stat"><span>Cette semaine</span><strong>${week.done}/${week.target || 0}</strong><small>${week.percent}% objectif</small></article>
        <article class="stat-card premium-stat"><span>30 jours</span><strong>${monthly.sessions}</strong><small>seances</small></article>
        <article class="stat-card premium-stat"><span>Temps total</span><strong>${formatDurationMinutes(totalMinutes)}</strong><small>depuis le debut</small></article>
        <article class="stat-card premium-stat"><span>Calories</span><strong>${stats.totalCalories}</strong><small>kcal estimees</small></article>
      </section>

      <section class="dashboard-two-col">
        <article class="card compact stack panel-card">
          <div class="between"><h3>Programme</h3><span class="badge">${escapeHtml(programDurationLabel(profile.program))}</span></div>
          <p class="small">${escapeHtml(programInfo.label)}</p>
          <div class="progress-bar"><div class="progress-fill" style="width:${programInfo.percent}%"></div></div>
          <div class="grid-2">
            <div class="mini-note"><strong>${weeklySessions(profile).length}</strong><p class="small">seances planifiees</p></div>
            <div class="mini-note"><strong>${currentWeeklyStreak(profile)}</strong><p class="small">semaines actives</p></div>
          </div>
        </article>

        <article class="card compact stack panel-card">
          <div class="between"><h3>Activite 6 semaines</h3><span class="badge">Seances</span></div>
          ${renderMiniBars(weeks, maxWeek, "count")}
          <p class="small">Les barres montrent le nombre de seances par semaine. Pas besoin d'un doctorat, juste de revenir souvent.</p>
        </article>
      </section>

      <section class="dashboard-two-col">
        <article class="card compact stack panel-card">
          <div class="between"><h3>Récupération</h3><span class="badge">30 jours</span></div>
          <div class="grid-2">
            <div class="mini-note"><strong>${monthly.difficulty || "-"}/5</strong><p class="small">difficulte moyenne</p></div>
            <div class="mini-note"><strong>${Math.round(stats.totalWaterMl / 1000)} L</strong><p class="small">eau conseillee cumulee</p></div>
          </div>
          ${pains.length ? `<div class="stack"><strong>Genes notees</strong>${pains.slice(0,4).map(([zone,count]) => `<div class="between pain-line"><span>${escapeHtml(zone)}</span><span class="badge warn">${count}</span></div>`).join("")}</div>` : `<p class="small">Aucune gene notee. Soit tout va bien, soit le corps n'a pas encore rempli le formulaire.</p>`}
        </article>

        <article class="card compact stack panel-card reward-strip">
          <div class="between"><h3>Badges</h3><span class="badge good">${(profile.achievements || []).length}/${ACHIEVEMENTS.length}</span></div>
          ${latestBadge ? `<div class="achievement-card unlocked rarity-${latestBadge.rarity || 'common'}"><div class="achievement-icon">${latestBadge.icon || '★'}</div><strong>${escapeHtml(latestBadge.title)}</strong><p>${escapeHtml(latestBadge.message || latestBadge.description || '')}</p></div>` : `<p class="small">Aucun badge pour l'instant. La gloire attend poliment dans un coin.</p>`}
          <button class="btn secondary" onclick="renderRewards()">Voir tous les badges</button>
        </article>
      </section>

      <section class="card compact stack">
        <div class="between"><h3>Historique récent</h3><button class="btn secondary small-btn" onclick="renderHistory()">Tout voir</button></div>
        <div class="stack">
          ${recentLogs.length ? recentLogs.map(log => `<article class="dashboard-log"><div><strong>${escapeHtml(log.sessionTitle)}</strong><p class="small">${formatFullDate(log.date)} · ${log.durationMinutes} min · difficulte ${log.difficulty}/5${log.calories ? ` · ${escapeHtml(log.calories.display)} kcal` : ""}</p></div><span class="badge ${Number(log.difficulty || 3) <= 3 ? 'good' : ''}">${log.readinessLabel ? escapeHtml(log.readinessLabel) : 'Terminee'}</span></article>`).join("") : `<p class="small">Aucune seance recente. Le dashboard contemple le vide avec professionnalisme.</p>`}
        </div>
      </section>
    </main>
  `);
}

function renderProgram() {
  view = "program";
  const profile = requireProfile();
  if (!profile) return;
  const sessions = programSessionsForCurrentWeek(profile);
  const progress = programProgressInfo(profile);
  const phase = currentProgressionPhase(profile.program);
  const stats = profileWeekStats(profile);
  renderShell(`
    ${appHeader("Programme")}
    <main class="screen program-screen">
      <section class="card dark-card program-hero stack-lg">
        <div class="between program-hero-top">
          <div class="stack">
            <span class="kicker">${escapeHtml(profile.program.name)}</span>
            <h1>Ton plan de bataille.</h1>
            <p class="muted-light">${escapeHtml(progress.label)} · ${stats.done}/${stats.target || 0} seances cette semaine. Rien de martial, juste un planning qui essaie de survivre au quotidien.</p>
          </div>
          <span class="badge light-badge">${escapeHtml(programDurationLabel(profile.program))}</span>
        </div>
        <div class="progress-bar light-bar"><div class="progress-fill light-fill" style="width:${progress.percent}%"></div></div>
        ${phase ? `<div class="glass-card"><span class="kicker">Phase actuelle</span><strong>${escapeHtml(phase.title)}</strong><p class="small muted-light">${escapeHtml(phase.description)}</p></div>` : ""}
        <div class="row hero-actions">
          <button class="btn light" onclick="renderSessionBuilder()">Ajouter une seance</button>
          <button class="btn ghost light-ghost small-btn" onclick="renderImportCenter()">Importer</button>
          <button class="btn ghost light-ghost small-btn" onclick="renderProgramEditor()">Modifier</button>
        </div>
      </section>

      <section class="program-session-grid">
        ${sessions.map((session, index) => `
          <article class="card session-card-v24 ${completedThisWeek(session.id, profile) ? 'done' : ''}">
            <div class="session-card-media">
              ${sessionCoverHtml(session)}
              <div class="session-card-overlay">
                <span class="badge ${completedThisWeek(session.id, profile) ? 'good' : ''}">${escapeHtml(sessionDoneText(session, profile))}</span>
                <span class="badge">${escapeHtml(session.recommendedDay || 'Libre')}</span>
              </div>
            </div>
            <div class="stack session-card-body">
              <div class="between">
                <div>
                  <span class="kicker">Seance ${index + 1} · ${escapeHtml(sessionTypeLabel(session))}</span>
                  <h3>${escapeHtml(session.title)}</h3>
                  <p class="small">${escapeHtml(session.subtitle || '')}</p>
                </div>
                <span class="badge">${escapeHtml(session.plannedDuration || '')}</span>
              </div>
              <p class="small">${escapeHtml(session.description || 'Seance personnalisee.')}</p>
              <div class="session-metrics">
                <div><strong>${session.exercises.length}</strong><span>exos</span></div>
                <div><strong>${totalSets(session)}</strong><span>series</span></div>
                <div><strong>${Math.max(0, (session.warmup || []).length)}</strong><span>echauff.</span></div>
              </div>
              <div class="row actions-inline">
                <button class="btn" onclick="startSession('${session.id}')">Preparer</button>
                <button class="btn secondary small-btn" onclick="renderSessionDetail('${session.id}')">Detail</button>
                <button class="btn ghost small-btn" onclick="editSession('${session.id}')">Modifier</button>
              </div>
            </div>
          </article>
        `).join("") || `<section class="card compact stack"><h3>Aucune seance</h3><p class="small">Ton programme a la profondeur d'une assiette vide. Ajoute ou importe une seance.</p></section>`}
      </section>
    </main>
  `);
}

function renderSessionDetail(sessionId) {
  const session = findSession(sessionId);
  if (!session) return renderProgram();
  view = "program";
  const firstMedia = (session.exercises || []).find(ex => ex.media) || (session.exercises || [])[0];
  renderShell(`
    ${appHeader("Detail")}
    <main class="screen session-detail-screen">
      <button class="btn ghost small-btn" onclick="renderProgram()">Retour au programme</button>
      <section class="card dark-card detail-hero stack-lg">
        <div class="detail-hero-media">${miniMediaHtml(firstMedia, "detail-cover")}</div>
        <div class="stack">
          <span class="kicker">${escapeHtml(session.recommendedDay || 'Libre')} · ${escapeHtml(session.plannedDuration || '')}</span>
          <h1>${escapeHtml(session.title)}</h1>
          <p class="muted-light">${escapeHtml(session.subtitle || '')}</p>
          <p class="muted-light">${escapeHtml(session.description || '')}</p>
          <div class="row"><span class="badge light-badge">${session.exercises.length} exercices</span><span class="badge light-badge">${totalSets(session)} series</span><span class="badge light-badge">${escapeHtml(sessionTypeLabel(session))}</span></div>
        </div>
        <button class="btn light" onclick="startSession('${session.id}')">Preparer cette seance</button>
      </section>

      ${session.warmup.length ? `<section class="card compact stack timeline-card"><div class="between"><h3>Echauffement</h3><span class="badge">${session.warmup.length} etapes</span></div><div class="timeline-list">${session.warmup.map((item, i) => `<div class="timeline-item"><span>${i + 1}</span><p>${escapeHtml(item)}</p></div>`).join("")}</div></section>` : ""}

      <section class="card compact stack">
        <div class="between"><h3>Exercices</h3><span class="badge">${totalSets(session)} series</span></div>
        <div class="exercise-preview-list">
          ${session.exercises.map((ex, index) => `<article class="exercise-preview"><div class="exercise-index">${index + 1}</div>${miniMediaHtml(ex, "exercise-thumb")}<div class="exercise-preview-body"><strong>${escapeHtml(ex.name)}</strong><p class="small">${ex.sets} serie(s) · ${escapeHtml(ex.target)} · repos ${ex.restSeconds}s</p></div></article>`).join("")}
        </div>
      </section>

      ${session.cooldown.length ? `<section class="card compact stack timeline-card"><div class="between"><h3>Retour au calme</h3><span class="badge">${session.cooldown.length} etapes</span></div><div class="timeline-list">${session.cooldown.map((item, i) => `<div class="timeline-item"><span>${i + 1}</span><p>${escapeHtml(item)}</p></div>`).join("")}</div></section>` : ""}
    </main>
  `);
}

function renderLibrary() {
  view = "library";
  const profile = requireProfile();
  if (!profile) return;
  const library = getLibrary();
  const customCount = (profile.customExercises || []).length;
  const mediaCount = library.filter(ex => ex.media).length;
  const categories = Array.from(new Set(library.map(ex => ex.category || "general"))).sort();
  renderShell(`
    ${appHeader("Exercices")}
    <main class="screen library-screen">
      <section class="card hero-card dark-card stack-lg library-hero">
        <div class="stack">
          <span class="kicker">Bibliotheque Alfred</span>
          <h1>Les mouvements au propre.</h1>
          <p class="muted-light">Base commune, exercices importes et ajouts personnels. Le corps humain reste confus, mais au moins la liste est lisible.</p>
        </div>
        <div class="hero-progress-grid">
          <article class="glass-card stat-surface"><span class="kicker">Exercices</span><strong>${library.length}</strong><p class="small muted-light">disponibles</p></article>
          <article class="glass-card stat-surface"><span class="kicker">Medias</span><strong>${mediaCount}</strong><p class="small muted-light">avec visuel</p></article>
          <article class="glass-card stat-surface"><span class="kicker">Perso</span><strong>${customCount}</strong><p class="small muted-light">ajoutes</p></article>
        </div>
        <button class="btn light" onclick="showCustomExerciseModal()">Ajouter un exercice</button>
      </section>

      <section class="card compact stack">
        <div class="between"><h3>Categories</h3><span class="badge">${categories.length}</span></div>
        <div class="check-list">${categories.map(cat => `<span class="check-pill">${escapeHtml(cat)}</span>`).join("")}</div>
      </section>

      <section class="library-grid exercise-library-grid">
        ${library.map(ex => `
          <article class="card compact stack exercise-library-card">
            <div class="exercise-library-top">
              ${miniMediaHtml(ex, "library-thumb")}
              <div class="stack" style="gap:6px;">
                <span class="badge">${escapeHtml(ex.category || "general")}</span>
                <h3>${escapeHtml(ex.name)}</h3>
                <p class="small">${escapeHtml((ex.equipment || []).join(", ") || "sans materiel")}</p>
              </div>
            </div>
            <p class="small">${escapeHtml(ex.instructions || "Mouvement controle, sans douleur nette.")}</p>
            <div class="row"><span class="badge good">${escapeHtml(ex.defaultTarget || "Libre")}</span><span class="badge">Repos ${Number(ex.defaultRest || 45)}s</span>${ex.media ? `<span class="badge good">Media</span>` : `<span class="badge">Sans media</span>`}</div>
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
  if (!builder) builder = { title: "Seance perso", subtitle: "Libre", day: "Libre", duration: "20-30 min", exercises: [], editingSessionId: null };
  const library = getLibrary();
  renderShell(`
    ${appHeader(builder.editingSessionId ? "Modifier" : "Nouvelle seance")}
    <main class="screen builder-screen">
      <button class="btn ghost small-btn" onclick="builder=null;renderProgram()">Annuler</button>
      <section class="card hero-card dark-card stack-lg builder-hero">
        <div class="stack"><span class="kicker">Atelier de seance</span><h1>${builder.editingSessionId ? "Modifier la seance" : "Construire une seance"}</h1><p class="muted-light">Choisis les exercices, ajuste le volume, enregistre. Promis, aucune certification Excel n'est requise.</p></div>
        <div class="hero-progress-grid">
          <article class="glass-card stat-surface"><span class="kicker">Exercices</span><strong>${builder.exercises.length}</strong><p class="small muted-light">choisis</p></article>
          <article class="glass-card stat-surface"><span class="kicker">Series</span><strong>${builder.exercises.reduce((s,e)=>s+Number(e.sets||0),0)}</strong><p class="small muted-light">prevues</p></article>
        </div>
      </section>
      <section class="card compact stack editor-panel">
        <div class="between"><h3>Informations</h3><span class="badge">Seance</span></div>
        <div class="form">
          <div class="field"><label>Titre</label><input id="builderTitle" class="input" value="${escapeHtml(builder.title)}"></div>
          <div class="field"><label>Sous-titre</label><input id="builderSubtitle" class="input" value="${escapeHtml(builder.subtitle)}"></div>
          <div class="grid-2"><div class="field"><label>Jour conseille</label><input id="builderDay" class="input" value="${escapeHtml(builder.day)}"></div><div class="field"><label>Duree</label><input id="builderDuration" class="input" value="${escapeHtml(builder.duration)}"></div></div>
        </div>
      </section>
      <section class="card compact stack editor-panel">
        <div class="between"><h3>Ajouter un exercice</h3><button class="btn ghost small-btn" onclick="showCustomExerciseModal()">Creer exercice</button></div>
        <div class="form">
          <select id="builderExercise" class="select">${library.map(ex => `<option value="${ex.id}">${escapeHtml(ex.name)} - ${escapeHtml(ex.category)}</option>`).join("")}</select>
          <div class="grid-2"><input id="builderSets" class="input" type="number" value="2" placeholder="Series"><input id="builderRest" class="input" type="number" value="45" placeholder="Repos"></div>
          <input id="builderTarget" class="input" placeholder="Objectif ex : 10 reps">
          <button class="btn secondary" onclick="addExerciseToBuilder()">Ajouter a la seance</button>
        </div>
      </section>
      <section class="card compact stack editor-panel"><div class="between"><h3>Exercices choisis</h3><span class="badge">${builder.exercises.length}</span></div>${builder.exercises.length ? `<div class="exercise-preview-list">${builder.exercises.map((ex, index) => `<article class="exercise-preview"><div class="exercise-index">${index + 1}</div>${miniMediaHtml(ex, "exercise-thumb")}<div class="exercise-preview-body"><strong>${escapeHtml(ex.name)}</strong><p class="small">${ex.sets} serie(s) · ${escapeHtml(ex.target)} · repos ${ex.restSeconds}s</p></div><button class="btn ghost small-btn" onclick="removeBuilderExercise(${index})">Retirer</button></article>`).join("")}</div>` : `<p class="small">Aucun exercice pour l'instant. Ambitieux, mais peu fatigant.</p>`}</section>
      <div class="row"><button class="btn" onclick="saveBuiltSession()">Enregistrer la seance</button>${builder.editingSessionId ? `<button class="btn warn" onclick="deleteSession('${builder.editingSessionId}')">Supprimer cette seance</button>` : ""}</div>
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
  const sessionData = {
    id: builder.editingSessionId || uid("session"),
    title: builder.title,
    subtitle: builder.subtitle,
    type: "personnel",
    recommendedDay: builder.day,
    plannedDuration: builder.duration,
    description: "Seance personnalisee creee ou modifiee depuis la bibliotheque.",
    warmup: builder.warmup || [],
    exercises: builder.exercises,
    cooldown: builder.cooldown || []
  };
  if (builder.editingSessionId) {
    replaceSessionInProgram(profile.program, builder.editingSessionId, sessionData);
  } else if (Array.isArray(profile.program.weeks) && profile.program.weeks.length) {
    const current = profile.program.weeks.find(w => Number(w.weekNumber) === Number(currentProgramWeek(profile.program))) || profile.program.weeks[0];
    current.sessions.push(sessionData);
  } else {
    profile.program.sessions.push(sessionData);
  }
  builder = null;
  saveState();
  renderProgram();
}

function replaceSessionInProgram(program, sessionId, sessionData) {
  if (Array.isArray(program.sessions)) {
    const index = program.sessions.findIndex(s => s.id === sessionId);
    if (index >= 0) program.sessions[index] = sessionData;
  }
  if (Array.isArray(program.weeks)) {
    program.weeks.forEach(week => {
      const index = (week.sessions || []).findIndex(s => s.id === sessionId);
      if (index >= 0) week.sessions[index] = sessionData;
    });
  }
}

function removeSessionFromProgram(program, sessionId) {
  if (Array.isArray(program.sessions)) program.sessions = program.sessions.filter(s => s.id !== sessionId);
  if (Array.isArray(program.weeks)) program.weeks.forEach(week => { week.sessions = (week.sessions || []).filter(s => s.id !== sessionId); });
}

function editSession(sessionId) {
  const session = findSession(sessionId);
  if (!session) return;
  builder = {
    editingSessionId: session.id,
    title: session.title || "Seance",
    subtitle: session.subtitle || "Libre",
    day: session.recommendedDay || "Libre",
    duration: session.plannedDuration || "20-30 min",
    warmup: session.warmup || [],
    cooldown: session.cooldown || [],
    exercises: clone(session.exercises || [])
  };
  renderSessionBuilder();
}

function deleteSession(sessionId) {
  const profile = activeProfile();
  const session = findSession(sessionId);
  if (!profile || !session) return;
  if (!confirm(`Supprimer la seance "${session.title}" ? Elle disparaitra du programme actif. Pas du passé, on n'a pas encore invente le voyage temporel.`)) return;
  removeSessionFromProgram(profile.program, sessionId);
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
    <main class="screen readiness-screen">
      <button class="btn ghost small-btn" onclick="renderHome()">Retour</button>
      <section class="card dark-card readiness-hero stack-lg">
        <div class="stack">
          <span class="kicker">Avant de commencer</span>
          <h1>Quel humain es-tu aujourd'hui ?</h1>
          <p class="muted-light">${escapeHtml(session.title)} · ${escapeHtml(session.subtitle || '')}. Choisis le volume realiste. La regularite bat la performance, ce qui est moins spectaculaire mais nettement plus durable.</p>
        </div>
        <div class="row"><span class="badge light-badge">${escapeHtml(session.plannedDuration || '')}</span><span class="badge light-badge">${totalSets(session)} series prevues</span><span class="badge light-badge">Mode adaptatif</span></div>
      </section>
      <section class="readiness-grid">
        ${options.map(opt => `
          <article class="card compact stack readiness-card-v24 ${opt.id}">
            <div class="between"><div><span class="kicker">${opt.badge}</span><h3>${opt.title}</h3></div><span class="readiness-orb"></span></div>
            <p class="small">${opt.description}</p>
            <div class="mini-note"><strong>${opt.details}</strong></div>
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
  renderShell(`
    ${renderTrainingHeader("Echauffement")}
    <main class="screen training-screen">
      <section class="card dark-card training-stage stack-lg">
        <span class="kicker">${escapeHtml(session.title)}</span>
        <h1>On chauffe la machine.</h1>
        <p class="muted-light">Pas besoin de bravoure. Juste reveiller les articulations sans negocier avec la douleur.</p>
        <div class="timeline-list light-timeline">${session.warmup.map((item, i) => `<div class="timeline-item"><span>${i + 1}</span><p>${escapeHtml(item)}</p></div>`).join("")}</div>
        <button class="btn light" onclick="finishWarmup()">Echauffement termine</button>
      </section>
    </main>
  `);
}

function finishWarmup() { active.mode = "exercise"; renderActiveSession(); }
function currentExercise() { return active.session.exercises[active.exerciseIndex]; }

function renderExercise() {
  const ex = currentExercise();
  const done = active.completedSets.length;
  const total = totalSets(active.session);
  const next = getNextStepLabel();
  renderShell(`
    ${renderTrainingHeader(`${done} / ${total} series`)}
    <main class="screen training-screen exercise-focus-screen">
      <section class="training-exercise-hero">
        <div class="stack">
          <span class="kicker">Exercice ${active.exerciseIndex + 1} / ${active.session.exercises.length}</span>
          <h1>${escapeHtml(ex.name)}</h1>
          <p class="muted">${escapeHtml(ex.instructions)}</p>
        </div>
        <div class="row"><span class="badge">${escapeHtml(ex.target)}</span><span class="badge">Repos ${ex.restSeconds}s</span><span class="badge ${active.session.readinessLabel ? 'good' : ''}">${active.session.readinessLabel ? escapeHtml(active.session.readinessLabel) : 'Seance'}</span></div>
      </section>
      ${mediaHtml(ex)}
      <section class="card compact stack-lg set-control-card">
        <div class="between">
          <div><span class="kicker">Serie en cours</span><div class="big-number">${active.setIndex + 1}/${ex.sets}</div></div>
          <div class="stack" style="text-align:right"><span class="badge">${done}/${total} faites</span><span class="small">Ensuite : ${escapeHtml(next)}</span></div>
        </div>
        <button class="btn big-action" onclick="completeSet(true)">Serie faite</button>
        <div class="row actions-inline"><button class="btn secondary small-btn" onclick="showPainModal()">Douleur / gene</button><button class="btn ghost small-btn" onclick="completeSet(false)">Ignorer serie</button></div>
      </section>
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
  renderShell(`
    ${renderTrainingHeader("Repos")}
    <main class="screen training-screen">
      <section class="card dark-card rest-stage stack-lg" style="text-align:center">
        <span class="kicker">Repos</span>
        <div class="timer-circle rest-timer"><div id="timerText" class="timer-text">${formatClock(restRemaining)}</div></div>
        <h2>Respire. Oui, vraiment.</h2>
        <p class="muted-light">Prochaine etape : ${escapeHtml(getNextStepLabel())}</p>
        <div class="row actions-inline"><button class="btn light" onclick="skipRest()">Passer le repos</button><button class="btn ghost light-ghost" onclick="showPainModal()">Douleur / gene</button></div>
      </section>
    </main>`);
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
  log.message = completionMessage(log);
  log.progressionAdvice = progressionMessageForLog(log);
  log.calories = estimateCaloriesForLog(log);
  log.water = estimateWaterForLog(log);
  log.xp = xpForLog(log);
  profile.logs.unshift(log);
  const unlockedBadges = updateRewardsAfterLog(profile, log);
  log.unlockedBadges = unlockedBadges;
  saveState();
  active = null;
  renderPostWorkout(log, unlockedBadges);
}

function renderPostWorkout(log, unlockedBadges = []) {
  view = "post-workout";
  const profile = activeProfile();
  const level = levelForXp(profile ? Number(profile.xp || 0) : 0);
  const nextText = level.next ? `${level.next.min - Number(profile.xp || 0)} XP avant ${level.next.name}` : "Niveau max local. Ridicule, mais flatteur.";
  renderShell(`
    ${appHeader("Bravo")}
    <main class="screen">
      <section class="card hero-card stack-lg">
        <span class="kicker">Seance enregistree</span>
        <h1>${escapeHtml(log.sessionTitle)}</h1>
        <p class="muted">${escapeHtml(log.message || "Seance validee.")}</p>
      </section>
      <section class="grid-2">
        <div class="stat-card"><strong>${log.durationMinutes}</strong><span>minutes</span></div>
        <div class="stat-card"><strong>${log.difficulty}/5</strong><span>difficulte</span></div>
        <div class="stat-card"><strong>${log.calories ? log.calories.display : "-"}</strong><span>kcal estimees</span></div>
        <div class="stat-card"><strong>${log.water ? log.water.display : "-"}</strong><span>eau conseillee</span></div>
      </section>
      <section class="card compact stack good-note">
        <h3>Recuperation</h3>
        <p class="small">${escapeHtml(hydrationTip(log))}</p>
      </section>
      <section class="card compact stack good-note">
        <h3>Progression</h3>
        <p class="small">${escapeHtml(log.progressionAdvice || "Maintiens le cap.")}</p>
      </section>
      <section class="card compact stack">
        <div class="between"><div><h3>${escapeHtml(level.current.name)}</h3><p class="small">+${log.xp || 0} XP · ${nextText}</p></div><span class="badge good">${profile ? profile.xp || 0 : 0} XP</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${level.next ? Math.min(100, Math.round(((profile.xp - level.current.min) / (level.next.min - level.current.min)) * 100)) : 100}%"></div></div>
      </section>
      ${unlockedBadges.length ? `<section class="card compact stack"><h3>Nouveaux badges</h3><div class="badge-grid">${unlockedBadges.map(b => `<article class="achievement-card unlocked rarity-${b.rarity || 'common'}"><div class="achievement-icon">${b.icon}</div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.message || b.description)}</p></article>`).join("")}</div></section>` : `<section class="card compact stack"><h3>Badge</h3><p class="small">Aucun nouveau badge. Terrible injustice, ou simple mathematique.</p></section>`}
      <section class="row"><button class="btn" onclick="renderHome()">Retour accueil</button><button class="btn secondary" onclick="renderRewards()">Badges</button><button class="btn ghost" onclick="renderHistory()">Historique</button></section>
    </main>`);
}

function confirmQuitSession() {
  if (confirm("Quitter la seance en cours ? Elle ne sera pas enregistree.")) { active = null; stopRestTimer(); renderHome(); }
}


function renderImportCenter() {
  view = "import";
  const profile = requireProfile();
  if (!profile) return;
  const prompt = buildAIPrompt(profile);
  const jsonTemplate = JSON.stringify(PROGRAM_IMPORT_TEMPLATE, null, 2);
  renderShell(`
    ${appHeader("Importer")}
    <main class="screen import-screen">
      <section class="card hero-card dark-card stack-lg import-hero">
        <div class="stack">
          <span class="kicker">Programme personnalise</span>
          <h1>Importer sans exposer ton compte.</h1>
          <p class="muted-light">Alfred accepte du JSON ou du Markdown structure. Pas de connexion IA dans l'app publique, pas de cle API offerte aux passants. Revolutionnaire : la prudence.</p>
        </div>
        <div class="hero-progress-grid">
          <article class="glass-card stat-surface"><span class="kicker">JSON</span><strong>Fiable</strong><p class="small muted-light">recommande</p></article>
          <article class="glass-card stat-surface"><span class="kicker">Markdown</span><strong>Lisible</strong><p class="small muted-light">structure</p></article>
        </div>
      </section>

      <section class="card compact stack ai-panel-card">
        <div class="between"><div><span class="kicker">IA externe</span><h3>Preparer le prompt</h3><p class="small">Copie le prompt, colle-le dans ton IA, puis importe le JSON. Ton compte reste la-bas, Alfred reste local. Chacun chez soi, c'est plus propre.</p></div><span class="badge good">Securise</span></div>
        <div class="ai-grid ai-grid-premium">
          <a class="ai-link" href="https://chatgpt.com/" target="_blank" rel="noopener"><span class="ai-logo ai-chatgpt">G</span><strong>ChatGPT</strong><small>Ouvrir</small></a>
          <a class="ai-link" href="https://claude.ai/new" target="_blank" rel="noopener"><span class="ai-logo ai-claude">C</span><strong>Claude</strong><small>Ouvrir</small></a>
          <a class="ai-link" href="https://gemini.google.com/app" target="_blank" rel="noopener"><span class="ai-logo ai-gemini">Gem</span><strong>Gemini</strong><small>Ouvrir</small></a>
          <a class="ai-link" href="https://chat.mistral.ai/chat" target="_blank" rel="noopener"><span class="ai-logo ai-mistral">M</span><strong>Mistral</strong><small>Ouvrir</small></a>
        </div>
        <p class="small">Les logos officiels pourront etre ajoutes dans <code>assets/logos/</code>. Pour l'instant, pastilles maison. Les avocats dormiront mieux, enfin on suppose.</p>
        <textarea id="aiPromptBox" class="textarea tall">${escapeHtml(prompt)}</textarea>
        <button class="btn secondary" onclick="copyFromTextarea('aiPromptBox')">Copier le prompt IA</button>
      </section>

      <section class="import-method-grid">
        <article class="card compact stack import-method-card">
          <div><span class="kicker">Format recommande</span><h3>Importer JSON</h3><p class="small">Le format le plus robuste. Moche comme un formulaire fiscal, mais fiable.</p></div>
          <textarea id="programJsonInput" class="textarea tall" placeholder="Colle ici le JSON produit par ChatGPT, Claude ou ton coach tres organise."></textarea>
          <div class="row"><button class="btn" onclick="importProgramFromJsonTextarea()">Importer le JSON</button><button class="btn ghost" onclick="pasteTemplate('programJsonInput')">Modele</button></div>
          <label class="btn secondary" for="programJsonFile">Fichier JSON</label><input id="programJsonFile" type="file" accept="application/json,.json" style="display:none" onchange="importProgramFile(event,'json')">
        </article>

        <article class="card compact stack import-method-card">
          <div><span class="kicker">Format lisible</span><h3>Importer Markdown</h3><p class="small">Plus agreable a lire, plus capricieux a importer. Comme quoi le charme a un prix.</p></div>
          <textarea id="programMarkdownInput" class="textarea tall" placeholder="# Programme...

## Semaine 1

### Seance A...

#### Exercices
| Exercice | Series | Objectif | Repos | Consignes |"></textarea>
          <div class="row"><button class="btn" onclick="importProgramFromMarkdownTextarea()">Importer le Markdown</button><button class="btn ghost" onclick="pasteMarkdownTemplate()">Modele</button></div>
          <label class="btn secondary" for="programMarkdownFile">Fichier Markdown</label><input id="programMarkdownFile" type="file" accept=".md,text/markdown,text/plain" style="display:none" onchange="importProgramFile(event,'markdown')">
        </article>
      </section>

      <section class="card compact stack warning format-card"><div class="between"><h3>Format obligatoire</h3><span class="badge">Schema</span></div><p class="small">L'app verifie les champs obligatoires. Si un exercice est inconnu, il est ajoute automatiquement sans media dans ta bibliotheque personnelle.</p><pre class="code-block">${escapeHtml(jsonTemplate)}</pre></section>
    </main>
  `);
}

const PROGRAM_IMPORT_TEMPLATE = {
  programName: "Programme reprise sportive personnalise",
  durationWeeks: 8,
  sessionsPerWeek: 3,
  goal: "Reprise sportive et renforcement",
  startDate: new Date().toISOString().slice(0, 10),
  weeks: [
    {
      weekNumber: 1,
      focus: "Installation",
      sessions: [
        {
          title: "Seance A - Full body",
          type: "renforcement",
          recommendedDay: "Lundi",
          plannedDuration: "30-40 min",
          warmup: ["10 squats lents", "10 cercles d'epaules"],
          exercises: [
            { name: "Pompes", sets: 3, target: "8-12 reps", restSeconds: 90, instructions: "Corps aligne", equipment: ["poids-corps"], category: "haut" }
          ],
          cooldown: ["Respiration lente : 1 min"]
        }
      ]
    }
  ]
};

function buildAIPrompt(profile) {
  const a = profile.answers || {};
  return `Tu es coach sportif. Crée un programme sportif compatible avec mon application mobile personnelle.\n\nIMPORTANT : réponds uniquement avec un JSON valide, sans Markdown, sans commentaire, sans texte avant ou après.\n\nProfil utilisateur :\n- Prénom : ${profile.name}\n- Objectif : ${a.goal || "non renseigne"}\n- Niveau : ${a.level || "non renseigne"}\n- Séances par semaine : ${a.sessionsPerWeek || 3}\n- Durée moyenne : ${a.duration || "30-45"} min\n- Jours possibles : ${(a.days || []).join(", ") || "libre"}\n- Durée du programme : ${a.programDurationWeeks || 8} semaines\n- Matériel : ${(a.equipment || []).join(", ") || "poids du corps"}\n- Limitations/douleurs : ${(a.limitations || []).join(", ") || "aucune"}\n- Commentaires douleur : ${a.injuryText || "aucun"}\n- Préférences : ${(a.preferences || []).join(", ") || "renforcement, gainage"}\n\nRègles :\n- Programme progressif et prudent.\n- Douleur articulaire nette = proposer adaptation.\n- Chaque séance doit contenir échauffement, exercices et retour au calme.\n- Chaque exercice doit avoir : name, sets, target, restSeconds, instructions, equipment, category.\n- Les repos doivent être en secondes.\n- Le JSON doit respecter exactement ce schéma :\n\n${JSON.stringify(PROGRAM_IMPORT_TEMPLATE, null, 2)}`;
}

function copyFromTextarea(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.select();
  document.execCommand("copy");
  alert("Copie faite. Tu peux maintenant nourrir l'IA externe, cette bestiole affamee de contexte.");
}

function pasteTemplate(id) {
  const el = document.getElementById(id);
  if (el) el.value = JSON.stringify(PROGRAM_IMPORT_TEMPLATE, null, 2);
}

function pasteMarkdownTemplate() {
  const el = document.getElementById("programMarkdownInput");
  if (!el) return;
  el.value = `# Programme reprise sportive\n\nDurée : 8 semaines\nSéances par semaine : 3\nObjectif : Reprise sportive et renforcement\n\n## Semaine 1\n\n### Séance A - Full body\nType : renforcement\nJour : Lundi\nDurée : 30-40 min\n\n#### Échauffement\n- 10 squats lents\n- 10 cercles d'épaules\n\n#### Exercices\n| Exercice | Séries | Objectif | Repos | Consignes |\n|---|---:|---|---:|---|\n| Pompes | 3 | 8-12 reps | 90 | Corps aligné |\n| Squats | 3 | 12-15 reps | 60 | Dos droit |\n\n#### Retour au calme\n- Respiration lente : 1 min`;
}

function importProgramFile(event, type) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (type === "json") importProgramFromJson(String(reader.result || ""));
    else importProgramFromMarkdown(String(reader.result || ""));
  };
  reader.readAsText(file);
}

function importProgramFromJsonTextarea() {
  importProgramFromJson(document.getElementById("programJsonInput").value);
}

function importProgramFromMarkdownTextarea() {
  importProgramFromMarkdown(document.getElementById("programMarkdownInput").value);
}

function importProgramFromJson(text) {
  try {
    const parsed = JSON.parse(text);
    const normalized = normalizeImportedProgram(parsed, "import_json");
    const errors = validateImportedProgram(normalized);
    if (errors.length) return alert("Programme incomplet :\n- " + errors.join("\n- "));
    previewImportedProgram(normalized);
  } catch (error) {
    alert("JSON invalide. Une virgule a probablement décidé de ruiner ta journée.");
  }
}

function importProgramFromMarkdown(text) {
  try {
    const parsed = parseMarkdownProgram(text);
    const normalized = normalizeImportedProgram(parsed, "import_markdown");
    const errors = validateImportedProgram(normalized);
    if (errors.length) return alert("Programme Markdown incomplet :\n- " + errors.join("\n- "));
    previewImportedProgram(normalized);
  } catch (error) {
    alert("Markdown impossible a lire. Le texte libre, cette jungle sans panneau de signalisation.");
  }
}

function normalizeImportedProgram(raw, source) {
  const duration = raw.durationWeeks === "none" ? "none" : Number(raw.durationWeeks || 4);
  const weeks = Array.isArray(raw.weeks) && raw.weeks.length ? raw.weeks.map((week, wIndex) => ({
    weekNumber: Number(week.weekNumber || week.week || wIndex + 1),
    focus: week.focus || `Semaine ${wIndex + 1}`,
    sessions: (week.sessions || []).map((session, sIndex) => normalizeImportedSession(session, wIndex + 1, sIndex))
  })) : [{
    weekNumber: 1,
    focus: "Programme importe",
    sessions: (raw.sessions || []).map((session, sIndex) => normalizeImportedSession(session, 1, sIndex))
  }];
  return {
    id: uid("program"),
    name: raw.programName || raw.name || "Programme importe",
    source,
    goal: raw.goal || "Programme personnalise",
    startDate: raw.startDate || new Date().toISOString().slice(0, 10),
    durationWeeks: raw.durationWeeks === "none" ? "none" : duration,
    durationMode: raw.durationWeeks === "none" ? "open" : "fixed",
    weeklyTarget: Number(raw.sessionsPerWeek || (weeks[0]?.sessions || []).length || 3),
    sessionsPerWeek: Number(raw.sessionsPerWeek || (weeks[0]?.sessions || []).length || 3),
    progressionPlan: buildProgressionPlan(raw.durationWeeks || duration, {}),
    weeks,
    sessions: [],
    notes: raw.notes || ["Programme importe depuis un format structure."],
    importedAt: new Date().toISOString()
  };
}

function normalizeImportedSession(session, weekNumber, index) {
  return {
    id: session.id || `w${weekNumber}-${slugify(session.title || "seance")}-${index}`,
    title: session.title || `Seance ${index + 1}`,
    subtitle: session.subtitle || session.type || "Personnalise",
    type: session.type || "renforcement",
    recommendedDay: session.recommendedDay || session.day || session.jour || "Libre",
    plannedDuration: session.plannedDuration || session.duration || session.duree || "30-45 min",
    description: session.description || `Seance importee - semaine ${weekNumber}`,
    warmup: arrayify(session.warmup || session.echauffement),
    exercises: (session.exercises || session.exercices || []).map((ex, i) => normalizeImportedExercise(ex, i)),
    cooldown: arrayify(session.cooldown || session.retourAuCalme || session.retour_au_calme)
  };
}

function normalizeImportedExercise(ex, index) {
  const name = ex.name || ex.exercise || ex.exercice || `Exercice ${index + 1}`;
  const known = findLibraryExerciseByName(name);
  return {
    id: ex.id || (known ? `${known.id}-${uid("imp")}` : `import-${slugify(name)}-${uid("ex")}`),
    name,
    media: known?.media || null,
    mediaType: known?.mediaType || "none",
    sets: Number(ex.sets || ex.series || ex.séries || 1),
    target: ex.target || ex.objectif || ex.reps || "A definir",
    restSeconds: Number(ex.restSeconds || ex.rest || ex.repos || 45),
    category: ex.category || known?.category || "personnalise",
    equipment: arrayify(ex.equipment || ex.materiel || known?.equipment || ["personnel"]),
    instructions: ex.instructions || ex.consignes || ex.consigne || known?.instructions || "Mouvement controle, sans douleur nette."
  };
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/\n|;/).map(x => x.trim()).filter(Boolean);
}

function slugify(value) {
  return String(value || "item").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
}

function findLibraryExerciseByName(name) {
  const key = slugify(name);
  return getLibrary().find(ex => slugify(ex.name) === key || slugify(ex.id) === key) || null;
}

function validateImportedProgram(program) {
  const errors = [];
  if (!program.name) errors.push("nom du programme manquant");
  if (!program.weeks || !program.weeks.length) errors.push("aucune semaine definie");
  (program.weeks || []).forEach(week => {
    if (!week.sessions || !week.sessions.length) errors.push(`semaine ${week.weekNumber} : aucune seance`);
    (week.sessions || []).forEach(session => {
      if (!session.title) errors.push(`semaine ${week.weekNumber} : titre de seance manquant`);
      if (!session.exercises || !session.exercises.length) errors.push(`${session.title} : aucun exercice`);
      (session.exercises || []).forEach(ex => {
        if (!ex.name) errors.push(`${session.title} : exercice sans nom`);
        if (!ex.sets) errors.push(`${session.title} / ${ex.name} : series manquantes`);
        if (!ex.target) errors.push(`${session.title} / ${ex.name} : objectif manquant`);
      });
    });
  });
  return errors;
}

function previewImportedProgram(program) {
  importDraft = program;
  const totalSessions = program.weeks.reduce((sum, week) => sum + (week.sessions || []).length, 0);
  const totalExercises = program.weeks.reduce((sum, week) => sum + (week.sessions || []).reduce((s, session) => s + (session.exercises || []).length, 0), 0);
  renderShell(`
    ${appHeader("Apercu import")}
    <main class="screen">
      <button class="btn ghost small-btn" onclick="renderImportCenter()">Retour</button>
      <section class="card stack-lg good-note"><span class="kicker">Programme compatible</span><h2>${escapeHtml(program.name)}</h2><p class="muted">${escapeHtml(program.goal)} · ${programDurationLabel(program)} · ${totalSessions} seances · ${totalExercises} exercices</p><button class="btn" onclick="applyImportedProgram()">Utiliser ce programme</button></section>
      <section class="card compact stack"><h3>Semaines detectees</h3><ul class="list">${program.weeks.map(w => `<li><strong>Semaine ${w.weekNumber} · ${escapeHtml(w.focus)}</strong><br><span class="small">${(w.sessions || []).map(s => escapeHtml(s.title)).join(" · ")}</span></li>`).join("")}</ul></section>
    </main>
  `);
}

function applyImportedProgram() {
  const profile = activeProfile();
  if (!profile || !importDraft) return;
  addUnknownExercisesFromProgram(profile, importDraft);
  profile.program = importDraft;
  profile.answers = profile.answers || {};
  profile.answers.programDurationWeeks = importDraft.durationWeeks;
  profile.answers.sessionsPerWeek = importDraft.sessionsPerWeek;
  importDraft = null;
  saveState();
  alert("Programme importe. L'app a compris la structure, pas ton âme. C'est deja bien.");
  renderProgram();
}

function addUnknownExercisesFromProgram(profile, program) {
  const knownNames = new Set(getLibrary().map(ex => slugify(ex.name)));
  (program.weeks || []).forEach(week => (week.sessions || []).forEach(session => (session.exercises || []).forEach(ex => {
    const key = slugify(ex.name);
    if (knownNames.has(key)) return;
    knownNames.add(key);
    profile.customExercises.push({
      id: `custom-${key}-${uid("ex")}`,
      name: ex.name,
      category: ex.category || "personnalise",
      equipment: ex.equipment || ["personnel"],
      media: null,
      mediaType: "none",
      defaultTarget: ex.target || "A definir",
      defaultRest: Number(ex.restSeconds || 45),
      instructions: ex.instructions || "Exercice importe sans media. A verifier avant execution."
    });
  })));
}

function parseMarkdownProgram(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const titleLine = lines.find(l => /^#\s+/.test(l));
  const raw = { programName: titleLine ? titleLine.replace(/^#\s+/, "").trim() : "Programme Markdown", weeks: [] };
  const durationLine = lines.find(l => /^Dur[ée]e\s*:/i.test(l) || /^Duree\s*:/i.test(l));
  if (durationLine) {
    const m = durationLine.match(/(\d+)/);
    raw.durationWeeks = m ? Number(m[1]) : "none";
  }
  const spwLine = lines.find(l => /^S[ée]ances par semaine\s*:/i.test(l) || /^Seances par semaine\s*:/i.test(l));
  if (spwLine) { const m = spwLine.match(/(\d+)/); raw.sessionsPerWeek = m ? Number(m[1]) : 3; }
  const goalLine = lines.find(l => /^Objectif\s*:/i.test(l));
  if (goalLine) raw.goal = goalLine.split(":").slice(1).join(":").trim();
  const weekChunks = text.split(/\n##\s+Semaine\s+/i).slice(1);
  raw.weeks = weekChunks.map((chunk, wi) => {
    const firstLine = chunk.split("\n")[0] || `${wi + 1}`;
    const weekNumber = Number((firstLine.match(/\d+/) || [wi + 1])[0]);
    const sessions = chunk.split(/\n###\s+/).slice(1).map((sessionChunk, si) => parseMarkdownSession(sessionChunk, weekNumber, si));
    return { weekNumber, focus: `Semaine ${weekNumber}`, sessions };
  });
  if (!raw.weeks.length) raw.weeks = [{ weekNumber: 1, focus: "Import Markdown", sessions: [] }];
  return raw;
}

function parseMarkdownSession(chunk, weekNumber, index) {
  const lines = chunk.split("\n");
  const title = (lines[0] || `Seance ${index + 1}`).trim();
  const getMeta = label => {
    const line = lines.find(l => new RegExp(`^${label}\\s*:`, "i").test(l));
    return line ? line.split(":").slice(1).join(":").trim() : "";
  };
  return {
    title,
    type: getMeta("Type") || "renforcement",
    recommendedDay: getMeta("Jour") || "Libre",
    plannedDuration: getMeta("Durée") || getMeta("Duree") || "30-45 min",
    warmup: extractMarkdownList(chunk, "Échauffement") || extractMarkdownList(chunk, "Echauffement"),
    exercises: extractMarkdownExercises(chunk),
    cooldown: extractMarkdownList(chunk, "Retour au calme")
  };
}

function extractMarkdownList(chunk, title) {
  const re = new RegExp(`####\\s+${title}[\\s\\S]*?(?=\\n####|\\n###|$)`, "i");
  const match = chunk.match(re);
  if (!match) return [];
  return match[0].split("\n").filter(l => /^\s*-\s+/.test(l)).map(l => l.replace(/^\s*-\s+/, "").trim());
}

function extractMarkdownExercises(chunk) {
  const block = (chunk.match(/####\s+Exercices[\s\S]*?(?=\n####|\n###|$)/i) || [""])[0];
  return block.split("\n").filter(l => /^\s*\|/.test(l) && !/---/.test(l) && !/Exercice\s*\|/i.test(l)).map(row => {
    const cells = row.split("|").map(c => c.trim()).filter(Boolean);
    return { name: cells[0], sets: Number(cells[1] || 1), target: cells[2] || "A definir", restSeconds: Number(cells[3] || 45), instructions: cells[4] || "Mouvement controle." };
  });
}

function renderProgramEditor() {
  view = "program";
  const profile = requireProfile();
  if (!profile) return;
  renderShell(`
    ${appHeader("Modifier")}
    <main class="screen">
      <button class="btn ghost small-btn" onclick="renderProgram()">Retour</button>
      <section class="card stack-lg"><span class="kicker">Programme actif</span><h2>Modifier les informations</h2><div class="form"><div class="field"><label>Nom du programme</label><input id="editProgramName" class="input" value="${escapeHtml(profile.program.name)}"></div><div class="field"><label>Objectif</label><input id="editProgramGoal" class="input" value="${escapeHtml(profile.program.goal || "")}"></div><div class="field"><label>Séances par semaine</label><input id="editProgramTarget" class="input" type="number" value="${profile.program.weeklyTarget || profile.program.sessionsPerWeek || 3}"></div><div class="field"><label>Date de début</label><input id="editProgramStart" class="input" type="date" value="${escapeHtml((profile.program.startDate || new Date().toISOString()).slice(0,10))}"></div></div><button class="btn" onclick="saveProgramMeta()">Enregistrer</button></section>
      <section class="card compact stack"><h3>Seances modifiables</h3>${allProgramSessions(profile).map(s => `<div class="exercise-row"><div><strong>${escapeHtml(s.title)}</strong><p class="small">${escapeHtml(s.recommendedDay || "Libre")} · ${escapeHtml(s.plannedDuration || "")}</p></div><button class="btn secondary small-btn" onclick="editSession('${s.id}')">Modifier</button></div>`).join("")}</section>
    </main>
  `);
}

function saveProgramMeta() {
  const profile = activeProfile();
  if (!profile) return;
  profile.program.name = document.getElementById("editProgramName").value.trim() || profile.program.name;
  profile.program.goal = document.getElementById("editProgramGoal").value.trim() || profile.program.goal;
  profile.program.weeklyTarget = Number(document.getElementById("editProgramTarget").value || profile.program.weeklyTarget || 3);
  profile.program.sessionsPerWeek = profile.program.weeklyTarget;
  profile.program.startDate = document.getElementById("editProgramStart").value || profile.program.startDate;
  saveState();
  renderProgram();
}

function renderHistory() {
  view = "history";
  const profile = requireProfile();
  if (!profile) return;
  renderShell(`
    ${appHeader("Historique")}
    <main class="screen">
      <section class="stack"><span class="kicker">${escapeHtml(profile.name)}</span><h2>Seances terminees</h2><p class="muted">Historique local de ce profil uniquement. Pas de melange conjugal des pompes, un minimum de civilisation.</p></section>
      ${(profile.logs || []).length ? profile.logs.map(log => `<article class="card compact stack history-item" style="align-items:flex-start"><div><h3>${escapeHtml(log.sessionTitle)}</h3><p class="small">${formatFullDate(log.date)} · ${log.durationMinutes} min · difficulte ${log.difficulty}/5${log.calories ? ` · ${escapeHtml(log.calories.display)} kcal` : ""}${log.readinessLabel ? ` · ${escapeHtml(log.readinessLabel)}` : ""}</p>${log.message ? `<p class="small"><strong>${escapeHtml(log.message)}</strong></p>` : ""}${log.comment ? `<p class="small">${escapeHtml(log.comment)}</p>` : ""}${log.progressionAdvice ? `<p class="small">${escapeHtml(log.progressionAdvice)}</p>` : ""}${log.painNotes && log.painNotes.length ? `<p class="small">Gene : ${log.painNotes.map(p => `${escapeHtml(p.zone)} ${p.level}/5`).join(", ")}</p>` : `<p class="small">Douleur : aucune note</p>`}</div></article>`).join("") : `<section class="card compact"><p class="muted">Aucune seance enregistree pour ce profil.</p></section>`}
    </main>`);
}

function defaultRewardMilestones() {
  return [
    { id: "sessions_10", label: "10 seances", type: "sessions", threshold: 10, suggestion: "Un accessoire sport utile. Pas un rameur pour poser du linge.", reward: "", claimed: false },
    { id: "sessions_25", label: "25 seances", type: "sessions", threshold: 25, suggestion: "Nouvelle tenue ou t-shirt sport. La dignite textile compte aussi.", reward: "", claimed: false },
    { id: "sessions_50", label: "50 seances", type: "sessions", threshold: 50, suggestion: "Haltère, tapis, massage ou sortie sympa. Oui, utile si possible.", reward: "", claimed: false },
    { id: "sessions_100", label: "100 seances", type: "sessions", threshold: 100, suggestion: "Grosse recompense personnelle. A ce stade, le canape a perdu.", reward: "", claimed: false },
    { id: "weeks_4", label: "4 semaines actives", type: "weeks", threshold: 4, suggestion: "Petit plaisir choisi, sans saboter tout le projet. Quelle audace.", reward: "", claimed: false },
    { id: "weeks_8", label: "8 semaines actives", type: "weeks", threshold: 8, suggestion: "Recompense de cycle : tenue, accessoire ou experience detente.", reward: "", claimed: false },
    { id: "kcal_1000_reward", label: "1000 kcal estimees", type: "calories", threshold: 1000, suggestion: "Un truc symbolique. Le biscuit theorique a deja donne.", reward: "", claimed: false },
    { id: "kcal_5000_reward", label: "5000 kcal estimees", type: "calories", threshold: 5000, suggestion: "Recompense recuperation : massage, bain, calme. Produit rare avec enfants.", reward: "", claimed: false }
  ];
}

function rewardProgress(profile, reward, stats = profileAchievementStats(profile)) {
  if (reward.type === "sessions") return stats.totalWorkouts;
  if (reward.type === "weeks") return stats.activeWeeks;
  if (reward.type === "calories") return stats.totalCalories;
  return 0;
}

function editReward(rewardId) {
  const profile = activeProfile();
  if (!profile) return;
  profile.rewards = profile.rewards || defaultRewardMilestones();
  const reward = profile.rewards.find(r => r.id === rewardId);
  if (!reward) return;
  const value = prompt("Quelle recompense veux-tu associer a ce palier ?", reward.reward || reward.suggestion || "");
  if (value === null) return;
  reward.reward = value.trim();
  saveState();
  renderRewards();
}

function toggleRewardClaim(rewardId) {
  const profile = activeProfile();
  if (!profile) return;
  const reward = (profile.rewards || []).find(r => r.id === rewardId);
  if (!reward) return;
  reward.claimed = !reward.claimed;
  saveState();
  renderRewards();
}

function setBadgeFilter(category) {
  badgeFilter = category;
  renderRewards();
}

function rarityLabel(rarity) {
  return { common: "Commun", rare: "Rare", epic: "Epique", legendary: "Legendaire" }[rarity] || "Badge";
}

function checkProgramCompletion(profile) {
  if (!profile || !profile.program || profile.program.durationMode === "open" || profile.program.durationWeeks === "none") return false;
  const info = programProgressInfo(profile);
  return Boolean(info.total && info.week >= info.total && (profile.logs || []).length > 0);
}

function extendProgramWeeks(extra = 4) {
  const profile = activeProfile();
  if (!profile) return;
  profile.program.durationWeeks = String(Number(profile.program.durationWeeks || 8) + extra);
  profile.program.durationMode = "fixed";
  profile.program.completedAt = null;
  profile.program.progressionPlan = buildProgressionPlan(profile.program.durationWeeks, profile.answers || {});
  saveState();
  renderHome();
}

function makeProgramOpenEnded() {
  const profile = activeProfile();
  if (!profile) return;
  profile.program.durationWeeks = "none";
  profile.program.durationMode = "open";
  profile.program.completedAt = null;
  profile.program.progressionPlan = buildProgressionPlan("none", profile.answers || {});
  saveState();
  renderHome();
}

function restartProgramStronger() {
  const profile = activeProfile();
  if (!profile) return;
  profile.program.startDate = new Date().toISOString();
  profile.program.completedAt = null;
  profile.program.notes = profile.program.notes || [];
  profile.program.notes.unshift("Nouveau cycle lance avec ambition moderee. L'ego reste sous surveillance.");
  profile.program.sessions.forEach(session => session.exercises.forEach(ex => {
    if (Number(ex.sets || 0) < 4 && !`${ex.name}`.toLowerCase().includes("velo")) ex.sets = Number(ex.sets || 1) + 1;
  }));
  saveState();
  renderHome();
}

function renderProgramCompleteCard(profile) {
  if (!checkProgramCompletion(profile)) return "";
  const stats = profileAchievementStats(profile);
  const info = programProgressInfo(profile);
  const level = levelForXp(Number(profile.xp || 0));
  return `<section class="card hero-card dark-card stack-lg"><span class="kicker">Programme termine</span><h1>Mission tenue</h1><p class="muted-light">${escapeHtml(info.label)} · ${stats.totalWorkouts} seance(s) · ${stats.totalCalories} kcal estimees · niveau ${escapeHtml(level.current.shortName || level.current.name)}. Le canape demande une reunion de crise.</p><div class="row"><button class="btn light" onclick="extendProgramWeeks(4)">Prolonger 4 semaines</button><button class="btn secondary small-btn" onclick="restartProgramStronger()">Recommencer plus fort</button><button class="btn ghost light-ghost small-btn" onclick="makeProgramOpenEnded()">Mode libre</button></div></section>`;
}

function renderRewards() {
  view = "rewards";
  const profile = requireProfile();
  if (!profile) return;
  profile.rewards = profile.rewards || defaultRewardMilestones();
  const stats = profileAchievementStats(profile);
  const level = levelForXp(Number(profile.xp || 0));
  const earned = profile.achievements || [];
  const earnedIds = new Set(earned.map(b => b.id));
  const filtered = ACHIEVEMENTS.filter(b => badgeFilter === "all" || b.category === badgeFilter);
  const nextBadges = ACHIEVEMENTS.filter(b => !earnedIds.has(b.id)).sort((a,b)=> (a.threshold - a.value(stats)) - (b.threshold - b.value(stats))).slice(0, 3);
  renderShell(`
    ${appHeader("Badges")}
    <main class="screen">
      <section class="card hero-card dark-card stack-lg">
        <span class="kicker">Niveau actuel</span>
        <h1>${escapeHtml(level.current.shortName || level.current.name)}</h1>
        <p class="muted-light">${Number(profile.xp || 0)} XP · ${earned.length} / ${ACHIEVEMENTS.length} badge(s) debloques. C'est une galerie de recompenses, pas le Louvre, mais au moins elle fait bouger.</p>
        <div class="progress-bar light-bar"><div class="progress-fill light-fill" style="width:${level.next ? Math.min(100, Math.round(((profile.xp - level.current.min) / (level.next.min - level.current.min)) * 100)) : 100}%"></div></div>
        <p class="small muted-light">${level.next ? `${level.next.min - profile.xp} XP avant ${level.next.shortName || level.next.name}` : "Tous les niveaux locaux sont atteints. Le canape est en ruine symbolique."}</p>
      </section>

      <section class="quick-stats">
        <article class="stat-card"><strong>${stats.totalWorkouts}</strong><span>seances</span></article>
        <article class="stat-card"><strong>${stats.totalCalories}</strong><span>kcal estimees</span></article>
        <article class="stat-card"><strong>${stats.activeWeeks}</strong><span>semaines actives</span></article>
      </section>

      ${nextBadges.length ? `<section class="card compact stack"><div class="between"><h3>Prochains badges</h3><span class="badge">A venir</span></div><div class="stack">${nextBadges.map(b => `<div class="mini-progress"><div><strong>${escapeHtml(b.title)}</strong><p class="small">${escapeHtml(badgeProgressText(b, stats))} · ${escapeHtml(rarityLabel(b.rarity))}</p></div><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, Math.round((Math.min(b.value(stats), b.threshold) / b.threshold) * 100))}%"></div></div></div>`).join("")}</div></section>` : ""}

      <section class="card compact stack">
        <div class="between"><h3>Galerie des badges</h3><span class="badge good">${earned.length} debloques</span></div>
        <div class="check-list">${BADGE_CATEGORIES.map(cat => `<button class="check-pill ${badgeFilter === cat.id ? "selected" : ""}" onclick="setBadgeFilter('${cat.id}')">${cat.label}</button>`).join("")}</div>
        <div class="badge-grid badge-gallery">
          ${filtered.map(b => {
            const isEarned = earnedIds.has(b.id);
            const pct = Math.min(100, Math.round((Math.min(b.value(stats), b.threshold) / b.threshold) * 100));
            return `<article class="achievement-card ${isEarned ? "unlocked" : "locked"} rarity-${b.rarity}"><div class="achievement-icon">${b.icon}</div><span class="badge rarity ${b.rarity}">${escapeHtml(rarityLabel(b.rarity))}</span><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.description)}</p><div class="progress-bar"><div class="progress-fill" style="width:${isEarned ? 100 : pct}%"></div></div><span class="badge ${isEarned ? "good" : ""}">${isEarned ? "Debloque" : badgeProgressText(b, stats)}</span></article>`;
          }).join("")}
        </div>
      </section>

      <section class="card compact stack">
        <div class="between"><h3>Recompenses personnelles</h3><span class="badge">Paliers</span></div>
        <p class="small">Definis une vraie recompense aux gros paliers. Utile, agreable, mais idealement pas un appareil cardio qui finira porte-manteau.</p>
        <div class="stack">
          ${profile.rewards.map(r => {
            const value = rewardProgress(profile, r, stats);
            const pct = Math.min(100, Math.round((Math.min(value, r.threshold) / r.threshold) * 100));
            const reached = value >= r.threshold;
            return `<article class="reward-card ${reached ? "reached" : ""}"><div class="between"><div><strong>${escapeHtml(r.label)}</strong><p class="small">${Math.min(value, r.threshold)} / ${r.threshold} · ${escapeHtml(r.reward || r.suggestion)}</p></div><span class="badge ${reached ? "good" : ""}">${reached ? (r.claimed ? "Reclamee" : "Atteinte") : "A venir"}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><div class="row"><button class="btn secondary small-btn" onclick="editReward('${r.id}')">Modifier</button>${reached ? `<button class="btn ghost small-btn" onclick="toggleRewardClaim('${r.id}')">${r.claimed ? "Marquer non prise" : "Marquer prise"}</button>` : ""}</div></article>`;
          }).join("")}
        </div>
      </section>
    </main>`);
}

function renderSettings() {
  view = "settings";
  const profile = requireProfile();
  if (!profile) return;
  const stats = profileAchievementStats(profile);
  const level = levelForXp(Number(profile.xp || 0));
  renderShell(`
    ${appHeader("Reglages")}
    <main class="screen settings-screen">
      <section class="card hero-card dark-card stack-lg settings-hero">
        <div class="stack"><span class="kicker">Profil actif</span><h1>${escapeHtml(profile.name)}</h1><p class="muted-light">${escapeHtml(profile.program.name)} · ${escapeHtml(level.current.shortName || level.current.name)} · ${stats.totalWorkouts} seance(s).</p></div>
        <div class="row"><button class="btn light" onclick="renderProfileSelect()">Changer de profil</button><button class="btn ghost light-ghost small-btn" onclick="startOnboarding()">Nouveau profil</button></div>
      </section>

      <section class="settings-grid">
        <article class="card compact stack settings-tile"><span class="kicker">Programmes</span><h3>Importer et modifier</h3><p class="small">Gere les programmes, les imports IA externes et les seances. Le bricolage, mais avec des coins arrondis.</p><div class="stack"><button class="btn secondary" onclick="renderImportCenter()">Importer un programme</button><button class="btn ghost" onclick="renderProgramEditor()">Modifier le programme</button></div></article>
        <article class="card compact stack settings-tile"><span class="kicker">Sauvegarde</span><h3>Exporter / importer</h3><p class="small">Pour eviter qu'un nettoyage Safari efface ton glorieux historique de squats.</p><button class="btn secondary" onclick="exportData()">Exporter tous les profils</button><label class="btn ghost" for="importFile">Importer une sauvegarde</label><input id="importFile" type="file" accept="application/json" style="display:none" onchange="importData(event)"></article>
        <article class="card compact stack settings-tile"><span class="kicker">Historique</span><h3>Donnees du profil</h3><p class="small">Vide seulement l'historique du profil actif. Les autres profils restent tranquilles, miracle de la separation.</p><button class="btn ghost" onclick="resetCurrentLogs()">Vider l'historique du profil</button></article>
        <article class="card compact stack settings-tile warning"><span class="kicker">Zone dangereuse</span><h3>Suppression</h3><p class="small">Ici les boutons mordent. Lentement, mais definitivement.</p><button class="btn warn" onclick="deleteProfile('${profile.id}')">Supprimer ce profil uniquement</button><button class="btn ghost" onclick="resetAllData()">Reinitialiser toute l'app</button></article>
      </section>

      <section class="card compact stack"><div class="between"><h3>Version</h3><span class="badge good">Alfred</span></div><p class="small">Alfred v2.5.0 · PWA locale · GitHub Pages · donnees stockees localement sur cet appareil.</p></section>
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
  state = { version: APP_VERSION, introSeen: false, activeProfileId: null, profiles: [] };
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
  renderSplash();
}

init();

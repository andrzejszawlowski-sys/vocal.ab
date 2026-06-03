import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ════════════════════════════════════════════════════════════
//  § 1. CONSTANTS
//  Wersja, storage keys, motyw, tematy, typy gramatyczne
// ════════════════════════════════════════════════════════════

const APP_VERSION = "2.0.0";
const STORAGE_KEY = "vl_data_v2";
const STORAGE_KEY_V1 = "vl_data_v1";
const GEMINI_KEY_STORAGE = "vl_gemini_key";

// Motyw kolorystyczny
const T = {
  bg: "#0d0c0b", s1: "#151412", s2: "#1c1a18", s3: "#232120",
  b1: "#2a2826", b2: "#353230", b3: "#424040",
  acc: "#f5c842", acc2: "#42c9c0", acc3: "#f56042",
  green: "#5ec97a", red: "#f05a5a", blue: "#5a8ff0", purple: "#a78bf0",
  tx: "#ede8df", tx2: "#9c9790", tx3: "#5c5a56",
  r: "10px", r2: "16px", r3: "22px",
};

// Kategorie tematyczne — dokładnie jedna na słowo
const TOPICS = {
  unset:        { label: "Nieprzypisane",      icon: "❓", color: "#5c5a56" },
  // Życie codzienne
  home:         { label: "Dom i mieszkanie",   icon: "🏠", color: "#f5c842" },
  shopping:     { label: "Zakupy i pieniądze", icon: "🛒", color: "#f5c842" },
  food:         { label: "Jedzenie i gotowanie",icon: "🍽️", color: "#f5c842" },
  clothes:      { label: "Ubrania i wygląd",   icon: "👕", color: "#f5c842" },
  transport:    { label: "Transport i podróże", icon: "🚗", color: "#f5c842" },
  // Człowiek
  body:         { label: "Części ciała",        icon: "💪", color: "#42c9c0" },
  health:       { label: "Zdrowie i medycyna",  icon: "💊", color: "#42c9c0" },
  family:       { label: "Rodzina i relacje",   icon: "👨‍👩‍👧", color: "#42c9c0" },
  emotions:     { label: "Emocje i uczucia",    icon: "😊", color: "#42c9c0" },
  // Świat
  nature:       { label: "Przyroda i środowisko",icon: "🌍", color: "#5ec97a" },
  city:         { label: "Miasto i infrastruktura",icon: "🏙️", color: "#5ec97a" },
  work:         { label: "Praca i kariera",     icon: "💼", color: "#5ec97a" },
  education:    { label: "Edukacja i nauka",    icon: "📚", color: "#5ec97a" },
  economy:      { label: "Ekonomia i finanse",  icon: "💰", color: "#5ec97a" },
  politics:     { label: "Polityka i społeczeństwo",icon: "🏛️", color: "#5ec97a" },
  // Rozrywka
  entertainment:{ label: "Film i muzyka",       icon: "🎬", color: "#a78bf0" },
  sport:        { label: "Sport i rekreacja",   icon: "⚽", color: "#a78bf0" },
  technology:   { label: "Technologia i internet",icon: "💻", color: "#a78bf0" },
  art:          { label: "Sztuka i kultura",    icon: "🎨", color: "#a78bf0" },
};

// Typy gramatyczne — dokładnie jeden na słowo
const GRAMMAR_TYPES = {
  noun:         { label: "Rzeczownik",              icon: "📝", color: "#f5c842" },
  verb_regular: { label: "Czasownik regularny",     icon: "🔵", color: "#42c9c0" },
  verb_irregular:{ label: "Czasownik nieregularny", icon: "🔴", color: "#f05a5a" },
  adjective:    { label: "Przymiotnik",             icon: "🟡", color: "#f5c842" },
  adverb:       { label: "Przysłówek",              icon: "🟢", color: "#5ec97a" },
  phrasal_verb: { label: "Phrasal verb",            icon: "🔗", color: "#a78bf0" },
  idiom:        { label: "Idiom",                   icon: "💬", color: "#a78bf0" },
  expression:   { label: "Wyrażenie",               icon: "📖", color: "#42c9c0" },
  proverb:      { label: "Przysłowie",              icon: "📜", color: "#5ec97a" },
  other:        { label: "Inne",                    icon: "•",  color: "#5c5a56" },
};

// Role użytkowników
const ROLE_META = {
  admin:   { color: T.acc,    label: "Admin",      icon: "⚙️" },
  teacher: { color: T.purple, label: "Nauczyciel", icon: "📖" },
  student: { color: T.acc2,   label: "Uczeń",      icon: "🎓" },
};

// ════════════════════════════════════════════════════════════
//  § 2. UTILS
//  Helpers: uid, normalizacja, Levenshtein, deduplikacja,
//  daty, shuffle
// ════════════════════════════════════════════════════════════

const uid = () => Math.random().toString(36).slice(2, 10);

// Normalizacja — usuwa diakrytyki, sprowadza do lowercase
const norm = s => (s || "").trim().toLowerCase()
  .replace(/[''`]/g, "'")
  .replace(/ą/g,"a").replace(/ć/g,"c").replace(/ę/g,"e")
  .replace(/ł/g,"l").replace(/ń/g,"n").replace(/ó/g,"o")
  .replace(/ś/g,"s").replace(/ź/g,"z").replace(/ż/g,"z");

const normPL = s => (s || "").trim().toLowerCase().replace(/[''`]/g, "'");

// Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// Normalizacja form polskich czasowników
function plRoot(s) {
  const w = normPL(s);
  return w
    .replace(/(uję|ujesz|uje|ujemy|ujecie|ują)$/, "ować")
    .replace(/(ię|isz|i|imy|icie|ią)$/, "ić")
    .replace(/(ę|esz|e|emy|ecie|ą)$/, "ać")
    .replace(/(am|asz|a|amy|acie|ają)$/, "ać")
    .replace(/(ę|ysz|y|ymy|ycie|ą)$/, "yć")
    .replace(/em$/, "eć")
    .replace(/ę$/, "eć");
}

// Dopasowanie lokalne — "full" | "typo" | "partial" | "none"
function localMatch(inp, correct) {
  const i = normPL((inp || "").trim());
  if (!i) return "none";
  const alts = (correct || "").split("/").map(a => normPL(a.trim()));
  if (alts.some(a => a === i)) return "full";
  if (alts.some(a => norm(a) === norm(i))) return "full";
  if (alts.some(a => plRoot(a) === plRoot(i))) return "partial";
  const minDist = Math.min(...alts.map(a => levenshtein(norm(a), norm(i))));
  if (minDist === 1) return "typo";
  if (minDist === 2 && i.length > 5) return "typo";
  return "none";
}

// Deduplikacja — sprawdza czy słowo już istnieje w tablicy items
// Zwraca: "exact" | "fuzzy" | null
function checkDuplicate(item, existingItems) {
  const enNorm = norm(item.en);
  const plNorm = norm(item.pl);
  // Exact match
  const exact = existingItems.find(x =>
    norm(x.en) === enNorm && norm(x.pl) === plNorm
  );
  if (exact) return { type: "exact", match: exact };
  // Fuzzy match (tylko EN)
  const fuzzy = existingItems.find(x => {
    const d = levenshtein(norm(x.en), enNorm);
    return d <= 1 && d > 0;
  });
  if (fuzzy) return { type: "fuzzy", match: fuzzy };
  return null;
}

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Pomocniki dat
const DAY_MS = 86400000;
function daysBetween(ts1, ts2) { return Math.floor(Math.abs(ts2 - ts1) / DAY_MS); }
function startOfDay(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }

// Filtr czasowy
function matchesTimeFilter(addedAt, filter) {
  const now = Date.now();
  if (filter === "all") return true;
  if (filter === "today") return daysBetween(addedAt, now) === 0;
  if (filter === "week") return daysBetween(addedAt, now) <= 7;
  if (filter === "month") return daysBetween(addedAt, now) <= 30;
  return true;
}

// Typ gramatyczny z form + category (backward compat)
function inferGrammarType(item) {
  if (item.grammarType) return item.grammarType;
  if (item.type && GRAMMAR_TYPES[item.type]) return item.type;
  if (item.forms) return "verb_irregular";
  const cat = (item.category || "").toLowerCase();
  if (cat.includes("nieregularne")) return "verb_irregular";
  if (cat.includes("regularny")) return "verb_regular";
  if (cat.includes("przymiotnik")) return "adjective";
  if (cat.includes("rzeczownik")) return "noun";
  return "other";
}

// ════════════════════════════════════════════════════════════
//  § 3. DATA MODEL & MIGRATION
//  Struktura danych v2, inicjalizacja, migracja z v1
// ════════════════════════════════════════════════════════════

/*
  ITEM v2 (zunifikowany — słowa i frazy):
  {
    id: string
    en: string
    pl: string
    grammarType: keyof GRAMMAR_TYPES    // dokładnie jeden
    topic: keyof TOPICS                 // dokładnie jeden
    forms: { past, pp } | null          // tylko verb_irregular
    example: string | null
    example_pl: string | null
    sets: string[]                      // id zbiorów zadaniowych
    status: "pending" | "approved"
    source: "manual" | "import" | "photo" | "synonym"
    addedBy: string
    addedAt: number (timestamp)
  }

  SET v2 (zbiór zadaniowy):
  {
    id: string
    name: string
    dueDate: number | null
    createdAt: number
    status: "active" | "done"
    phase: "learn" | "review" | "test" | "done"
    itemIds: string[]
    stats: { total, newItems, knownItems }
  }
*/

const DEMO_ITEMS = [
  // Czasowniki nieregularne
  { en:"be",    pl:"być",           grammarType:"verb_irregular", topic:"unset", forms:{past:"was/were",pp:"been"},  example:"I am happy.", example_pl:"Jestem szczęśliwy." },
  { en:"have",  pl:"mieć",          grammarType:"verb_irregular", topic:"unset", forms:{past:"had",pp:"had"},        example:"I have a dog.", example_pl:"Mam psa." },
  { en:"go",    pl:"iść/jechać",    grammarType:"verb_irregular", topic:"transport", forms:{past:"went",pp:"gone"},  example:"I go to school.", example_pl:"Idę do szkoły." },
  { en:"make",  pl:"robić",         grammarType:"verb_irregular", topic:"unset", forms:{past:"made",pp:"made"},      example:"Make a wish.", example_pl:"Wypowiedz życzenie." },
  { en:"come",  pl:"przychodzić",   grammarType:"verb_irregular", topic:"unset", forms:{past:"came",pp:"come"},      example:"Come here!", example_pl:"Chodź tutaj!" },
  { en:"know",  pl:"wiedzieć",      grammarType:"verb_irregular", topic:"education", forms:{past:"knew",pp:"known"}, example:"I know the answer.", example_pl:"Znam odpowiedź." },
  { en:"think", pl:"myśleć",        grammarType:"verb_irregular", topic:"unset", forms:{past:"thought",pp:"thought"},example:"Think before you speak.", example_pl:"Myśl zanim powiesz." },
  { en:"take",  pl:"brać",          grammarType:"verb_irregular", topic:"unset", forms:{past:"took",pp:"taken"},     example:"Take your time.", example_pl:"Nie spiesz się." },
  { en:"see",   pl:"widzieć",       grammarType:"verb_irregular", topic:"health", forms:{past:"saw",pp:"seen"},      example:"I can see you.", example_pl:"Widzę cię." },
  { en:"give",  pl:"dawać",         grammarType:"verb_irregular", topic:"unset", forms:{past:"gave",pp:"given"},     example:"Give me a hand.", example_pl:"Pomóż mi." },
  // Przymiotniki
  { en:"beautiful", pl:"piękny",    grammarType:"adjective", topic:"art",   forms:null, example:"What a beautiful day!", example_pl:"Jaki piękny dzień!" },
  { en:"important",  pl:"ważny",    grammarType:"adjective", topic:"unset", forms:null, example:"This is important.", example_pl:"To jest ważne." },
  { en:"difficult",  pl:"trudny",   grammarType:"adjective", topic:"education", forms:null, example:"It's difficult.", example_pl:"To jest trudne." },
  // Zdrowie
  { en:"doctor",     pl:"lekarz",   grammarType:"noun", topic:"health",  forms:null, example:"See a doctor.", example_pl:"Idź do lekarza." },
  { en:"hospital",   pl:"szpital",  grammarType:"noun", topic:"health",  forms:null, example:"She's in the hospital.", example_pl:"Jest w szpitalu." },
  // Dom
  { en:"kitchen",    pl:"kuchnia",  grammarType:"noun", topic:"home",    forms:null, example:"Cook in the kitchen.", example_pl:"Gotuj w kuchni." },
  { en:"bedroom",    pl:"sypialnia",grammarType:"noun", topic:"home",    forms:null, example:"My bedroom is small.", example_pl:"Moja sypialnia jest mała." },
  // Phrasal verbs i idiomy
  { en:"break up",   pl:"rozstać się / rozbić", grammarType:"phrasal_verb", topic:"family",
    forms:null, example:"They broke up after two years.", example_pl:"Rozstali się po dwóch latach." },
  { en:"give up",    pl:"poddać się / zrezygnować", grammarType:"phrasal_verb", topic:"unset",
    forms:null, example:"Don't give up on your dreams.", example_pl:"Nie rezygnuj ze swoich marzeń." },
  { en:"take over",  pl:"przejąć kontrolę", grammarType:"phrasal_verb", topic:"work",
    forms:null, example:"She took over the company.", example_pl:"Przejęła firmę." },
  { en:"look up",    pl:"sprawdzić / wyszukać", grammarType:"phrasal_verb", topic:"education",
    forms:null, example:"Look it up in the dictionary.", example_pl:"Sprawdź to w słowniku." },
  { en:"come up with", pl:"wymyślić / wpaść na pomysł", grammarType:"phrasal_verb", topic:"unset",
    forms:null, example:"She came up with a great idea.", example_pl:"Wpadła na świetny pomysł." },
  { en:"once in a blue moon", pl:"raz na jakiś czas / bardzo rzadko", grammarType:"idiom", topic:"unset",
    forms:null, example:"We meet once in a blue moon.", example_pl:"Spotykamy się bardzo rzadko." },
  { en:"break a leg", pl:"powodzenia / trzymaj kciuki", grammarType:"idiom", topic:"unset",
    forms:null, example:"Break a leg at your presentation!", example_pl:"Powodzenia na prezentacji!" },
].map(w => ({
  ...w, id: uid(), sets: [], status: "approved",
  source: "manual", addedBy: "system", addedAt: Date.now() - Math.floor(Math.random() * 30 * DAY_MS),
}));

// Migracja z v1 → v2
function migrateV1ToV2(v1data) {
  const items = [];
  // Migruj words
  (v1data.words || []).forEach(w => {
    items.push({
      id: w.id || uid(),
      en: w.en, pl: w.pl,
      grammarType: inferGrammarType(w),
      topic: "unset",
      forms: w.forms || null,
      example: null, example_pl: null,
      sets: [],
      status: w.status || "approved",
      source: w.source || "manual",
      addedBy: w.addedBy || "admin",
      addedAt: w.addedAt || Date.now(),
    });
  });
  // Migruj phrases
  (v1data.phrases || []).forEach(p => {
    items.push({
      id: p.id || uid(),
      en: p.en, pl: p.pl,
      grammarType: p.type || "phrasal_verb",
      topic: "unset",
      forms: null,
      example: p.example || null,
      example_pl: p.example_pl || null,
      sets: [],
      status: p.status || "approved",
      source: p.source || "manual",
      addedBy: p.addedBy || "admin",
      addedAt: p.addedAt || Date.now(),
    });
  });
  return {
    users: v1data.users || [],
    currentUserId: v1data.currentUserId || null,
    firstRun: v1data.firstRun !== false,
    items,
    sets: [],
    sessions: v1data.sessions || [],
    progress: v1data.progress || {},
    version: 2,
  };
}

function initData() {
  // Próbuj załadować v2
  try {
    const r2 = localStorage.getItem(STORAGE_KEY);
    if (r2) {
      const d = JSON.parse(r2);
      if (d.version === 2) return d;
    }
  } catch {}

  // Próbuj migrować z v1
  try {
    const r1 = localStorage.getItem(STORAGE_KEY_V1);
    if (r1) {
      const v1 = JSON.parse(r1);
      if (v1.words || v1.phrases) {
        console.log("VocabLab: migrating v1 → v2");
        return migrateV1ToV2(v1);
      }
    }
  } catch {}

  // Świeży start
  return {
    users: [{ id: "u_admin", name: "Admin", pin: "1234",
      roles: ["admin","teacher","student"], classId: null,
      createdAt: Date.now(), xp: 0, streak: 0, lastStudyDate: null }],
    currentUserId: null,
    firstRun: true,
    items: DEMO_ITEMS,
    sets: [],
    sessions: [],
    progress: {},
    version: 2,
  };
}

// ════════════════════════════════════════════════════════════
//  § 4. AI / GEMINI
//  Klucz per-user, weryfikacja, ocena odpowiedzi, synonimy
// ════════════════════════════════════════════════════════════

function getGeminiKey(userId) {
  try {
    if (userId) {
      const personal = localStorage.getItem(`${GEMINI_KEY_STORAGE}__${userId}`);
      if (personal) return personal;
    }
    return localStorage.getItem(GEMINI_KEY_STORAGE) || "";
  } catch { return ""; }
}

function setGeminiKey(key, userId) {
  try {
    const k = (key || "").trim();
    const storKey = userId ? `${GEMINI_KEY_STORAGE}__${userId}` : GEMINI_KEY_STORAGE;
    if (k) localStorage.setItem(storKey, k);
    else localStorage.removeItem(storKey);
  } catch {}
}

async function geminiRequest(key, prompt, maxTokens = 300) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens }
      })
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function verifyGeminiKey(key) {
  try {
    await geminiRequest(key, "Say OK", 5);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Ocena odpowiedzi przez AI
async function evaluateAnswer({ wordEN, wordPL, userAnswer, forms, formsAnswer, userId }) {
  const key = getGeminiKey(userId);

  // Poziom 1: lokalny (zawsze)
  const localResult = localMatch(userAnswer, wordPL);
  let formsOk = true, formsDetail = "";
  if (forms && formsAnswer) {
    const pastOk = localMatch(formsAnswer.past || "", forms.past) !== "none";
    const ppOk   = localMatch(formsAnswer.pp   || "", forms.pp)   !== "none";
    formsOk = pastOk && ppOk;
    if (!formsOk)
      formsDetail = `Past: ${formsAnswer.past||"—"} (poprawnie: ${forms.past}) · PP: ${formsAnswer.pp||"—"} (poprawnie: ${forms.pp})`;
  }

  if (localResult === "full" && formsOk)
    return { quality:"full", feedback:"Idealna odpowiedź!", suggestion:wordPL, source:"local" };
  if (localResult === "typo" && formsOk)
    return { quality:"partial", feedback:"Literówka — prawie dobrze!", suggestion:wordPL, source:"local" };
  if (!key) {
    if (localResult === "none")
      return { quality:"wrong", feedback:"Błędna odpowiedź.", suggestion:wordPL, source:"local",
        correctDisplay: wordPL + (forms ? ` · ${forms.past} · ${forms.pp}` : "") };
    return { quality:"partial", feedback:`Akceptowane, sprawdź: ${wordPL}`, suggestion:wordPL, source:"local" };
  }

  // Poziom 2: AI
  try {
    const formsPrompt = forms
      ? `\nFormy (past/pp): "${forms.past}" / "${forms.pp}"\nOdpowiedź ucznia (past/pp): "${formsAnswer?.past||""}" / "${formsAnswer?.pp||""}"`
      : "";
    const prompt = `Jesteś nauczycielem angielskiego. Oceń odpowiedź ucznia.
Słowo EN: "${wordEN}"
Poprawne tłumaczenie PL: "${wordPL}"${formsPrompt}
Odpowiedź ucznia: "${userAnswer}"
Uwzględnij synonimy, formy gramatyczne, literówki.
Odpowiedz TYLKO JSON:
{"quality":"full"|"partial"|"wrong","feedback":"komentarz PL max 60 znaków","suggestion":"najlepsze tłumaczenie PL"}`;
    const text = await geminiRequest(key, prompt, 200);
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    let q = parsed.quality;
    if (!formsOk && q === "full") q = "partial";
    return { quality:q, feedback:parsed.feedback||"", suggestion:parsed.suggestion||wordPL,
      source:"ai", formsDetail: formsDetail||undefined };
  } catch (e) {
    console.warn("Gemini error:", e.message);
    if (localResult === "none")
      return { quality:"wrong", feedback:`AI niedostępne. Poprawna: ${wordPL}`, suggestion:wordPL, source:"local-fallback",
        correctDisplay: wordPL + (forms ? ` · ${forms.past} · ${forms.pp}` : "") };
    return { quality:localResult==="full"?"full":"partial",
      feedback:"Zaakceptowano lokalnie (AI niedostępne)", suggestion:wordPL, source:"local-fallback" };
  }
}

// Synonimy z Datamuse + tłumaczenia Gemini
async function fetchDatamuseRelated(word) {
  try {
    const [syn, trg, mlt] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=8`).then(r=>r.json()).catch(()=>[]),
      fetch(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}&max=6`).then(r=>r.json()).catch(()=>[]),
      fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=6`).then(r=>r.json()).catch(()=>[]),
    ]);
    const seen = new Set([word]);
    return [
      ...syn.map(d=>({word:d.word, type:"synonym"})),
      ...trg.map(d=>({word:d.word, type:"related"})),
      ...mlt.map(d=>({word:d.word, type:"similar"})),
    ].filter(x => { if(seen.has(x.word)) return false; seen.add(x.word); return true; }).slice(0,16);
  } catch { return []; }
}

async function lookupSynonyms(word, userId) {
  const related = await fetchDatamuseRelated(word);
  if (!related.length) return [];
  const key = getGeminiKey(userId);
  let translations = {};
  if (key) {
    try {
      const prompt = `Przetłumacz na polski (TYLKO JSON {"en":"pl",...}): ${related.map(r=>r.word).join(", ")}`;
      const text = await geminiRequest(key, prompt, 400);
      translations = JSON.parse(text.replace(/```json|```/g,"").trim());
    } catch {}
  }
  return related.map(r => ({ word:r.word, pl:translations[r.word]||"", type:r.type }));
}

// AI reklasyfikacja tematu (placeholder — działa gdy jest klucz)
async function classifyTopic(enWord, plWord, userId) {
  const key = getGeminiKey(userId);
  if (!key) return "unset";
  try {
    const topicList = Object.entries(TOPICS)
      .filter(([k]) => k !== "unset")
      .map(([k,v]) => `${k}: ${v.label}`)
      .join(", ");
    const prompt = `Przypisz słowo "${enWord}" (${plWord}) do jednej kategorii tematycznej.
Dostępne kategorie: ${topicList}
Odpowiedz TYLKO kluczem kategorii, np: health`;
    const text = await geminiRequest(key, prompt, 20);
    const key2 = text.trim().toLowerCase().replace(/[^a-z_]/g,"");
    return TOPICS[key2] ? key2 : "unset";
  } catch { return "unset"; }
}

// ════════════════════════════════════════════════════════════
//  § 5. STYLE HELPERS
//  Karty, przyciski, inputy, badge
// ════════════════════════════════════════════════════════════

const S = {
  card:  (extra={}) => ({ background:T.s1, border:`1px solid ${T.b1}`, borderRadius:T.r2, padding:20, ...extra }),
  card2: (extra={}) => ({ background:T.s2, border:`1px solid ${T.b1}`, borderRadius:T.r, padding:14, ...extra }),
  input: (extra={}) => ({ background:T.s2, border:`1.5px solid ${T.b2}`, borderRadius:8, color:T.tx,
    fontFamily:"'DM Mono',monospace", fontSize:14, padding:"9px 13px", width:"100%",
    outline:"none", boxSizing:"border-box", ...extra }),
  btn: (v="primary", sm=false, extra={}) => ({
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
    padding: sm ? "6px 13px" : "10px 20px",
    borderRadius:8, fontFamily:"'DM Sans',sans-serif", fontSize: sm?12:14, fontWeight:500,
    cursor:"pointer", border:"none", transition:"all .15s",
    background: v==="primary"?T.acc : v==="danger"?T.acc3 : v==="success"?T.green : v==="ghost"?"transparent" : T.s3,
    color: v==="primary"?"#0d0c0b" : v==="ghost"?T.tx2 : T.tx,
    ...(v==="ghost" ? {border:`1px solid ${T.b2}`} : {}),
    ...extra,
  }),
  label: { fontSize:10, textTransform:"uppercase", letterSpacing:"1.5px", color:T.tx3,
    fontFamily:"'DM Mono',monospace", marginBottom:5, display:"block" },
  row: (extra={}) => ({ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", ...extra }),
  col: (g=12, extra={}) => ({ display:"flex", flexDirection:"column", gap:g, ...extra }),
  badge: (color, extra={}) => ({ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px",
    borderRadius:20, fontSize:11, fontFamily:"'DM Mono',monospace",
    background:`${color}20`, color, border:`1px solid ${color}35`, ...extra }),
};

function hasRole(user, role) { return user?.roles?.includes(role); }
function isAdmin(user)   { return hasRole(user, "admin"); }
function isTeacher(user) { return hasRole(user, "teacher"); }

// ════════════════════════════════════════════════════════════
//  § 6. MAIN APP
//  Stan globalny, persist, akcje, routing ekranów
// ════════════════════════════════════════════════════════════

function App() {
  const [data, setData]   = useState(initData);
  const [screen, setScreen] = useState("splash");
  const [toast, setToast]   = useState(null);
  const toastTimer = useRef();

  // Persist
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  // Boot
  useEffect(() => {
    setTimeout(() => {
      if (data.firstRun) setScreen("onboarding");
      else if (!data.currentUserId) setScreen("login");
      else setScreen("home");
    }, 1000);
  }, []);

  const showToast = useCallback((msg, color=T.acc2) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, color });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const mutate = useCallback((fn) => {
    setData(d => { const nd = JSON.parse(JSON.stringify(d)); fn(nd); return nd; });
  }, []);

  const currentUser = data.users.find(u => u.id === data.currentUserId) || null;

  // ── Akcje ────────────────────────────────────────────────

  function completeOnboarding(profile) {
    mutate(d => {
      const user = { id:uid(), name:profile.name, pin:profile.pin, roles:profile.roles,
        classId:null, createdAt:Date.now(), xp:0, streak:0, lastStudyDate:null };
      d.users = [user];
      d.currentUserId = user.id;
      d.firstRun = false;
    });
    setScreen("home");
    showToast("Witaj! VocabLab v2.0 gotowy 🎉");
  }

  function login(userId) { mutate(d => { d.currentUserId = userId; }); setScreen("home"); }
  function logout()       { mutate(d => { d.currentUserId = null; });  setScreen("login"); }

  function addUser(profile) {
    mutate(d => { d.users.push({ id:uid(), name:profile.name, pin:profile.pin,
      roles:profile.roles, classId:null, createdAt:Date.now(), xp:0, streak:0, lastStudyDate:null }); });
    showToast("Dodano użytkownika");
  }
  function updateUser(id, changes) {
    mutate(d => { const u = d.users.find(x=>x.id===id); if(u) Object.assign(u, changes); });
  }
  function deleteUser(id) { mutate(d => { d.users = d.users.filter(u=>u.id!==id); }); }

  // Dodaj słowa/frazy z deduplikacją
  function addItems(newItems) {
    let added = 0, skipped = 0, fuzzyWarnings = [];
    mutate(d => {
      newItems.forEach(item => {
        const dup = checkDuplicate(item, d.items);
        if (dup?.type === "exact") { skipped++; return; }
        if (dup?.type === "fuzzy") { fuzzyWarnings.push(`"${item.en}" podobne do "${dup.match.en}"`); }
        const approved = isTeacher(currentUser) || isAdmin(currentUser);
        d.items.push({
          ...item, id:uid(), sets:item.sets||[],
          status: item.status || (approved ? "approved" : "pending"),
          source: item.source || "manual",
          addedBy: currentUser?.id || "admin",
          addedAt: Date.now(),
        });
        added++;
      });
    });
    if (skipped > 0) showToast(`Dodano ${added}, pominięto ${skipped} duplikatów`, T.acc);
    else showToast(`Dodano ${added} pozycji`);
    if (fuzzyWarnings.length) showToast(`Uwaga: ${fuzzyWarnings[0]}${fuzzyWarnings.length>1?` (+${fuzzyWarnings.length-1})`:""}`, T.acc3);
  }

  function updateItem(id, changes) {
    mutate(d => { const w = d.items.find(x=>x.id===id); if(w) Object.assign(w, changes); });
  }
  function deleteItem(id) { mutate(d => { d.items = d.items.filter(w=>w.id!==id); }); }

  // Zbiory zadaniowe
  function addSet(set) {
    mutate(d => { d.sets.push({ ...set, id:uid(), createdAt:Date.now(), createdBy:currentUser?.id,
      phase:"learn", status:"active" }); });
    showToast("Zbiór utworzony");
  }
  function updateSet(id, changes) {
    mutate(d => { const s = d.sets.find(x=>x.id===id); if(s) Object.assign(s,changes); });
  }
  function deleteSet(id) {
    // Usuwa zbiór ale NIE usuwa słów — tylko odpina je od zbioru
    mutate(d => {
      d.items.forEach(item => { item.sets = (item.sets||[]).filter(s=>s!==id); });
      d.sets = d.sets.filter(s=>s.id!==id);
    });
    showToast("Zbiór usunięty (słowa zachowane)");
  }

  function saveSession(session) {
    mutate(d => {
      d.sessions.unshift({ ...session, id:uid(), userId:currentUser?.id, date:Date.now() });
      if(d.sessions.length > 200) d.sessions = d.sessions.slice(0,200);
      const u = d.users.find(x=>x.id===currentUser?.id);
      if(u) {
        u.xp = (u.xp||0) + session.xpEarned;
        const today = new Date().toDateString();
        if(u.lastStudyDate !== today) {
          const yesterday = new Date(Date.now()-86400000).toDateString();
          u.streak = u.lastStudyDate===yesterday ? (u.streak||0)+1 : 1;
          u.lastStudyDate = today;
        }
      }
    });
  }

  function updateProgress(itemId, result) {
    mutate(d => {
      const key = `${currentUser?.id}_${itemId}`;
      const p = d.progress[key] || { score:0, streak:0, nextReview:0, lastSeen:0 };
      p.score = result.correct ? Math.max(0,p.score)+1 : p.score-1;
      p.streak = result.correct ? p.streak+1 : 0;
      p.nextReview = result.correct ? Date.now()+(p.score*8*3600000) : Date.now()+1800000;
      p.lastSeen = Date.now();
      d.progress[key] = p;
    });
  }

  function getProgress(itemId) {
    return data.progress[`${currentUser?.id}_${itemId}`] || { score:0, streak:0, nextReview:0, lastSeen:0 };
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`vocablab-v2-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast("Eksport gotowy");
  }
  function importData(json) {
    try {
      const d = JSON.parse(json);
      if(!d.items && !d.words) throw new Error("Nieprawidłowy format");
      const migrated = d.version === 2 ? d : migrateV1ToV2(d);
      setData(migrated);
      showToast("Import zakończony");
    } catch(e) { showToast("Błąd importu: "+e.message, T.red); }
  }

  // Context
  const ctx = {
    data, currentUser, mutate, showToast,
    addItems, updateItem, deleteItem,
    addSet, updateSet, deleteSet,
    addUser, updateUser, deleteUser,
    login, logout, exportData, importData,
    saveSession, updateProgress, getProgress,
  };

  return (
    <div style={{ background:T.bg, color:T.tx, minHeight:"100vh", fontFamily:"'DM Sans',sans-serif",
      display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto", position:"relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        input:focus { border-color:${T.acc} !important; }
        select { appearance:none; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:${T.b2}; border-radius:2px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .fade-up { animation:fadeUp .3s ease both; }
      `}</style>

      {screen==="splash"     && <SplashScreen />}
      {screen==="onboarding" && <OnboardingScreen onDone={completeOnboarding} />}
      {screen==="login"      && <LoginScreen users={data.users} onLogin={login} />}
      {screen==="home" && currentUser  && <AppShell ctx={ctx} />}
      {screen==="home" && !currentUser && <LoginScreen users={data.users} onLogin={login} />}

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background:T.s3, border:`1px solid ${T.b2}`, borderRadius:10, padding:"10px 18px",
          fontSize:13, color:T.tx, zIndex:9999, whiteSpace:"nowrap",
          boxShadow:"0 8px 32px rgba(0,0,0,.6)", animation:"fadeUp .25s ease" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 7. SPLASH & ONBOARDING
// ════════════════════════════════════════════════════════════

function SplashScreen() {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"100vh", gap:16 }}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:42, color:T.acc, letterSpacing:-1 }}>
        Vocab<span style={{ color:T.tx2, fontStyle:"italic" }}>Lab</span>
      </div>
      <div style={{ fontSize:11, color:T.tx3, fontFamily:"'DM Mono',monospace" }}>v{APP_VERSION}</div>
      <div style={{ width:32, height:32, border:`3px solid ${T.b2}`, borderTopColor:T.acc,
        borderRadius:"50%", animation:"spin 1s linear infinite" }} />
    </div>
  );
}

function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name:"", pin:"", mode:null, roles:[], geminiKey:"" });
  const [keyStatus, setKeyStatus] = useState(null);

  const MODES = [
    { key:"solo",    label:"Tylko dla siebie",  desc:"Uczysz się sam. Masz pełną kontrolę.", icon:"🧑‍💻", roles:["admin","teacher","student"] },
    { key:"teacher", label:"Nauczyciel / Rodzic",desc:"Zarządzasz bazą słów i klasą.",        icon:"📖", roles:["admin","teacher"] },
    { key:"student", label:"Uczeń w klasie",     desc:"Dołączasz do istniejącej klasy.",      icon:"🎓", roles:["student"] },
  ];

  function finish() {
    if (!form.name.trim() || form.pin.length < 4) return;
    if (form.geminiKey.trim()) setGeminiKey(form.geminiKey, null);
    onDone({ name:form.name.trim(), pin:form.pin, roles:form.roles });
  }

  async function checkKey() {
    setKeyStatus("checking");
    const r = await verifyGeminiKey(form.geminiKey.trim());
    setKeyStatus(r.ok ? "ok" : "error");
  }

  return (
    <div style={{ flex:1, minHeight:"100vh", ...S.col(0) }}>
      <div style={{ padding:"40px 24px 20px", textAlign:"center" }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:36, color:T.acc, letterSpacing:-1, marginBottom:4 }}>VocabLab</div>
        <div style={{ fontSize:11, color:T.tx3, fontFamily:"'DM Mono',monospace", marginBottom:4 }}>v{APP_VERSION}</div>
        <div style={{ fontSize:13, color:T.tx3 }}>Pierwsze uruchomienie — krok {step+1} / 3</div>
        <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:10 }}>
          {[0,1,2].map(i => <div key={i} style={{ width:8, height:8, borderRadius:"50%",
            background:step>=i?T.acc:T.b2, transition:"background .2s" }} />)}
        </div>
      </div>

      <div style={{ flex:1, padding:"0 24px 40px" }}>
        {step===0 && (
          <div className="fade-up" style={S.col(16)}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, marginBottom:4 }}>Jak używasz aplikacji?</div>
            {MODES.map(m => (
              <button key={m.key} onClick={() => { setForm(f=>({...f,mode:m.key,roles:m.roles})); setStep(1); }}
                style={{ background:T.s1, border:`1.5px solid ${T.b2}`, borderRadius:T.r2,
                  padding:"18px 20px", cursor:"pointer", textAlign:"left" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>{m.icon}</div>
                <div style={{ fontSize:16, fontWeight:600, color:T.tx, marginBottom:4 }}>{m.label}</div>
                <div style={{ fontSize:13, color:T.tx2 }}>{m.desc}</div>
                <div style={{ marginTop:10, ...S.row() }}>
                  {m.roles.map(r => <span key={r} style={S.badge(ROLE_META[r].color)}>{ROLE_META[r].icon} {ROLE_META[r].label}</span>)}
                </div>
              </button>
            ))}
          </div>
        )}

        {step===1 && (
          <div className="fade-up" style={S.col(16)}>
            <button onClick={() => setStep(0)} style={S.btn("ghost",true)}>← Wróć</button>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22 }}>Twój profil</div>
            <div>
              <label style={S.label}>Imię lub nick</label>
              <input style={S.input()} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Np. Kacper" autoFocus />
            </div>
            <div>
              <label style={S.label}>PIN (min. 4 cyfry)</label>
              <input style={S.input()} type="password" inputMode="numeric" maxLength={8}
                value={form.pin} onChange={e=>setForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))} placeholder="••••" />
            </div>
            <button onClick={() => setStep(2)} style={{ ...S.btn("primary"), width:"100%", padding:"14px", fontSize:15 }}
              disabled={!form.name.trim() || form.pin.length < 4}>
              Dalej →
            </button>
          </div>
        )}

        {step===2 && (
          <div className="fade-up" style={S.col(16)}>
            <button onClick={() => setStep(1)} style={S.btn("ghost",true)}>← Wróć</button>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22 }}>
              Klucz AI <span style={{ fontSize:14, color:T.tx3, fontStyle:"italic" }}>(opcjonalnie)</span>
            </div>
            <div style={S.card2({ borderColor:T.acc2 })}>
              <div style={{ fontSize:13, fontWeight:600, color:T.acc2, marginBottom:6 }}>Do czego służy klucz Gemini?</div>
              {[
                { icon:"🧠", text:"Ocenia odpowiedzi semantycznie — widzę = widzieć ✓" },
                { icon:"🔍", text:"Tłumaczy synonimy na polski" },
                { icon:"📂", text:"Klasyfikuje słowa do kategorii tematycznych" },
              ].map(x => (
                <div key={x.icon} style={S.row({ gap:8, alignItems:"flex-start", marginBottom:6 })}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{x.icon}</span>
                  <span style={{ fontSize:13, color:T.tx2 }}>{x.text}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:T.tx2, lineHeight:1.9, background:T.s2, borderRadius:T.r, padding:"12px 14px" }}>
              Klucz z <span style={{ color:T.acc, fontFamily:"'DM Mono',monospace" }}>aistudio.google.com</span> → Get API key → Create API key
            </div>
            <div>
              <label style={S.label}>Klucz API Gemini</label>
              <div style={S.row({ gap:8 })}>
                <input style={{ ...S.input(), flex:1, fontFamily:"'DM Mono',monospace", fontSize:13 }}
                  value={form.geminiKey} onChange={e=>{setForm(f=>({...f,geminiKey:e.target.value}));setKeyStatus(null);}}
                  placeholder="AIzaSy… lub AQ.…" autoComplete="off" spellCheck={false} />
                {form.geminiKey.trim() && (
                  <button style={S.btn("ghost",true)} onClick={checkKey} disabled={keyStatus==="checking"}>
                    {keyStatus==="checking" ? "…" : "Sprawdź"}
                  </button>
                )}
              </div>
              {keyStatus==="ok"    && <div style={{color:T.green,fontSize:12,marginTop:5}}>✓ Klucz działa</div>}
              {keyStatus==="error" && <div style={{color:T.red,fontSize:12,marginTop:5}}>✗ Błędny klucz</div>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <button onClick={finish} style={{ ...S.btn("ghost"), width:"100%", justifyContent:"center" }}>
                Pomiń, dodaj później
              </button>
              <button onClick={finish} style={{ ...S.btn("primary"), width:"100%", justifyContent:"center" }}
                disabled={!!form.geminiKey.trim() && keyStatus==="error"}>
                {form.geminiKey.trim() ? "Zapisz i zacznij →" : "Zacznij bez AI →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 8. LOGIN
// ════════════════════════════════════════════════════════════

function LoginScreen({ users, onLogin }) {
  const [selected, setSelected] = useState(users[0]?.id || null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const pinRef = useRef();

  function doLogin() {
    const user = users.find(u=>u.id===selected);
    if (!user) return;
    if (user.pin !== pin) { setError("Błędny PIN"); setPin(""); return; }
    setError(""); onLogin(user.id);
  }

  return (
    <div style={{ flex:1, minHeight:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:36, color:T.acc, letterSpacing:-1, marginBottom:4 }}>VocabLab</div>
      <div style={{ fontSize:11, color:T.tx3, fontFamily:"'DM Mono',monospace", marginBottom:28 }}>v{APP_VERSION}</div>
      <div style={{ width:"100%", ...S.col(14) }}>
        {users.length > 1 && (
          <div style={S.col(8)}>
            {users.map(u => (
              <button key={u.id} onClick={() => { setSelected(u.id); setPin(""); setTimeout(()=>pinRef.current?.focus(),50); }}
                style={{ ...S.card2(), border:`1.5px solid ${selected===u.id?T.acc:T.b1}`,
                  cursor:"pointer", display:"flex", alignItems:"center", gap:12,
                  background:selected===u.id?`${T.acc}10`:T.s2 }}>
                <div style={{ width:38, height:38, borderRadius:"50%", background:T.s3,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                  {u.roles.includes("admin")?"⚙️":u.roles.includes("teacher")?"📖":"🎓"}
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:15 }}>{u.name}</div>
                  <div style={S.row({ gap:4, marginTop:3 })}>
                    {u.roles.map(r => <span key={r} style={S.badge(ROLE_META[r].color,{fontSize:10,padding:"1px 6px"})}>{ROLE_META[r].label}</span>)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div>
          <label style={S.label}>PIN</label>
          <input ref={pinRef} style={S.input()} type="password" inputMode="numeric" maxLength={8}
            value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}
            onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="••••" autoFocus={users.length===1} />
          {error && <div style={{color:T.red,fontSize:12,marginTop:5}}>{error}</div>}
        </div>
        <button onClick={doLogin} style={{ ...S.btn("primary"), width:"100%", padding:13, fontSize:15 }}>Zaloguj →</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 9. APP SHELL + PROFILE DRAWER
//  Górny pasek, dolna nawigacja, drawer profilu
// ════════════════════════════════════════════════════════════

function AppShell({ ctx }) {
  const { currentUser, logout } = ctx;
  const [tab, setTab] = useState("home");
  const [showProfile, setShowProfile] = useState(false);

  const tabs = [
    { id:"home",    icon:"🏠", label:"Start" },
    { id:"learn",   icon:"📚", label:"Nauka" },
    { id:"library", icon:"🗂",  label:"Baza" },
    { id:"sets",    icon:"📋", label:"Zbiory" },
  ];

  const hasKey = !!getGeminiKey(currentUser.id);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      {/* Top bar */}
      <div style={{ background:T.s1, borderBottom:`1px solid ${T.b1}`, padding:"10px 16px",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:19, color:T.acc, letterSpacing:-0.5 }}>VocabLab</div>
          <div style={{ fontSize:10, color:T.tx3, fontFamily:"'DM Mono',monospace" }}>v{APP_VERSION}</div>
        </div>
        <div style={S.row({ gap:8 })}>
          {(isTeacher(currentUser)||isAdmin(currentUser)) && (
            <button onClick={() => setTab("manage")}
              style={{ background:tab==="manage"?`${T.acc}15`:"none",
                border:`1px solid ${tab==="manage"?T.acc:T.b2}`,
                borderRadius:7, padding:"4px 10px", cursor:"pointer", fontSize:12,
                color:tab==="manage"?T.acc:T.tx3 }}>⚙️</button>
          )}
          <button onClick={() => setShowProfile(true)}
            style={{ display:"flex", alignItems:"center", gap:7, background:T.s2,
              border:`1px solid ${T.b2}`, borderRadius:20, padding:"5px 12px 5px 8px", cursor:"pointer" }}>
            <div style={{ width:24, height:24, borderRadius:"50%",
              background:hasKey?`${T.green}30`:T.s3,
              border:`2px solid ${hasKey?T.green:T.b2}`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
              {currentUser.roles.includes("admin")?"⚙️":currentUser.roles.includes("teacher")?"📖":"🎓"}
            </div>
            <span style={{ fontSize:13, color:T.tx2 }}>{currentUser.name}</span>
            {!hasKey && <span style={{ fontSize:10, color:T.acc, fontFamily:"'DM Mono',monospace" }}>AI?</span>}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 16px 80px" }}>
        {tab==="home"    && <HomeTab    ctx={ctx} />}
        {tab==="learn"   && <LearnTab   ctx={ctx} />}
        {tab==="library" && <LibraryTab ctx={ctx} />}
        {tab==="sets"    && <SetsTab    ctx={ctx} />}
        {tab==="manage"  && <ManageTab  ctx={ctx} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:480, background:T.s1, borderTop:`1px solid ${T.b1}`,
        display:"flex", zIndex:100 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, background:"none", border:"none", padding:"10px 0 8px",
              cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:22 }}>{t.icon}</span>
            <span style={{ fontSize:10, color:tab===t.id?T.acc:T.tx3, fontWeight:tab===t.id?600:400 }}>{t.label}</span>
            {tab===t.id && <div style={{ width:20, height:2, background:T.acc, borderRadius:1 }} />}
          </button>
        ))}
      </div>

      {showProfile && <ProfileDrawer user={currentUser} onClose={() => setShowProfile(false)} onLogout={logout} />}
    </div>
  );
}

function ProfileDrawer({ user, onClose, onLogout }) {
  const [key, setKey]     = useState(() => getGeminiKey(user.id));
  const [show, setShow]   = useState(false);
  const [status, setStatus] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const saved = getGeminiKey(user.id);

  async function verify() {
    if (!key.trim()) return;
    setStatus("checking"); setErrMsg("");
    const r = await verifyGeminiKey(key.trim());
    if (r.ok) { setGeminiKey(key.trim(), user.id); setStatus("ok"); }
    else { setStatus("error"); setErrMsg(r.error); }
  }
  function clear() { setGeminiKey("",user.id); setKey(""); setStatus("cleared"); }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:500,
      display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:T.s1, border:`1px solid ${T.b2}`,
        borderRadius:`${T.r3} ${T.r3} 0 0`, padding:"24px 20px 36px",
        width:"100%", maxWidth:480, animation:"fadeUp .25s ease", maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20 }}>Mój profil</div>
            <div style={S.row({ gap:4, marginTop:4 })}>
              {user.roles.map(r => <span key={r} style={S.badge(ROLE_META[r].color,{fontSize:10})}>{ROLE_META[r].icon} {ROLE_META[r].label}</span>)}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.tx2, cursor:"pointer", fontSize:22 }}>✕</button>
        </div>

        <div style={S.col(12)}>
          <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>🤖 Klucz Gemini AI</div>
          <div style={{ ...S.card2({ borderColor:saved?T.green:T.acc }), background:saved?`${T.green}08`:`${T.acc}08` }}>
            <div style={S.row({ gap:10 })}>
              <span style={{ fontSize:20 }}>{saved?"✅":"⚠️"}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:saved?T.green:T.acc }}>
                  {saved?"AI aktywne":"Brak klucza — AI wyłączone"}
                </div>
                <div style={{ fontSize:11, color:T.tx2, marginTop:2 }}>
                  {saved?"Ocena odpowiedzi, synonimy i klasyfikacja działają."
                    :"Aplikacja działa lokalnie — bez oceny AI."}
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize:12, color:T.tx2, lineHeight:1.8, background:T.s2, borderRadius:T.r, padding:"10px 14px" }}>
            Klucz z <span style={{ color:T.acc, fontFamily:"'DM Mono',monospace" }}>aistudio.google.com</span> → Get API key → Create API key
          </div>
          <div>
            <label style={S.label}>Klucz API</label>
            <div style={S.row({ gap:8 })}>
              <input style={{ ...S.input(), flex:1, fontFamily:"'DM Mono',monospace", fontSize:12, letterSpacing:show?0:1 }}
                type={show?"text":"password"} value={key}
                onChange={e=>{setKey(e.target.value);setStatus(null);}}
                placeholder="AIzaSy… lub AQ.…" autoComplete="off" spellCheck={false} />
              <button style={S.btn("ghost",true)} onClick={() => setShow(s=>!s)}>{show?"🙈":"👁"}</button>
            </div>
          </div>
          {status==="checking" && <div style={S.row({gap:8,color:T.tx3,fontSize:12})}>
            <div style={{ width:12,height:12,border:`2px solid ${T.b2}`,borderTopColor:T.acc2,borderRadius:"50%",animation:"spin 1s linear infinite" }} />Weryfikuję…</div>}
          {status==="ok"      && <div style={{color:T.green,fontSize:12}}>✓ Klucz zapisany i działa</div>}
          {status==="cleared" && <div style={{color:T.acc2,fontSize:12}}>Klucz usunięty</div>}
          {status==="error"   && <div style={{color:T.red,fontSize:12}}>✗ {errMsg}</div>}
          <div style={S.row({ gap:8 })}>
            <button style={{ ...S.btn("primary"), flex:1, justifyContent:"center" }}
              onClick={verify} disabled={!key.trim()||status==="checking"}>
              {status==="checking"?"Sprawdzam…":"✓ Zweryfikuj i zapisz"}
            </button>
            {saved && <button style={S.btn("danger",true)} onClick={clear}>Usuń</button>}
          </div>
          <div style={{ height:1, background:T.b1 }} />
          <button onClick={() => { onLogout(); onClose(); }}
            style={{ ...S.btn("ghost"), width:"100%", justifyContent:"center", color:T.red, borderColor:`${T.red}40` }}>
            Wyloguj się
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 10. HOME TAB
//  Dashboard: statystyki, serie, zbiory aktywne
// ════════════════════════════════════════════════════════════

function HomeTab({ ctx }) {
  const { data, currentUser, getProgress } = ctx;
  const { items, sessions, sets } = data;

  const approved = items.filter(w => w.status==="approved");
  const myProgress = approved.map(w => getProgress(w.id));
  const known    = myProgress.filter(p => p.score>=4).length;
  const learning = myProgress.filter(p => p.score>0 && p.score<4).length;
  const hard     = myProgress.filter(p => p.score<0).length;
  const due      = approved.filter(w => getProgress(w.id).nextReview <= Date.now()).length;

  const mySessions = sessions.filter(s => s.userId===currentUser.id);
  const todaySessions = mySessions.filter(s => new Date(s.date).toDateString()===new Date().toDateString());
  const todayXP = todaySessions.reduce((a,s) => a+(s.xpEarned||0), 0);
  const streak = currentUser.streak || 0;
  const totalXP = currentUser.xp || 0;

  const activeSets = sets.filter(s => s.status==="active");

  // Ostatnio dodane (7 dni)
  const recentCount = items.filter(w => matchesTimeFilter(w.addedAt, "week")).length;

  return (
    <div style={S.col(16)}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, letterSpacing:-0.5 }}>
        Cześć, {currentUser.name}! {streak>2?"🔥":"👋"}
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {[
          { label:"Seria dni", value:streak, unit:"🔥", color:streak>0?T.acc:T.tx3 },
          { label:"XP dziś",   value:todayXP, unit:"⚡", color:T.acc2 },
          { label:"XP łącznie",value:totalXP, unit:"🏆", color:T.purple },
        ].map(s => (
          <div key={s.label} style={S.card2({ textAlign:"center" })}>
            <div style={{ fontSize:22 }}>{s.unit}</div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:T.tx3, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {due > 0 && (
        <div style={S.card({ borderColor:T.acc, background:`${T.acc}08` })}>
          <div style={{ fontSize:14, fontWeight:600, color:T.acc, marginBottom:4 }}>⏰ {due} słów do powtórzenia</div>
          <div style={{ fontSize:12, color:T.tx2 }}>Przejdź do Nauki → Dzienny przegląd</div>
        </div>
      )}

      {/* Progress */}
      <div style={S.card()}>
        <div style={{ fontSize:12, color:T.tx3, fontFamily:"'DM Mono',monospace",
          textTransform:"uppercase", letterSpacing:"1px", marginBottom:12 }}>Postęp nauki</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            { l:"Wszystkich", v:approved.length, c:T.tx2 },
            { l:"Znam",       v:known,    c:T.green },
            { l:"Uczę się",   v:learning, c:T.acc2 },
            { l:"Trudne",     v:hard,     c:T.red },
          ].map(x => (
            <div key={x.l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:x.c }}>{x.v}</div>
              <div style={{ fontSize:10, color:T.tx3 }}>{x.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:14, height:6, background:T.s3, borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${approved.length?(known/approved.length)*100:0}%`,
            background:`linear-gradient(90deg,${T.acc2},${T.green})`, borderRadius:3, transition:"width .5s" }} />
        </div>
        <div style={{ fontSize:11, color:T.tx3, marginTop:5 }}>
          {approved.length ? Math.round((known/approved.length)*100) : 0}% opanowanych
        </div>
      </div>

      {/* Ostatnio dodane */}
      {recentCount > 0 && (
        <div style={S.card2({ borderColor:T.acc2 })}>
          <div style={{ fontSize:13, color:T.acc2, fontWeight:600 }}>🆕 {recentCount} słów dodanych w ostatnim tygodniu</div>
          <div style={{ fontSize:11, color:T.tx3, marginTop:4 }}>Sprawdź zakładkę Baza → filtr "Ostatnie 7 dni"</div>
        </div>
      )}

      {/* Aktywne zbiory */}
      {activeSets.length > 0 && (
        <div style={S.card()}>
          <div style={{ fontSize:12, color:T.tx3, fontFamily:"'DM Mono',monospace",
            textTransform:"uppercase", letterSpacing:"1px", marginBottom:12 }}>Aktywne zbiory</div>
          {activeSets.slice(0,3).map(s => {
            const setItems = data.items.filter(w => (w.sets||[]).includes(s.id));
            const phaseMeta = { learn:"Poznaj", review:"Utrwal", test:"Test", done:"Zakończony" };
            return (
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.b1}` }}>
                <div>
                  <div style={{ fontWeight:500, fontSize:14 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:T.tx3, marginTop:2 }}>
                    {setItems.length} słów · faza: {phaseMeta[s.phase]||s.phase}
                  </div>
                </div>
                {s.dueDate && <div style={S.badge(T.acc3)}>{new Date(s.dueDate).toLocaleDateString("pl")}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Kategorie tematyczne */}
      <TopicOverview ctx={ctx} />
    </div>
  );
}

function TopicOverview({ ctx }) {
  const { data, getProgress } = ctx;
  const topicCounts = {};
  data.items.filter(w=>w.status==="approved").forEach(w => {
    const t = w.topic || "unset";
    if (!topicCounts[t]) topicCounts[t] = { total:0, known:0 };
    topicCounts[t].total++;
    if ((getProgress(w.id).score||0) >= 4) topicCounts[t].known++;
  });
  const entries = Object.entries(topicCounts).filter(([,v])=>v.total>0).sort((a,b)=>b[1].total-a[1].total).slice(0,6);
  if (!entries.length) return null;

  return (
    <div style={S.card()}>
      <div style={{ fontSize:12, color:T.tx3, fontFamily:"'DM Mono',monospace",
        textTransform:"uppercase", letterSpacing:"1px", marginBottom:12 }}>Tematy</div>
      <div style={S.col(8)}>
        {entries.map(([topicKey, counts]) => {
          const meta = TOPICS[topicKey] || TOPICS.unset;
          const pct = counts.total ? Math.round((counts.known/counts.total)*100) : 0;
          return (
            <div key={topicKey}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                <span>{meta.icon} {meta.label}</span>
                <span style={{ color:T.tx3, fontFamily:"'DM Mono',monospace", fontSize:11 }}>
                  {counts.known}/{counts.total}
                </span>
              </div>
              <div style={{ height:4, background:T.s3, borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:meta.color, borderRadius:2, opacity:0.7 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 11. LEARN TAB
//  Wybór trybu, kierunek, szybkie statsy
// ════════════════════════════════════════════════════════════

function LearnTab({ ctx }) {
  const { data, getProgress } = ctx;
  const [activeSession, setActiveSession] = useState(null);
  const [direction, setDirection] = useState("en-pl");

  if (activeSession) {
    const onDone = r => { ctx.saveSession(r); setActiveSession(null); };
    const onExit = () => setActiveSession(null);
    if (activeSession.mode==="flashcard")
      return <FlashcardSession config={activeSession} ctx={ctx} onDone={onDone} onExit={onExit} />;
    return <QuizSession config={activeSession} ctx={ctx} onDone={onDone} onExit={onExit} />;
  }

  const approved = data.items.filter(w=>w.status==="approved");
  const due  = approved.filter(w=>getProgress(w.id).nextReview<=Date.now());
  const hard = approved.filter(w=>getProgress(w.id).score<0);
  const newW = approved.filter(w=>getProgress(w.id).score===0&&getProgress(w.id).lastSeen===0);

  function start(mode, pool, extra={}) {
    if (!pool.length) { ctx.showToast("Brak słów w tej puli"); return; }
    setActiveSession({ mode, pool:shuffle(pool).slice(0,extra.limit||999), direction, ...extra });
  }

  const MODES = [
    { icon:"🃏", title:"Fiszki",          color:T.acc,    tag:"Anki",
      desc:"Widzisz słowo — sam oceniasz czy wiedziałeś",
      action:()=>start("flashcard",approved,{limit:20,xpMult:1.2}) },
    { icon:"📅", title:"Dzienny przegląd", color:T.acc2,   tag:"spaced repetition",
      desc:`${due.length} słów do powtórzenia dziś`,
      action:()=>start("typing",due.length?due:approved.slice(0,20),{limit:20,xpMult:1.5}) },
    { icon:"🎲", title:"Quiz 1 z 4",       color:T.blue,   tag:"rozgrzewka",
      desc:"Cztery opcje do wyboru",
      action:()=>start("choice",approved,{limit:20,xpMult:0.8}) },
    { icon:"⌨️", title:"Wpisywanie",        color:T.green,  tag:"najtrudniejszy",
      desc:"Wpisujesz pełną odpowiedź — z oceną AI",
      action:()=>start("typing",approved,{limit:20,xpMult:1.5}) },
    { icon:"🆕", title:"Nowe słowa",        color:T.green,  tag:"pierwsze zetknięcie",
      desc:`${newW.length} słów których jeszcze nie znasz`,
      action:()=>start("flashcard",newW.length?newW:approved,{limit:15,xpMult:1}) },
    { icon:"🔥", title:"Trudne słowa",      color:T.red,    tag:"intensywna powtórka",
      desc:`${hard.length} słów do poprawy`,
      action:()=>start("typing",hard.length?hard:approved,{limit:15,xpMult:2}) },
    { icon:"🔊", title:"Ze słuchu",         color:T.purple, tag:"trening słuchu",
      desc:"Słyszysz słowo, wpisujesz znaczenie",
      action:()=>start("tts",approved,{limit:15,xpMult:1.2}) },
    { icon:"🔁", title:"Sesja do zaliczenia",color:T.acc,   tag:"utrwalanie",
      desc:"Ćwicz aż każde słowo zaliczone 2× z rzędu",
      action:()=>start("session",approved,{limit:20,xpMult:1.5}) },
  ];

  return (
    <div style={S.col(14)}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, letterSpacing:-0.5 }}>Nauka</div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
        {[
          { l:"Do powtórki", v:due.length,  c:T.acc },
          { l:"Nowe",        v:newW.length, c:T.green },
          { l:"Trudne",      v:hard.length, c:T.red },
        ].map(x => (
          <div key={x.l} style={S.card2({ textAlign:"center" })}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:x.c }}>{x.v}</div>
            <div style={{ fontSize:10, color:T.tx3 }}>{x.l}</div>
          </div>
        ))}
      </div>

      {/* Kierunek */}
      <div style={S.card2()}>
        <div style={{ fontSize:11, color:T.tx3, fontFamily:"'DM Mono',monospace",
          textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>Kierunek tłumaczenia</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { v:"en-pl", label:"🇬🇧 → 🇵🇱", sub:"Angielski → Polski" },
            { v:"pl-en", label:"🇵🇱 → 🇬🇧", sub:"Polski → Angielski" },
          ].map(d => (
            <button key={d.v} onClick={() => setDirection(d.v)}
              style={{ background:direction===d.v?`${T.acc}12`:T.s3,
                border:`1.5px solid ${direction===d.v?T.acc:T.b2}`,
                borderRadius:T.r, padding:"10px 12px", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:18, marginBottom:2 }}>{d.label}</div>
              <div style={{ fontSize:11, color:direction===d.v?T.acc:T.tx3 }}>{d.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tryby */}
      <div style={S.col(8)}>
        {MODES.map(m => (
          <button key={m.title} onClick={m.action}
            style={{ background:T.s1, border:`1px solid ${T.b1}`, borderRadius:T.r,
              padding:"13px 16px", cursor:"pointer", display:"flex", alignItems:"center",
              gap:14, textAlign:"left" }}>
            <div style={{ fontSize:26, width:36, textAlign:"center", flexShrink:0 }}>{m.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:14, color:m.color }}>{m.title}</div>
              <div style={{ fontSize:12, color:T.tx3, marginTop:1 }}>{m.desc}</div>
            </div>
            <span style={{ ...S.badge(m.color,{}), fontSize:10, flexShrink:0, whiteSpace:"nowrap" }}>{m.tag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 12. FLASHCARD SESSION
// ════════════════════════════════════════════════════════════

function FlashcardSession({ config, ctx, onDone, onExit }) {
  const { pool, xpMult=1, direction="en-pl" } = config;
  const [queue, setQueue] = useState(() => shuffle([...pool]));
  const [idx, setIdx]   = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats]   = useState({ knew:0, didnt:0 });
  const [done, setDone]     = useState(false);
  const [exitAnim, setExitAnim] = useState(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key===" "||e.key==="ArrowUp") { e.preventDefault(); if(!flipped) setFlipped(true); }
      if (e.key==="ArrowRight"&&flipped) respond(true);
      if (e.key==="ArrowLeft"&&flipped)  respond(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped]);

  const current = queue[idx];
  if (!current||done) return null;
  const progress = Math.round((idx/Math.max(queue.length,1))*100);
  const front = direction==="en-pl" ? current.en : current.pl;
  const back  = direction==="en-pl" ? current.pl : current.en;
  const backForms = direction==="en-pl" && current.forms
    ? `${current.forms.past} · ${current.forms.pp}` : null;
  const backExample = direction==="en-pl" ? current.example_pl : current.example;

  function respond(knew) {
    setExitAnim(knew?"knew":"didnt");
    ctx.updateProgress(current.id, { correct:knew });
    setStats(s => ({ knew:s.knew+(knew?1:0), didnt:s.didnt+(knew?0:1) }));
    if (!knew) {
      setQueue(q => {
        const nq=[...q];
        const ri=Math.min(idx+2+Math.floor(Math.random()*3),nq.length);
        nq.splice(ri,0,{...current});
        return nq;
      });
    }
    setTimeout(() => {
      setExitAnim(null); setFlipped(false);
      if (idx+1>=queue.length) {
        const xpEarned=Math.round(stats.knew*10*xpMult);
        onDone({ mode:"flashcard", correct:stats.knew+(knew?1:0),
          wrong:stats.didnt+(knew?0:1), total:pool.length, xpEarned });
        setDone(true);
      } else { setIdx(i=>i+1); }
    }, 280);
  }

  return (
    <div style={S.col(14)}>
      <div style={S.row({ justifyContent:"space-between" })}>
        <div style={S.col(2,{gap:2})}>
          <div style={{ fontSize:11, color:T.tx3, fontFamily:"'DM Mono',monospace",
            textTransform:"uppercase", letterSpacing:"1px" }}>
            Fiszki · {direction==="en-pl"?"EN→PL":"PL→EN"} · {idx+1}/{queue.length}
          </div>
          <div style={S.row({gap:8})}>
            <span style={{fontSize:11,color:T.green}}>✓ {stats.knew}</span>
            <span style={{fontSize:11,color:T.red}}>✗ {stats.didnt}</span>
          </div>
        </div>
        <button onClick={onExit} style={S.btn("ghost",true)}>✕ Zakończ</button>
      </div>

      <div style={{ height:4, background:T.s3, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${progress}%`,
          background:`linear-gradient(90deg,${T.acc2},${T.acc})`, borderRadius:2, transition:"width .4s" }} />
      </div>

      <div onClick={!flipped?()=>setFlipped(true):undefined}
        style={{ ...S.card({ minHeight:200,
          cursor:flipped?"default":"pointer", userSelect:"none",
          transform:exitAnim==="knew"?"translateX(80px)":exitAnim==="didnt"?"translateX(-80px)":"none",
          opacity:exitAnim?0:1,
          transition:exitAnim?"all .25s ease":"border-color .2s",
          border:`1px solid ${flipped?T.acc2:T.b1}` }),
          display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", textAlign:"center", gap:12 }}>

        <div style={{ fontSize:10, color:T.tx3, fontFamily:"'DM Mono',monospace",
          textTransform:"uppercase", letterSpacing:"1.5px" }}>
          {flipped?(direction==="en-pl"?"Polski":"Angielski"):(direction==="en-pl"?"Angielski":"Polski")}
        </div>

        {/* Typ gramatyczny */}
        {current.grammarType && GRAMMAR_TYPES[current.grammarType] && (
          <span style={{ ...S.badge(GRAMMAR_TYPES[current.grammarType].color,{fontSize:10}), alignSelf:"center" }}>
            {GRAMMAR_TYPES[current.grammarType].icon} {GRAMMAR_TYPES[current.grammarType].label}
          </span>
        )}

        <div style={{ fontFamily:"'DM Serif Display',serif",
          fontSize:"clamp(28px,7vw,48px)", letterSpacing:-0.5, lineHeight:1.1,
          color:flipped?T.tx2:T.tx }}>
          {front}
        </div>

        {!flipped && (
          <div style={{ fontSize:13, color:T.tx3, marginTop:4 }}>Dotknij aby odkryć →</div>
        )}

        {flipped && (
          <div style={{ borderTop:`1px solid ${T.b1}`, paddingTop:14, width:"100%" }}>
            <div style={{ fontFamily:"'DM Serif Display',serif",
              fontSize:"clamp(24px,6vw,40px)", color:T.acc, letterSpacing:-0.5, lineHeight:1.15 }}>
              {back}
            </div>
            {backForms && (
              <div style={{ marginTop:8, fontFamily:"'DM Mono',monospace", fontSize:14, color:T.tx3 }}>
                {backForms}
              </div>
            )}
            {backExample && (
              <div style={{ marginTop:8, fontSize:12, color:T.tx3, fontStyle:"italic" }}>
                {backExample}
              </div>
            )}
          </div>
        )}
      </div>

      {flipped ? (
        <div style={S.col(10)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <button onClick={() => respond(false)}
              style={{ background:`${T.red}12`, border:`1.5px solid ${T.red}50`,
                borderRadius:T.r2, padding:"16px 12px", cursor:"pointer",
                display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <span style={{fontSize:28}}>😕</span>
              <span style={{fontSize:14,fontWeight:700,color:T.red}}>Nie wiedziałem</span>
              <span style={{fontSize:11,color:T.tx3}}>Wróci do powtórki</span>
            </button>
            <button onClick={() => respond(true)}
              style={{ background:`${T.green}12`, border:`1.5px solid ${T.green}50`,
                borderRadius:T.r2, padding:"16px 12px", cursor:"pointer",
                display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <span style={{fontSize:28}}>😊</span>
              <span style={{fontSize:14,fontWeight:700,color:T.green}}>Wiedziałem!</span>
              <span style={{fontSize:11,color:T.tx3}}>+XP · do przodu</span>
            </button>
          </div>
          <SynonymPanel word={current} ctx={ctx} />
        </div>
      ) : (
        <button onClick={() => setFlipped(true)}
          style={{ ...S.btn("primary"), width:"100%", justifyContent:"center", fontSize:15, padding:"14px" }}>
          Odkryj odpowiedź
        </button>
      )}

      <div style={{ textAlign:"center", fontSize:11, color:T.tx3 }}>
        {!flipped?"Spacja = odkryj":"← Nie wiedziałem  ·  Wiedziałem →"}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 13. QUIZ SESSION
//  Wpisywanie, wybór, TTS, test — z oceną AI
// ════════════════════════════════════════════════════════════

function QuizSession({ config, ctx, onDone, onExit }) {
  const { mode, pool, xpMult=1, setId, direction="en-pl" } = config;
  const isChoiceMode = mode==="choice";
  const [queue, setQueue] = useState(() => [...pool]);
  const [idx, setIdx]     = useState(0);
  const [phase, setPhase] = useState("input");
  const [evaluation, setEvaluation] = useState(null);
  const [inputVal, setInputVal]   = useState("");
  const [formsVal, setFormsVal]   = useState({ past:"", pp:"" });
  const [hintLevel, setHintLevel] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct:0, partial:0, wrong:0 });
  const [choices, setChoices] = useState([]);
  const [done, setDone] = useState(false);
  const inputRef = useRef();

  const current = queue[idx];
  const progress = Math.round((idx/Math.max(queue.length,1))*100);
  const hasKey = !!getGeminiKey(ctx.currentUser?.id);

  const promptText  = current?(direction==="en-pl"?current.en:current.pl):"";
  const answerField = direction==="en-pl"?current?.pl:current?.en;
  const inputLabel  = direction==="en-pl"?"Polskie znaczenie":"Angielskie słowo";
  const inputPlaceholder = direction==="en-pl"?"Wpisz polskie tłumaczenie…":"Write in English…";

  useEffect(() => {
    if (!isChoiceMode||!current) return;
    const others = shuffle(ctx.data.items.filter(w=>w.id!==current.id&&w.status==="approved")).slice(0,3);
    setChoices(shuffle([current,...others]).map(w=>direction==="en-pl"?w.pl:w.en));
  }, [idx, mode, direction]);

  useEffect(() => {
    if (mode==="tts"&&current) {
      setTimeout(() => {
        const u=new SpeechSynthesisUtterance(current.en); u.lang="en-US"; u.rate=0.85;
        window.speechSynthesis?.speak(u);
      }, 300);
    }
  }, [idx, mode]);

  useEffect(() => { if(inputRef.current&&phase==="input") inputRef.current.focus(); }, [idx,phase]);

  const hasForms = !!(current?.forms) && mode!=="tts" && !isChoiceMode && direction==="en-pl";

  function getHint() {
    if (!current||hintLevel===0) return null;
    return current.pl.split("/")[0].trim().slice(0,hintLevel)+"…";
  }

  async function check(choiceVal=null) {
    if (phase!=="input") return;
    const ans = choiceVal!==null ? choiceVal : inputVal;
    if (!ans.trim()&&!choiceVal) return;
    setPhase("evaluating");

    let result;
    if (isChoiceMode) {
      const correct = normPL(ans)===normPL(answerField)||
        (answerField||"").split("/").map(a=>normPL(a.trim())).includes(normPL(ans));
      result = { quality:correct?"full":"wrong", feedback:correct?"Poprawnie!":"Błąd.",
        suggestion:answerField||"", source:"local" };
    } else if (direction==="pl-en") {
      const lm = localMatch(ans, current.en);
      if (lm==="full")    result={quality:"full",   feedback:"Idealnie!",       suggestion:current.en, source:"local"};
      else if(lm==="typo")result={quality:"partial", feedback:"Literówka!",     suggestion:current.en, source:"local"};
      else                result={quality:"wrong",   feedback:`Poprawnie: ${current.en}`, suggestion:current.en, source:"local"};
    } else {
      result = await evaluateAnswer({
        wordEN:current.en, wordPL:current.pl, userAnswer:ans,
        forms:current.forms||null, formsAnswer:hasForms?formsVal:null,
        userId:ctx.currentUser?.id,
      });
    }

    setEvaluation({ ...result, userAnswer:ans, formsAnswer:hasForms?{...formsVal}:null });
    setPhase("result");

    const isCorrect = result.quality==="full"||result.quality==="partial";
    setSessionStats(s => ({
      correct: s.correct+(result.quality==="full"?1:0),
      partial: s.partial+(result.quality==="partial"?1:0),
      wrong:   s.wrong+(result.quality==="wrong"?1:0),
    }));
    ctx.updateProgress(current.id, { correct:isCorrect });

    if (mode==="session"&&!isCorrect) {
      setQueue(q => {
        const nq=[...q];
        const ri=Math.min(idx+2+Math.floor(Math.random()*3),nq.length);
        nq.splice(ri,0,{...current});
        return nq;
      });
    }
  }

  function next() {
    if (idx+1>=queue.length) { finish(); return; }
    setIdx(i=>i+1); setPhase("input"); setEvaluation(null);
    setInputVal(""); setFormsVal({past:"",pp:""}); setHintLevel(0);
  }

  function finish() {
    const xpEarned = Math.round((sessionStats.correct+sessionStats.partial*0.7)*10*xpMult);
    onDone({ mode, correct:sessionStats.correct, partial:sessionStats.partial,
      wrong:sessionStats.wrong, total:queue.length, xpEarned, setId });
    setDone(true);
  }

  if (done) return null;
  if (!current) { finish(); return null; }

  const modeLabels = { typing:"Wpisywanie", choice:"Quiz wyboru", tts:"Ze słuchu",
    session:"Sesja do zaliczenia", test:"Sprawdzian" };
  const qColor = evaluation?(evaluation.quality==="full"?T.green:evaluation.quality==="partial"?T.acc:T.red):T.b1;
  const qBg    = evaluation?(evaluation.quality==="full"?`${T.green}08`:evaluation.quality==="partial"?`${T.acc}08`:`${T.red}08`):T.s1;
  const qIcon  = evaluation?(evaluation.quality==="full"?"✓":evaluation.quality==="partial"?"≈":"✗"):"";
  const qLabel = evaluation?(evaluation.quality==="full"?"Poprawnie!":evaluation.quality==="partial"?"Prawie dobrze":"Błąd"):"";
  const hint = getHint();

  return (
    <div style={S.col(14)}>
      <div style={S.row({ justifyContent:"space-between" })}>
        <div style={S.col(2,{gap:2})}>
          <div style={{ fontSize:11, color:T.tx3, fontFamily:"'DM Mono',monospace",
            textTransform:"uppercase", letterSpacing:"1px" }}>
            {modeLabels[mode]} · {idx+1}/{queue.length}
          </div>
          <div style={S.row({gap:8})}>
            <span style={{fontSize:11,color:T.green}}>✓ {sessionStats.correct}</span>
            <span style={{fontSize:11,color:T.acc}}>≈ {sessionStats.partial}</span>
            <span style={{fontSize:11,color:T.red}}>✗ {sessionStats.wrong}</span>
            {hasKey && <span style={{fontSize:10,color:T.tx3,fontFamily:"'DM Mono',monospace"}}>AI ✦</span>}
          </div>
        </div>
        <button onClick={onExit} style={S.btn("ghost",true)}>✕ Zakończ</button>
      </div>

      <div style={{ height:4, background:T.s3, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${progress}%`,
          background:`linear-gradient(90deg,${T.acc2},${T.acc})`, borderRadius:2, transition:"width .4s" }} />
      </div>

      {/* Karta pytania */}
      <div style={{ ...S.card({ textAlign:"center",
        background:phase==="result"?qBg:T.s1,
        border:`1px solid ${phase==="result"?qColor:T.b1}`, transition:"all .25s" }) }}>
        <div style={{ fontSize:10, color:T.tx3, fontFamily:"'DM Mono',monospace",
          textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:10 }}>
          {mode==="tts"?"Ze słuchu":direction==="en-pl"?"Angielski → Polski":"Polski → Angielski"}
        </div>

        {mode==="tts" ? (
          <div>
            <button onClick={() => { const u=new SpeechSynthesisUtterance(current.en);
              u.lang="en-US"; u.rate=0.85; window.speechSynthesis?.speak(u); }}
              style={{ fontSize:52, background:"none", border:"none", cursor:"pointer",
                display:"block", margin:"0 auto 6px" }}>🔊</button>
            <div style={{ fontSize:11, color:T.tx3 }}>Dotknij aby posłuchać ponownie</div>
          </div>
        ) : (
          <div>
            {current.grammarType && GRAMMAR_TYPES[current.grammarType] && (
              <span style={{ ...S.badge(GRAMMAR_TYPES[current.grammarType].color,{fontSize:10}), marginBottom:8, display:"inline-flex" }}>
                {GRAMMAR_TYPES[current.grammarType].icon} {GRAMMAR_TYPES[current.grammarType].label}
              </span>
            )}
            <div style={{ fontFamily:"'DM Serif Display',serif",
              fontSize:"clamp(26px,6vw,44px)", letterSpacing:-0.5, lineHeight:1.1 }}>
              {promptText}
            </div>
          </div>
        )}

        {hint && phase==="input" && (
          <div style={{ marginTop:8, fontFamily:"'DM Mono',monospace", fontSize:16, color:T.acc, letterSpacing:2 }}>
            {hint}
          </div>
        )}

        {phase==="evaluating" && (
          <div style={{ marginTop:16, display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:T.tx3 }}>
            <div style={{ width:16, height:16, border:`2px solid ${T.b2}`, borderTopColor:T.acc2,
              borderRadius:"50%", animation:"spin 1s linear infinite" }} />
            <span style={{fontSize:13}}>Oceniam odpowiedź…</span>
          </div>
        )}

        {phase==="result" && evaluation && (
          <div style={{ marginTop:16 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 16px",
              background:`${qColor}18`, border:`1px solid ${qColor}40`, borderRadius:10, marginBottom:10 }}>
              <span style={{fontSize:18,color:qColor}}>{qIcon}</span>
              <span style={{fontSize:14,fontWeight:700,color:qColor}}>{qLabel}</span>
              {evaluation.source==="ai" && <span style={{fontSize:10,color:T.tx3,fontFamily:"'DM Mono',monospace"}}>AI</span>}
            </div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",marginBottom:4}}>Twoja odpowiedź</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:15,color:evaluation.quality==="wrong"?T.red:T.tx,padding:"6px 12px",background:T.s3,borderRadius:6,display:"inline-block"}}>
                {evaluation.userAnswer||"—"}
              </div>
            </div>
            <div style={{marginBottom:evaluation.feedback?8:0}}>
              <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",marginBottom:4}}>Poprawna odpowiedź</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:15,color:T.green,padding:"6px 12px",background:`${T.green}10`,borderRadius:6,display:"inline-block"}}>
                {answerField}
              </div>
            </div>
            {current.forms && (
              <div style={{marginTop:8}}>
                <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",marginBottom:4}}>Formy czasownika</div>
                <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                  {[{label:"Past",correct:current.forms.past,given:evaluation.formsAnswer?.past},
                    {label:"PP",  correct:current.forms.pp,  given:evaluation.formsAnswer?.pp}].map(f => {
                    const fOk = f.given?localMatch(f.given,f.correct)!=="none":false;
                    return (
                      <div key={f.label} style={{textAlign:"center"}}>
                        <div style={{fontSize:10,color:T.tx3,marginBottom:2}}>{f.label}</div>
                        {f.given && <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:fOk?T.green:T.red,textDecoration:fOk?"none":"line-through",marginBottom:1}}>{f.given}</div>}
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:T.green,background:`${T.green}10`,padding:"3px 8px",borderRadius:5}}>{f.correct}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {evaluation.feedback && evaluation.quality!=="full" && (
              <div style={{marginTop:10,fontSize:12,color:T.tx2,fontStyle:"italic",padding:"6px 12px",background:T.s3,borderRadius:6}}>
                💬 {evaluation.feedback}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pole odpowiedzi */}
      {phase==="input" && (
        <div style={S.card()}>
          {isChoiceMode ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {choices.map((c,i) => (
                <button key={i} onClick={() => check(c)}
                  style={{ background:T.s2, border:`1.5px solid ${T.b2}`, borderRadius:T.r,
                    padding:"14px 10px", cursor:"pointer", fontFamily:"'DM Mono',monospace",
                    fontSize:13, color:T.tx, textAlign:"center", lineHeight:1.3 }}>
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <div style={S.col(10)}>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <label style={S.label}>{inputLabel}</label>
                  {direction==="en-pl" && (
                    <button onClick={() => setHintLevel(l=>Math.min(l+1,5))}
                      style={{background:"none",border:`1px solid ${T.b2}`,borderRadius:6,
                        padding:"2px 8px",fontSize:11,color:T.tx3,cursor:"pointer"}}>
                      💡 Podpowiedź
                    </button>
                  )}
                </div>
                <input ref={inputRef} style={S.input()} value={inputVal}
                  onChange={e=>setInputVal(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&check()}
                  placeholder={hint?`Zaczyna się od: ${hint}`:inputPlaceholder}
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              </div>
              {hasForms && (
                <div>
                  <label style={S.label}>Formy czasownika</label>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <label style={{...S.label,color:T.tx3}}>Past</label>
                      <input style={S.input()} value={formsVal.past}
                        onChange={e=>setFormsVal(v=>({...v,past:e.target.value}))}
                        onKeyDown={e=>e.key==="Enter"&&check()} placeholder="np. went" autoComplete="off" spellCheck={false} />
                    </div>
                    <div>
                      <label style={{...S.label,color:T.tx3}}>Past Participle</label>
                      <input style={S.input()} value={formsVal.pp}
                        onChange={e=>setFormsVal(v=>({...v,pp:e.target.value}))}
                        onKeyDown={e=>e.key==="Enter"&&check()} placeholder="np. gone" autoComplete="off" spellCheck={false} />
                    </div>
                  </div>
                </div>
              )}
              <button onClick={() => check()} style={{...S.btn("primary"),alignSelf:"flex-end",minWidth:100}}>
                Sprawdź →
              </button>
            </div>
          )}
        </div>
      )}

      {phase==="result" && (
        <div style={S.col(8)}>
          <div style={S.row({justifyContent:"center",gap:10})}>
            {mode==="test"&&evaluation?.quality==="wrong" ? (
              <button onClick={finish} style={S.btn("danger")}>Zakończ test</button>
            ) : (
              <button onClick={next} style={S.btn("primary")}>
                {idx+1>=queue.length?"Zakończ 🎉":"Następne →"}
              </button>
            )}
          </div>
          <SynonymPanel word={current} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 14. SYNONYM PANEL
// ════════════════════════════════════════════════════════════

function SynonymPanel({ word, ctx, autoOpen=false }) {
  const [open, setOpen]       = useState(autoOpen);
  const [loading, setLoading] = useState(autoOpen);
  const [results, setResults] = useState([]);
  const [checked, setChecked] = useState({});
  const [added, setAdded]     = useState(false);
  const [offline, setOffline] = useState(false);

  const userId = ctx.currentUser?.id;
  const hasKey = !!getGeminiKey(userId);

  useEffect(() => { if(autoOpen) doLoad(); }, []);

  async function doLoad() {
    setLoading(true); setOffline(false);
    try {
      const syns = await lookupSynonyms(word.en, userId);
      setResults(syns);
      if (!syns.length&&!navigator.onLine) setOffline(true);
    } catch { setOffline(true); }
    setLoading(false);
  }

  async function load() {
    if (results.length) { setOpen(o=>!o); return; }
    setOpen(true); await doLoad();
  }

  function addSelected() {
    const toAdd = results.filter(r=>checked[r.word]).map(r => ({
      en:r.word, pl:r.pl||"", grammarType:"other", topic:"unset",
      forms:null, example:null, example_pl:null,
      status:"approved", source:"synonym",
    }));
    if (!toAdd.length) return;
    ctx.addItems(toAdd);
    setAdded(true); setChecked({});
    setTimeout(()=>setAdded(false),2000);
  }

  const typeColors = { synonym:T.acc2, related:T.purple, similar:T.blue };
  const typeLabels = { synonym:"synonim", related:"pokrewne", similar:"podobne" };
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <button onClick={load}
        style={{ ...S.btn("ghost",true), width:"100%", justifyContent:"center", gap:6 }}>
        🔍 Zobacz synonimy i słowa pokrewne
      </button>

      {open && (
        <div style={{ ...S.card({marginTop:8}), borderColor:T.acc2 }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:600}}>
              Słowa pokrewne do: <span style={{color:T.acc,fontFamily:"'DM Mono',monospace"}}>{word.en}</span>
            </div>
            <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:16}}>✕</button>
          </div>

          {loading && (
            <div style={S.row({justifyContent:"center",gap:8,padding:"16px 0",color:T.tx3})}>
              <div style={{width:14,height:14,border:`2px solid ${T.b2}`,borderTopColor:T.acc2,borderRadius:"50%",animation:"spin 1s linear infinite"}} />
              <span style={{fontSize:13}}>Szukam…</span>
            </div>
          )}

          {!loading && (results.length===0||offline) && (
            <div style={S.col(8,{padding:"8px 0"})}>
              {offline ? (
                <div style={{fontSize:13,color:T.acc3,textAlign:"center"}}>
                  📡 Brak połączenia z internetem.
                </div>
              ) : (
                <div style={{fontSize:13,color:T.tx3,textAlign:"center"}}>
                  Brak synonimów dla tego słowa.
                  {!hasKey && <div style={{fontSize:11,marginTop:4}}>Dodaj klucz Gemini dla tłumaczeń PL.</div>}
                </div>
              )}
              <button onClick={doLoad} style={{...S.btn("ghost",true),alignSelf:"center"}}>↺ Spróbuj ponownie</button>
            </div>
          )}

          {!loading && results.length>0 && (
            <>
              <div style={S.col(6)}>
                {results.map(r => {
                  const alreadyIn = ctx.data.items.some(w=>norm(w.en)===norm(r.word));
                  return (
                    <label key={r.word}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",
                        background:checked[r.word]?`${T.acc2}12`:T.s2,borderRadius:8,
                        cursor:alreadyIn?"default":"pointer",
                        border:`1px solid ${checked[r.word]?T.acc2:T.b1}`,transition:"all .1s"}}>
                      <input type="checkbox" checked={!!checked[r.word]} disabled={alreadyIn}
                        onChange={() => !alreadyIn&&setChecked(c=>({...c,[r.word]:!c[r.word]}))}
                        style={{accentColor:T.acc2,width:15,height:15,flexShrink:0}} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:500}}>{r.word}</span>
                          <span style={S.badge(typeColors[r.type]||T.tx3,{fontSize:9})}>{typeLabels[r.type]||r.type}</span>
                          {alreadyIn && <span style={{fontSize:10,color:T.green}}>✓ w bazie</span>}
                        </div>
                        {r.pl && <div style={{fontSize:12,color:T.tx2,marginTop:1}}>{r.pl}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
              {checkedCount>0 && (
                <button onClick={addSelected}
                  style={{...S.btn("primary"),width:"100%",justifyContent:"center",marginTop:10}}>
                  {added?"✓ Dodano!":`Dodaj zaznaczone (${checkedCount})`}
                </button>
              )}
              {!hasKey && (
                <div style={{fontSize:11,color:T.tx3,marginTop:8,textAlign:"center"}}>
                  💡 Dodaj klucz Gemini (kliknij swoje imię) aby uzyskać tłumaczenia PL
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 15. LIBRARY TAB
//  Baza słów z filtrami: temat, typ gramatyczny, czas, zbiór
// ════════════════════════════════════════════════════════════

function LibraryTab({ ctx }) {
  const { data, currentUser, getProgress } = ctx;
  const [search, setSearch]         = useState("");
  const [filterTopic, setFilterTopic]   = useState("all");
  const [filterGrammar, setFilterGrammar] = useState("all");
  const [filterTime, setFilterTime]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSet, setFilterSet]     = useState("all");
  const [editing, setEditing]         = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAssignSet, setShowAssignSet] = useState(false);
  const [expandSynonym, setExpandSynonym] = useState(null);
  const [showFilters, setShowFilters]   = useState(false);

  const canEdit = isAdmin(currentUser)||isTeacher(currentUser);

  function getItemStatus(item) {
    if (item.status==="pending") return { label:"Oczekuje", color:T.acc };
    const p = getProgress(item.id);
    if (p.score<0)                  return { label:"Trudne",  color:T.red };
    if (p.score===0&&!p.lastSeen)   return { label:"Nowe",    color:T.tx3 };
    if (p.score>=4)                 return { label:"Znam",    color:T.green };
    return { label:"Uczę się", color:T.acc2 };
  }

  const filtered = useMemo(() => data.items.filter(item => {
    const q = search.toLowerCase();
    const mq = !q || item.en.toLowerCase().includes(q) || item.pl.toLowerCase().includes(q);
    const mt = filterTopic==="all"   || item.topic===filterTopic;
    const mg = filterGrammar==="all" || item.grammarType===filterGrammar;
    const ms = filterStatus==="all"  || getItemStatus(item).label===filterStatus;
    const mtime = matchesTimeFilter(item.addedAt, filterTime);
    const mset = filterSet==="all"   || (item.sets||[]).includes(filterSet);
    return mq && mt && mg && ms && mtime && mset;
  }), [data.items, search, filterTopic, filterGrammar, filterStatus, filterTime, filterSet, data.progress]);

  function toggleSelect(id) {
    setSelectedIds(s => s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  }

  // Zlicz aktywne filtry
  const activeFilterCount = [filterTopic,filterGrammar,filterTime,filterStatus,filterSet].filter(f=>f!=="all").length;

  return (
    <div style={S.col(12)}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, letterSpacing:-0.5 }}>Baza słów</div>

      {/* Szukaj + filtry */}
      <div style={S.col(8)}>
        <div style={S.row({gap:8})}>
          <input style={{...S.input(),flex:1}} value={search}
            onChange={e=>setSearch(e.target.value)} placeholder="🔍  Szukaj…" />
          <button onClick={()=>setShowFilters(f=>!f)}
            style={{...S.btn(activeFilterCount>0?"primary":"ghost",true),
              position:"relative", flexShrink:0}}>
            🔽 Filtry{activeFilterCount>0?` (${activeFilterCount})`:""}
          </button>
        </div>

        {showFilters && (
          <div style={S.card2({ borderColor:T.acc2 })}>
            <div style={{ fontSize:11, color:T.acc2, fontFamily:"'DM Mono',monospace",
              textTransform:"uppercase", letterSpacing:"1px", marginBottom:10 }}>Filtry</div>
            <div style={S.col(10)}>
              {/* Temat */}
              <div>
                <label style={S.label}>Temat tematyczny</label>
                <select value={filterTopic} onChange={e=>setFilterTopic(e.target.value)}
                  style={{...S.input(),cursor:"pointer"}}>
                  <option value="all">Wszystkie tematy</option>
                  {Object.entries(TOPICS).map(([k,v]) => (
                    <option key={k} value={k}>{v.icon} {v.label} ({data.items.filter(w=>w.topic===k).length})</option>
                  ))}
                </select>
              </div>
              {/* Typ gramatyczny */}
              <div>
                <label style={S.label}>Typ gramatyczny</label>
                <select value={filterGrammar} onChange={e=>setFilterGrammar(e.target.value)}
                  style={{...S.input(),cursor:"pointer"}}>
                  <option value="all">Wszystkie typy</option>
                  {Object.entries(GRAMMAR_TYPES).map(([k,v]) => (
                    <option key={k} value={k}>{v.icon} {v.label} ({data.items.filter(w=>w.grammarType===k).length})</option>
                  ))}
                </select>
              </div>
              {/* Czas */}
              <div>
                <label style={S.label}>Czas dodania</label>
                <select value={filterTime} onChange={e=>setFilterTime(e.target.value)}
                  style={{...S.input(),cursor:"pointer"}}>
                  <option value="all">Wszystkie czasy</option>
                  <option value="today">Dziś</option>
                  <option value="week">Ostatnie 7 dni</option>
                  <option value="month">Ostatnie 30 dni</option>
                </select>
              </div>
              {/* Zbiór */}
              {data.sets.length>0 && (
                <div>
                  <label style={S.label}>Zbiór zadaniowy</label>
                  <select value={filterSet} onChange={e=>setFilterSet(e.target.value)}
                    style={{...S.input(),cursor:"pointer"}}>
                    <option value="all">Wszystkie zbiory</option>
                    {data.sets.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Status */}
              <div>
                <label style={S.label}>Status nauki</label>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                  style={{...S.input(),cursor:"pointer"}}>
                  {["all","Nowe","Oczekuje","Uczę się","Znam","Trudne"].map(s => (
                    <option key={s} value={s}>{s==="all"?"Wszystkie statusy":s}</option>
                  ))}
                </select>
              </div>
              {activeFilterCount>0 && (
                <button onClick={() => { setFilterTopic("all"); setFilterGrammar("all");
                  setFilterTime("all"); setFilterStatus("all"); setFilterSet("all"); }}
                  style={{...S.btn("ghost",true),alignSelf:"flex-start"}}>
                  ✕ Wyczyść filtry
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pasek akcji */}
      <div style={S.row({justifyContent:"space-between"})}>
        <div style={{fontSize:13,color:T.tx3}}>{filtered.length} / {data.items.length} pozycji</div>
        <div style={S.row({gap:6})}>
          {canEdit && <button style={S.btn("ghost",true)} onClick={()=>setShowAdd(true)}>+ Dodaj</button>}
          {canEdit && <button style={S.btn("ghost",true)} onClick={()=>setShowImport(true)}>⬆ Import CSV</button>}
        </div>
      </div>

      {/* Pasek zaznaczenia */}
      {selectedIds.length>0 && (
        <div style={S.card2({background:`${T.acc}10`,border:`1px solid ${T.acc}`,
          display:"flex",justifyContent:"space-between",alignItems:"center"})}>
          <div style={{fontSize:13,color:T.acc}}>Zaznaczono: {selectedIds.length}</div>
          <div style={S.row({gap:6})}>
            <button style={S.btn("primary",true)} onClick={()=>setShowAssignSet(true)}>
              Dodaj do zbioru
            </button>
            <button style={S.btn("ghost",true)} onClick={()=>setSelectedIds([])}>Odznacz</button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={S.col(4)}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 4px"}}>
          <input type="checkbox"
            checked={selectedIds.length===filtered.length&&filtered.length>0}
            onChange={e=>e.target.checked?setSelectedIds(filtered.map(w=>w.id)):setSelectedIds([])}
            style={{width:16,height:16,accentColor:T.acc}} />
          <div style={{fontSize:10,color:T.tx3,fontFamily:"'DM Mono',monospace",
            textTransform:"uppercase",letterSpacing:"1px"}}>Zaznacz wszystkie</div>
        </div>

        {filtered.map(item => {
          const st = getItemStatus(item);
          const sel = selectedIds.includes(item.id);
          const gramMeta = GRAMMAR_TYPES[item.grammarType];
          const topicMeta = TOPICS[item.topic||"unset"];
          return (
            <div key={item.id}
              style={{background:sel?`${T.acc}08`:T.s1,
                border:`1px solid ${sel?T.acc:T.b1}`,
                borderRadius:T.r,padding:"12px 14px",
                display:"flex",gap:10,alignItems:"flex-start",transition:"all .1s"}}>
              <input type="checkbox" checked={sel} onChange={()=>toggleSelect(item.id)}
                style={{width:16,height:16,marginTop:2,accentColor:T.acc,flexShrink:0}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div>
                    <span style={{fontFamily:"'DM Mono',monospace",fontWeight:500,fontSize:14}}>{item.en}</span>
                    {item.forms && <span style={{fontSize:11,color:T.tx3,fontFamily:"'DM Mono',monospace",marginLeft:6}}>({item.forms.past})</span>}
                  </div>
                  <span style={S.badge(st.color,{flexShrink:0})}>{st.label}</span>
                </div>
                <div style={{fontSize:13,color:T.tx2,marginTop:2}}>{item.pl}</div>
                {item.example_pl && (
                  <div style={{fontSize:11,color:T.tx3,marginTop:3,fontStyle:"italic"}}>„{item.example_pl}"</div>
                )}
                <div style={{...S.row({gap:4,marginTop:6,flexWrap:"wrap"})}}>
                  {gramMeta && <span style={S.badge(gramMeta.color,{fontSize:9})}>{gramMeta.icon} {gramMeta.label}</span>}
                  {topicMeta && item.topic!=="unset" && <span style={S.badge(topicMeta.color,{fontSize:9})}>{topicMeta.icon} {topicMeta.label}</span>}
                  {(item.sets||[]).map(setId => {
                    const s = data.sets.find(x=>x.id===setId);
                    return s ? <span key={setId} style={S.badge(T.acc3,{fontSize:9})}>📋 {s.name}</span> : null;
                  })}
                </div>
              </div>
              {canEdit && (
                <div style={S.col(4,{flexShrink:0})}>
                  <button onClick={()=>setEditing({...item})}
                    style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:14}}>✏️</button>
                  <button onClick={()=>{if(confirm("Usunąć?"))ctx.deleteItem(item.id);}}
                    style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:14}}>🗑</button>
                  {item.status==="pending" && (
                    <button onClick={()=>ctx.updateItem(item.id,{status:"approved"})}
                      style={{background:"none",border:"none",color:T.green,cursor:"pointer",fontSize:14}}>✓</button>
                  )}
                  <button onClick={()=>setExpandSynonym(expandSynonym===item.id?null:item.id)}
                    style={{background:"none",border:"none",color:T.acc2,cursor:"pointer",fontSize:14}}>🔍</button>
                </div>
              )}
            </div>
          );
        })}

        {expandSynonym && (() => {
          const w = filtered.find(x=>x.id===expandSynonym);
          return w ? <div key={"syn_"+w.id}><SynonymPanel word={w} ctx={ctx} autoOpen={true} /></div> : null;
        })()}

        {filtered.length===0 && (
          <div style={{textAlign:"center",color:T.tx3,padding:32,fontSize:13}}>
            Brak pozycji pasujących do filtrów
          </div>
        )}
      </div>

      {editing && <EditItemModal item={editing} ctx={ctx}
        onSave={changes=>{ctx.updateItem(editing.id,changes);setEditing(null);ctx.showToast("Zapisano");}}
        onClose={()=>setEditing(null)} />}
      {showAdd && <AddItemModal ctx={ctx}
        onAdd={items=>{ctx.addItems(items);setShowAdd(false);}}
        onClose={()=>setShowAdd(false)} />}
      {showImport && <ImportModal ctx={ctx}
        onAdd={items=>{ctx.addItems(items);setShowImport(false);}}
        onClose={()=>setShowImport(false)} />}
      {showAssignSet && <AssignSetModal ctx={ctx} selectedIds={selectedIds}
        onDone={()=>{setShowAssignSet(false);setSelectedIds([]);}}
        onClose={()=>setShowAssignSet(false)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 16. SETS TAB
//  Zbiory zadaniowe — cykl: Poznaj → Utrwal → Test
// ════════════════════════════════════════════════════════════

function SetsTab({ ctx }) {
  const { data } = ctx;
  const [showCreate, setShowCreate] = useState(false);
  const [activeSetSession, setActiveSetSession] = useState(null);

  if (activeSetSession) {
    return <SetSession config={activeSetSession} ctx={ctx}
      onDone={(r) => { ctx.saveSession(r); setActiveSetSession(null); }}
      onExit={() => setActiveSetSession(null)} />;
  }

  const sets = data.sets;

  const PHASE_META = {
    learn:  { label:"Poznaj nowe",   icon:"🆕", color:T.green,  desc:"Fiszki — pierwsze zetknięcie ze słowami" },
    review: { label:"Utrwal",        icon:"🔄", color:T.acc2,   desc:"Quiz mieszany — nowe i znane słowa" },
    test:   { label:"Test końcowy",  icon:"📝", color:T.acc,    desc:"Sprawdzian z całego zbioru" },
    done:   { label:"Zakończony",    icon:"✅", color:T.tx3,    desc:"Zbiór przetestowany" },
  };

  function startPhase(set, phase) {
    const setItems = data.items.filter(w=>(w.sets||[]).includes(set.id)&&w.status==="approved");
    if (!setItems.length) { ctx.showToast("Brak słów w tym zbiorze"); return; }

    let pool, mode;
    if (phase==="learn") { pool=setItems; mode="flashcard"; }
    else if (phase==="review") { pool=setItems; mode="typing"; }
    else { pool=setItems; mode="typing"; }

    setActiveSetSession({ mode, pool, setId:set.id, xpMult:phase==="test"?2:1.5,
      direction:"en-pl", phase });
  }

  function nextPhase(set) {
    const phases = ["learn","review","test","done"];
    const curr = phases.indexOf(set.phase||"learn");
    const next = phases[Math.min(curr+1, phases.length-1)];
    ctx.updateSet(set.id, { phase:next, status:next==="done"?"done":"active" });
    ctx.showToast(`Faza: ${PHASE_META[next].label}`);
  }

  return (
    <div style={S.col(14)}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, letterSpacing:-0.5 }}>Zbiory</div>
        <button style={S.btn("primary",true)} onClick={()=>setShowCreate(true)}>+ Nowy zbiór</button>
      </div>

      <div style={{ fontSize:12, color:T.tx2, lineHeight:1.8 }}>
        Zbiory to tymczasowe zestawy słów do nauki — np. rozdział podręcznika lub zakres sprawdzianu.
        Cykl: <strong style={{color:T.green}}>Poznaj</strong> → <strong style={{color:T.acc2}}>Utrwal</strong> → <strong style={{color:T.acc}}>Test</strong>.
        Po zakończeniu zbiór można usunąć — słowa zostają w bazie.
      </div>

      {sets.length===0 && (
        <div style={S.card({ borderColor:T.b2, textAlign:"center" })}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, color:T.tx2, marginBottom:6 }}>Brak zbiorów</div>
          <div style={{ fontSize:13, color:T.tx3 }}>
            Utwórz zbiór ręcznie lub zaznacz słowa w Bazie → "Dodaj do zbioru"
          </div>
        </div>
      )}

      {sets.map(set => {
        const setItems = data.items.filter(w=>(w.sets||[]).includes(set.id));
        const approved = setItems.filter(w=>w.status==="approved");
        const phase = set.phase||"learn";
        const phaseMeta = PHASE_META[phase];
        const isDone = phase==="done"||set.status==="done";

        return (
          <div key={set.id} style={S.card({ borderColor:isDone?T.tx3:phaseMeta.color })}>
            {/* Header zbioru */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:600,fontSize:16}}>{set.name}</div>
                <div style={{fontSize:12,color:T.tx3,marginTop:3}}>
                  {approved.length} słów
                  {set.dueDate ? ` · sprawdzian: ${new Date(set.dueDate).toLocaleDateString("pl")}` : ""}
                  {set.createdAt && ` · dodany: ${new Date(set.createdAt).toLocaleDateString("pl")}`}
                </div>
              </div>
              <span style={S.badge(phaseMeta.color)}>{phaseMeta.icon} {phaseMeta.label}</span>
            </div>

            {/* Pasek faz */}
            {!isDone && (
              <div style={{display:"flex",gap:4,marginBottom:14}}>
                {["learn","review","test"].map((p,i) => {
                  const pm = PHASE_META[p];
                  const phases = ["learn","review","test"];
                  const currIdx = phases.indexOf(phase);
                  const isActive = p===phase;
                  const isDonePhase = i<currIdx;
                  return (
                    <div key={p} style={{flex:1,height:4,borderRadius:2,
                      background:isDonePhase?pm.color:isActive?pm.color:T.b2,
                      opacity:isDonePhase?0.4:1}} />
                  );
                })}
              </div>
            )}

            {/* Opis fazy */}
            {!isDone && (
              <div style={{fontSize:12,color:T.tx2,marginBottom:14}}>{phaseMeta.desc}</div>
            )}

            {/* Akcje */}
            <div style={S.row({gap:8,flexWrap:"wrap"})}>
              {!isDone && (
                <button style={{...S.btn("primary"),flex:1,justifyContent:"center"}}
                  onClick={()=>startPhase(set,phase)} disabled={!approved.length}>
                  {phaseMeta.icon} {phaseMeta.label}
                </button>
              )}
              {!isDone && phase!=="learn" && (
                <button style={S.btn("ghost",true)} onClick={()=>startPhase(set,"learn")}>
                  🔄 Od nowa
                </button>
              )}
              {!isDone && (
                <button style={S.btn("success",true)} onClick={()=>nextPhase(set)}>
                  Następna faza →
                </button>
              )}
              {isDone && (
                <div style={{fontSize:13,color:T.green,flex:1}}>✅ Zbiór ukończony</div>
              )}
              <button style={S.btn("ghost",true)}
                onClick={()=>{if(confirm(`Usunąć zbiór "${set.name}"?\n(słowa zostaną w bazie)`))ctx.deleteSet(set.id);}}>
                🗑
              </button>
            </div>

            {/* Podgląd słów */}
            {approved.length>0 && (
              <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:4}}>
                {approved.slice(0,8).map(w => (
                  <span key={w.id} style={S.badge(T.b3,{fontSize:10})}>{w.en}</span>
                ))}
                {approved.length>8 && <span style={{fontSize:11,color:T.tx3}}>+{approved.length-8} więcej</span>}
              </div>
            )}
          </div>
        );
      })}

      {showCreate && <CreateSetModal ctx={ctx}
        onSave={(set)=>{ctx.addSet(set);setShowCreate(false);}}
        onClose={()=>setShowCreate(false)} />}
    </div>
  );
}

// Sesja dla zbioru (FlashcardSession lub QuizSession)
function SetSession({ config, ctx, onDone, onExit }) {
  const { mode, phase } = config;

  function handleDone(result) {
    // Automatycznie przejdź do następnej fazy po teście
    if (config.setId && phase==="test") {
      ctx.updateSet(config.setId, { phase:"done", status:"done" });
      ctx.showToast("Test zakończony! Zbiór ukończony ✅");
    }
    onDone(result);
  }

  if (mode==="flashcard")
    return <FlashcardSession config={config} ctx={ctx} onDone={handleDone} onExit={onExit} />;
  return <QuizSession config={config} ctx={ctx} onDone={handleDone} onExit={onExit} />;
}

// ════════════════════════════════════════════════════════════
//  § 17. MANAGE TAB
// ════════════════════════════════════════════════════════════

function ManageTab({ ctx }) {
  const { data, currentUser, exportData, importData } = ctx;
  const [subTab, setSubTab] = useState("pending");
  const fileRef = useRef();
  const pending = data.items.filter(w=>w.status==="pending");

  const subTabs = [
    { id:"pending", label:`Moderacja${pending.length>0?` (${pending.length})`:""}` },
    ...(isAdmin(currentUser)?[
      { id:"users", label:"Użytkownicy" },
      { id:"api",   label:"🔑 API" },
      { id:"data",  label:"Dane" },
    ]:[]),
  ];

  return (
    <div style={S.col(14)}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, letterSpacing:-0.5 }}>Zarządzanie</div>
      <div style={S.row({gap:6,flexWrap:"wrap"})}>
        {subTabs.map(t => (
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={S.btn(subTab===t.id?"primary":"ghost",true)}>{t.label}</button>
        ))}
      </div>

      {subTab==="pending" && <PendingModeration ctx={ctx} />}
      {subTab==="users"   && isAdmin(currentUser) && <UsersManager ctx={ctx} />}
      {subTab==="api"     && isAdmin(currentUser) && <ApiSettingsPanel ctx={ctx} />}
      {subTab==="data"    && isAdmin(currentUser) && (
        <div style={S.col(12)}>
          <div style={{fontSize:13,color:T.tx2}}>Eksportuj lub importuj bazę danych (backup JSON).</div>
          <button style={S.btn("primary")} onClick={exportData}>⬇ Eksportuj backup JSON</button>
          <button style={S.btn("ghost")} onClick={()=>fileRef.current.click()}>⬆ Importuj backup JSON</button>
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}}
            onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>importData(ev.target.result);r.readAsText(f);}} />
          <div style={{fontSize:11,color:T.tx3,lineHeight:1.7}}>
            Baza: <strong style={{color:T.tx}}>{data.items.length}</strong> pozycji ·{" "}
            <strong style={{color:T.tx}}>{data.sets.length}</strong> zbiorów ·{" "}
            <strong style={{color:T.tx}}>{data.sessions.length}</strong> sesji
          </div>
        </div>
      )}
    </div>
  );
}

function PendingModeration({ ctx }) {
  const pending = ctx.data.items.filter(w=>w.status==="pending");
  if (!pending.length) return (
    <div style={{color:T.tx3,fontSize:13,textAlign:"center",padding:24}}>✓ Wszystkie zatwierdzone</div>
  );
  return (
    <div style={S.col(8)}>
      <div style={{fontSize:13,color:T.tx2}}>{pending.length} pozycji czeka na zatwierdzenie</div>
      {pending.map(w => (
        <div key={w.id} style={S.card()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontWeight:500}}>
                {w.en} <span style={{color:T.tx3}}>→</span> {w.pl}
              </div>
              {w.forms && <div style={{fontSize:12,color:T.tx3,fontFamily:"'DM Mono',monospace",marginTop:2}}>{w.forms.past} · {w.forms.pp}</div>}
              <div style={S.row({gap:4,marginTop:6})}>
                {GRAMMAR_TYPES[w.grammarType] && (
                  <span style={S.badge(GRAMMAR_TYPES[w.grammarType].color,{fontSize:10})}>
                    {GRAMMAR_TYPES[w.grammarType].icon} {GRAMMAR_TYPES[w.grammarType].label}
                  </span>
                )}
              </div>
            </div>
            <div style={S.row({gap:6})}>
              <button style={S.btn("success",true)} onClick={()=>ctx.updateItem(w.id,{status:"approved"})}>✓</button>
              <button style={S.btn("danger",true)} onClick={()=>ctx.deleteItem(w.id)}>✕</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersManager({ ctx }) {
  const { data, currentUser } = ctx;
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div style={S.col(10)}>
      <div style={S.row({justifyContent:"space-between"})}>
        <div style={{fontSize:13,color:T.tx3}}>{data.users.length} użytkowników</div>
        <button style={S.btn("primary",true)} onClick={()=>setShowAdd(true)}>+ Dodaj</button>
      </div>
      {data.users.map(u => (
        <div key={u.id} style={S.card({border:`1px solid ${u.id===currentUser.id?T.acc:T.b1}`})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:600,fontSize:15}}>{u.name} {u.id===currentUser.id&&<span style={{fontSize:11,color:T.acc}}>(Ty)</span>}</div>
              <div style={S.row({gap:4,marginTop:5})}>
                {u.roles.map(r=><span key={r} style={S.badge(ROLE_META[r].color,{fontSize:10})}>{ROLE_META[r].icon} {ROLE_META[r].label}</span>)}
              </div>
              <div style={{fontSize:11,color:T.tx3,marginTop:5,fontFamily:"'DM Mono',monospace"}}>XP: {u.xp||0} · Seria: {u.streak||0} dni</div>
            </div>
            {u.id!==currentUser.id && (
              <button style={S.btn("danger",true)}
                onClick={()=>{if(confirm(`Usunąć ${u.name}?`))ctx.deleteUser(u.id);}}>Usuń</button>
            )}
          </div>
        </div>
      ))}
      {showAdd && <AddUserModal onAdd={p=>{ctx.addUser(p);setShowAdd(false);}} onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

function ApiSettingsPanel({ ctx }) {
  const userId = ctx?.currentUser?.id;
  const [key, setKey] = useState(()=>getGeminiKey(userId));
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const savedKey = getGeminiKey(userId);

  async function verify() {
    setStatus("checking"); setErrorMsg("");
    const r = await verifyGeminiKey(key.trim());
    if (r.ok) { setGeminiKey(key.trim(),userId); setStatus("ok"); }
    else { setStatus("error"); setErrorMsg(r.error); }
  }

  return (
    <div style={S.col(14)}>
      <div style={S.card2({background:savedKey?`${T.green}10`:`${T.acc}10`,border:`1px solid ${savedKey?T.green:T.acc}`})}>
        <div style={S.row({gap:10})}>
          <span style={{fontSize:22}}>{savedKey?"✅":"⚠️"}</span>
          <div>
            <div style={{fontWeight:600,fontSize:14,color:savedKey?T.green:T.acc}}>
              {savedKey?"Gemini AI aktywny":"Brak klucza API"}
            </div>
            <div style={{fontSize:12,color:T.tx2,marginTop:2}}>
              {savedKey?"Ocena AI, synonimy i klasyfikacja działają.":"Tryb lokalny — dopasowanie tekstowe."}
            </div>
          </div>
        </div>
      </div>
      <div>
        <label style={S.label}>Klucz API Gemini</label>
        <div style={S.row({gap:8})}>
          <input style={{...S.input(),flex:1,fontFamily:"'DM Mono',monospace",letterSpacing:show?0:2}}
            type={show?"text":"password"} value={key}
            onChange={e=>{setKey(e.target.value);setStatus(null);}}
            placeholder="AIzaSy… lub AQ.…" autoComplete="off" spellCheck={false} />
          <button style={S.btn("ghost",true)} onClick={()=>setShow(s=>!s)}>{show?"🙈":"👁"}</button>
        </div>
      </div>
      {status==="checking"&&<div style={S.row({gap:8,color:T.tx3,fontSize:13})}>
        <div style={{width:14,height:14,border:`2px solid ${T.b2}`,borderTopColor:T.acc2,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Weryfikuję…</div>}
      {status==="ok"&&<div style={{fontSize:13,color:T.green}}>✓ Klucz poprawny — zapisano!</div>}
      {status==="error"&&<div style={{fontSize:13,color:T.red}}>✗ {errorMsg}</div>}
      <div style={S.row({gap:8})}>
        <button style={S.btn("primary")} onClick={verify} disabled={!key.trim()||status==="checking"}>
          ✓ Zweryfikuj i zapisz
        </button>
        {savedKey&&<button style={S.btn("danger")} onClick={()=>{setKey("");setGeminiKey("",userId);setStatus(null);}}>Usuń klucz</button>}
      </div>

      {/* AI features status */}
      <div style={S.card()}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Funkcje AI</div>
        <div style={S.col(8)}>
          {[
            { icon:"🧠", label:"Ocena odpowiedzi", desc:"Semantyczna ocena — widzę = widzieć ✓", needsKey:true },
            { icon:"🔍", label:"Tłumaczenia synonimów", desc:"Polskie tłumaczenia słów pokrewnych", needsKey:true },
            { icon:"📂", label:"Klasyfikacja tematyczna", desc:"Automatyczne przypisanie tematu przy imporcie", needsKey:true },
            { icon:"⚡", label:"Ocena lokalna", desc:"Zawsze aktywna — Levenshtein + formy PL", needsKey:false },
            { icon:"🔎", label:"Deduplikacja", desc:"Exact + fuzzy match bez AI", needsKey:false },
          ].map(f => (
            <div key={f.label} style={S.row({gap:10,alignItems:"flex-start"})}>
              <span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>{f.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:(!f.needsKey||savedKey)?T.tx:T.tx3}}>
                  {f.label}
                  {f.needsKey&&!savedKey&&<span style={{fontSize:10,color:T.acc3,marginLeft:6}}>wymaga klucza</span>}
                  {(!f.needsKey||savedKey)&&<span style={{fontSize:10,color:T.green,marginLeft:6}}>✓ aktywne</span>}
                </div>
                <div style={{fontSize:11,color:T.tx3,marginTop:1}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  § 18. MODALS
//  Edycja słowa, dodawanie, import CSV, zbiory, użytkownicy
// ════════════════════════════════════════════════════════════

function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:500,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.s1,border:`1px solid ${T.b2}`,
        borderRadius:`${T.r3} ${T.r3} 0 0`,padding:"24px 20px 32px",
        width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",animation:"fadeUp .25s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:20}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.tx2,cursor:"pointer",fontSize:20,lineHeight:1}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditItemModal({ item, ctx, onSave, onClose }) {
  const [w, setW] = useState({...item});
  const hasForms = !!w.forms;
  return (
    <Modal title="Edytuj pozycję" onClose={onClose}>
      <div style={S.col(12)}>
        <div><label style={S.label}>Angielski</label>
          <input style={S.input()} value={w.en} onChange={e=>setW(x=>({...x,en:e.target.value}))} /></div>
        <div><label style={S.label}>Polski</label>
          <input style={S.input()} value={w.pl} onChange={e=>setW(x=>({...x,pl:e.target.value}))} /></div>
        <div><label style={S.label}>Przykład EN</label>
          <input style={S.input()} value={w.example||""} onChange={e=>setW(x=>({...x,example:e.target.value}))} placeholder="Zdanie przykładowe po angielsku" /></div>
        <div><label style={S.label}>Przykład PL</label>
          <input style={S.input()} value={w.example_pl||""} onChange={e=>setW(x=>({...x,example_pl:e.target.value}))} placeholder="Tłumaczenie zdania" /></div>
        <div>
          <label style={S.label}>Typ gramatyczny</label>
          <select value={w.grammarType||"other"} onChange={e=>setW(x=>({...x,grammarType:e.target.value}))}
            style={{...S.input(),cursor:"pointer"}}>
            {Object.entries(GRAMMAR_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Temat tematyczny</label>
          <select value={w.topic||"unset"} onChange={e=>setW(x=>({...x,topic:e.target.value}))}
            style={{...S.input(),cursor:"pointer"}}>
            {Object.entries(TOPICS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div style={S.row()}>
          <label style={{...S.label,marginBottom:0}}>Formy czasownika</label>
          <input type="checkbox" checked={hasForms}
            onChange={e=>setW(x=>({...x,forms:e.target.checked?{past:"",pp:""}:null}))}
            style={{accentColor:T.acc}} />
        </div>
        {hasForms && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={S.label}>Past</label>
              <input style={S.input()} value={w.forms.past}
                onChange={e=>setW(x=>({...x,forms:{...x.forms,past:e.target.value}}))} /></div>
            <div><label style={S.label}>Past Participle</label>
              <input style={S.input()} value={w.forms.pp}
                onChange={e=>setW(x=>({...x,forms:{...x.forms,pp:e.target.value}}))} /></div>
          </div>
        )}
        <div style={S.row({justifyContent:"flex-end"})}>
          <button style={S.btn("ghost")} onClick={onClose}>Anuluj</button>
          <button style={S.btn("primary")} onClick={()=>onSave(w)}>Zapisz</button>
        </div>
      </div>
    </Modal>
  );
}

function AddItemModal({ ctx, onAdd, onClose }) {
  const [form, setForm] = useState({
    en:"", pl:"", grammarType:"noun", topic:"unset",
    hasForms:false, past:"", pp:"",
    example:"", example_pl:"",
  });

  function save() {
    if (!form.en.trim()||!form.pl.trim()) return;
    onAdd([{
      en:form.en.trim().toLowerCase(), pl:form.pl.trim(),
      grammarType:form.grammarType, topic:form.topic,
      forms:form.hasForms&&form.past&&form.pp?{past:form.past,pp:form.pp}:null,
      example:form.example||null, example_pl:form.example_pl||null,
      status:"approved", source:"manual",
    }]);
    onClose();
  }

  return (
    <Modal title="Dodaj pozycję" onClose={onClose}>
      <div style={S.col(12)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={S.label}>Angielski</label>
            <input style={S.input()} value={form.en} onChange={e=>setForm(f=>({...f,en:e.target.value}))} autoFocus /></div>
          <div><label style={S.label}>Polski</label>
            <input style={S.input()} value={form.pl} onChange={e=>setForm(f=>({...f,pl:e.target.value}))} /></div>
        </div>
        <div>
          <label style={S.label}>Typ gramatyczny</label>
          <select value={form.grammarType} onChange={e=>setForm(f=>({...f,grammarType:e.target.value,hasForms:e.target.value==="verb_irregular"}))}
            style={{...S.input(),cursor:"pointer"}}>
            {Object.entries(GRAMMAR_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Temat tematyczny</label>
          <select value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))}
            style={{...S.input(),cursor:"pointer"}}>
            {Object.entries(TOPICS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        {(form.grammarType==="verb_irregular"||form.hasForms) && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={S.label}>Past</label>
              <input style={S.input()} value={form.past} onChange={e=>setForm(f=>({...f,past:e.target.value}))} /></div>
            <div><label style={S.label}>Past Participle</label>
              <input style={S.input()} value={form.pp} onChange={e=>setForm(f=>({...f,pp:e.target.value}))} /></div>
          </div>
        )}
        <div><label style={S.label}>Przykład EN (opcjonalnie)</label>
          <input style={S.input()} value={form.example} onChange={e=>setForm(f=>({...f,example:e.target.value}))} /></div>
        <div><label style={S.label}>Przykład PL (opcjonalnie)</label>
          <input style={S.input()} value={form.example_pl} onChange={e=>setForm(f=>({...f,example_pl:e.target.value}))} /></div>
        <button style={{...S.btn("primary"),width:"100%"}} onClick={save}>Dodaj</button>
      </div>
    </Modal>
  );
}

function ImportModal({ ctx, onAdd, onClose }) {
  const [csvText, setCsvText] = useState("");
  const [grammarType, setGrammarType] = useState("verb_irregular");
  const [topic, setTopic] = useState("unset");
  const [preview, setPreview] = useState([]);

  function parseCSV() {
    const lines = csvText.split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#"));
    return lines.map(line => {
      const p = line.split(",").map(s=>s.trim().replace(/^"|"$/g,""));
      const [en,pl,past,pp,ex,exPl] = p;
      if (!en||!pl) return null;
      const hasForms = past&&pp;
      return {
        en:en.toLowerCase(), pl,
        grammarType: hasForms?"verb_irregular":grammarType,
        topic,
        forms:hasForms?{past,pp}:null,
        example:ex||null, example_pl:exPl||null,
        status:"approved", source:"import",
      };
    }).filter(Boolean);
  }

  function doPreview() { setPreview(parseCSV()); }
  function doImport()  { onAdd(parseCSV()); onClose(); }

  return (
    <Modal title="Import CSV" onClose={onClose}>
      <div style={S.col(12)}>
        <div style={{fontSize:12,color:T.tx3,lineHeight:1.8,fontFamily:"'DM Mono',monospace",background:T.s2,borderRadius:T.r,padding:"10px 14px"}}>
          Format: <strong style={{color:T.tx}}>en,pl,past,pp,przykład_EN,przykład_PL</strong><br/>
          Czasownik: <strong style={{color:T.acc}}>go,iść,went,gone</strong><br/>
          Słowo: <strong style={{color:T.acc}}>beautiful,piękny</strong><br/>
          Ze zdaniem: <strong style={{color:T.acc}}>run,biegać,ran,run,I can run fast.,Mogę szybko biegać.</strong>
        </div>
        <div>
          <label style={S.label}>Domyślny typ (dla słów bez form)</label>
          <select value={grammarType} onChange={e=>setGrammarType(e.target.value)} style={{...S.input(),cursor:"pointer"}}>
            {Object.entries(GRAMMAR_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Temat tematyczny</label>
          <select value={topic} onChange={e=>setTopic(e.target.value)} style={{...S.input(),cursor:"pointer"}}>
            {Object.entries(TOPICS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <textarea style={{...S.input(),minHeight:140,resize:"vertical"}} value={csvText}
          onChange={e=>{setCsvText(e.target.value);setPreview([]);}}
          placeholder={"go,iść,went,gone\nbeautiful,piękny\nrun,biegać,ran,run"} />

        {preview.length>0 && (
          <div style={S.card2()}>
            <div style={{fontSize:12,color:T.acc2,marginBottom:8}}>Podgląd ({preview.length} pozycji):</div>
            {preview.slice(0,5).map((w,i) => (
              <div key={i} style={{fontSize:12,color:T.tx2,fontFamily:"'DM Mono',monospace",marginBottom:3}}>
                {w.en} → {w.pl}{w.forms?` (${w.forms.past}, ${w.forms.pp})`:""}
              </div>
            ))}
            {preview.length>5&&<div style={{fontSize:11,color:T.tx3}}>...i {preview.length-5} więcej</div>}
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center"}} onClick={doPreview}>
            👁 Podgląd
          </button>
          <button style={{...S.btn("primary"),width:"100%",justifyContent:"center"}} onClick={doImport}
            disabled={!csvText.trim()}>
            ⬆ Importuj
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateSetModal({ ctx, onSave, onClose }) {
  const [name, setName]     = useState("");
  const [dueDate, setDueDate] = useState("");
  const approved = ctx.data.items.filter(w=>w.status==="approved");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");

  const filtered = approved.filter(w =>
    !search || w.en.toLowerCase().includes(search.toLowerCase()) || w.pl.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id) { setSelectedIds(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]); }

  function save() {
    if (!name.trim()) return;
    // Przypisz zaznaczone słowa do tego zbioru
    const setId = uid();
    if (selectedIds.length>0) {
      ctx.mutate(d => {
        selectedIds.forEach(id => {
          const item = d.items.find(x=>x.id===id);
          if (item && !(item.sets||[]).includes(setId)) {
            item.sets = [...(item.sets||[]), setId];
          }
        });
      });
    }
    onSave({ id:setId, name:name.trim(), dueDate:dueDate||null,
      phase:"learn", status:"active",
      stats:{ total:selectedIds.length, newItems:0, knownItems:0 } });
  }

  return (
    <Modal title="Utwórz zbiór" onClose={onClose}>
      <div style={S.col(12)}>
        <div><label style={S.label}>Nazwa zbioru</label>
          <input style={S.input()} value={name} onChange={e=>setName(e.target.value)}
            placeholder="Np. Rozdział 4, Sprawdzian 15.06" autoFocus /></div>
        <div><label style={S.label}>Data sprawdzianu (opcjonalnie)</label>
          <input style={S.input()} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></div>

        <div>
          <label style={S.label}>Dodaj słowa do zbioru (opcjonalnie)</label>
          <input style={{...S.input(),marginBottom:8}} value={search}
            onChange={e=>setSearch(e.target.value)} placeholder="🔍 Szukaj słów…" />
          <div style={{maxHeight:200,overflowY:"auto",...S.col(4)}}>
            {filtered.slice(0,30).map(w => (
              <label key={w.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",
                background:selectedIds.includes(w.id)?`${T.acc}10`:T.s2,borderRadius:6,cursor:"pointer",
                border:`1px solid ${selectedIds.includes(w.id)?T.acc:T.b1}`}}>
                <input type="checkbox" checked={selectedIds.includes(w.id)} onChange={()=>toggle(w.id)}
                  style={{accentColor:T.acc,width:14,height:14,flexShrink:0}} />
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:13}}>{w.en}</span>
                <span style={{fontSize:12,color:T.tx2}}>→ {w.pl}</span>
              </label>
            ))}
          </div>
          {selectedIds.length>0&&<div style={{fontSize:12,color:T.acc,marginTop:6}}>Zaznaczono: {selectedIds.length} słów</div>}
        </div>

        <button style={{...S.btn("primary"),width:"100%"}} onClick={save} disabled={!name.trim()}>
          Utwórz zbiór
        </button>
      </div>
    </Modal>
  );
}

function AssignSetModal({ ctx, selectedIds, onDone, onClose }) {
  const [setId, setSetId] = useState("");
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState("existing"); // "existing" | "new"

  function assign() {
    if (mode==="existing"&&!setId) return;
    if (mode==="new"&&!newName.trim()) return;

    let targetSetId = setId;
    if (mode==="new") {
      targetSetId = uid();
      ctx.addSet({ id:targetSetId, name:newName.trim(), dueDate:null,
        phase:"learn", status:"active", stats:{total:selectedIds.length,newItems:0,knownItems:0} });
    }

    ctx.mutate(d => {
      selectedIds.forEach(id => {
        const item = d.items.find(x=>x.id===id);
        if (item && !(item.sets||[]).includes(targetSetId)) {
          item.sets = [...(item.sets||[]), targetSetId];
        }
      });
    });
    ctx.showToast(`Dodano ${selectedIds.length} słów do zbioru`);
    onDone();
  }

  return (
    <Modal title="Dodaj do zbioru" onClose={onClose}>
      <div style={S.col(12)}>
        <div style={{fontSize:13,color:T.tx2}}>Zaznaczono: <strong style={{color:T.acc}}>{selectedIds.length}</strong> słów</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {["existing","new"].map(m => (
            <button key={m} onClick={()=>setMode(m)}
              style={{...S.btn(mode===m?"primary":"ghost",true),justifyContent:"center"}}>
              {m==="existing"?"Istniejący zbiór":"Nowy zbiór"}
            </button>
          ))}
        </div>

        {mode==="existing" && (
          ctx.data.sets.filter(s=>s.status==="active").length>0 ? (
            <select value={setId} onChange={e=>setSetId(e.target.value)} style={{...S.input(),cursor:"pointer"}}>
              <option value="">Wybierz zbiór…</option>
              {ctx.data.sets.filter(s=>s.status==="active").map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <div style={{fontSize:13,color:T.tx3}}>Brak aktywnych zbiorów. Utwórz nowy.</div>
          )
        )}

        {mode==="new" && (
          <div><label style={S.label}>Nazwa nowego zbioru</label>
            <input style={S.input()} value={newName} onChange={e=>setNewName(e.target.value)}
              placeholder="Np. Rozdział 5" autoFocus /></div>
        )}

        <button style={{...S.btn("primary"),width:"100%"}} onClick={assign}
          disabled={(mode==="existing"&&!setId)||(mode==="new"&&!newName.trim())}>
          Dodaj do zbioru
        </button>
      </div>
    </Modal>
  );
}

function AddUserModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ name:"", pin:"", mode:"student" });
  const MODES = [
    { key:"student", roles:["student"],                    label:"Uczeń" },
    { key:"teacher", roles:["teacher"],                    label:"Nauczyciel" },
    { key:"admin",   roles:["admin","teacher","student"],  label:"Administrator" },
  ];
  function save() {
    if (!form.name.trim()||form.pin.length<4) return;
    const roles = MODES.find(m=>m.key===form.mode)?.roles||["student"];
    onAdd({ name:form.name.trim(), pin:form.pin, roles });
    onClose();
  }
  return (
    <Modal title="Dodaj użytkownika" onClose={onClose}>
      <div style={S.col(12)}>
        <div><label style={S.label}>Imię / Nick</label>
          <input style={S.input()} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus /></div>
        <div><label style={S.label}>PIN (min. 4 cyfry)</label>
          <input style={S.input()} type="password" inputMode="numeric" maxLength={8}
            value={form.pin} onChange={e=>setForm(f=>({...f,pin:e.target.value.replace(/\D/g,"")}))} /></div>
        <div>
          <label style={S.label}>Rola</label>
          <div style={S.col(6)}>
            {MODES.map(m => (
              <button key={m.key} onClick={()=>setForm(f=>({...f,mode:m.key}))}
                style={{background:form.mode===m.key?`${T.acc}15`:T.s2,
                  border:`1.5px solid ${form.mode===m.key?T.acc:T.b1}`,
                  borderRadius:T.r,padding:"10px 14px",cursor:"pointer",textAlign:"left",
                  display:"flex",justifyContent:"space-between"}}>
                <span style={{color:form.mode===m.key?T.acc:T.tx,fontSize:14}}>{m.label}</span>
                <div style={S.row({gap:4})}>
                  {m.roles.map(r=><span key={r} style={S.badge(ROLE_META[r].color,{fontSize:10})}>{ROLE_META[r].label}</span>)}
                </div>
              </button>
            ))}
          </div>
        </div>
        <button style={{...S.btn("primary"),width:"100%"}} onClick={save}>Dodaj użytkownika</button>
      </div>
    </Modal>
  );
}

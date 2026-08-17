const { useState, useEffect, useRef, useMemo } = React;

const DAY = 24 * 60 * 60 * 1000;
const LOCALES = { cs: "cs-CZ", en: "en-GB", pl: "pl-PL", es: "es-ES" };
const LANG_NAMES = [
  { id: "cs", label: "Čeština" },
  { id: "en", label: "English" },
  { id: "pl", label: "Polski" },
  { id: "es", label: "Español" },
];

// ================= Helpers =================

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseLocaleNumber(str) {
  if (str === null || str === undefined) return NaN;
  let s = String(str).trim();
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length > 2) s = s.replace(/\./g, "");
  }
  return parseFloat(s);
}

function fmtMoney(n, currency, lang) {
  const sym = { EUR: "€", CZK: "Kč", PLN: "zł" }[currency] || "Kč";
  const decimals = currency === "EUR" ? 2 : 0;
  return `${n.toLocaleString(LOCALES[lang], { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${sym}`;
}

function hourUnitWord(lang, h) {
  if (lang === "cs") return h === 1 ? "hodina" : h >= 2 && h <= 4 ? "hodiny" : "hodin";
  if (lang === "pl") return "godz.";
  if (lang === "es") return "h";
  return null; // signal: use the en hr/h scheme below
}
function workdayUnitWord(lang, n) {
  if (lang === "cs") return n === 1 ? "pracovní den" : n >= 2 && n <= 4 ? "pracovní dny" : "pracovních dní";
  if (lang === "pl") return n === 1 ? "dzień roboczy" : "dni robocze";
  if (lang === "es") return n === 1 ? "día laborable" : "días laborables";
  return n === 1 ? "workday" : "workdays";
}
function yearUnitWord(lang, n) {
  if (lang === "cs") return n === 1 ? "rok" : n >= 2 && n <= 4 ? "roky" : "let";
  if (lang === "pl") return n === 1 ? "rok" : "lat";
  if (lang === "es") return n === 1 ? "año" : "años";
  return n === 1 ? "year" : "years";
}

function fmtDuration(hours, unit, lang) {
  const sign = hours < 0 ? "-" : "";
  const abs = Math.abs(hours);
  if (unit === "minutes") {
    const total = Math.round(abs * 60);
    return { big: sign + total.toLocaleString(LOCALES[lang]), unit: "min" };
  }
  if (unit === "days") {
    const d = abs / 8;
    const r = Math.round(d * 10) / 10;
    const whole = Number.isInteger(r);
    return { big: sign + (whole ? r.toLocaleString(LOCALES[lang]) : r.toFixed(1)), unit: workdayUnitWord(lang, r) };
  }
  // hours -- fall back to a years figure for absurdly large values instead of
  // printing an unreadable multi-digit hour count.
  if (abs >= 24 * 365) {
    const years = abs / (24 * 365);
    const yStr = years.toLocaleString(LOCALES[lang], { maximumFractionDigits: 1 });
    return { big: sign + yStr, unit: yearUnitWord(lang, Math.round(years * 10) / 10) };
  }
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  const hStr = h.toLocaleString(LOCALES[lang]);
  if (h === 0) return { big: sign + String(m), unit: "min" };
  const localWord = hourUnitWord(lang, h);
  if (localWord) {
    if (m === 60) return { big: sign + (h + 1).toLocaleString(LOCALES[lang]), unit: localWord };
    if (m === 0) return { big: sign + hStr, unit: localWord };
    return { big: `${sign}${hStr}:${String(m).padStart(2, "0")}`, unit: localWord };
  }
  if (m === 0) return { big: sign + hStr, unit: "hr" };
  if (m === 60) return { big: sign + (h + 1).toLocaleString(LOCALES[lang]), unit: "hr" };
  return { big: `${sign}${hStr}:${String(m).padStart(2, "0")}`, unit: "h" };
}

function timeLeftStr(ms, lang) {
  if (ms <= 0) return STR[lang].timeUp;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function theme(dark) {
  if (!dark) return {
    bg: "#EDEAE2", surface: "#FFFFFF", surfaceAlt: "#F1EEE6",
    stop: "#C6491F", onStop: "#FFF8F3", stopContainer: "#F6DED0", onStopContainer: "#6E2A0C",
    calm: "#3E6259", onCalm: "#FFFFFF", calmContainer: "#DCE7E2", onCalmContainer: "#1E332D",
    outline: "#DEDAD0", onSurface: "#14171A", onSurfaceVariant: "#5C5850",
    inverseSurface: "#14171A", inverseOnSurface: "#F5F3EF",
    shadow: "0 6px 20px rgba(20,23,26,0.12), 0 1px 3px rgba(20,23,26,0.08)",
    shadowSm: "0 2px 8px rgba(20,23,26,0.10)",
  };
  return {
    bg: "#0C0E10", surface: "#17191C", surfaceAlt: "#1F2225",
    stop: "#E8693F", onStop: "#1B0B02", stopContainer: "#3A1D0E", onStopContainer: "#F5C9AE",
    calm: "#6FA695", onCalm: "#062017", calmContainer: "#1B322B", onCalmContainer: "#BFE0D3",
    outline: "#2B2E31", onSurface: "#F2F0EA", onSurfaceVariant: "#9A968D",
    inverseSurface: "#F2F0EA", inverseOnSurface: "#14171A",
    shadow: "0 8px 24px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)",
    shadowSm: "0 3px 10px rgba(0,0,0,0.35)",
  };
}

// ================= i18n =================

const STR = {
  cs: {
    splashDesc: "Než začneme, řekni mi svou hodinovou sazbu. Pomůže mi to přepočítat ceny na hodiny tvého života, aby ses mohl/a rozhodnout, jestli to za to stojí.",
    continueBtn: "Pokračovat",
    langTitle: "Jazyk",
    currencyTitle: "Měna",
    rateLabel: "Čistá hodinová sazba",
    itemNamePlaceholder: "Přidej název (nepovinné)",
    priceInvalid: "Cena musí být kladné číslo.",
    unitMinutes: "Minuty", unitHours: "Hodiny", unitWorkdays: "Pracovní dny",
    atRatePrefix: "při ",
    notBuying: "Nekupuju", thinkAboutIt: "Nechám si to projít hlavou", worthIt: "Stálo to za to", back: "Zpět",
    thinkPrompt: "Jak dlouho si to chceš nechat projít hlavou?",
    think30: "30 minut", think24: "24 hodin", think3d: "3 dny",
    coolingOffHeader: "Na zvážení", timeUp: "čas vypršel", willBuy: "Přece jen si to koupím",
    navCalculator: "Kalkulačka", navHistory: "Historie",
    streakBanner: (n) => `🔒 ${n} dní bez impulzivního nákupu — tak dál`,
    spentAnyway: "Přesto utraceno", stoppedYourself: "Ušetřeno díky rozvaze", last30days: "posledních 30 dní",
    daysWithoutBuying: "Dní bez nákupu:", longestStreak: "Nejdelší série:",
    investLine: (amount) => `Kdyby ${amount}, které jsi neutratil/a, bylo investováno při 7 % ročně na 10 let, mohlo by z toho být zhruba`,
    followupTitle: "Pořád to stálo za to?",
    followupQuestion: (name) => `Pořád jsi rád/a za ${name}?`,
    followupGlad: "Ano, pořád rád/a", followupRegret: "Ne, mrzí mě to",
    subscriptionsHeader: "Předplatné",
    subNamePlaceholder: "např. Netflix", subPricePlaceholder: "cena/měs", addBtn: "Přidat",
    historyHeader: "Historie", undoLast: "↩ Vrátit poslední rozhodnutí",
    badgeWorthIt: "stálo za to", badgeBought: "koupeno", badgeSkipped: "vynecháno",
    exportCSV: "Exportovat CSV",
    settingsAppearance: "Vzhled", darkMode: "Tmavý režim",
    settingsCurrency: "Měna", currencyHint: "Změna měny mění jen zobrazený symbol — uložené sazby se nepřepočítávají.",
    settingsHourlyRates: "Hodinové sazby", activeTag: "· aktivní", useBtn: "Použít",
    rateNamePlaceholder: "Název, např. Freelance", rateValuePlaceholder: "sazba",
    settingsCategories: "Kategorie", newCategoryPlaceholder: "Nová kategorie",
    categoryDeleteHint: "Smazání kategorie nemění historii — staré položky spadnou pod poslední kategorii v seznamu.",
    settingsLanguage: "Jazyk",
    resetApp: "Resetovat appku", resetConfirm: "Klepni znovu pro potvrzení",
    resetHint: "Smaže všechna data a vrátí tě na úvodní obrazovku.",
    doneBtn: "Hotovo",
    backupHeader: "Záloha", downloadBackup: "Stáhnout zálohu", restoreBackup: "Obnovit ze zálohy",
    backupHint: "Záloha je čitelný JSON soubor se všemi tvými daty.",
    toastDecisionSaved: "Rozhodnutí uloženo", toastAddedCooling: "Přidáno k rozvaze", toastCSVExported: "CSV exportováno",
    toastBackupDownloaded: "Záloha stažena", toastBackupRestored: "Záloha obnovena", toastBackupInvalid: "Neplatný soubor zálohy",
    cat: { jidlo: "Jídlo a pití", obleceni: "Oblečení", elektronika: "Elektronika", krasa: "Krása a péče", domacnost: "Domácnost", zabava: "Zábava", doprava: "Doprava", cestovani: "Cestování", ostatni: "Ostatní" },
  },
  en: {
    splashDesc: "Before we start, tell me your hourly rate. I'll use it to turn prices into hours of your life, so you can decide if it's worth it.",
    continueBtn: "Continue",
    langTitle: "Language",
    currencyTitle: "Currency",
    rateLabel: "Net hourly rate",
    itemNamePlaceholder: "Add a name (optional)",
    priceInvalid: "Price must be a positive number.",
    unitMinutes: "Minutes", unitHours: "Hours", unitWorkdays: "Workdays",
    atRatePrefix: "at ",
    notBuying: "Not buying", thinkAboutIt: "I'll think about it", worthIt: "Worth it", back: "Back",
    thinkPrompt: "How long do you want to sit on it?",
    think30: "30 minutes", think24: "24 hours", think3d: "3 days",
    coolingOffHeader: "Cooling off", timeUp: "time's up", willBuy: "I'll buy it",
    navCalculator: "Calculator", navHistory: "History",
    streakBanner: (n) => `🔒 ${n} days without an impulse buy — keep it up`,
    spentAnyway: "Spent anyway", stoppedYourself: "Stopped yourself", last30days: "last 30 days",
    daysWithoutBuying: "Days without buying:", longestStreak: "Longest streak:",
    investLine: (amount) => `If the ${amount} you didn't spend had been invested at 7% for 10 years, it could be roughly`,
    followupTitle: "Still worth it?",
    followupQuestion: (name) => `Are you still glad about ${name}?`,
    followupGlad: "Yes, still glad", followupRegret: "No, I regret it",
    subscriptionsHeader: "Subscriptions",
    subNamePlaceholder: "e.g. Netflix", subPricePlaceholder: "price/mo", addBtn: "Add",
    historyHeader: "History", undoLast: "↩ Undo last decision",
    badgeWorthIt: "worth it", badgeBought: "bought", badgeSkipped: "skipped",
    exportCSV: "Export CSV",
    settingsAppearance: "Appearance", darkMode: "Dark mode",
    settingsCurrency: "Currency", currencyHint: "Changing currency only changes the symbol shown — saved rate numbers aren't converted.",
    settingsHourlyRates: "Hourly rates", activeTag: "· active", useBtn: "Use",
    rateNamePlaceholder: "Name, e.g. Freelance", rateValuePlaceholder: "rate",
    settingsCategories: "Categories", newCategoryPlaceholder: "New category",
    categoryDeleteHint: "Removing a category doesn't change your history — old entries fall back to the last category on the list.",
    settingsLanguage: "Language",
    resetApp: "Reset app", resetConfirm: "Tap again to confirm",
    resetHint: "Deletes all data and takes you back to the start screen.",
    doneBtn: "Done",
    backupHeader: "Backup", downloadBackup: "Download backup", restoreBackup: "Restore from backup",
    backupHint: "Your backup is a readable JSON file with all your data.",
    toastDecisionSaved: "Decision saved", toastAddedCooling: "Added to cooling off", toastCSVExported: "CSV exported",
    toastBackupDownloaded: "Backup downloaded", toastBackupRestored: "Backup restored", toastBackupInvalid: "Invalid backup file",
    cat: { jidlo: "Food & drink", obleceni: "Clothing", elektronika: "Electronics", krasa: "Beauty & care", domacnost: "Home", zabava: "Entertainment", doprava: "Transport", cestovani: "Travel", ostatni: "Other" },
  },
  pl: {
    splashDesc: "Zanim zaczniemy, podaj swoją stawkę godzinową. Na jej podstawie przeliczę ceny na godziny twojego życia, żebyś mógł/mogła zdecydować, czy warto.",
    continueBtn: "Dalej",
    langTitle: "Język",
    currencyTitle: "Waluta",
    rateLabel: "Stawka godzinowa netto",
    itemNamePlaceholder: "Dodaj nazwę (opcjonalnie)",
    priceInvalid: "Cena musi być liczbą dodatnią.",
    unitMinutes: "Minuty", unitHours: "Godziny", unitWorkdays: "Dni robocze",
    atRatePrefix: "przy stawce ",
    notBuying: "Nie kupuję", thinkAboutIt: "Zastanowię się", worthIt: "Warto było", back: "Wstecz",
    thinkPrompt: "Jak długo chcesz to przemyśleć?",
    think30: "30 minut", think24: "24 godziny", think3d: "3 dni",
    coolingOffHeader: "Do przemyślenia", timeUp: "czas minął", willBuy: "Jednak kupuję",
    navCalculator: "Kalkulator", navHistory: "Historia",
    streakBanner: (n) => `🔒 ${n} dni bez impulsywnego zakupu — tak trzymaj`,
    spentAnyway: "Wydano mimo to", stoppedYourself: "Zaoszczędzone dzięki rozwadze", last30days: "ostatnie 30 dni",
    daysWithoutBuying: "Dni bez zakupu:", longestStreak: "Najdłuższa seria:",
    investLine: (amount) => `Gdyby ${amount}, które nie zostały wydane, zainwestować przy 7% rocznie na 10 lat, mogłoby z tego wyjść mniej więcej`,
    followupTitle: "Nadal warto było?",
    followupQuestion: (name) => `Nadal cieszysz się z: ${name}?`,
    followupGlad: "Tak, nadal się cieszę", followupRegret: "Nie, żałuję",
    subscriptionsHeader: "Subskrypcje",
    subNamePlaceholder: "np. Netflix", subPricePlaceholder: "cena/mies", addBtn: "Dodaj",
    historyHeader: "Historia", undoLast: "↩ Cofnij ostatnią decyzję",
    badgeWorthIt: "warto było", badgeBought: "kupione", badgeSkipped: "pominięte",
    exportCSV: "Eksportuj CSV",
    settingsAppearance: "Wygląd", darkMode: "Tryb ciemny",
    settingsCurrency: "Waluta", currencyHint: "Zmiana waluty zmienia tylko wyświetlany symbol — zapisane stawki nie są przeliczane.",
    settingsHourlyRates: "Stawki godzinowe", activeTag: "· aktywna", useBtn: "Użyj",
    rateNamePlaceholder: "Nazwa, np. Freelance", rateValuePlaceholder: "stawka",
    settingsCategories: "Kategorie", newCategoryPlaceholder: "Nowa kategoria",
    categoryDeleteHint: "Usunięcie kategorii nie zmienia historii — stare pozycje przechodzą pod ostatnią kategorię na liście.",
    settingsLanguage: "Język",
    resetApp: "Zresetuj aplikację", resetConfirm: "Stuknij ponownie, aby potwierdzić",
    resetHint: "Usuwa wszystkie dane i wraca do ekranu startowego.",
    doneBtn: "Gotowe",
    backupHeader: "Kopia zapasowa", downloadBackup: "Pobierz kopię zapasową", restoreBackup: "Przywróć z kopii zapasowej",
    backupHint: "Kopia zapasowa to czytelny plik JSON ze wszystkimi Twoimi danymi.",
    toastDecisionSaved: "Decyzja zapisana", toastAddedCooling: "Dodano do przemyślenia", toastCSVExported: "CSV wyeksportowany",
    toastBackupDownloaded: "Kopia zapasowa pobrana", toastBackupRestored: "Kopia zapasowa przywrócona", toastBackupInvalid: "Nieprawidłowy plik kopii zapasowej",
    cat: { jidlo: "Jedzenie i picie", obleceni: "Ubrania", elektronika: "Elektronika", krasa: "Uroda i pielęgnacja", domacnost: "Dom", zabava: "Rozrywka", doprava: "Transport", cestovani: "Podróże", ostatni: "Inne" },
  },
  es: {
    splashDesc: "Antes de empezar, dime tu tarifa por hora. La usaré para convertir los precios en horas de tu vida, para que decidas si merece la pena.",
    continueBtn: "Continuar",
    langTitle: "Idioma",
    currencyTitle: "Moneda",
    rateLabel: "Tarifa neta por hora",
    itemNamePlaceholder: "Añade un nombre (opcional)",
    priceInvalid: "El precio debe ser un número positivo.",
    unitMinutes: "Minutos", unitHours: "Horas", unitWorkdays: "Días laborables",
    atRatePrefix: "a ",
    notBuying: "No lo compro", thinkAboutIt: "Me lo pensaré", worthIt: "Merece la pena", back: "Atrás",
    thinkPrompt: "¿Cuánto tiempo quieres pensártelo?",
    think30: "30 minutos", think24: "24 horas", think3d: "3 días",
    coolingOffHeader: "Pensándolo", timeUp: "se acabó el tiempo", willBuy: "Lo compraré",
    navCalculator: "Calculadora", navHistory: "Historial",
    streakBanner: (n) => `🔒 ${n} días sin una compra impulsiva — sigue así`,
    spentAnyway: "Gastado igualmente", stoppedYourself: "Te contuviste", last30days: "últimos 30 días",
    daysWithoutBuying: "Días sin comprar:", longestStreak: "Racha más larga:",
    investLine: (amount) => `Si los ${amount} que no gastaste se hubieran invertido al 7% durante 10 años, podrían convertirse en aproximadamente`,
    followupTitle: "¿Sigue mereciendo la pena?",
    followupQuestion: (name) => `¿Sigues contento/a con ${name}?`,
    followupGlad: "Sí, sigo contento/a", followupRegret: "No, me arrepiento",
    subscriptionsHeader: "Suscripciones",
    subNamePlaceholder: "p. ej. Netflix", subPricePlaceholder: "precio/mes", addBtn: "Añadir",
    historyHeader: "Historial", undoLast: "↩ Deshacer última decisión",
    badgeWorthIt: "merecía la pena", badgeBought: "comprado", badgeSkipped: "omitido",
    exportCSV: "Exportar CSV",
    settingsAppearance: "Apariencia", darkMode: "Modo oscuro",
    settingsCurrency: "Moneda", currencyHint: "Cambiar la moneda solo cambia el símbolo mostrado — las tarifas guardadas no se convierten.",
    settingsHourlyRates: "Tarifas por hora", activeTag: "· activa", useBtn: "Usar",
    rateNamePlaceholder: "Nombre, p. ej. Freelance", rateValuePlaceholder: "tarifa",
    settingsCategories: "Categorías", newCategoryPlaceholder: "Nueva categoría",
    categoryDeleteHint: "Eliminar una categoría no cambia tu historial — las entradas antiguas pasan a la última categoría de la lista.",
    settingsLanguage: "Idioma",
    resetApp: "Restablecer app", resetConfirm: "Toca de nuevo para confirmar",
    resetHint: "Borra todos los datos y vuelve a la pantalla de inicio.",
    doneBtn: "Hecho",
    backupHeader: "Copia de seguridad", downloadBackup: "Descargar copia de seguridad", restoreBackup: "Restaurar copia de seguridad",
    backupHint: "Tu copia de seguridad es un archivo JSON legible con todos tus datos.",
    toastDecisionSaved: "Decisión guardada", toastAddedCooling: "Añadido a pensándolo", toastCSVExported: "CSV exportado",
    toastBackupDownloaded: "Copia de seguridad descargada", toastBackupRestored: "Copia de seguridad restaurada", toastBackupInvalid: "Archivo de copia de seguridad no válido",
    cat: { jidlo: "Comida y bebida", obleceni: "Ropa", elektronika: "Electrónica", krasa: "Belleza y cuidado", domacnost: "Hogar", zabava: "Ocio", doprava: "Transporte", cestovani: "Viajes", ostatni: "Otros" },
  },
};

const CATEGORY_DEFAULT_ICONS = [
  { id: "jidlo", icon: "🍽️" },
  { id: "obleceni", icon: "👕" },
  { id: "elektronika", icon: "💻" },
  { id: "krasa", icon: "💄" },
  { id: "domacnost", icon: "🏠" },
  { id: "zabava", icon: "🎬" },
  { id: "doprava", icon: "🚗" },
  { id: "cestovani", icon: "✈️" },
  { id: "ostatni", icon: "🛍️" },
];
const EMOJI_CHOICES = ["🍽️", "☕", "🍕", "🍔", "🍷", "👕", "👗", "👟", "👜", "💄", "💅", "💻", "📱", "🎧", "📷", "🏠", "🛋️", "🪴", "🧹", "🎬", "🎮", "🎵", "🎨", "📚", "🎟️", "🚗", "⛽", "🚲", "✈️", "🏨", "🛍️", "🎁", "💊", "🏋️", "⚽", "🐾", "🔧", "💡", "📦", "💼", "👶", "🧸", "🎓", "💳", "🍿"];

const QUICK_AMOUNTS = { CZK: [200, 500, 1000, 2500], EUR: [10, 20, 50, 100], PLN: [50, 100, 200, 500] };
const CURRENCY_SYMBOL = { CZK: "Kč", EUR: "€", PLN: "zł" };
const DECISION_POSITIVE = { not_buying: false, worth_it: true, bought_after_thinking: true, skipped_after_thinking: false };

function decisionLabel(d, s) {
  if (d === "not_buying" || d === "skipped_after_thinking") return s.badgeSkipped;
  if (d === "worth_it") return s.badgeWorthIt;
  return s.badgeBought;
}

function categoryLookup(categories, id, s) {
  const c = categories.find((c) => c.id === id);
  if (!c) return { icon: "🛍️", label: s.cat.ostatni };
  if (c.custom) return c;
  return { icon: c.icon, label: s.cat[c.id] || c.id };
}

// Longest run, and current trailing run, of calendar days with no "spend"
// decision -- counted from the first-ever history entry through today.
function computeStreaks(history, now) {
  if (!history.length) return { current: 0, longest: 0 };
  const spendDays = new Set(
    history.filter((h) => DECISION_POSITIVE[h.decision]).map((h) => new Date(h.ts).toDateString())
  );
  const start = new Date(Math.min(...history.map((h) => h.ts)));
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let longest = 0, run = 0;
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    if (spendDays.has(d.toDateString())) run = 0;
    else { run++; longest = Math.max(longest, run); }
  }
  return { current: run, longest };
}

function csvSafe(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ================= Logo =================

function Logo({ size = 20 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M19,19 Q19,12.5 24,12.5 Q29,12.5 29,19" strokeWidth="1.6" />
      <path d="M15,19 L33,19 L30.5,34 L17.5,34 Z" fill="currentColor" fillOpacity="0.14" strokeWidth="1.6" />
      <line x1="12.3" y1="12.3" x2="35.7" y2="35.7" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      @keyframes cb-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes cb-sheet { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      .cb-panel { animation: cb-fadein 0.2s ease; }
      .cb-sheet { animation: cb-sheet 0.22s ease; }
      .cb-hscroll { scrollbar-width: none; -ms-overflow-style: none; }
      .cb-hscroll::-webkit-scrollbar { display: none; }
      button { font-family: 'Inter', sans-serif; transition: transform 0.12s ease, opacity 0.12s ease, background 0.15s ease; -webkit-tap-highlight-color: transparent; }
      button:active:not(:disabled) { transform: scale(0.96); opacity: 0.85; }
      input { font-family: 'Inter', sans-serif; }
    `}</style>
  );
}

// ================= Segmented control =================

function segStyle(T, active, full) {
  return {
    flex: full ? 1 : undefined, padding: "9px 14px", borderRadius: 10,
    border: active ? `1.5px solid ${T.stop}` : `1px solid ${T.outline}`,
    background: active ? T.stopContainer : T.surface, color: T.onSurface,
    fontSize: 12.5, fontWeight: active ? 600 : 500, cursor: "pointer", whiteSpace: "nowrap",
  };
}

// ================= App =================

function App() {
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("splash"); // splash | lang | rate | app
  const [tab, setTab] = useState("home"); // home | history
  const [lang, setLang] = useState("en");
  const [darkMode, setDarkMode] = useState(true);
  const [currency, setCurrency] = useState("CZK");
  const [rates, setRates] = useState([{ id: "main", label: "Main rate", rate: 300 }]);
  const [activeRateId, setActiveRateId] = useState("main");
  const [categories, setCategories] = useState(CATEGORY_DEFAULT_ICONS);
  const [category, setCategory] = useState(null);
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [pickingDuration, setPickingDuration] = useState(false);
  const [displayUnit, setDisplayUnit] = useState("hours");
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [newSubName, setNewSubName] = useState("");
  const [newSubPrice, setNewSubPrice] = useState("");
  const [newRateName, setNewRateName] = useState("");
  const [newRateValue, setNewRateValue] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState(EMOJI_CHOICES[0]);
  const [resetArmed, setResetArmed] = useState(false);
  const [onboardRateInput, setOnboardRateInput] = useState("");
  const [onboardCurrency, setOnboardCurrency] = useState("CZK");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const toastTimer = useRef(null);
  const resetTimer = useRef(null);
  const fileInputRef = useRef(null);

  // ---- load / persist ----
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("cb-app-data");
        if (res && res.value) {
          const d = JSON.parse(res.value);
          if (typeof d.lang === "string") setLang(d.lang);
          if (typeof d.darkMode === "boolean") setDarkMode(d.darkMode);
          if (d.currency) setCurrency(d.currency);
          if (Array.isArray(d.rates) && d.rates.length) setRates(d.rates);
          if (d.activeRateId) setActiveRateId(d.activeRateId);
          if (Array.isArray(d.categories) && d.categories.length) setCategories(d.categories);
          if (Array.isArray(d.pending)) setPending(d.pending);
          if (Array.isArray(d.history)) setHistory(d.history);
          if (Array.isArray(d.recurring)) setRecurring(d.recurring);
          if (d.setupDone) setScreen("app");
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const setupDone = screen === "app";
    const data = { lang, darkMode, currency, rates, activeRateId, categories, pending, history, recurring, setupDone };
    window.storage.set("cb-app-data", JSON.stringify(data)).catch(() => {});
  }, [lang, darkMode, currency, rates, activeRateId, categories, pending, history, recurring, screen, loaded]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(resetTimer.current);
  }, []);

  const T = theme(darkMode);
  const s = STR[lang] || STR.en;

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function currentRate() {
    const r = rates.find((r) => r.id === activeRateId);
    return r ? r.rate : rates[0] ? rates[0].rate : 300;
  }
  const rate = currentRate();
  const priceNum = parseLocaleNumber(price);
  const priceValid = !isNaN(priceNum) && priceNum > 0;
  const priceInvalid = price.trim() !== "" && !priceValid;
  const resultVisible = priceValid;

  function resetForm() {
    setCategory(null);
    setItemName("");
    setPrice("");
    setPickingDuration(false);
  }

  function selectCategory(id) {
    setCategory((c) => (c === id ? null : id));
  }

  function addHistory(decision) {
    if (!priceValid) return;
    const entry = { id: uid(), name: itemName.trim(), categoryId: category, price: priceNum, decision, hours: priceNum / rate, ts: Date.now() };
    setHistory((h) => [entry, ...h]);
    resetForm();
    showToast(s.toastDecisionSaved);
  }

  function addPending(ms) {
    if (!priceValid) return;
    const entry = { id: uid(), name: itemName.trim(), categoryId: category, price: priceNum, hours: priceNum / rate, until: Date.now() + ms };
    setPending((p) => [entry, ...p]);
    resetForm();
    showToast(s.toastAddedCooling);
  }

  function resolvePending(item, decision) {
    const entry = { id: uid(), name: item.name, categoryId: item.categoryId, price: item.price, decision, hours: item.hours, ts: Date.now() };
    setHistory((h) => [entry, ...h]);
    setPending((p) => p.filter((x) => x.id !== item.id));
  }

  function deletePending(id) {
    setPending((p) => p.filter((x) => x.id !== id));
  }
  function deleteHistory(id) {
    setHistory((h) => h.filter((x) => x.id !== id));
  }
  function undoLast() {
    setHistory((h) => h.slice(1));
  }
  function answerFollowup(id, val) {
    setHistory((h) => h.map((x) => (x.id === id ? { ...x, followup: val } : x)));
  }

  function exportCSV() {
    const header = ["Date", "Name", "Category", "Price", "Currency", "Decision", "Hours"];
    const rows = history.map((h) => {
      const cat = categoryLookup(categories, h.categoryId, s);
      return [
        new Date(h.ts).toISOString(),
        h.name || "",
        cat.label,
        h.price,
        currency,
        decisionLabel(h.decision, s),
        (h.hours || 0).toFixed(2),
      ].map(csvSafe).join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "stop-and-think-history.csv");
    showToast(s.toastCSVExported);
  }

  function exportBackup() {
    const data = { lang, darkMode, currency, rates, activeRateId, categories, pending, history, recurring };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "stop-and-think-backup.json");
    showToast(s.toastBackupDownloaded);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (typeof d.lang === "string") setLang(d.lang);
        if (typeof d.darkMode === "boolean") setDarkMode(d.darkMode);
        if (d.currency) setCurrency(d.currency);
        if (Array.isArray(d.rates) && d.rates.length) setRates(d.rates);
        if (d.activeRateId) setActiveRateId(d.activeRateId);
        if (Array.isArray(d.categories) && d.categories.length) setCategories(d.categories);
        if (Array.isArray(d.pending)) setPending(d.pending);
        if (Array.isArray(d.history)) setHistory(d.history);
        if (Array.isArray(d.recurring)) setRecurring(d.recurring);
        showToast(s.toastBackupRestored);
      } catch (e) {
        showToast(s.toastBackupInvalid);
      }
    };
    reader.readAsText(file);
  }

  function addSub() {
    const p = parseLocaleNumber(newSubPrice);
    if (!newSubName.trim() || !(p > 0)) return;
    setRecurring((r) => [...r, { id: uid(), name: newSubName.trim(), price: p }]);
    setNewSubName("");
    setNewSubPrice("");
  }
  function deleteSub(id) {
    setRecurring((r) => r.filter((x) => x.id !== id));
  }

  function activateRate(id) {
    setActiveRateId(id);
  }
  function addRate() {
    const val = parseLocaleNumber(newRateValue);
    if (!newRateName.trim() || !(val > 0)) return;
    setRates((r) => [...r, { id: uid(), label: newRateName.trim(), rate: val }]);
    setNewRateName("");
    setNewRateValue("");
  }

  function addCategory() {
    if (!newCatName.trim()) return;
    setCategories((c) => [...c, { id: uid(), icon: newCatEmoji || "🛍️", label: newCatName.trim(), custom: true }]);
    setNewCatName("");
  }
  function removeCategory(id) {
    setCategories((c) => (c.length <= 1 ? c : c.filter((x) => x.id !== id)));
  }

  function goToLang() {
    setScreen("lang");
  }
  function goToRateSetup() {
    setScreen("rate");
  }
  function finishOnboarding() {
    const val = parseLocaleNumber(onboardRateInput);
    const r = val > 0 ? val : 300;
    setCurrency(onboardCurrency);
    setRates((rs) => rs.map((x) => (x.id === activeRateId ? { ...x, rate: r } : x)));
    setScreen("app");
  }

  function resetTap() {
    if (!resetArmed) {
      setResetArmed(true);
      resetTimer.current = setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    clearTimeout(resetTimer.current);
    setScreen("splash");
    setTab("home");
    setLang("en");
    setCurrency("CZK");
    setSettingsOpen(false);
    setRates([{ id: "main", label: "Main rate", rate: 300 }]);
    setActiveRateId("main");
    setCategories(CATEGORY_DEFAULT_ICONS);
    setCategory(null);
    setItemName("");
    setPrice("");
    setPickingDuration(false);
    setDisplayUnit("hours");
    setPending([]);
    setHistory([]);
    setRecurring([]);
    setResetArmed(false);
    setOnboardRateInput("");
    setOnboardCurrency("CZK");
  }

  // ---- derived ----
  const last30 = useMemo(() => history.filter((h) => now - h.ts <= 30 * DAY), [history, now]);
  const spentHours = useMemo(() => last30.filter((h) => DECISION_POSITIVE[h.decision]).reduce((a, h) => a + h.hours, 0), [last30]);
  const notSpentHours = useMemo(() => last30.filter((h) => !DECISION_POSITIVE[h.decision]).reduce((a, h) => a + h.hours, 0), [last30]);
  const notSpentMoney = useMemo(() => last30.filter((h) => !DECISION_POSITIVE[h.decision]).reduce((a, h) => a + h.price, 0), [last30]);
  const spf = fmtDuration(spentHours, "hours", lang);
  const nspf = fmtDuration(notSpentHours, "hours", lang);
  const growth = Math.pow(1.07, 10);

  const streaks = useMemo(() => computeStreaks(history, now), [history, now]);
  const streakMilestone = [3, 7, 14, 30].includes(streaks.current) ? streaks.current : null;
  const showStreakBanner = !!streakMilestone;

  const monthlyHours = useMemo(() => recurring.reduce((a, r) => a + r.price / rate, 0), [recurring, rate]);
  const rf = fmtDuration(monthlyHours, "hours", lang);

  const df = fmtDuration(priceValid ? priceNum / rate : 0, displayUnit, lang);

  const followupsDue = useMemo(
    () => history.filter((h) => (h.decision === "worth_it" || h.decision === "bought_after_thinking") && !h.followup && now - h.ts >= 3 * DAY),
    [history, now]
  );
  const followupItem = followupsDue[0] || null;

  if (!loaded) return null;

  // ================= Splash =================
  if (screen === "splash") {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: T.bg, color: T.onSurface }}>
        <GlobalStyles />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 28px 32px", boxSizing: "border-box", textAlign: "center" }}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: T.stop, color: T.onStop, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, boxShadow: `0 0 0 6px ${T.bg}, 0 0 0 9px ${T.stopContainer}, 0 0 0 10px ${T.outline}` }}>
            <Logo size={42} />
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 30, fontWeight: 800, color: T.onSurface, marginBottom: 10, letterSpacing: "-0.4px" }}>Stop &amp; Think</div>
          <div style={{ fontSize: 15.5, color: T.onSurfaceVariant, lineHeight: 1.6, marginBottom: 30, maxWidth: 300 }}>{s.splashDesc}</div>
          <button onClick={goToLang} style={{ width: "100%", maxWidth: 300, background: T.stop, color: T.onStop, border: "none", borderRadius: 100, padding: "17px 0", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            {s.continueBtn}
          </button>
        </div>
      </div>
    );
  }

  // ================= Language picker =================
  if (screen === "lang") {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", height: "100vh", overflow: "hidden", display: "flex", justifyContent: "center", background: T.bg, color: T.onSurface }}>
        <GlobalStyles />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 26px 32px", boxSizing: "border-box", textAlign: "center", width: "100%" }}>
          <div style={{ width: "100%", maxWidth: 320 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 26, fontWeight: 700, color: T.onSurface, marginBottom: 24, letterSpacing: "-0.3px", textAlign: "center" }}>{s.langTitle}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {LANG_NAMES.map((l) => (
                <button key={l.id} onClick={() => setLang(l.id)} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: lang === l.id ? `1.5px solid ${T.stop}` : `1px solid ${T.outline}`, background: lang === l.id ? T.stopContainer : T.surface, color: T.onSurface, fontSize: 15, fontWeight: lang === l.id ? 700 : 500, cursor: "pointer" }}>
                  {l.label}
                </button>
              ))}
            </div>
            <button onClick={goToRateSetup} style={{ width: "100%", background: T.stop, color: T.onStop, border: "none", borderRadius: 100, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              {s.continueBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= Rate setup =================
  if (screen === "rate") {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", height: "100vh", overflow: "hidden", display: "flex", justifyContent: "center", background: T.bg, color: T.onSurface }}>
        <GlobalStyles />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 26px 32px", boxSizing: "border-box", textAlign: "center", width: "100%" }}>
          <div style={{ width: "100%", maxWidth: 320 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 26, fontWeight: 700, color: T.onSurface, marginBottom: 24, letterSpacing: "-0.3px", textAlign: "center" }}>{s.currencyTitle}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 28, justifyContent: "center" }}>
              {["CZK", "EUR", "PLN"].map((c) => (
                <button key={c} onClick={() => setOnboardCurrency(c)} style={segStyle(T, onboardCurrency === c, true)}>{c}</button>
              ))}
            </div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: T.onSurfaceVariant, marginBottom: 10, textAlign: "center" }}>{s.rateLabel}</label>
            <div style={{ position: "relative", marginBottom: 28 }}>
              <input
                autoFocus
                value={onboardRateInput}
                onChange={(e) => setOnboardRateInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && parseLocaleNumber(onboardRateInput) > 0 && finishOnboarding()}
                inputMode="decimal"
                placeholder="0"
                maxLength={10}
                style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${T.outline}`, borderRadius: 14, padding: "18px 16px", paddingRight: 52, fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 600, color: T.onSurface, background: T.surfaceAlt, outline: "none", textAlign: "center" }}
              />
              <span style={{ position: "absolute", right: 18, top: 21, color: T.onSurfaceVariant, fontSize: 17, fontWeight: 500 }}>{CURRENCY_SYMBOL[onboardCurrency]}</span>
            </div>
            <button
              disabled={!(parseLocaleNumber(onboardRateInput) > 0)}
              onClick={finishOnboarding}
              style={{ width: "100%", background: parseLocaleNumber(onboardRateInput) > 0 ? T.stop : T.outline, color: T.onStop, border: "none", borderRadius: 100, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >
              {s.continueBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= Main app =================
  const navItem = (id) => {
    const active = tab === id;
    return {
      pill: { padding: "4px 20px", borderRadius: 12, background: active ? T.stopContainer : "transparent" },
      icon: { color: active ? T.onStopContainer : T.onSurfaceVariant, display: "flex" },
      label: { fontSize: 11.5, fontWeight: active ? 600 : 500, color: active ? T.onStopContainer : T.onSurfaceVariant },
    };
  };
  const nHome = navItem("home"), nHist = navItem("history");

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: "100vh", width: "100%", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", background: T.bg, color: T.onSurface, boxSizing: "border-box" }}>
      <GlobalStyles />

      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "18px 16px", paddingTop: "calc(18px + env(safe-area-inset-top, 0px))", background: T.surface, boxShadow: T.shadowSm, position: "relative", zIndex: 1, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.stop, color: T.onStop, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 0 2px ${T.surface}, 0 0 0 3.5px ${T.stopContainer}` }}>
            <Logo size={16} />
          </div>
          <div style={{ fontSize: 17, fontFamily: "'Inter', sans-serif", fontWeight: 800, color: T.onSurface, letterSpacing: "-0.2px" }}>Stop &amp; Think</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, fontWeight: 600, color: T.onSurfaceVariant, background: T.surfaceAlt, padding: "7px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
            {fmtMoney(rate, currency, lang)}/h
          </div>
          <button onClick={() => setSettingsOpen(true)} style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${T.outline}`, background: T.surface, color: T.onSurfaceVariant, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 13.5a1.7 1.7 0 000-3l-1.1-.3a6.6 6.6 0 00-.6-1.4l.6-1a1.7 1.7 0 00-2.4-2.4l-1 .6a6.6 6.6 0 00-1.4-.6L13.5 4.6a1.7 1.7 0 00-3 0l-.3 1.1a6.6 6.6 0 00-1.4.6l-1-.6a1.7 1.7 0 00-2.4 2.4l.6 1a6.6 6.6 0 00-.6 1.4l-1.1.3a1.7 1.7 0 000 3l1.1.3a6.6 6.6 0 00.6 1.4l-.6 1a1.7 1.7 0 002.4 2.4l1-.6a6.6 6.6 0 001.4.6l.3 1.1a1.7 1.7 0 003 0l.3-1.1a6.6 6.6 0 001.4-.6l1 .6a1.7 1.7 0 002.4-2.4l-.6-1a6.6 6.6 0 00.6-1.4z"></path></svg>
          </button>
        </div>
      </div>

      <div className="cb-panel" key={tab} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 12px", boxSizing: "border-box" }}>

        {tab === "home" && (
          <React.Fragment>
            {followupItem && (
              <div style={{ background: T.calmContainer, borderRadius: 16, padding: 16, marginBottom: 16, boxSizing: "border-box", textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.onCalmContainer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{s.followupTitle}</div>
                <div style={{ fontSize: 14, color: T.onCalmContainer, marginBottom: 12 }}>{s.followupQuestion(followupItem.name || categoryLookup(categories, followupItem.categoryId, s).label)}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => answerFollowup(followupItem.id, "glad")} style={{ flex: 1, background: "none", color: T.calm, border: `1.5px solid ${T.calm}`, borderRadius: 100, padding: "9px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s.followupGlad}</button>
                  <button onClick={() => answerFollowup(followupItem.id, "regret")} style={{ flex: 1, background: "none", color: T.stop, border: `1.5px solid ${T.stop}`, borderRadius: 100, padding: "9px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s.followupRegret}</button>
                </div>
              </div>
            )}

            <div className="cb-hscroll" style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
              {(QUICK_AMOUNTS[currency] || QUICK_AMOUNTS.CZK).map((v) => (
                <button key={v} onClick={() => setPrice(String(v))} style={{ padding: "8px 16px", borderRadius: 100, border: `1px solid ${T.outline}`, background: T.surfaceAlt, color: T.onSurface, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {fmtMoney(v, currency, lang)}
                </button>
              ))}
            </div>

            <div className="cb-hscroll" style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
              {categories.map((cat) => {
                const active = category === cat.id;
                const label = cat.custom ? cat.label : s.cat[cat.id] || cat.id;
                return (
                  <button key={cat.id} onClick={() => selectCategory(cat.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 100, border: active ? `1.5px solid ${T.stop}` : `1px solid ${T.outline}`, background: active ? T.stopContainer : T.surface, color: active ? T.onStopContainer : T.onSurface, fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                    <span>{cat.icon}</span><span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.outline}`, borderRadius: 20, padding: "24px 22px", boxShadow: T.shadow, marginBottom: 18, boxSizing: "border-box", textAlign: "center" }}>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={s.itemNamePlaceholder}
                maxLength={60}
                style={{ width: "100%", boxSizing: "border-box", border: "none", borderBottom: `1px solid ${T.outline}`, background: "none", padding: "0 0 12px", fontSize: 14, color: T.onSurface, outline: "none", textAlign: "center", marginBottom: 20 }}
              />

              <div style={{ display: "flex", width: "fit-content", margin: "0 auto", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 600, color: T.onSurfaceVariant }}>{CURRENCY_SYMBOL[currency]}</span>
                <input
                  autoFocus
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  maxLength={10}
                  style={{ width: 160, boxSizing: "border-box", border: "none", background: "none", outline: "none", fontFamily: "'IBM Plex Mono', monospace", fontSize: 44, fontWeight: 600, color: T.onSurface, textAlign: "left" }}
                />
              </div>
              {priceInvalid && <div style={{ fontSize: 11.5, color: T.stop, marginTop: 6 }}>{s.priceInvalid}</div>}

              <hr style={{ height: 1, background: T.outline, margin: "20px 0", border: "none" }} />

              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, fontWeight: 600, color: T.onSurface, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
                {df.big}<span style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 500, color: T.onSurfaceVariant }}>{df.unit}</span>
              </div>
              <div style={{ fontSize: 12, color: T.onSurfaceVariant, marginTop: 8 }}>{s.atRatePrefix}{fmtMoney(rate, currency, lang)}/h</div>

              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
                {[{ id: "minutes", label: s.unitMinutes }, { id: "hours", label: s.unitHours }, { id: "days", label: s.unitWorkdays }].map((u) => (
                  <button key={u.id} onClick={() => setDisplayUnit(u.id)} style={{ flex: 1, padding: "7px 0", borderRadius: 10, border: "none", background: displayUnit === u.id ? T.stop : "rgba(128,128,128,0.16)", color: displayUnit === u.id ? T.onStop : T.onSurfaceVariant, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            {resultVisible && (
              <div style={{ marginBottom: 20 }}>
                {!pickingDuration && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <button onClick={() => addHistory("not_buying")} style={{ width: "100%", background: T.stop, color: T.onStop, border: "none", borderRadius: 100, padding: "15px 0", fontSize: 15.5, fontWeight: 700, cursor: "pointer" }}>{s.notBuying}</button>
                    <button onClick={() => setPickingDuration(true)} style={{ width: "100%", background: T.surfaceAlt, color: T.onSurface, border: `1px solid ${T.outline}`, borderRadius: 100, padding: "13.5px 0", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>{s.thinkAboutIt}</button>
                    <button onClick={() => addHistory("worth_it")} style={{ width: "100%", background: "none", color: T.calm, border: `1.5px solid ${T.calm}`, borderRadius: 100, padding: "12px 0", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>{s.worthIt}</button>
                    <button onClick={resetForm} style={{ background: "none", border: "none", color: T.onSurfaceVariant, fontSize: 13, marginTop: 2, cursor: "pointer", padding: 6 }}>{s.back}</button>
                  </div>
                )}
                {pickingDuration && (
                  <div style={{ background: T.surface, border: `1px solid ${T.outline}`, borderRadius: 20, padding: "24px 22px", boxShadow: T.shadow, boxSizing: "border-box", textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: T.onSurfaceVariant, fontWeight: 600, marginBottom: 10 }}>{s.thinkPrompt}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => addPending(30 * 60 * 1000)} style={{ flex: 1, background: T.stopContainer, border: `1px solid ${T.outline}`, borderRadius: 12, padding: "11px 4px", fontSize: 12.5, fontWeight: 500, color: T.onSurface, cursor: "pointer" }}>{s.think30}</button>
                      <button onClick={() => addPending(24 * 60 * 60 * 1000)} style={{ flex: 1, background: T.stopContainer, border: `1px solid ${T.outline}`, borderRadius: 12, padding: "11px 4px", fontSize: 12.5, fontWeight: 500, color: T.onSurface, cursor: "pointer" }}>{s.think24}</button>
                      <button onClick={() => addPending(3 * 24 * 60 * 60 * 1000)} style={{ flex: 1, background: T.stopContainer, border: `1px solid ${T.outline}`, borderRadius: 12, padding: "11px 4px", fontSize: 12.5, fontWeight: 500, color: T.onSurface, cursor: "pointer" }}>{s.think3d}</button>
                    </div>
                    <button onClick={() => setPickingDuration(false)} style={{ background: "none", border: "none", color: T.onSurfaceVariant, fontSize: 13, marginTop: 12, cursor: "pointer", padding: 6 }}>{s.back}</button>
                  </div>
                )}
              </div>
            )}

            {pending.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{s.coolingOffHeader} ({pending.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pending.map((p) => {
                    const ms = p.until - now;
                    const ready = ms <= 0;
                    const hf = fmtDuration(p.hours, "hours", lang);
                    const cat = categoryLookup(categories, p.categoryId, s);
                    return (
                      <div key={p.id} style={{ background: T.surface, borderRadius: 12, padding: 14, boxShadow: T.shadowSm, boxSizing: "border-box" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 14.5, color: T.onSurface }}>{p.name || cat.label}</div>
                            <div style={{ fontSize: 12.5, color: T.onSurfaceVariant, marginTop: 2 }}>{fmtMoney(p.price, currency, lang)} · {hf.big} {hf.unit}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: ready ? T.stop : T.onSurfaceVariant }}>{ready ? s.timeUp : timeLeftStr(ms, lang)}</span>
                            <button onClick={() => deletePending(p.id)} style={{ background: "none", border: "none", color: T.onSurfaceVariant, fontSize: 14, cursor: "pointer", padding: 2 }}>✕</button>
                          </div>
                        </div>
                        {ready && (
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button onClick={() => resolvePending(p, "skipped_after_thinking")} style={{ flex: 1, background: T.stop, color: T.onStop, border: "none", borderRadius: 100, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{s.notBuying}</button>
                            <button onClick={() => resolvePending(p, "bought_after_thinking")} style={{ flex: 1, background: "none", color: T.calm, border: `1.5px solid ${T.calm}`, borderRadius: 100, padding: "8.5px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{s.willBuy}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </React.Fragment>
        )}

        {tab === "history" && (
          <React.Fragment>
            {showStreakBanner && (
              <div style={{ background: T.calmContainer, color: T.onCalmContainer, borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 14, boxSizing: "border-box" }}>
                {s.streakBanner(streaks.current)}
              </div>
            )}

            <div style={{ background: T.surface, border: `1px solid ${T.outline}`, borderRadius: 16, padding: 22, marginBottom: 16, boxShadow: T.shadow, boxSizing: "border-box", textAlign: "center" }}>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T.onSurfaceVariant, fontWeight: 600 }}>{s.spentAnyway}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 21, marginTop: 4, color: T.stop }}>{spf.big} <span style={{ fontSize: 12, fontWeight: 500 }}>{spf.unit}</span></div>
                  <div style={{ fontSize: 10.5, color: T.onSurfaceVariant, marginTop: 2 }}>{s.last30days}</div>
                </div>
                <div style={{ width: 1, background: T.outline }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T.onSurfaceVariant, fontWeight: 600 }}>{s.stoppedYourself}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 21, marginTop: 4, color: T.calm }}>{nspf.big} <span style={{ fontSize: 12, fontWeight: 500 }}>{nspf.unit}</span></div>
                  <div style={{ fontSize: 10.5, color: T.onSurfaceVariant, marginTop: 2 }}>{s.last30days}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.outline}` }}>
                <div style={{ fontSize: 11.5, color: T.onSurfaceVariant }}>{s.daysWithoutBuying} <span style={{ fontWeight: 700, color: T.onSurface }}>{streaks.current}</span></div>
                <div style={{ fontSize: 11.5, color: T.onSurfaceVariant }}>{s.longestStreak} <span style={{ fontWeight: 700, color: T.onSurface }}>{streaks.longest}</span></div>
              </div>
            </div>

            {notSpentMoney > 0 && (
              <div style={{ background: T.calmContainer, borderRadius: 16, padding: 18, marginBottom: 16, boxSizing: "border-box", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.onCalmContainer, lineHeight: 1.5, marginBottom: 8, opacity: 0.85 }}>
                  {s.investLine(fmtMoney(notSpentMoney, currency, lang))}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 24, color: T.onCalmContainer }}>{fmtMoney(notSpentMoney * growth, currency, lang)}</div>
              </div>
            )}

            <div style={{ background: T.surface, border: `1px solid ${T.outline}`, borderRadius: 16, marginBottom: 14, overflow: "hidden", boxShadow: T.shadowSm }}>
              <div style={{ width: "100%", textAlign: "center", padding: "18px 18px 8px", fontSize: 15.5, fontWeight: 700, color: T.onSurface, boxSizing: "border-box" }}>
                {s.subscriptionsHeader} <span style={{ color: T.onSurfaceVariant, fontWeight: 400 }}>({rf.big} {rf.unit}/mo)</span>
              </div>
              <div style={{ padding: "0 18px 18px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8 }}>
                {recurring.map((r) => {
                  const subHf = fmtDuration(r.price / rate, "hours", lang);
                  return (
                    <div key={r.id} style={{ background: T.surfaceAlt, border: `1px solid ${T.outline}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: T.onSurface }}>{r.name}</div>
                        <div style={{ fontSize: 10.5, color: T.onSurfaceVariant, marginTop: 2 }}>{fmtMoney(r.price, currency, lang)}/mo · {subHf.big} {subHf.unit}/mo</div>
                      </div>
                      <button onClick={() => deleteSub(r.id)} style={{ background: "none", border: "none", color: T.onSurfaceVariant, fontSize: 14, cursor: "pointer", padding: 2 }}>✕</button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder={s.subNamePlaceholder} style={{ flex: 1, minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.outline}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, background: T.surfaceAlt, outline: "none", color: T.onSurface }} />
                  <input value={newSubPrice} onChange={(e) => setNewSubPrice(e.target.value)} inputMode="decimal" placeholder={s.subPricePlaceholder} maxLength={10} style={{ width: 74, boxSizing: "border-box", border: `1px solid ${T.outline}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, background: T.surfaceAlt, outline: "none", color: T.onSurface }} />
                  <button onClick={addSub} style={{ background: T.stop, color: T.onStop, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s.addBtn}</button>
                </div>
              </div>
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.outline}`, borderRadius: 16, marginBottom: 14, overflow: "hidden", boxShadow: T.shadowSm }}>
              <div style={{ width: "100%", textAlign: "center", padding: "18px 18px 8px", fontSize: 15.5, fontWeight: 700, color: T.onSurface, boxSizing: "border-box" }}>
                {s.historyHeader} <span style={{ color: T.onSurfaceVariant, fontWeight: 400 }}>({history.length})</span>
              </div>
              <div style={{ padding: "0 18px 18px", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <button onClick={undoLast} disabled={!history.length} style={{ background: "none", border: "none", color: T.stop, fontSize: 11.5, fontWeight: 600, cursor: history.length ? "pointer" : "default", opacity: history.length ? 1 : 0.4 }}>{s.undoLast}</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 14 }}>
                  {history.map((h) => {
                    const cat = categoryLookup(categories, h.categoryId, s);
                    const hf = fmtDuration(h.hours, "hours", lang);
                    const positive = DECISION_POSITIVE[h.decision];
                    return (
                      <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 2px", borderBottom: `1px solid ${T.outline}`, gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: T.onSurface }}>{h.name || cat.label}</div>
                          <div style={{ fontSize: 11.5, color: T.onSurfaceVariant }}>{h.name ? cat.label + " · " : ""}{fmtMoney(h.price, currency, lang)} · {hf.big} {hf.unit}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: positive ? T.onStopContainer : T.onCalmContainer, background: positive ? T.stopContainer : T.calmContainer, borderRadius: 20, padding: "4px 10px", whiteSpace: "nowrap" }}>{decisionLabel(h.decision, s)}</span>
                          <button onClick={() => deleteHistory(h.id)} style={{ background: "none", border: "none", color: T.onSurfaceVariant, fontSize: 14, cursor: "pointer", padding: 2 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={exportCSV} disabled={!history.length} style={{ width: "100%", background: T.surfaceAlt, color: T.onSurface, border: `1px solid ${T.outline}`, borderRadius: 100, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: history.length ? "pointer" : "default", opacity: history.length ? 1 : 0.5 }}>{s.exportCSV}</button>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>

      <div style={{ flexShrink: 0, display: "flex", background: T.surface, boxShadow: `0 -4px 16px ${darkMode ? "rgba(0,0,0,0.4)" : "rgba(20,23,26,0.12)"}`, position: "relative", zIndex: 1, padding: "10px 4px 12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box" }}>
        <button onClick={() => setTab("home")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", cursor: "pointer" }}>
          <div style={nHome.pill}><div style={nHome.icon}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"></rect><line x1="8" y1="7" x2="16" y2="7"></line><line x1="8" y1="11" x2="8.01" y2="11"></line><line x1="12" y1="11" x2="12.01" y2="11"></line><line x1="16" y1="11" x2="16.01" y2="11"></line><line x1="8" y1="15" x2="8.01" y2="15"></line><line x1="12" y1="15" x2="12.01" y2="15"></line><line x1="16" y1="15" x2="16.01" y2="15"></line></svg>
          </div></div>
          <span style={nHome.label}>{s.navCalculator}</span>
        </button>
        <button onClick={() => setTab("history")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", cursor: "pointer" }}>
          <div style={nHist.pill}><div style={nHist.icon}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3.5 2"></path></svg>
          </div></div>
          <span style={nHist.label}>{s.navHistory}</span>
        </button>
      </div>

      {settingsOpen && (
        <React.Fragment>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 4 }} onClick={() => setSettingsOpen(false)} />
          <div className="cb-sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "86%", background: T.surface, borderRadius: "22px 22px 0 0", padding: "10px 20px 24px", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box", zIndex: 5, boxShadow: T.shadow, display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.outline, margin: "6px auto 16px", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{s.settingsAppearance}</div>
                <div style={{ background: T.surfaceAlt, borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.onSurface }}>{s.darkMode}</div>
                  <button onClick={() => setDarkMode((d) => !d)} style={{ width: 46, height: 26, borderRadius: 13, background: darkMode ? T.stop : T.outline, border: "none", cursor: "pointer", position: "relative", padding: 3, boxSizing: "border-box" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", transform: darkMode ? "translateX(20px)" : "translateX(0)", transition: "transform 0.15s ease" }} />
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{s.settingsLanguage}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {LANG_NAMES.map((l) => (
                    <button key={l.id} onClick={() => setLang(l.id)} style={{ ...segStyle(T, lang === l.id, true), padding: "11px 14px", textAlign: "left" }}>{l.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{s.settingsCurrency}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["CZK", "EUR", "PLN"].map((c) => (
                    <button key={c} onClick={() => setCurrency(c)} style={segStyle(T, currency === c, true)}>{c}</button>
                  ))}
                </div>
                {rates.length > 1 && <div style={{ fontSize: 10.5, color: T.onSurfaceVariant, marginTop: 8 }}>{s.currencyHint}</div>}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{s.settingsHourlyRates}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {rates.map((r) => (
                    <div key={r.id} style={{ background: T.surfaceAlt, borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: T.onSurface }}>{r.label}</div>
                        <div style={{ fontSize: 10.5, color: T.onSurfaceVariant, marginTop: 2 }}>{fmtMoney(r.rate, currency, lang)}/h {activeRateId === r.id && <span style={{ color: T.stop, fontWeight: 600 }}> {s.activeTag}</span>}</div>
                      </div>
                      {activeRateId !== r.id && <button onClick={() => activateRate(r.id)} style={{ background: T.stopContainer, color: T.onStopContainer, border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s.useBtn}</button>}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newRateName} onChange={(e) => setNewRateName(e.target.value)} placeholder={s.rateNamePlaceholder} style={{ flex: 1, minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.outline}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, background: T.surfaceAlt, outline: "none", color: T.onSurface }} />
                  <input value={newRateValue} onChange={(e) => setNewRateValue(e.target.value)} inputMode="decimal" placeholder={s.rateValuePlaceholder} maxLength={10} style={{ width: 60, boxSizing: "border-box", border: `1px solid ${T.outline}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, background: T.surfaceAlt, outline: "none", color: T.onSurface }} />
                  <button onClick={addRate} style={{ background: T.stop, color: T.onStop, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s.addBtn}</button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{s.settingsCategories}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {categories.map((cat) => {
                    const label = cat.custom ? cat.label : s.cat[cat.id] || cat.id;
                    return (
                      <div key={cat.id} style={{ background: T.surfaceAlt, borderRadius: 14, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 18 }}>{cat.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: T.onSurface }}>{label}</span>
                        </div>
                        <button onClick={() => removeCategory(cat.id)} style={{ background: "none", border: "none", color: T.onSurfaceVariant, fontSize: 14, cursor: "pointer", padding: 2, flexShrink: 0 }}>✕</button>
                      </div>
                    );
                  })}
                </div>
                <div className="cb-hscroll" style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", padding: "2px 0" }}>
                  {EMOJI_CHOICES.map((e) => (
                    <button key={e} onClick={() => setNewCatEmoji(e)} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: newCatEmoji === e ? `1.5px solid ${T.stop}` : `1px solid ${T.outline}`, background: newCatEmoji === e ? T.stopContainer : T.surfaceAlt, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{e}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={s.newCategoryPlaceholder} maxLength={30} style={{ flex: 1, minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.outline}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, background: T.surfaceAlt, outline: "none", color: T.onSurface }} />
                  <button onClick={addCategory} style={{ background: T.stop, color: T.onStop, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s.addBtn}</button>
                </div>
                <div style={{ fontSize: 10.5, color: T.onSurfaceVariant, marginTop: 8 }}>{s.categoryDeleteHint}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.onSurfaceVariant, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{s.backupHeader}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={exportBackup} style={{ width: "100%", background: T.surfaceAlt, color: T.onSurface, border: `1px solid ${T.outline}`, borderRadius: 100, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{s.downloadBackup}</button>
                  <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{ width: "100%", background: T.surfaceAlt, color: T.onSurface, border: `1px solid ${T.outline}`, borderRadius: 100, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{s.restoreBackup}</button>
                  <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ""; }} />
                </div>
                <div style={{ fontSize: 10.5, color: T.onSurfaceVariant, textAlign: "center", marginTop: 8 }}>{s.backupHint}</div>
              </div>

              <div>
                <button onClick={resetTap} style={{ width: "100%", background: "none", border: `1.5px solid ${resetArmed ? T.stop : T.outline}`, color: resetArmed ? T.stop : T.onSurfaceVariant, borderRadius: 100, padding: "12px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                  {resetArmed ? s.resetConfirm : s.resetApp}
                </button>
                <div style={{ fontSize: 11, color: T.onSurfaceVariant, textAlign: "center", marginTop: 8 }}>{s.resetHint}</div>
              </div>
              <button onClick={() => setSettingsOpen(false)} style={{ width: "100%", background: T.surfaceAlt, color: T.onSurface, border: `1px solid ${T.outline}`, borderRadius: 100, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{s.doneBtn}</button>
            </div>
          </div>
        </React.Fragment>
      )}

      {toast && (
        <div style={{ position: "absolute", left: 16, right: 16, bottom: "calc(20px + env(safe-area-inset-bottom, 0px))", background: T.inverseSurface, color: T.inverseOnSurface, padding: "14px 16px", borderRadius: 14, fontSize: 13, boxShadow: "0 4px 14px rgba(0,0,0,0.3)", boxSizing: "border-box", zIndex: 3 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

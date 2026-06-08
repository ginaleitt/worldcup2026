import { useState, useEffect, useRef, useCallback } from "react";

const FONT = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500;600&display=swap');`;

// ─── API CONFIG ───────────────────────────────────────────────────────────────
// Replace with your real key from https://www.football-data.org/
const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY;
// Always use the proxy path — Vite handles it locally, vercel.json handles it in production
const API_BASE = '/api/v4';
const WC_2026_ID = 2000; // football-data.org competition ID for FIFA World Cup 2026

// ─── POLLING CONFIG ───────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// A match is considered "live" from kickoff until 2h15m after (90min + extra + breaks)
const MATCH_LIVE_DURATION_MS = 135 * 60 * 1000;

/** Returns true if right now falls within any currently-live match window */
function anyMatchLiveNow(matches) {
  const now = Date.now();
  return matches.some(m => {
    const kick = new Date(m.date).getTime();
    return now >= kick && now <= kick + MATCH_LIVE_DURATION_MS;
  });
}

// ─── API LAYER ────────────────────────────────────────────────────────────────

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

/**
 * Fetches all matches for WC 2026 and returns them shaped like our internal format.
 * Swap the mock data below for this call once you have a real API key.
 *
 * Usage:
 *   const { matches, standings } = await fetchTournamentData();
 */
async function fetchTournamentData() {
  const [matchesRes, standingsRes] = await Promise.all([
    apiFetch(`/competitions/${WC_2026_ID}/matches`),
    apiFetch(`/competitions/${WC_2026_ID}/standings`),
  ]);

  const matches = matchesRes.matches.map(m => ({
    id: m.id,
    home: m.homeTeam.shortName || m.homeTeam.name,
    away: m.awayTeam.shortName || m.awayTeam.name,
    date: m.utcDate,
    venue: m.venue || "TBD",
    stage: m.stage,
    status: m.status === "FINISHED" ? "FT"
          : m.status === "IN_PLAY" || m.status === "PAUSED" ? "LIVE"
          : "upcoming",
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
  }));

  // standings is an array of groups, each with a table array
  const standings = {};
  (standingsRes.standings || []).forEach(group => {
    const groupLetter = group.group?.replace("GROUP_", "") || group.stage;
    standings[groupLetter] = group.table.map(row => ({
      team: row.team.shortName || row.team.name,
      p: row.playedGames,
      w: row.won,
      d: row.draw,
      l: row.lost,
      gf: row.goalsFor,
      ga: row.goalsAgainst,
      pts: row.points,
    }));
  });

  return { matches, standings };
}

// ─── MOCK DATA (used until real API key is set) ───────────────────────────────

// All 48 teams — 12 groups (A–L) — confirmed FIFA 2026 draw
// API returns team names; these must match the shortName the API uses for flag + group lookup
// If a team flag shows as 🏳 in the app, check what shortName the API returns and add a mapping below
const TEAM_META = {
  // Group A
  "Mexico":              { flag: "🇲🇽", group: "A" },
  "South Africa":        { flag: "🇿🇦", group: "A" },
  "Korea Republic":      { flag: "🇰🇷", group: "A" },
  "South Korea":         { flag: "🇰🇷", group: "A" }, // alternate API name
  "Czechia":             { flag: "🇨🇿", group: "A" },
  "Czech Republic":      { flag: "🇨🇿", group: "A" }, // alternate API name
  // Group B
  "Canada":              { flag: "🇨🇦", group: "B" },
  "Bosnia and Herzegovina": { flag: "🇧🇦", group: "B" },
  "Bosnia-Herzegovina":  { flag: "🇧🇦", group: "B" }, // alternate
  "Qatar":               { flag: "🇶🇦", group: "B" },
  "Switzerland":         { flag: "🇨🇭", group: "B" },
  // Group C
  "Brazil":              { flag: "🇧🇷", group: "C" },
  "Morocco":             { flag: "🇲🇦", group: "C" },
  "Haiti":               { flag: "🇭🇹", group: "C" },
  "Scotland":            { flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
  // Group D
  "USA":                 { flag: "🇺🇸", group: "D" },
  "United States":       { flag: "🇺🇸", group: "D" }, // alternate API name
  "Paraguay":            { flag: "🇵🇾", group: "D" },
  "Australia":           { flag: "🇦🇺", group: "D" },
  "Türkiye":             { flag: "🇹🇷", group: "D" },
  "Turkiye":             { flag: "🇹🇷", group: "D" }, // alternate
  "Turkey":              { flag: "🇹🇷", group: "D" }, // alternate
  // Group E
  "Germany":             { flag: "🇩🇪", group: "E" },
  "Curaçao":             { flag: "🇨🇼", group: "E" },
  "Curacao":             { flag: "🇨🇼", group: "E" }, // alternate
  "Côte d'Ivoire":       { flag: "🇨🇮", group: "E" },
  "Cote d'Ivoire":       { flag: "🇨🇮", group: "E" }, // alternate
  "Ivory Coast":         { flag: "🇨🇮", group: "E" }, // alternate
  "Ecuador":             { flag: "🇪🇨", group: "E" },
  // Group F
  "Netherlands":         { flag: "🇳🇱", group: "F" },
  "Japan":               { flag: "🇯🇵", group: "F" },
  "Sweden":              { flag: "🇸🇪", group: "F" },
  "Tunisia":             { flag: "🇹🇳", group: "F" },
  // Group G
  "Belgium":             { flag: "🇧🇪", group: "G" },
  "Egypt":               { flag: "🇪🇬", group: "G" },
  "Iran":                { flag: "🇮🇷", group: "G" },
  "IR Iran":             { flag: "🇮🇷", group: "G" }, // alternate API name
  "New Zealand":         { flag: "🇳🇿", group: "G" },
  // Group H
  "Spain":               { flag: "🇪🇸", group: "H" },
  "Cabo Verde":          { flag: "🇨🇻", group: "H" },
  "Cape Verde":          { flag: "🇨🇻", group: "H" }, // alternate
  "Saudi Arabia":        { flag: "🇸🇦", group: "H" },
  "Uruguay":             { flag: "🇺🇾", group: "H" },
  // Group I
  "France":              { flag: "🇫🇷", group: "I" },
  "Senegal":             { flag: "🇸🇳", group: "I" },
  "Iraq":                { flag: "🇮🇶", group: "I" },
  "Norway":              { flag: "🇳🇴", group: "I" },
  // Group J
  "Argentina":           { flag: "🇦🇷", group: "J" },
  "Algeria":             { flag: "🇩🇿", group: "J" },
  "Austria":             { flag: "🇦🇹", group: "J" },
  "Jordan":              { flag: "🇯🇴", group: "J" },
  // Group K
  "Portugal":            { flag: "🇵🇹", group: "K" },
  "Congo DR":            { flag: "🇨🇩", group: "K" },
  "DR Congo":            { flag: "🇨🇩", group: "K" }, // alternate
  "Uzbekistan":          { flag: "🇺🇿", group: "K" },
  "Colombia":            { flag: "🇨🇴", group: "K" },
  "Columbia":            { flag: "🇨🇴", group: "K" }, // common misspelling in some APIs
  // Group L
  "England":             { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" },
  "Croatia":             { flag: "🇭🇷", group: "L" },
  "Ghana":               { flag: "🇬🇭", group: "L" },
  "Panama":              { flag: "🇵🇦", group: "L" },
};


// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatMatchTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function formatDateOnly(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getStake(team, standings) {
  const meta = TEAM_META[team];
  if (!meta) return null;
  const group = standings[meta.group];
  if (!group) return null;
  const row = group.find(r => r.team === team);
  if (!row) return null;
  const sorted = [...group].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
  const pos = sorted.findIndex(r => r.team === team) + 1;
  if (pos <= 2 && row.p >= 2) return { label: "Looking good — likely through", dot: "green" };
  if (pos <= 2) return { label: "In qualification position", dot: "green" };
  if (pos === 3 && row.p < 3) return { label: "Win and hope for the best", dot: "amber" };
  return { label: "Must win to have any chance", dot: "red" };
}

function googleCalUrl(match) {
  const start = new Date(match.date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = encodeURIComponent(`${TEAM_META[match.home]?.flag || ""} ${match.home} vs ${TEAM_META[match.away]?.flag || ""} ${match.away} — FIFA World Cup 2026`);
  const details = encodeURIComponent(`${match.stage} · ${match.venue}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
}

function outlookCalUrl(match) {
  const start = new Date(match.date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const title = encodeURIComponent(`${match.home} vs ${match.away} — FIFA World Cup 2026`);
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${start.toISOString()}&enddt=${end.toISOString()}&body=${encodeURIComponent(match.stage + " · " + match.venue)}`;
}

function icsDownload(match) {
  const start = new Date(match.date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const content = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${match.home} vs ${match.away} — FIFA World Cup 2026`,
    `DESCRIPTION:${match.stage} · ${match.venue}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${match.home}-vs-${match.away}.ics`; a.click();
  URL.revokeObjectURL(url);
}

function groupMatchesByDate(matches) {
  const map = {};
  matches.forEach(m => {
    const d = new Date(m.date).toDateString();
    if (!map[d]) map[d] = [];
    map[d].push(m);
  });
  return Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// All text on dark (#0a0e1a) backgrounds:
//   primary   #f0f2f8  — headings, scores, team names
//   secondary #c8d0e0  — body text, match meta
//   muted     #8d9ab5  — labels, badges, secondary info
//   dim       #5a6680  — dividers, placeholders

const C = {
  bg:         "#0a0e1a",
  surface:    "#0f1526",
  surfaceAlt: "#141c30",
  border:     "#1e2848",
  borderSub:  "#252f4a",
  green:      "#16c784",
  greenDim:   "#0d2a1a",
  amber:      "#f59e0b",
  amberDim:   "#2a1e08",
  red:        "#ef4444",
  redDim:     "#2a0d0d",
  blue:       "#60a5fa",
  blueDim:    "#0d1a2a",
  textPrimary:   "#f0f2f8",
  textSecondary: "#c8d0e0",
  textMuted:     "#8d9ab5",
  textDim:       "#5a6680",
};

const S = {
  app: {
    minHeight: "100vh",
    background: C.bg,
    color: C.textPrimary,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 15,
  },
  header: {
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: "0.04em",
    color: C.textPrimary,
    textTransform: "uppercase",
  },
  logoAccent: { color: C.green },
  nav: { display: "flex", gap: 2 },
  navBtn: (active) => ({
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "6px 14px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    background: active ? C.green : "transparent",
    color: active ? C.bg : C.textMuted,
    transition: "all 0.15s",
  }),
  content: { maxWidth: 860, margin: "0 auto", padding: "28px 24px" },
  sectionLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: C.textMuted,
    marginBottom: 12,
  },
  card: (accentColor) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderLeft: accentColor ? `4px solid ${accentColor}` : `1px solid ${C.border}`,
    borderRadius: accentColor ? "0 12px 12px 0" : 12,
    padding: "16px 20px",
    marginBottom: 12,
  }),
  teamName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: "0.02em",
    color: C.textPrimary,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 4,
    background: C.surfaceAlt,
    color: C.textMuted,
    letterSpacing: "0.04em",
  },
  matchup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "12px 0",
  },
  flagBig: { fontSize: 28, lineHeight: 1 },
  vsText: { fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: "0.1em" },
  matchName: { fontSize: 15, fontWeight: 600, color: C.textPrimary },
  matchMeta: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  venueMeta: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  stakeRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  stakeDot: (dot) => ({
    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
    background: dot === "red" ? C.red : dot === "green" ? C.green : dot === "amber" ? C.amber : C.blue,
  }),
  stakeText: (dot) => ({
    fontSize: 13, fontWeight: 600,
    color: dot === "red" ? C.red : dot === "green" ? C.green : dot === "amber" ? C.amber : C.blue,
  }),
  calRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  calBtn: {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
    padding: "6px 14px", borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.surfaceAlt,
    color: C.textSecondary,
    cursor: "pointer", textTransform: "uppercase",
  },
  divider: { border: "none", borderTop: `1px solid ${C.border}`, margin: "28px 0" },
  pastHistory: {
    marginTop: 14, paddingTop: 14,
    borderTop: `1px solid ${C.border}`,
  },
  historyRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "5px 0", fontSize: 13, color: C.textSecondary,
  },
  resultPill: (res) => ({
    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
    background: res === "W" ? C.greenDim : res === "L" ? C.redDim : C.amberDim,
    color: res === "W" ? C.green : res === "L" ? C.red : C.amber,
    letterSpacing: "0.06em",
  }),
  elimSection: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "14px 18px", marginTop: 8,
  },
  elimTitle: { fontSize: 13, color: C.textMuted, marginBottom: 10, fontWeight: 500 },
  chips: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  elimChip: {
    fontSize: 12, padding: "4px 10px",
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.textDim, textDecoration: "line-through",
  },
  addChipBtn: {
    fontSize: 12, padding: "4px 12px",
    background: "transparent", border: `1px dashed ${C.borderSub}`,
    borderRadius: 6, color: C.green, cursor: "pointer",
    fontFamily: "'Barlow', sans-serif",
  },
  dateLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase",
    color: C.green, marginBottom: 8, marginTop: 20,
  },
  allMatchCard: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "12px 16px", marginBottom: 6,
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  matchTeamLine: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 14, fontWeight: 500, color: C.textPrimary,
  },
  scoreBox: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18,
    color: C.textPrimary, background: C.surfaceAlt,
    padding: "3px 12px", borderRadius: 6, minWidth: 52, textAlign: "center",
  },
  standingsGroupLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15,
    letterSpacing: "0.1em", textTransform: "uppercase", color: C.textPrimary,
    marginBottom: 8, borderLeft: `3px solid ${C.green}`, paddingLeft: 10,
  },
  standingsTable: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: 11, fontWeight: 700, color: C.textMuted, textAlign: "right",
    padding: "6px 8px", borderBottom: `1px solid ${C.border}`, letterSpacing: "0.06em",
  },
  td: (hl) => ({
    padding: "9px 8px", borderBottom: `1px solid ${C.borderSub}`,
    textAlign: "right", fontSize: 13,
    color: hl ? C.textPrimary : C.textSecondary,
    background: hl ? C.surfaceAlt : "transparent",
    fontWeight: hl ? 500 : 400,
  }),
  tdLeft: (hl) => ({
    padding: "9px 8px", borderBottom: `1px solid ${C.borderSub}`,
    textAlign: "left", fontSize: 13,
    color: hl ? C.textPrimary : C.textPrimary,
    background: hl ? C.surfaceAlt : "transparent",
    fontWeight: hl ? 600 : 400,
  }),
  youBadge: {
    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
    background: C.greenDim, color: C.green, marginLeft: 6, letterSpacing: "0.04em",
  },
  bracketRoundLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase",
    color: C.green, marginBottom: 10,
  },
  bracketMatch: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 10, overflow: "hidden", marginBottom: 8,
    width: 300, display: "inline-block", marginRight: 12, verticalAlign: "top",
  },
  bracketTeamRow: (winner) => ({
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 14px", fontSize: 14,
    fontWeight: winner ? 600 : 400,
    color: winner ? C.textPrimary : C.textSecondary,
    background: winner ? C.surfaceAlt : "transparent",
    borderBottom: `1px solid ${C.border}`,
  }),
  bracketScore: (winner) => ({
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16,
    color: winner ? C.green : C.textDim,
  }),
  modal: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
  },
  modalBox: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 28, width: 460,
    maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto",
  },
  modalTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20,
    color: C.textPrimary, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em",
  },
  modalSub: { fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  searchInput: {
    width: "100%", background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "10px 14px", fontSize: 14, color: C.textPrimary,
    fontFamily: "'Barlow', sans-serif", marginBottom: 14, outline: "none",
    boxSizing: "border-box",
  },
  countryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  countryOption: (selected, followed) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
    borderRadius: 8, border: selected ? `1px solid ${C.green}` : `1px solid ${C.border}`,
    background: selected ? C.greenDim : C.bg,
    cursor: followed ? "default" : "pointer",
    opacity: followed ? 0.45 : 1, fontSize: 13,
    color: selected ? C.green : C.textPrimary, fontWeight: selected ? 500 : 400,
  }),
  modalBtn: (primary) => ({
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
    letterSpacing: "0.08em", textTransform: "uppercase",
    padding: "9px 20px", borderRadius: 8,
    border: primary ? "none" : `1px solid ${C.border}`,
    background: primary ? C.green : "transparent",
    color: primary ? C.bg : C.textSecondary,
    cursor: "pointer", marginTop: 16, marginRight: 8,
  }),
  liveTag: {
    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
    background: C.redDim, color: C.red, letterSpacing: "0.08em",
    marginLeft: 8, verticalAlign: "middle",
  },
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function CalButtons({ match }) {
  return (
    <div style={S.calRow}>
      <a href={googleCalUrl(match)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        <button style={S.calBtn}>📅 Google Cal</button>
      </a>
      <a href={outlookCalUrl(match)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        <button style={S.calBtn}>📅 Outlook</button>
      </a>
      <button style={S.calBtn} onClick={() => icsDownload(match)}>⬇ .ics</button>
    </div>
  );
}

function MatchRow({ team, match }) {
  const opp = match.home === team ? match.away : match.home;
  const oppMeta = TEAM_META[opp];
  const isLive = match.status === "LIVE";
  const isFT = match.status === "FT";
  const isHome = match.home === team;
  const myScore = isHome ? match.homeScore : match.awayScore;
  const theirScore = isHome ? match.awayScore : match.homeScore;
  const res = isFT ? (myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D") : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderTop: `1px solid ${C.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        {res && <span style={S.resultPill(res)}>{res}</span>}
        {isLive && <span style={{ ...S.liveTag, marginLeft: 0 }}>LIVE</span>}
        <span style={{ fontSize: 20 }}>{oppMeta?.flag || "🏳"}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary }}>{opp}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {isFT || isLive ? match.stage : formatMatchTime(match.date)}
            {match.venue && match.venue !== "TBD" ? ` · ${match.venue}` : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {(isFT || isLive) && (
          <span style={S.scoreBox}>{myScore ?? "–"}–{theirScore ?? "–"}</span>
        )}
        {!isFT && !isLive && (
          <CalButtons match={match} />
        )}
      </div>
    </div>
  );
}

function HeroCard({ team, matches, standings, isKnockout, onRemove }) {
  const meta = TEAM_META[team];
  const teamMatches = matches
    .filter(m => (m.home === team || m.away === team))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextUpcoming = teamMatches.find(m => m.status === "upcoming");
  const stake = isKnockout ? { label: "Knockout — win or go home", dot: "blue" } : getStake(team, standings);
  const groupRow = standings[meta?.group]?.find(r => r.team === team);
  const recordStr = groupRow ? `${groupRow.w}W ${groupRow.d}D ${groupRow.l}L` : "";
  const stageBadge = isKnockout ? (nextUpcoming?.stage || "Knockout") : `Group ${meta?.group}${recordStr ? ` · ${recordStr}` : ""}`;
  const accentColor = stake?.dot === "red" ? C.red : stake?.dot === "green" ? C.green : stake?.dot === "amber" ? C.amber : C.blue;

  return (
    <div style={S.card(accentColor)}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={S.teamName}>{meta?.flag} {team}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {stake && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={S.stakeDot(stake.dot)}></div>
              <span style={{ ...S.stakeText(stake.dot), fontSize: 12 }}>{stake.label}</span>
            </div>
          )}
          <span style={S.badge}>{stageBadge}</span>
          <button onClick={onRemove} title="Unfollow"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textDim, fontSize: 18, lineHeight: 1, padding: "2px 4px" }}>×</button>
        </div>
      </div>

      {/* All matches */}
      {teamMatches.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted, padding: "10px 0" }}>No matches scheduled yet.</div>
      ) : (
        teamMatches.map(m => <MatchRow key={m.id} team={team} match={m} />)
      )}
    </div>
  );
}

function AddTeamModal({ followed, allTeams, onSave, onClose }) {
  const [query, setQuery] = useState("");
  // Start with current followed list so user can also deselect to unfollow
  const [selected, setSelected] = useState([...followed]);

  const all = allTeams?.length ? allTeams : Object.keys(TEAM_META).filter(
    (t, i, arr) => arr.findIndex(x => TEAM_META[x]?.flag === TEAM_META[t]?.flag) === i
  );

  // USA first, then alphabetical
  const sorted = [...all].sort((a, b) => {
    if (a === "USA" || a === "United States") return -1;
    if (b === "USA" || b === "United States") return 1;
    return a.localeCompare(b);
  });

  const filtered = sorted.filter(t => t.toLowerCase().includes(query.toLowerCase()));

  const toggle = (t) => setSelected(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t]);

  const added   = selected.filter(t => !followed.includes(t)).length;
  const removed = followed.filter(t => !selected.includes(t)).length;
  const btnLabel = added > 0 && removed > 0 ? `Save (${added} added, ${removed} removed)`
    : added > 0  ? `Add ${added} team${added > 1 ? "s" : ""}`
    : removed > 0 ? `Remove ${removed} team${removed > 1 ? "s" : ""}`
    : "Save";

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>Manage teams</div>
        <div style={S.modalSub}>Select to follow, deselect to unfollow. USA listed first.</div>
        <input
          style={S.searchInput}
          placeholder="Search countries…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <div style={S.countryGrid}>
          {filtered.map(t => {
            const isSel = selected.includes(t);
            return (
              <div key={t} style={S.countryOption(isSel, false)} onClick={() => toggle(t)}>
                <span style={{ fontSize: 20 }}>{TEAM_META[t]?.flag || "🏳"}</span>
                <span>{t}</span>
                {isSel
                  ? <span style={{ marginLeft: "auto", color: C.green, fontSize: 14 }}>✓</span>
                  : <span style={{ marginLeft: "auto", fontSize: 11, color: C.textDim }}>+</span>
                }
              </div>
            );
          })}
        </div>
        <div>
          <button style={S.modalBtn(true)} onClick={() => { onSave(selected); onClose(); }}>
            {btnLabel}
          </button>
          <button style={S.modalBtn(false)} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

function MyTeams({ followed, eliminated, matches, standings, onOpenAdd, onRemove }) {
  const active = followed.filter(t => !eliminated.includes(t));
  const knockoutStages = ["Round of 16", "Quarter-final", "Semi-final", "Final"];
  const isKnockout = (team) => {
    const next = matches.find(m => (m.home === team || m.away === team) && m.status === "upcoming");
    return next && knockoutStages.some(s => next.stage?.includes(s));
  };

  return (
    <div>
      {active.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚽</div>
          <div style={{ fontSize: 16, marginBottom: 8, color: C.textSecondary }}>No teams followed yet</div>
          <button style={{ ...S.modalBtn(true), marginTop: 0 }} onClick={onOpenAdd}>+ Follow teams</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={S.sectionLabel}>Your teams · next matches</div>
            <button style={{ ...S.calBtn, border: `1px dashed ${C.borderSub}`, color: C.green }} onClick={onOpenAdd}>
              + Add team
            </button>
          </div>
          {active.map(team => (
            <HeroCard key={team} team={team} matches={matches} standings={standings} isKnockout={isKnockout(team)} onRemove={() => onRemove(team)} />
          ))}
        </>
      )}
      {eliminated.length > 0 && (
        <div style={S.elimSection}>
          <div style={S.elimTitle}>Eliminated</div>
          <div style={S.chips}>
            {eliminated.map(t => <span key={t} style={S.elimChip}>{TEAM_META[t]?.flag} {t}</span>)}
            <button style={S.addChipBtn} onClick={onOpenAdd}>+ Follow another</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AllMatches({ followed, matches }) {
  const [filter, setFilter] = useState("all");
  const pool = filter === "mine"
    ? matches.filter(m => followed.includes(m.home) || followed.includes(m.away))
    : matches;

  const upcoming = pool.filter(m => m.status === "upcoming");
  const live     = pool.filter(m => m.status === "LIVE");
  const completed = pool.filter(m => m.status === "FT").reverse();
  const grouped = groupMatchesByDate(upcoming);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all", "mine"].map(f => (
          <button key={f} style={S.navBtn(filter === f)} onClick={() => setFilter(f)}>
            {f === "all" ? "All matches" : "My teams only"}
          </button>
        ))}
      </div>

      {live.length > 0 && (
        <>
          <div style={{ ...S.dateLabel, color: C.red }}>🔴 Live now</div>
          {live.map(m => (
            <div key={m.id} style={{ ...S.allMatchCard, border: `1px solid ${C.red}33` }}>
              <div>
                <div style={S.matchTeamLine}>
                  <span>{TEAM_META[m.home]?.flag} {m.home}</span>
                  <span style={S.scoreBox}>{m.homeScore ?? "–"}–{m.awayScore ?? "–"}</span>
                  <span>{m.away} {TEAM_META[m.away]?.flag}</span>
                  <span style={S.liveTag}>LIVE</span>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{m.stage} · {m.venue}</div>
              </div>
            </div>
          ))}
          <hr style={S.divider} />
        </>
      )}

      {grouped.map(([dateStr, dayMatches]) => (
        <div key={dateStr}>
          <div style={S.dateLabel}>{formatDateOnly(dayMatches[0].date)}</div>
          {dayMatches.map(m => (
            <div key={m.id} style={S.allMatchCard}>
              <div style={{ flex: 1 }}>
                <div style={S.matchTeamLine}>
                  <span>{TEAM_META[m.home]?.flag}</span>
                  <span>{m.home}</span>
                  <span style={{ color: C.textDim, fontSize: 12, margin: "0 4px" }}>vs</span>
                  <span>{TEAM_META[m.away]?.flag}</span>
                  <span>{m.away}</span>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  {formatMatchTime(m.date)} · {m.stage} · {m.venue}
                </div>
              </div>
              <CalButtons match={m} />
            </div>
          ))}
        </div>
      ))}

      {completed.length > 0 && (
        <>
          <hr style={S.divider} />
          <div style={{ ...S.dateLabel, color: C.textMuted }}>Results</div>
          {completed.map(m => (
            <div key={m.id} style={S.allMatchCard}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{TEAM_META[m.home]?.flag} {m.home}</span>
                  <span style={S.scoreBox}>{m.homeScore}–{m.awayScore}</span>
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{m.away} {TEAM_META[m.away]?.flag}</span>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{m.stage} · {formatDateOnly(m.date)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: "0.06em" }}>FT</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Standings({ followed, standings }) {
  return (
    <div>
      {Object.entries(standings).map(([group, rows]) => (
        <div key={group} style={{ marginBottom: 28 }}>
          <div style={S.standingsGroupLabel}>Group {group}</div>
          <table style={S.standingsTable}>
            <thead>
              <tr>
                <th style={{ ...S.th, textAlign: "left" }}>Team</th>
                {["P","W","D","L","GF","GA","GD","Pts"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const hl = followed.includes(row.team);
                const meta = TEAM_META[row.team];
                return (
                  <tr key={row.team}>
                    <td style={S.tdLeft(hl)}>
                      {i < 2 && <span style={{ display: "inline-block", width: 3, height: 13, background: C.green, borderRadius: 2, marginRight: 8, verticalAlign: "middle" }} />}
                      {meta?.flag} {row.team}
                      {hl && <span style={S.youBadge}>YOU</span>}
                    </td>
                    {[row.p, row.w, row.d, row.l, row.gf, row.ga, row.gf - row.ga].map((v, idx) => (
                      <td key={idx} style={S.td(hl)}>{v}</td>
                    ))}
                    <td style={{ ...S.td(hl), fontWeight: 700, color: hl ? C.green : C.textPrimary }}>{row.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
        <span style={{ display: "inline-block", width: 3, height: 10, background: C.green, borderRadius: 2, marginRight: 6, verticalAlign: "middle" }} />
        Top 2 in each group + 8 best 3rd-place teams advance to Round of 32
      </div>
    </div>
  );
}

function Bracket({ followed, matches }) {
  // Derive bracket rounds from API match data by stage
  const knockoutOrder = ["ROUND_OF_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL", "THIRD_PLACE"];
  const roundLabels = {
    "ROUND_OF_16":   "Round of 32",
    "QUARTER_FINALS":"Quarter-finals",
    "SEMI_FINALS":   "Semi-finals",
    "FINAL":         "Final",
    "THIRD_PLACE":   "Third place",
  };

  const knockoutMatches = matches.filter(m =>
    knockoutOrder.some(k => m.stage?.toUpperCase().includes(k.replace("_", "")) ||
      m.stage === k || m.stage?.replace(/ /g,"_").toUpperCase() === k)
  );

  // Group by stage preserving order
  const byStage = {};
  knockoutMatches.forEach(m => {
    const key = m.stage || "TBD";
    if (!byStage[key]) byStage[key] = [];
    byStage[key].push(m);
  });

  const stages = Object.keys(byStage);

  if (stages.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 14 }}>Bracket will appear once knockout rounds are drawn.</div>
      </div>
    );
  }

  return (
    <div>
      {stages.map(stage => (
        <div key={stage} style={{ marginBottom: 32 }}>
          <div style={S.bracketRoundLabel}>{roundLabels[stage] || stage}</div>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {byStage[stage].map(m => {
              const homeWon = m.homeScore !== null && m.homeScore > m.awayScore;
              const awayWon = m.awayScore !== null && m.awayScore > m.homeScore;
              const hMeta = TEAM_META[m.home];
              const aMeta = TEAM_META[m.away];
              const hFol = followed.includes(m.home);
              const aFol = followed.includes(m.away);
              return (
                <div key={m.id} style={S.bracketMatch}>
                  <div style={S.bracketTeamRow(homeWon)}>
                    <span style={{ fontWeight: hFol ? 700 : 400 }}>
                      {hMeta?.flag || "🏳"} {m.home}
                      {hFol && <span style={S.youBadge}>YOU</span>}
                    </span>
                    <span style={S.bracketScore(homeWon)}>{m.homeScore !== null ? m.homeScore : "–"}</span>
                  </div>
                  <div style={{ ...S.bracketTeamRow(awayWon), borderBottom: "none" }}>
                    <span style={{ fontWeight: aFol ? 700 : 400 }}>
                      {aMeta?.flag || "🏳"} {m.away}
                      {aFol && <span style={S.youBadge}>YOU</span>}
                    </span>
                    <span style={S.bracketScore(awayWon)}>{m.awayScore !== null ? m.awayScore : "–"}</span>
                  </div>
                  {m.status === "upcoming" && (
                    <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{formatMatchTime(m.date)}</div>
                      <CalButtons match={m} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]               = useState("my");

  // Persist followed + eliminated teams across refreshes
  const [followed, setFollowed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wc2026_followed")) || []; }
    catch { return []; }
  });
  const [eliminated, setEliminated] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wc2026_eliminated")) || []; }
    catch { return []; }
  });
  const [showAdd, setShowAdd]       = useState(false);
  const [matches, setMatches]       = useState([]);
  const [standings, setStandings]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const pollRef = useRef(null);
  const matchesRef = useRef([]);

  // Save to localStorage whenever followed/eliminated changes
  useEffect(() => {
    localStorage.setItem("wc2026_followed", JSON.stringify(followed));
  }, [followed]);

  useEffect(() => {
    localStorage.setItem("wc2026_eliminated", JSON.stringify(eliminated));
  }, [eliminated]);

  const loadFromAPI = useCallback(async () => {
    try {
      const { matches: m, standings: s } = await fetchTournamentData();
      setMatches(m);
      matchesRef.current = m;
      setStandings(s);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error("World Cup API fetch failed:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + smart polling — only re-fetches during live match windows
  useEffect(() => {
    loadFromAPI();

    pollRef.current = setInterval(() => {
      if (anyMatchLiveNow(matchesRef.current)) {
        loadFromAPI();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [loadFromAPI]);

  const tabs = [
    { id: "my",        label: "My Teams" },
    { id: "matches",   label: "All Matches" },
    { id: "standings", label: "Standings" },
    { id: "bracket",   label: "Bracket" },
  ];

  const LoadingScreen = () => (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Loading tournament data…
      </div>
      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>Fetching matches and standings</div>
    </div>
  );

  const ErrorScreen = () => (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: C.red, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Could not load data
      </div>
      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8, marginBottom: 20 }}>{error}</div>
      <button style={S.modalBtn(true)} onClick={loadFromAPI}>Retry</button>
    </div>
  );

  return (
    <>
      <style>{FONT}</style>
      <div style={S.app}>
        <header style={S.header}>
          <div style={S.logo}>
            World<span style={S.logoAccent}>Cup</span> 2026
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <nav style={S.nav}>
              {tabs.map(t => (
                <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
            {lastRefresh && (
              <span style={{ fontSize: 11, color: C.textDim }}>
                Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </header>

        <main style={S.content}>
          {loading ? <LoadingScreen /> : error ? <ErrorScreen /> : (
            <>
              {tab === "my" && (
                <MyTeams
                  followed={followed}
                  eliminated={eliminated}
                  matches={matches}
                  standings={standings}
                  onOpenAdd={() => setShowAdd(true)}
                  onRemove={team => setFollowed(f => f.filter(t => t !== team))}
                />
              )}
              {tab === "matches"   && <AllMatches followed={followed} matches={matches} />}
              {tab === "standings" && <Standings  followed={followed} standings={standings} />}
              {tab === "bracket"   && <Bracket    followed={followed} matches={matches} />}
            </>
          )}
        </main>

        {showAdd && (
          <AddTeamModal
            followed={followed}
            allTeams={Object.keys(TEAM_META).filter((t, i, arr) => arr.findIndex(x => TEAM_META[x]?.flag === TEAM_META[t]?.flag && TEAM_META[x]?.group === TEAM_META[t]?.group) === i)}
            onSave={teams => setFollowed(teams)}
            onClose={() => setShowAdd(false)}
          />
        )}
      </div>
    </>
  );
}
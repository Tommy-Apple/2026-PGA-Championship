import { useState, useEffect, useRef } from "react";

const FIREBASE_URL = "https://YOUR-PROJECT-default-rtdb.firebaseio.com";
const DRAFT_PATH = `${FIREBASE_URL}/pga-draft-2026.json`;
const ESPN_API = "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

const GREEN = "#1a6b3c";
const GREEN_LIGHT = "#2d9b5a";
const GOLD = "#c9a840";
const CREAM = "#faf7f0";
const DARK = "#0d1f0f";
const GRAY = "#6b7b6e";
const RED = "#e05252";

function getRoundForPick(pickIndex) {
  return Math.floor(pickIndex / 11) + 1;
}

function getTeamForPick(pickIndex) {
  const round = Math.floor(pickIndex / 11);
  const pos = pickIndex % 11;
  return round % 2 === 0 ? pos : 10 - pos;
}

// Normalize player name for fuzzy matching ESPN names to draft names
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreColor(score) {
  if (score === null || score === undefined || score === "E") return CREAM;
  const n = typeof score === "string" ? parseInt(score) : score;
  if (isNaN(n)) return CREAM;
  if (n < 0) return "#4ade80";
  if (n > 0) return RED;
  return CREAM;
}

function formatScore(score) {
  if (score === null || score === undefined) return "–";
  if (score === 0 || score === "E") return "E";
  if (typeof score === "number") return score > 0 ? `+${score}` : `${score}`;
  return score;
}

function ScoreCard({ team, rank, isYou }) {
  const { name, golfers, teamScore, hasFourMakeCut } = team;

  return (
    <div style={{
      ...s.card,
      ...(isYou ? s.cardHighlight : {}),
      ...(rank === 1 ? s.cardFirst : {}),
    }}>
      <div style={s.cardHeader}>
        <div style={s.rankBadge}>
          {rank === 1 ? "🏆" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
        </div>
        <div style={s.teamInfo}>
          <div style={s.teamName}>{name} {isYou ? "⭐" : ""}</div>
          {!hasFourMakeCut && (
            <div style={s.cutWarning}>⚠️ Needs 4 to make cut</div>
          )}
        </div>
        <div style={s.teamTotal}>
          <div style={{ ...s.totalScore, color: scoreColor(teamScore) }}>
            {formatScore(teamScore)}
          </div>
          <div style={s.totalLabel}>TOP 4</div>
        </div>
      </div>

      <div style={s.golferList}>
        {golfers.map((g, i) => (
          <div key={i} style={{
            ...s.golferRow,
            ...(g.countsToScore ? s.golferCounts : {}),
            ...(g.missedCut ? s.golferMC : {}),
          }}>
            <div style={s.golferLeft}>
              {g.countsToScore && <span style={s.countsDot}>●</span>}
              <span style={s.golferName}>{g.name}</span>
            </div>
            <div style={s.golferRight}>
              {g.missedCut ? (
                <span style={s.mcBadge}>MC</span>
              ) : g.withdrawn ? (
                <span style={s.wdBadge}>WD</span>
              ) : (
                <>
                  <span style={{ ...s.golferScore, color: scoreColor(g.score) }}>
                    {formatScore(g.score)}
                  </span>
                  <span style={s.golferThru}>{g.thru || "–"}</span>
                  {g.position && <span style={s.golferPos}>{g.position}</span>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Scoreboard() {
  const [draftState, setDraftState] = useState(null);
  const [espnData, setEspnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Load draft state from Firebase
  const loadDraft = async () => {
    try {
      const res = await fetch(DRAFT_PATH);
      const data = await res.json();
      if (data) {
        if (data.picks && !Array.isArray(data.picks)) data.picks = Object.values(data.picks);
        if (data.teams && !Array.isArray(data.teams)) data.teams = Object.values(data.teams);
        if (!data.picks) data.picks = [];
        setDraftState(data);
      }
    } catch (e) {
      setError("Could not load draft data from Firebase.");
    }
  };

  // Load live scores from ESPN
  const loadScores = async () => {
    try {
      const res = await fetch(ESPN_API);
      const data = await res.json();
      setEspnData(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError("Could not load live scores. ESPN API may be unavailable.");
    }
  };

  useEffect(() => {
    Promise.all([loadDraft(), loadScores()]).finally(() => setLoading(false));
    // Refresh scores every 60 seconds
    pollRef.current = setInterval(loadScores, 60000);
    return () => clearInterval(pollRef.current);
  }, []);

  // Build scoreboard data
  const buildScoreboard = () => {
    if (!draftState || !espnData) return [];

    // Build ESPN player map: normalized name -> score data
    const espnPlayers = {};
    const competitors = espnData?.events?.[0]?.competitions?.[0]?.competitors || [];
    competitors.forEach(c => {
      const name = normalizeName(c.athlete?.displayName || "");
      const scoreVal = c.score?.displayValue;
      const status = c.status?.type?.name || "";
      const thru = c.status?.thru || c.status?.period;
      const pos = c.statistics?.find(s => s.name === "position")?.displayValue || c.status?.position?.displayValue;

      let score = null;
      if (scoreVal === "E") score = 0;
      else if (scoreVal) score = parseInt(scoreVal);

      espnPlayers[name] = {
        score,
        missedCut: status === "STATUS_CUT" || status === "STATUS_MISSED_CUT",
        withdrawn: status === "STATUS_WITHDRAWN" || status === "STATUS_WD",
        thru: thru ? `Thru ${thru}` : "–",
        position: pos || "",
      };
    });

    // Build team scorecards
    return draftState.teams.map((team, teamIdx) => {
      const teamPicks = draftState.picks.filter(p => p.teamId === team.id);

      const golfers = teamPicks.map(pick => {
        const normalized = normalizeName(pick.golfer);
        // Try exact match first, then partial
        let espn = espnPlayers[normalized];
        if (!espn) {
          const key = Object.keys(espnPlayers).find(k =>
            k.includes(normalized) || normalized.includes(k)
          );
          espn = key ? espnPlayers[key] : null;
        }

        return {
          name: pick.golfer,
          score: espn?.score ?? null,
          missedCut: espn?.missedCut || false,
          withdrawn: espn?.withdrawn || false,
          thru: espn?.thru || "–",
          position: espn?.position || "",
        };
      });

      // Sort: active players by score, then MC/WD at bottom
      const active = golfers
        .filter(g => !g.missedCut && !g.withdrawn && g.score !== null)
        .sort((a, b) => a.score - b.score);
      const noScore = golfers.filter(g => !g.missedCut && !g.withdrawn && g.score === null);
      const mc = golfers.filter(g => g.missedCut || g.withdrawn);

      const sorted = [...active, ...noScore, ...mc];

      // Top 4 that count (not MC/WD, best scores)
      const counting = active.slice(0, 4);
      const teamScore = counting.length > 0
        ? counting.reduce((sum, g) => sum + g.score, 0)
        : null;

      // Mark which golfers count
      const countingNames = new Set(counting.map(g => g.name));
      sorted.forEach(g => { g.countsToScore = countingNames.has(g.name); });

      const madeCut = golfers.filter(g => !g.missedCut && !g.withdrawn).length;

      return {
        id: team.id,
        name: team.name,
        golfers: sorted,
        teamScore,
        hasFourMakeCut: madeCut >= 4,
        pickCount: teamPicks.length,
      };
    });
  };

  const teams = buildScoreboard();

  // Sort teams: null scores last, then by score
  const sorted = [...teams].sort((a, b) => {
    if (a.teamScore === null && b.teamScore === null) return 0;
    if (a.teamScore === null) return 1;
    if (b.teamScore === null) return -1;
    return a.teamScore - b.teamScore;
  });

  if (loading) {
    return (
      <div style={s.loading}>
        <div style={{ fontSize: 40 }}>⛳</div>
        <div>Loading scoreboard…</div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 28 }}>⛳</span>
          <div>
            <div style={s.logoTitle}>PGA Championship 2026</div>
            <div style={s.logoSub}>Live Fantasy Scoreboard · Aronimink</div>
          </div>
        </div>
        <div style={s.headerRight}>
          {error && <span style={s.errorBadge}>⚠️ {error}</span>}
          {lastUpdated && (
            <span style={s.updated}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button style={s.refreshBtn} onClick={loadScores}>↻ Refresh</button>
        </div>
      </div>

      {/* Legend */}
      <div style={s.legend}>
        <span style={s.legendItem}><span style={{ color: "#4ade80" }}>●</span> Counts toward team score (top 4)</span>
        <span style={s.legendItem}><span style={s.mcBadge}>MC</span> Missed cut</span>
        <span style={s.legendItem}><span style={{ color: GOLD }}>⚠️</span> Needs 4 to make cut</span>
      </div>

      {/* Scoreboard */}
      <div style={s.grid}>
        {sorted.map((team, i) => (
          <ScoreCard
            key={team.id}
            team={team}
            rank={i + 1}
            isYou={team.name === "Tommy Applebaum"}
          />
        ))}
      </div>

      <div style={s.footer}>
        🏆 Winner bonus (-2) applied manually after tournament · Scores auto-refresh every 60 seconds
      </div>
    </div>
  );
}

const s = {
  loading: {
    minHeight: "100vh", background: DARK, display: "flex", flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center", gap: 10,
    color: CREAM, fontFamily: "'Georgia', serif", fontSize: 18,
  },
  wrap: { minHeight: "100vh", background: DARK, color: CREAM, fontFamily: "'Georgia', serif" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", background: "rgba(0,0,0,0.4)",
    borderBottom: `1px solid rgba(201,168,64,0.2)`, flexWrap: "wrap" as const, gap: 10,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoTitle: { fontSize: 17, fontWeight: 700, color: GOLD, lineHeight: 1.2 },
  logoSub: { fontSize: 12, color: GRAY },
  headerRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const },
  updated: { fontSize: 11, color: GRAY },
  errorBadge: { fontSize: 11, color: "#fca5a5", background: "#7f1d1d", padding: "3px 8px", borderRadius: 4 },
  refreshBtn: {
    background: `rgba(201,168,64,0.15)`, border: `1px solid ${GOLD}`, color: GOLD,
    borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  },
  legend: {
    display: "flex", gap: 20, padding: "10px 20px", flexWrap: "wrap" as const,
    borderBottom: `1px solid rgba(255,255,255,0.06)`, background: "rgba(0,0,0,0.2)",
  },
  legendItem: { fontSize: 11, color: GRAY, display: "flex", alignItems: "center", gap: 6 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 12, padding: 16,
  },
  card: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, overflow: "hidden",
  },
  cardHighlight: {
    border: `1px solid rgba(201,168,64,0.4)`,
    background: "rgba(201,168,64,0.05)",
  },
  cardFirst: {
    border: `1px solid rgba(74,222,128,0.4)`,
    background: "rgba(74,222,128,0.05)",
  },
  cardHeader: {
    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
    background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  rankBadge: { fontSize: 20, flexShrink: 0, width: 32, textAlign: "center" as const },
  teamInfo: { flex: 1 },
  teamName: { fontWeight: 700, fontSize: 14, color: CREAM },
  cutWarning: { fontSize: 10, color: GOLD, marginTop: 2 },
  teamTotal: { textAlign: "right" as const },
  totalScore: { fontSize: 22, fontWeight: 700 },
  totalLabel: { fontSize: 9, color: GRAY, letterSpacing: 1 },
  golferList: { padding: "6px 0" },
  golferRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)",
    opacity: 0.6,
  },
  golferCounts: { opacity: 1, background: "rgba(45,155,90,0.08)" },
  golferMC: { opacity: 0.35 },
  golferLeft: { display: "flex", alignItems: "center", gap: 6 },
  countsDot: { color: "#4ade80", fontSize: 8, flexShrink: 0 },
  golferName: { fontSize: 13, color: CREAM },
  golferRight: { display: "flex", alignItems: "center", gap: 8 },
  golferScore: { fontSize: 14, fontWeight: 700 },
  golferThru: { fontSize: 10, color: GRAY },
  golferPos: { fontSize: 10, color: GOLD },
  mcBadge: {
    fontSize: 10, background: "rgba(224,82,82,0.2)", color: RED,
    border: `1px solid ${RED}`, borderRadius: 3, padding: "1px 5px",
  },
  wdBadge: {
    fontSize: 10, background: "rgba(107,123,110,0.2)", color: GRAY,
    border: `1px solid ${GRAY}`, borderRadius: 3, padding: "1px 5px",
  },
  footer: {
    textAlign: "center" as const, padding: "16px 20px", fontSize: 11,
    color: GRAY, borderTop: "1px solid rgba(255,255,255,0.06)",
  },
};

import { useState, useEffect, useRef } from "react";

const FIREBASE_URL = "https://pga-championship-55d2f-default-rtdb.firebaseio.com/";
const DRAFT_PATH = `${FIREBASE_URL}/pga-draft-2026.json`;
const ESPN_API = "https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

const TOTAL_TEAMS = 11;
const TOTAL_ROUNDS = 6;
const TOTAL_PICKS = TOTAL_TEAMS * TOTAL_ROUNDS;

const GREEN = "#1a6b3c";
const GREEN_LIGHT = "#2d9b5a";
const GOLD = "#c9a840";
const CREAM = "#faf7f0";
const DARK = "#0d1f0f";
const GRAY = "#6b7b6e";
const RED = "#e05252";

const PGA_GOLFERS = [
  "Ludvig Aberg", "Angel Ayora", "Derek Berg", "Daniel Berger",
  "Christiaan Bezuidenhout", "Akshay Bhatia", "Francisco Bide", "Chandler Blanchet",
  "Michael Block", "Keegan Bradley", "Michael Brennan", "Jacob Bridgeman",
  "Daniel Brown", "Sam Burns", "Brian Campbell", "Patrick Cantlay",
  "Ricky Castillo", "Bud Cauley", "Stewart Cink", "Wyndham Clark",
  "Tyler Collet", "Corey Conners", "Pierceson Coody", "Jason Day",
  "Bryson DeChambeau", "Thomas Detry", "Luke Donald", "Jesse Droemer",
  "Jason Dufner", "Nico Echavarria", "Harris English", "Bryce Fisher",
  "Steven Fisk", "Alex Fitzpatrick", "Matt Fitzpatrick", "Tommy Fleetwood",
  "Rickie Fowler", "Ryan Fox", "Chris Gabriele", "Mark Geddes",
  "Ryan Gerard", "Lucas Glover", "Chris Gotterup", "Max Greyserman",
  "Ben Griffin", "Emiliano Grillo", "Jordan Gumberg", "Harry Hall",
  "Brian Harman", "Padraig Harrington", "Tyrrell Hatton", "Zach Haynes",
  "Russell Henley", "Kazuki Higa", "Garrick Higgo", "Joe Highsmith",
  "Daniel Hillier", "Ryo Hisatsune", "Rico Hoey", "Nicolai Hojgaard",
  "Rasmus Hojgaard", "Ian Holt", "Max Homa", "Billy Horschel",
  "Viktor Hovland", "Austin Hurt", "Sungjae Im", "Stephan Jaeger",
  "Casey Jarvis", "Dustin Johnson", "Jared Jones", "Kota Kaneko",
  "Michael Kartrude", "Martin Kaymer", "John Keefer", "Ben Kern",
  "Michael Kim", "Si Woo Kim", "Chris Kirk", "Kurt Kitayama",
  "Jake Knapp", "Brooks Koepka", "Min Woo Lee", "Ryan Lenahan",
  "Haotong Li", "Mikael Lindberg", "David Lipsky", "Shane Lowry",
  "Robert MacIntyre", "Hideki Matsuyama", "Denny McCarthy", "Matt McCarty",
  "Paul McClure", "Max McGreevy", "Rory McIlroy", "Tom McKibbin",
  "Maverick McNealy", "Shaun Micheel", "Keith Mitchell", "Collin Morikawa",
  "William Mouw", "Rasmus Neergaard-Petersen", "Joaquin Niemann", "Alex Noren",
  "Andrew Novak", "John Parry", "Taylor Pendrith", "Marco Penge",
  "Ben Polland", "J.T. Poston", "Aldrich Potgieter", "David Puig",
  "Andrew Putnam", "Jon Rahm", "Aaron Rai", "Patrick Reed",
  "Kristoffer Reitan", "Davis Riley", "Patrick Rodgers", "Justin Rose",
  "Adrien Saddier", "Garrett Sapp", "Jayden Schaper", "Xander Schauffele",
  "Scottie Scheffler", "Adam Schenk", "Matti Schmid", "Adam Scott",
  "Braden Shattuck", "Alex Smalley", "Cameron Smith", "Jordan Smith",
  "Austin Smotherman", "Elvis Smylie", "Travis Smyth", "Brandt Snedeker",
  "J.J. Spaun", "Jordan Spieth", "Sam Stevens", "Sepp Straka",
  "Andy Sullivan", "Nick Taylor", "Sahith Theegala", "Justin Thomas",
  "Michael Thorbjornsen", "Sami Valimaki", "Jhonattan Vegas", "Ryan Vermeer",
  "Jimmy Walker", "Matt Wallace", "Bernd Wiesberger", "Timothy Wiseman",
  "Gary Woodland", "Y.E. Yang", "Sudarshan Yellamaraju", "Cameron Young",
];

function getTeamForPick(pickIndex) {
  const round = Math.floor(pickIndex / TOTAL_TEAMS);
  const pos = pickIndex % TOTAL_TEAMS;
  return round % 2 === 0 ? pos : TOTAL_TEAMS - 1 - pos;
}

function getRoundForPick(pickIndex) {
  return Math.floor(pickIndex / TOTAL_TEAMS) + 1;
}

function buildSnakeOrder() {
  return Array.from({ length: TOTAL_PICKS }, (_, i) => ({
    pickNumber: i + 1, round: getRoundForPick(i), team: getTeamForPick(i),
  }));
}

const SNAKE_ORDER = buildSnakeOrder();

const DEFAULT_STATE = {
  teams: Array.from({ length: TOTAL_TEAMS }, (_, i) => ({ id: i, name: `Team ${i + 1}`, phone: "" })),
  picks: [],
  setupDone: false,
};

function getSMSLink(phone, message) { return `sms:${phone}?body=${encodeURIComponent(message)}`; }

async function fbRead() {
  const res = await fetch(DRAFT_PATH);
  if (!res.ok) throw new Error("Firebase read failed");
  return await res.json();
}

async function fbWrite(state) {
  const res = await fetch(DRAFT_PATH, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
  if (!res.ok) throw new Error("Firebase write failed");
}

function normalizeName(name) {
  return name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function scoreColor(score) {
  if (score === null || score === undefined) return CREAM;
  const n = typeof score === "string" ? parseInt(score) : score;
  if (isNaN(n) || n === 0) return CREAM;
  return n < 0 ? "#4ade80" : RED;
}

function formatScore(score) {
  if (score === null || score === undefined) return "–";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────
function Scoreboard({ draftState }) {
  const [espnData, setEspnData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [scoreError, setScoreError] = useState(null);
  const [winnerBonus, setWinnerBonus] = useState({});
  const pollRef = useRef(null);

  const loadScores = async () => {
    try {
      const res = await fetch(ESPN_API);
      const data = await res.json();
      setEspnData(data);
      setLastUpdated(new Date());
      setScoreError(null);
    } catch {
      setScoreError("Could not load live scores from ESPN.");
    }
  };

  useEffect(() => {
    loadScores();
    pollRef.current = setInterval(loadScores, 30000);
    return () => clearInterval(pollRef.current);
  }, []);

  const buildTeams = () => {
    if (!draftState) return [];
    const espnPlayers: Record<string, any> = {};
    const competitors = espnData?.events?.[0]?.competitions?.[0]?.competitors || [];
    competitors.forEach((c: any) => {
      const name = normalizeName(c.athlete?.displayName || "");
      const scoreVal = c.score?.displayValue;
      const status = c.status?.type?.name || "";
      const thru = c.status?.thru;
      const pos = c.status?.position?.displayValue || "";
      let score = null;
      if (scoreVal === "E") score = 0;
      else if (scoreVal) { const n = parseInt(scoreVal); if (!isNaN(n)) score = n; }
      espnPlayers[name] = {
        score,
        missedCut: status.includes("CUT") || status.includes("MISSED"),
        withdrawn: status.includes("WD") || status.includes("WITHDRAWN"),
        thru: thru ? `Thru ${thru}` : (status === "STATUS_SCHEDULED" ? "–" : "F"),
        position: pos,
      };
    });

    return draftState.teams.map((team: any) => {
      const teamPicks = draftState.picks.filter((p: any) => p.teamId === team.id);
      const golfers = teamPicks.map((pick: any) => {
        const norm = normalizeName(pick.golfer);
        let espn = espnPlayers[norm];
        if (!espn) {
          const key = Object.keys(espnPlayers).find(k => k.includes(norm) || norm.includes(k));
          espn = key ? espnPlayers[key] : null;
        }
        return {
          name: pick.golfer,
          score: espn?.score ?? null,
          missedCut: espn?.missedCut || false,
          withdrawn: espn?.withdrawn || false,
          thru: espn?.thru || "–",
          position: espn?.position || "",
          countsToScore: false,
        };
      });

      const active = golfers.filter(g => !g.missedCut && !g.withdrawn && g.score !== null).sort((a, b) => a.score - b.score);
      const noScore = golfers.filter(g => !g.missedCut && !g.withdrawn && g.score === null);
      const mc = golfers.filter(g => g.missedCut || g.withdrawn);
      const sorted = [...active, ...noScore, ...mc];

      const counting = active.slice(0, 4);
      const baseScore = counting.length > 0 ? counting.reduce((sum, g) => sum + g.score, 0) : null;
      const bonus = winnerBonus[team.id] ? -2 : 0;
      const teamScore = baseScore !== null ? baseScore + bonus : null;

      const countingNames = new Set(counting.map(g => g.name));
      sorted.forEach(g => { g.countsToScore = countingNames.has(g.name); });

      const madeCut = golfers.filter(g => !g.missedCut && !g.withdrawn).length;
      return { id: team.id, name: team.name, golfers: sorted, teamScore, baseScore, hasFourMakeCut: madeCut >= 4, hasBonus: !!winnerBonus[team.id] };
    });
  };

  const teams = buildTeams();
  const sorted = [...teams].sort((a, b) => {
    if (a.teamScore === null && b.teamScore === null) return 0;
    if (a.teamScore === null) return 1;
    if (b.teamScore === null) return -1;
    return a.teamScore - b.teamScore;
  });

  return (
    <div>
      {/* Score controls bar */}
      <div style={sb.controlBar}>
        <div style={sb.controlLeft}>
          {scoreError && <span style={sb.scoreError}>⚠️ {scoreError}</span>}
          {lastUpdated && <span style={sb.updated}>🔄 {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        <div style={sb.controlRight}>
          <span style={sb.hint}>🏆 Toggle winner bonus (-2) after tournament:</span>
          <button style={sb.refreshBtn} onClick={loadScores}>↻ Refresh</button>
        </div>
      </div>

      {/* Legend */}
      <div style={sb.legend}>
        <span style={sb.legendItem}><span style={{ color: "#4ade80" }}>●</span> Counts (top 4)</span>
        <span style={sb.legendItem}><span style={sb.mcBadge}>MC</span> Missed cut</span>
        <span style={sb.legendItem}><span style={sb.wdBadge}>WD</span> Withdrawn</span>
        <span style={sb.legendItem}>⚠️ Needs 4 to make cut</span>
      </div>

      {/* Cards */}
      <div style={sb.grid}>
        {sorted.map((team, i) => (
          <div key={team.id} style={{ ...sb.card, ...(i === 0 ? sb.cardFirst : {}) }}>
            <div style={sb.cardHeader}>
              <div style={sb.rank}>{i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</div>
              <div style={sb.teamMeta}>
                <div style={sb.teamNameSb}>{team.name}</div>
                {!team.hasFourMakeCut && <div style={sb.cutWarn}>⚠️ Needs 4 to make cut</div>}
              </div>
              <div style={sb.teamScoreBox}>
                <div style={{ ...sb.bigScore, color: scoreColor(team.teamScore) }}>{team.teamScore !== null ? formatScore(team.teamScore) : "–"}</div>
                <div style={sb.scoreLabel}>TOP 4</div>
                <button
                  style={{ ...sb.bonusBtn, ...(team.hasBonus ? sb.bonusBtnOn : {}) }}
                  onClick={() => setWinnerBonus(prev => ({ ...prev, [team.id]: !prev[team.id] }))}
                  title="Toggle winner bonus"
                >🏆 {team.hasBonus ? "-2 ON" : "+BONUS"}</button>
              </div>
            </div>
            <div style={sb.golferRows}>
              {team.golfers.map((g, j) => (
                <div key={j} style={{ ...sb.golferRow, ...(g.countsToScore ? sb.rowCounts : {}), ...(g.missedCut || g.withdrawn ? sb.rowFaded : {}) }}>
                  <div style={sb.golferLeft}>
                    {g.countsToScore && <span style={{ color: "#4ade80", fontSize: 8, marginRight: 4 }}>●</span>}
                    <span style={sb.golferNameSb}>{g.name}</span>
                  </div>
                  <div style={sb.golferRight}>
                    {g.missedCut ? <span style={sb.mcBadge}>MC</span>
                      : g.withdrawn ? <span style={sb.wdBadge}>WD</span>
                      : <>
                          <span style={{ ...sb.golferScore, color: scoreColor(g.score) }}>{formatScore(g.score)}</span>
                          <span style={sb.golferThru}>{g.thru}</span>
                          {g.position && <span style={sb.golferPos}>{g.position}</span>}
                        </>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={sb.footer}>Scores auto-refresh every 30 seconds · Winner bonus applied manually after tournament ends</div>
    </div>
  );
}

// ─── SetupScreen ─────────────────────────────────────────────────────────────
function SetupScreen({ teams, onSave }) {
  const [localTeams, setLocalTeams] = useState(teams);
  const update = (i, field, val) => setLocalTeams(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  return (
    <div style={s.setupWrap}>
      <div style={s.setupCard}>
        <div style={s.badge}>⛳ PGA Championship 2026</div>
        <h1 style={s.setupTitle}>Draft Setup</h1>
        <p style={s.setupSub}>Enter team names & phone numbers for iMessage notifications.</p>
        <div style={s.teamGrid}>
          {localTeams.map((t, i) => (
            <div key={i} style={s.teamRow}>
              <span style={s.teamNum}>{i + 1}</span>
              <input style={s.inputName} placeholder={`Team ${i + 1} name`} value={t.name} onChange={e => update(i, "name", e.target.value)} />
              <input style={s.inputPhone} placeholder="Phone (optional)" value={t.phone} onChange={e => update(i, "phone", e.target.value.replace(/\D/g, ""))} maxLength={10} />
            </div>
          ))}
        </div>
        <button style={s.startBtn} onClick={() => onSave(localTeams)}>Start Draft →</button>
      </div>
    </div>
  );
}

// ─── GolferPicker ─────────────────────────────────────────────────────────────
function GolferPicker({ available, onPick, currentTeam }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const filtered = available.filter(g => g.toLowerCase().includes(search.toLowerCase()));
  if (typeof document !== "undefined" && !document.getElementById("ce-placeholder-style")) {
    const style = document.createElement("style");
    style.id = "ce-placeholder-style";
    style.innerHTML = `[contenteditable][data-placeholder]:empty:before { content: attr(data-placeholder); color: rgba(255,255,255,0.3); pointer-events: none; }`;
    document.head.appendChild(style);
  }
  return (
    <div style={s.pickerWrap}>
      <div style={s.onClockBanner}>🔔 ON THE CLOCK: <strong>{currentTeam.name}</strong></div>
      <div style={{ ...s.searchInput, outline: "none", cursor: "text", minHeight: 20 }}
        contentEditable suppressContentEditableWarning data-placeholder="Search golfers…"
        onInput={e => { setSearch((e.target as HTMLDivElement).innerText); setSelected(null); }}
        onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} />
      <div style={s.golferList}>
        {filtered.map(g => (
          <div key={g} style={{ ...s.golferItem, ...(selected === g ? s.golferSelected : {}) }} onClick={() => setSelected(selected === g ? null : g)}>{g}</div>
        ))}
      </div>
      <button style={{ ...s.confirmBtn, ...(selected ? {} : s.confirmDisabled) }} disabled={!selected} onClick={() => selected && onPick(selected)}>
        {selected ? `✓ Confirm: ${selected}` : "Select a golfer above"}
      </button>
    </div>
  );
}

// ─── DraftBoard ───────────────────────────────────────────────────────────────
function DraftBoard({ state, onMakePick, onReset, syncing, firebaseReady }) {
  const { teams, picks } = state;
  const pickIndex = picks.length;
  const isDraftComplete = pickIndex >= TOTAL_PICKS;
  const currentTeamIdx = isDraftComplete ? null : getTeamForPick(pickIndex);
  const currentTeam = currentTeamIdx !== null ? teams[currentTeamIdx] : null;
  const pickedGolfers = new Set(picks.map(p => p.golfer));
  const available = PGA_GOLFERS.filter(g => !pickedGolfers.has(g));

  const [showPicker, setShowPicker] = useState(false);
  const [smsPrompt, setSmsPrompt] = useState(null);
  const [activeTab, setActiveTab] = useState(isDraftComplete ? "scoreboard" : "board");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handlePick = (golfer) => {
    onMakePick(golfer);
    setShowPicker(false);
    const nextPickIdx = picks.length + 1;
    if (nextPickIdx < TOTAL_PICKS) {
      const nextTeam = teams[getTeamForPick(nextPickIdx)];
      if (nextTeam?.phone) setSmsPrompt(nextTeam);
    }
  };

  const teamPicks = teams.map(t => picks.filter(p => p.teamId === t.id));
  const rounds = Array.from({ length: TOTAL_ROUNDS }, (_, r) => {
    const roundSlots = SNAKE_ORDER.filter(o => o.round === r + 1);
    return roundSlots.map(o => { const pick = picks.find(p => p.pickNumber === o.pickNumber); return { ...o, pick, team: teams[o.team] }; });
  });

  return (
    <div style={s.boardWrap}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.logoIcon}>⛳</span>
          <div>
            <div style={s.logoTitle}>PGA Championship 2026</div>
            <div style={s.logoSub}>{isDraftComplete ? "Live Fantasy Scoreboard · Aronimink" : "Fantasy Draft"}</div>
          </div>
        </div>
        <div style={s.headerRight}>
          {!firebaseReady && <span style={s.firebaseWarn}>⚠️ Set Firebase URL</span>}
          {syncing && <span style={s.syncing}>↑ Saving…</span>}
          {!isDraftComplete && <span style={s.pickCounter}>Pick {Math.min(pickIndex + 1, TOTAL_PICKS)} / {TOTAL_PICKS}</span>}
          <button style={copied ? s.copiedBtn : s.copyBtn} onClick={handleCopyLink}>{copied ? "✓ Copied!" : "🔗 Share"}</button>
        </div>
      </div>

      {!isDraftComplete && currentTeam && (
        <div style={s.clockBar}>
          <div style={s.clockLeft}>
            <span style={s.clockDot} />
            <span style={s.clockLabel}>ON THE CLOCK</span>
            <span style={s.clockTeam}>{currentTeam.name}</span>
            <span style={s.clockRound}>Round {getRoundForPick(pickIndex)} · Pick {pickIndex + 1}</span>
          </div>
          <div style={s.clockRight}>
            <a href={`sms:&body=${encodeURIComponent(`🏌️ ${currentTeam.name} is on the clock! Pick ${pickIndex + 1} of ${TOTAL_PICKS} — PGA Championship 2026 Fantasy Draft. Round ${getRoundForPick(pickIndex)}.`)}`} style={s.smsBtn}>📲 Notify Group</a>
            <button style={s.makePickBtn} onClick={() => setShowPicker(true)}>Make Pick</button>
          </div>
        </div>
      )}

      {isDraftComplete && activeTab !== "scoreboard" && (
        <div style={s.completeBanner}>🏆 Draft Complete! Tournament is underway — check the Scoreboard tab.</div>
      )}

      {smsPrompt && (
        <div style={s.smsPromptBar}>
          <span><strong>{smsPrompt.name}</strong> is on deck — notify the group?</span>
          <a href={`sms:&body=${encodeURIComponent(`⛳ Heads up — ${smsPrompt.name} is on deck in the PGA 2026 Fantasy Draft!`)}`} style={s.smsSendBtn} onClick={() => setSmsPrompt(null)}>📲 Open Group Text</a>
          <button style={s.smsDismiss} onClick={() => setSmsPrompt(null)}>✕</button>
        </div>
      )}

      <div style={s.tabs}>
        {[
          ["scoreboard", "🏆 Scoreboard"],
          ["board", "📋 Draft Board"],
          ["teams", "👥 Rosters"],
          ["rules", "📜 Rules"],
        ].map(([id, label]) => (
          <button key={id} style={{ ...s.tab, ...(activeTab === id ? s.tabActive : {}) }} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {showPicker && (
        <div style={s.modalOverlay} onClick={() => setShowPicker(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.modalClose} onClick={() => setShowPicker(false)}>✕</button>
            <GolferPicker available={available} onPick={handlePick} currentTeam={currentTeam} />
          </div>
        </div>
      )}

      {activeTab === "scoreboard" && <Scoreboard draftState={state} />}

      {activeTab === "board" && (
        <div style={s.tableWrap}>
          <div style={s.tableScroll}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.thRound}>Rd</th>
                  {teams.map(t => <th key={t.id} style={s.thTeam}>{t.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {rounds.map((roundData, rIdx) => (
                  <tr key={rIdx} style={rIdx % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={s.tdRound}>{rIdx + 1}</td>
                    {teams.map((team) => {
                      const cell = roundData.find(o => o.team.id === team.id);
                      const isCurrent = !isDraftComplete && cell && !cell.pick && cell.pickNumber === pickIndex + 1;
                      return (
                        <td key={team.id} style={{ ...s.tdPick, ...(isCurrent ? s.tdCurrent : {}), ...(cell?.pick ? s.tdFilled : {}) }}>
                          {cell?.pick ? <span style={s.golferName}>{cell.pick.golfer}</span> : isCurrent ? <span style={s.onClockCell}>●</span> : <span style={s.emptyCell}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "rules" && (
        <div style={s.rulesWrap}>
          <div style={s.rulesCard}>
            <div style={s.rulesTitle}>📜 League Rules</div>
            <div style={s.rulesList}>
              {[
                ["⛳", "Scoring", "Your top 4 golfer scores count toward your team total. Lowest combined score wins."],
                ["✂️", "Cut Rule", "You must have at least 4 players make the cut to be eligible to win."],
                ["🏆", "Winner Bonus", "If your team includes the tournament winner, you receive an additional -2 strokes applied to your score."],
                ["💰", "Payouts", "Entry fee is $75 per team. 1st place takes the pot. 2nd place gets their money back."],
              ].map(([icon, heading, text]) => (
                <div key={heading} style={s.ruleItem}>
                  <span style={s.ruleIcon}>{icon}</span>
                  <div>
                    <div style={s.ruleHeading}>{heading}</div>
                    <div style={s.ruleText}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "teams" && (
        <div style={s.teamsGrid}>
          {teams.map((team, i) => (
            <div key={i} style={s.teamCard}>
              <div style={s.teamCardHeader}>
                <span style={s.teamCardNum}>#{i + 1}</span>
                <span style={s.teamCardName}>{team.name}</span>
                <span style={s.teamCardCount}>{teamPicks[i].length} picks</span>
              </div>
              <div style={s.teamPickList}>
                {teamPicks[i].length === 0 ? <span style={s.noPicksYet}>No picks yet</span>
                  : teamPicks[i].map((p, j) => (
                    <div key={j} style={s.teamPickItem}>
                      <span style={s.teamPickRound}>R{getRoundForPick(p.pickNumber - 1)}</span>
                      <span style={s.teamPickGolfer}>{p.golfer}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [draftState, setDraftState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const firebaseReady = !FIREBASE_URL.includes("YOUR-PROJECT");

  const loadState = async (silent = false) => {
    if (!firebaseReady) { setDraftState(prev => prev || DEFAULT_STATE); setLoading(false); return; }
    try {
      const data = await fbRead();
      const loaded = data || DEFAULT_STATE;
      if (loaded.picks && !Array.isArray(loaded.picks)) loaded.picks = Object.values(loaded.picks);
      if (!loaded.picks) loaded.picks = [];
      if (loaded.teams && !Array.isArray(loaded.teams)) loaded.teams = Object.values(loaded.teams);
      if (!loaded.teams || loaded.teams.length === 0) loaded.teams = DEFAULT_STATE.teams;
      setDraftState(loaded);
      setError(null);
    } catch {
      if (!silent) setError("Could not connect to Firebase.");
      setDraftState(prev => prev || DEFAULT_STATE);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadState();
    if (firebaseReady) { pollRef.current = setInterval(() => loadState(true), 4000); }
    return () => clearInterval(pollRef.current);
  }, []);

  const save = async (newState) => {
    setDraftState(newState);
    if (!firebaseReady) return;
    setSyncing(true);
    try { await fbWrite(newState); } catch { setError("Save failed."); }
    setSyncing(false);
  };

  const handleSetupSave = (teams) => save({ ...draftState, teams, setupDone: true });
  const handleMakePick = (golfer) => {
    const pickIndex = draftState.picks.length;
    if (pickIndex >= TOTAL_PICKS) return;
    save({ ...draftState, picks: [...draftState.picks, { pickNumber: pickIndex + 1, teamId: getTeamForPick(pickIndex), golfer, timestamp: Date.now() }] });
  };
  const handleReset = () => { if (window.confirm("Reset the entire draft?")) save({ ...DEFAULT_STATE, teams: draftState.teams }); };

  if (loading) return (
    <div style={s.loading}>
      <div style={{ fontSize: 40 }}>⛳</div>
      <div>Loading…</div>
    </div>
  );

  return (
    <>
      {error && <div style={s.errorBar}>⚠️ {error}<button style={s.errorDismiss} onClick={() => setError(null)}>✕</button></div>}
      {!firebaseReady && <div style={s.setupWarning}>🔥 <strong>Firebase not configured.</strong> Paste your URL into FIREBASE_URL.</div>}
      {!draftState.setupDone
        ? <SetupScreen teams={draftState.teams} onSave={handleSetupSave} />
        : <DraftBoard state={draftState} onMakePick={handleMakePick} onReset={handleReset} syncing={syncing} firebaseReady={firebaseReady} />}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  loading: { minHeight: "100vh", background: DARK, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 10, color: CREAM, fontFamily: "'Georgia', serif", fontSize: 18 },
  errorBar: { background: "#7f1d1d", color: "#fca5a5", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontFamily: "'Georgia', serif" },
  errorDismiss: { background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16 },
  setupWarning: { background: "rgba(201,168,64,0.12)", borderBottom: `1px solid rgba(201,168,64,0.3)`, color: GOLD, padding: "10px 20px", fontSize: 13, fontFamily: "'Georgia', serif" },
  setupWrap: { minHeight: "100vh", background: `linear-gradient(160deg, ${DARK} 0%, #0a2e16 60%, #0d1f0f 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Georgia', serif" },
  setupCard: { background: "rgba(255,255,255,0.04)", border: `1px solid rgba(201,168,64,0.25)`, borderRadius: 16, padding: "36px 32px", maxWidth: 600, width: "100%" },
  badge: { display: "inline-block", background: "rgba(201,168,64,0.15)", border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 20, padding: "4px 14px", fontSize: 13, letterSpacing: 1, marginBottom: 16 },
  setupTitle: { color: CREAM, fontSize: 32, margin: "0 0 8px", fontWeight: 700 },
  setupSub: { color: GRAY, fontSize: 14, marginBottom: 28, lineHeight: 1.6 },
  teamGrid: { display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 28 },
  teamRow: { display: "flex", alignItems: "center", gap: 10 },
  teamNum: { color: GOLD, fontWeight: 700, width: 24, textAlign: "right" as const, fontSize: 14, flexShrink: 0 },
  inputName: { flex: 2, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: CREAM, fontSize: 14, fontFamily: "inherit", outline: "none" },
  inputPhone: { flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: CREAM, fontSize: 14, fontFamily: "inherit", outline: "none" },
  startBtn: { width: "100%", background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 16, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  boardWrap: { minHeight: "100vh", background: DARK, color: CREAM, fontFamily: "'Georgia', serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "rgba(0,0,0,0.4)", borderBottom: `1px solid rgba(201,168,64,0.2)`, flexWrap: "wrap" as const, gap: 8 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: { fontSize: 28 },
  logoTitle: { fontSize: 17, fontWeight: 700, color: GOLD, lineHeight: 1.2 },
  logoSub: { fontSize: 12, color: GRAY },
  headerRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const },
  pickCounter: { fontSize: 13, color: GRAY },
  syncing: { fontSize: 11, color: GREEN_LIGHT },
  firebaseWarn: { fontSize: 11, color: GOLD },
  copyBtn: { background: "rgba(201,168,64,0.15)", border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  copiedBtn: { background: "rgba(45,155,90,0.2)", border: `1px solid ${GREEN_LIGHT}`, color: GREEN_LIGHT, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  clockBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", background: "linear-gradient(90deg, rgba(26,107,60,0.4) 0%, rgba(26,107,60,0.15) 100%)", borderBottom: `1px solid rgba(45,155,90,0.3)`, flexWrap: "wrap" as const, gap: 12 },
  clockLeft: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
  clockDot: { width: 10, height: 10, background: "#4ade80", borderRadius: "50%", boxShadow: "0 0 8px #4ade80", flexShrink: 0 },
  clockLabel: { fontSize: 11, color: "#4ade80", letterSpacing: 2, fontWeight: 700 },
  clockTeam: { fontSize: 18, fontWeight: 700, color: CREAM },
  clockRound: { fontSize: 12, color: GRAY },
  clockRight: { display: "flex", alignItems: "center", gap: 10 },
  smsBtn: { background: "rgba(201,168,64,0.15)", border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 8, padding: "8px 14px", fontSize: 13, textDecoration: "none", fontFamily: "inherit" },
  makePickBtn: { background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, border: "none", color: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  completeBanner: { padding: "12px 24px", background: "linear-gradient(90deg, rgba(201,168,64,0.2), rgba(201,168,64,0.05))", borderBottom: `1px solid rgba(201,168,64,0.3)`, color: GOLD, fontWeight: 700, fontSize: 14, textAlign: "center" as const },
  smsPromptBar: { display: "flex", alignItems: "center", gap: 12, padding: "10px 24px", background: "rgba(45,155,90,0.15)", borderBottom: `1px solid rgba(45,155,90,0.25)`, fontSize: 14, flexWrap: "wrap" as const },
  smsSendBtn: { background: GREEN, color: "#fff", borderRadius: 6, padding: "5px 12px", textDecoration: "none", fontSize: 13, fontFamily: "inherit" },
  smsDismiss: { background: "transparent", border: "none", color: GRAY, cursor: "pointer", fontSize: 14, fontFamily: "inherit" },
  tabs: { display: "flex", padding: "0 24px", borderBottom: `1px solid rgba(255,255,255,0.08)`, background: "rgba(0,0,0,0.2)", overflowX: "auto" as const },
  tab: { background: "transparent", border: "none", borderBottom: "2px solid transparent", color: GRAY, padding: "12px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const },
  tabActive: { color: GOLD, borderBottomColor: GOLD },
  tableWrap: { padding: "16px 0 0", overflowX: "auto" as const },
  tableScroll: { minWidth: 900, padding: "0 8px" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  thRound: { padding: "8px 10px", color: GRAY, fontWeight: 700, textAlign: "center" as const, width: 36, background: "rgba(0,0,0,0.2)" },
  thTeam: { padding: "8px 6px", color: GOLD, fontWeight: 700, textAlign: "center" as const, background: "rgba(0,0,0,0.2)", fontSize: 11, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  trEven: { background: "rgba(255,255,255,0.02)" },
  trOdd: { background: "transparent" },
  tdRound: { padding: "6px 8px", textAlign: "center" as const, color: GRAY, fontWeight: 700, fontSize: 11 },
  tdPick: { padding: "5px 4px", textAlign: "center" as const, border: "1px solid rgba(255,255,255,0.04)", minWidth: 80, maxWidth: 90 },
  tdFilled: { background: "rgba(26,107,60,0.15)" },
  tdCurrent: { background: "rgba(201,168,64,0.12)", border: "1px solid rgba(201,168,64,0.4)" },
  golferName: { color: CREAM, fontSize: 11, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 88 },
  onClockCell: { color: GOLD, fontSize: 14 },
  emptyCell: { color: "rgba(255,255,255,0.1)", fontSize: 10 },
  teamsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, padding: 16 },
  teamCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" },
  teamCardHeader: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(26,107,60,0.15)", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  teamCardNum: { color: GOLD, fontWeight: 700, fontSize: 12 },
  teamCardName: { flex: 1, color: CREAM, fontWeight: 700, fontSize: 13 },
  teamCardCount: { color: GRAY, fontSize: 11 },
  teamPickList: { padding: "8px 14px", maxHeight: 220, overflowY: "auto" as const },
  noPicksYet: { color: GRAY, fontSize: 12, fontStyle: "italic" as const },
  teamPickItem: { display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" },
  teamPickRound: { color: GRAY, fontSize: 10, width: 24, flexShrink: 0 },
  teamPickGolfer: { color: CREAM, fontSize: 12 },
  modalOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal: { background: "#112418", border: `1px solid rgba(201,168,64,0.3)`, borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" as const, position: "relative" as const },
  modalClose: { position: "absolute" as const, top: 12, right: 14, background: "transparent", border: "none", color: GRAY, fontSize: 18, cursor: "pointer", fontFamily: "inherit" },
  pickerWrap: { display: "flex", flexDirection: "column" as const, gap: 12, flex: 1, overflow: "hidden" },
  onClockBanner: { background: "rgba(26,107,60,0.3)", border: `1px solid rgba(45,155,90,0.4)`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#a7f3c3", textAlign: "center" as const },
  searchInput: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "10px 14px", color: CREAM, fontSize: 14, fontFamily: "inherit", outline: "none" },
  golferList: { flex: 1, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: 2 },
  golferItem: { padding: "9px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14, color: CREAM, background: "transparent" },
  golferSelected: { background: "rgba(45,155,90,0.25)", border: `1px solid rgba(45,155,90,0.5)` },
  confirmBtn: { background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, border: "none", color: "#fff", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
  confirmDisabled: { background: "rgba(255,255,255,0.06)", color: GRAY, cursor: "not-allowed" },
  rulesWrap: { padding: 20, maxWidth: 640, margin: "0 auto" },
  rulesCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,64,0.2)", borderRadius: 14, overflow: "hidden" },
  rulesTitle: { padding: "16px 24px", fontSize: 18, fontWeight: 700, color: GOLD, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(201,168,64,0.07)" },
  rulesList: { padding: "8px 0" },
  ruleItem: { display: "flex", gap: 16, padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "flex-start" as const },
  ruleIcon: { fontSize: 22, flexShrink: 0, marginTop: 2 },
  ruleHeading: { color: CREAM, fontWeight: 700, fontSize: 15, marginBottom: 4 },
  ruleText: { color: GRAY, fontSize: 14, lineHeight: 1.6 },
} as const;

const sb = {
  controlBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", background: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" as const, gap: 8 },
  controlLeft: { display: "flex", alignItems: "center", gap: 12 },
  controlRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
  hint: { fontSize: 11, color: GRAY },
  updated: { fontSize: 11, color: GRAY },
  scoreError: { fontSize: 11, color: "#fca5a5" },
  refreshBtn: { background: `rgba(201,168,64,0.15)`, border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  legend: { display: "flex", gap: 16, padding: "8px 20px", flexWrap: "wrap" as const, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.15)" },
  legendItem: { fontSize: 11, color: GRAY, display: "flex", alignItems: "center", gap: 5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, padding: 16 },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" },
  cardFirst: { border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.04)" },
  cardYou: { border: `1px solid rgba(201,168,64,0.4)`, background: "rgba(201,168,64,0.04)" },
  cardHeader: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  rank: { fontSize: 20, width: 32, textAlign: "center" as const, flexShrink: 0 },
  teamMeta: { flex: 1 },
  teamNameSb: { fontWeight: 700, fontSize: 14, color: CREAM },
  cutWarn: { fontSize: 10, color: GOLD, marginTop: 2 },
  teamScoreBox: { textAlign: "right" as const, display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 3 },
  bigScore: { fontSize: 24, fontWeight: 700 },
  scoreLabel: { fontSize: 9, color: GRAY, letterSpacing: 1 },
  bonusBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: GRAY, borderRadius: 4, padding: "2px 7px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" },
  bonusBtnOn: { background: "rgba(201,168,64,0.2)", border: `1px solid ${GOLD}`, color: GOLD },
  golferRows: { padding: "4px 0" },
  golferRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)", opacity: 0.55 },
  rowCounts: { opacity: 1, background: "rgba(45,155,90,0.07)" },
  rowFaded: { opacity: 0.3 },
  golferLeft: { display: "flex", alignItems: "center" },
  golferNameSb: { fontSize: 13, color: CREAM },
  golferRight: { display: "flex", alignItems: "center", gap: 8 },
  golferScore: { fontSize: 14, fontWeight: 700 },
  golferThru: { fontSize: 10, color: GRAY },
  golferPos: { fontSize: 10, color: GOLD },
  mcBadge: { fontSize: 10, background: "rgba(224,82,82,0.2)", color: RED, border: `1px solid ${RED}`, borderRadius: 3, padding: "1px 5px" },
  wdBadge: { fontSize: 10, background: "rgba(107,123,110,0.2)", color: GRAY, border: `1px solid ${GRAY}`, borderRadius: 3, padding: "1px 5px" },
  footer: { textAlign: "center" as const, padding: "14px 20px", fontSize: 11, color: GRAY, borderTop: "1px solid rgba(255,255,255,0.05)" },
} as const;

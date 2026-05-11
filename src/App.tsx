import { useState, useEffect, useRef } from "react";

const FIREBASE_URL = "https://YOUR-PROJECT-default-rtdb.firebaseio.com";

const DRAFT_PATH = `${FIREBASE_URL}/pga-draft-2026.json`;

const TOTAL_TEAMS = 11;
const TOTAL_ROUNDS = 6;
const TOTAL_PICKS = TOTAL_TEAMS * TOTAL_ROUNDS;

const PGA_GOLFERS = [
  "Scottie Scheffler", "Rory McIlroy", "Xander Schauffele", "Collin Morikawa",
  "Jon Rahm", "Viktor Hovland", "Patrick Cantlay", "Wyndham Clark",
  "Bryson DeChambeau", "Brooks Koepka", "Jordan Spieth", "Justin Thomas",
  "Tommy Fleetwood", "Shane Lowry", "Max Homa", "Hideki Matsuyama",
  "Cameron Smith", "Billy Horschel", "Dustin Johnson", "Sungjae Im",
  "Russell Henley", "Sahith Theegala", "Jason Day", "Adam Scott",
  "Keegan Bradley", "Corey Conners", "Matt Fitzpatrick", "Tyrrell Hatton",
  "Min Woo Lee", "Cameron Young", "Sepp Straka", "Kurt Kitayama",
  "Nick Taylor", "Si Woo Kim", "Harris English", "Denny McCarthy",
  "Nico Echavarria", "Alex Noren", "Rickie Fowler", "Justin Rose",
  "Robert MacIntyre", "Joaquin Niemann", "Ludvig Aberg", "Tom McKibbin",
  "Akshay Bhatia", "Sam Burns", "Lucas Glover", "Daniel Berger",
  "Max Greyserman", "Chris Gotterup", "Ben Griffin", "Emiliano Grillo",
  "Thomas Detry", "Maverick McNealy", "J.T. Poston", "Davis Riley",
  "Andrew Putnam", "Aaron Rai", "Patrick Reed", "Adam Schenk",
  "J.J. Spaun", "Stephan Jaeger", "Ryan Fox", "Taylor Pendrith",
  "Pierceson Coody", "Alex Fitzpatrick", "Harry Hall", "Chris Kirk",
  "Keith Mitchell", "Garrick Higgo", "Mito Pereira", "Christiaan Bezuidenhout",
  "Nicolai Hojgaard", "Rasmus Hojgaard", "Ryo Hisatsune", "Kazuki Higa",
  "Kota Kaneko", "Haotong Li", "Martin Kaymer", "Padraig Harrington",
  "Luke Donald", "Stewart Cink", "Jason Dufner", "Gary Woodland",
  "Jimmy Walker", "Y.E. Yang", "Shaun Micheel", "Patrick Rodgers",
  "Andy Sullivan", "Matt Wallace", "Jordan Smith", "Daniel Brown",
  "John Parry", "Marco Penge", "Adrien Saddier", "Bernd Wiesberger",
  "Sami Valimaki", "Matti Schmid", "Mikael Lindberg", "Aldrich Potgieter",
  "Jayden Schaper", "Casey Jarvis", "Elvis Smylie", "Travis Smyth",
  "Jhonattan Vegas", "David Lipsky", "Alex Smalley", "Max McGreevy",
  "Andrew Novak", "Steven Fisk", "Ryan Gerard", "Ben Kern",
  "Austin Smotherman", "Sam Stevens", "Rico Hoey", "Joe Highsmith",
  "Chris Gotterup", "Jordan Gumberg", "Jake Knapp", "Matt McCarty",
  "William Mouw", "Rasmus Neergaard-Petersen", "Kristoffer Reitan",
  "Daniel Hillier", "David Puig", "Angel Ayora", "Aldrich Potgieter",
  "Michael Thorbjornsen", "Austin Hurt", "Bud Cauley", "Ian Holt",
  "Michael Block", "Michael Brennan", "Jacob Bridgeman",
  // Alternates
  "Sudarshan Yellamaraju", "Tom Hoge", "Kevin Yu", "Mac Meissner",
  "Tony Finau", "Kevin Roy", "Davis Thompson",
];

function getTeamForPick(pickIndex) {
  const round = Math.floor(pickIndex / TOTAL_TEAMS);
  const posInRound = pickIndex % TOTAL_TEAMS;
  return round % 2 === 0 ? posInRound : TOTAL_TEAMS - 1 - posInRound;
}

function getRoundForPick(pickIndex) {
  return Math.floor(pickIndex / TOTAL_TEAMS) + 1;
}

function buildSnakeOrder() {
  return Array.from({ length: TOTAL_PICKS }, (_, i) => ({
    pickNumber: i + 1,
    round: getRoundForPick(i),
    team: getTeamForPick(i),
  }));
}

const SNAKE_ORDER = buildSnakeOrder();

const DEFAULT_STATE = {
  teams: Array.from({ length: TOTAL_TEAMS }, (_, i) => ({
    id: i, name: `Team ${i + 1}`, phone: "",
  })),
  picks: [],
  setupDone: false,
};

function getSMSLink(phone, message) {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

// ─── Firebase helpers ────────────────────────────────────────────────────────
async function fbRead() {
  const res = await fetch(DRAFT_PATH);
  if (!res.ok) throw new Error("Firebase read failed");
  return await res.json();
}

async function fbWrite(state) {
  const res = await fetch(DRAFT_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error("Firebase write failed");
}

// ─── SetupScreen ─────────────────────────────────────────────────────────────
function SetupScreen({ teams, onSave }) {
  const [localTeams, setLocalTeams] = useState(teams);
  const update = (i, field, val) =>
    setLocalTeams(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  return (
    <div style={s.setupWrap}>
      <div style={s.setupCard}>
        <div style={s.badge}>⛳ PGA Championship 2026</div>
        <h1 style={s.setupTitle}>Draft Setup</h1>
        <p style={s.setupSub}>
          Enter team names & phone numbers. Phone numbers let you send iMessage
          notifications straight from the draft board.
        </p>
        <div style={s.teamGrid}>
          {localTeams.map((t, i) => (
            <div key={i} style={s.teamRow}>
              <span style={s.teamNum}>{i + 1}</span>
              <input
                style={s.inputName}
                placeholder={`Team ${i + 1} name`}
                value={t.name}
                onChange={e => update(i, "name", e.target.value)}
              />
              <input
                style={s.inputPhone}
                placeholder="Phone (optional)"
                value={t.phone}
                onChange={e => update(i, "phone", e.target.value.replace(/\D/g, ""))}
                maxLength={10}
              />
            </div>
          ))}
        </div>
        <button style={s.startBtn} onClick={() => onSave(localTeams)}>
          Start Draft →
        </button>
      </div>
    </div>
  );
}

// ─── GolferPicker ─────────────────────────────────────────────────────────────
function GolferPicker({ available, onPick, currentTeam }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const filtered = available.filter(g => g.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={s.pickerWrap}>
      <div style={s.onClockBanner}>
        🔔 ON THE CLOCK: <strong>{currentTeam.name}</strong>
      </div>
      <input
        style={s.searchInput}
        placeholder="Search golfers…"
        value={search}
        autoFocus
        onChange={e => { setSearch(e.target.value); setSelected(null); }}
      />
      <div style={s.golferList}>
        {filtered.map(g => (
          <div
            key={g}
            style={{ ...s.golferItem, ...(selected === g ? s.golferSelected : {}) }}
            onClick={() => setSelected(selected === g ? null : g)}
          >
            {g}
          </div>
        ))}
      </div>
      <button
        style={{ ...s.confirmBtn, ...(selected ? {} : s.confirmDisabled) }}
        disabled={!selected}
        onClick={() => selected && onPick(selected)}
      >
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
  const [activeTab, setActiveTab] = useState("board");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    return roundSlots.map(o => {
      const pick = picks.find(p => p.pickNumber === o.pickNumber);
      return { ...o, pick, team: teams[o.team] };
    });
  });

  return (
    <div style={s.boardWrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.logoIcon}>⛳</span>
          <div>
            <div style={s.logoTitle}>PGA Championship</div>
            <div style={s.logoSub}>2026 Fantasy Draft</div>
          </div>
        </div>
        <div style={s.headerRight}>
          {!firebaseReady && <span style={s.firebaseWarn}>⚠️ Set Firebase URL</span>}
          {syncing && <span style={s.syncing}>↑ Saving…</span>}
          <span style={s.pickCounter}>Pick {Math.min(pickIndex + 1, TOTAL_PICKS)} / {TOTAL_PICKS}</span>
          <button style={copied ? s.copiedBtn : s.copyBtn} onClick={handleCopyLink}>{copied ? '✓ Copied!' : '🔗 Share'}</button>
          <button style={s.resetBtn} onClick={onReset}>↺ Reset</button>
        </div>
      </div>

      {/* On-clock bar */}
      {!isDraftComplete && currentTeam && (
        <div style={s.clockBar}>
          <div style={s.clockLeft}>
            <span style={s.clockDot} />
            <span style={s.clockLabel}>ON THE CLOCK</span>
            <span style={s.clockTeam}>{currentTeam.name}</span>
            <span style={s.clockRound}>Round {getRoundForPick(pickIndex)} · Pick {pickIndex + 1}</span>
          </div>
          <div style={s.clockRight}>
            {currentTeam.phone && (
              <a
                href={getSMSLink(currentTeam.phone,
                  `🏌️ You're on the clock! Pick ${pickIndex + 1} of ${TOTAL_PICKS} — PGA Championship 2026 Fantasy Draft. Round ${getRoundForPick(pickIndex)}. Make your pick!`
                )}
                style={s.smsBtn}
              >📲 Notify</a>
            )}
            <button style={s.makePickBtn} onClick={() => setShowPicker(true)}>Make Pick</button>
          </div>
        </div>
      )}

      {isDraftComplete && (
        <div style={s.completeBanner}>🏆 Draft Complete! Good luck to all managers.</div>
      )}

      {smsPrompt && (
        <div style={s.smsPromptBar}>
          <span>Text <strong>{smsPrompt.name}</strong> they're on deck?</span>
          <a
            href={getSMSLink(smsPrompt.phone, `⛳ You're on deck in the PGA 2026 Fantasy Draft! You're picking next — get ready!`)}
            style={s.smsSendBtn}
            onClick={() => setSmsPrompt(null)}
          >Open iMessage</a>
          <button style={s.smsDismiss} onClick={() => setSmsPrompt(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {[["board", "📋 Draft Board"], ["teams", "👥 Rosters"]].map(([id, label]) => (
          <button
            key={id}
            style={{ ...s.tab, ...(activeTab === id ? s.tabActive : {}) }}
            onClick={() => setActiveTab(id)}
          >{label}</button>
        ))}
      </div>

      {/* Golfer picker modal */}
      {showPicker && (
        <div style={s.modalOverlay} onClick={() => setShowPicker(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.modalClose} onClick={() => setShowPicker(false)}>✕</button>
            <GolferPicker available={available} onPick={handlePick} currentTeam={currentTeam} />
          </div>
        </div>
      )}

      {/* Board view */}
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
                        <td key={team.id} style={{
                          ...s.tdPick,
                          ...(isCurrent ? s.tdCurrent : {}),
                          ...(cell?.pick ? s.tdFilled : {}),
                        }}>
                          {cell?.pick
                            ? <span style={s.golferName}>{cell.pick.golfer}</span>
                            : isCurrent
                              ? <span style={s.onClockCell}>●</span>
                              : <span style={s.emptyCell}>—</span>}
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

      {/* Roster view */}
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
                {teamPicks[i].length === 0
                  ? <span style={s.noPicksYet}>No picks yet</span>
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
    if (!firebaseReady) {
      setDraftState(prev => prev || DEFAULT_STATE);
      setLoading(false);
      return;
    }
    try {
      const data = await fbRead();
      const loaded = data || DEFAULT_STATE;
      // Firebase stores arrays as objects — normalize both
      if (loaded.picks && !Array.isArray(loaded.picks)) {
        loaded.picks = Object.values(loaded.picks);
      }
      if (!loaded.picks) loaded.picks = [];
      if (loaded.teams && !Array.isArray(loaded.teams)) {
        loaded.teams = Object.values(loaded.teams);
      }
      if (!loaded.teams || loaded.teams.length === 0) {
        loaded.teams = DEFAULT_STATE.teams;
      }
      setDraftState(loaded);
      setError(null);
    } catch (e) {
      if (!silent) setError("Could not connect to Firebase. Check your URL in the code.");
      setDraftState(prev => prev || DEFAULT_STATE);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadState();
    if (firebaseReady) {
      pollRef.current = setInterval(() => loadState(true), 4000);
    }
    return () => clearInterval(pollRef.current);
  }, []);

  const save = async (newState) => {
    setDraftState(newState);
    if (!firebaseReady) return;
    setSyncing(true);
    try {
      await fbWrite(newState);
    } catch {
      setError("Save failed. Check Firebase connection.");
    }
    setSyncing(false);
  };

  const handleSetupSave = (teams) => save({ ...draftState, teams, setupDone: true });

  const handleMakePick = (golfer) => {
    const pickIndex = draftState.picks.length;
    if (pickIndex >= TOTAL_PICKS) return;
    save({
      ...draftState,
      picks: [...draftState.picks, {
        pickNumber: pickIndex + 1,
        teamId: getTeamForPick(pickIndex),
        golfer,
        timestamp: Date.now(),
      }],
    });
  };

  const handleReset = () => {
    if (window.confirm("Reset the entire draft? This cannot be undone.")) {
      save({ ...DEFAULT_STATE, teams: draftState.teams });
    }
  };

  if (loading) {
    return (
      <div style={s.loading}>
        <div style={{ fontSize: 40 }}>⛳</div>
        <div>Loading draft…</div>
        {firebaseReady && <div style={{ fontSize: 12, color: "#6b7b6e", marginTop: 4 }}>Connecting to Firebase…</div>}
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={s.errorBar}>
          ⚠️ {error}
          <button style={s.errorDismiss} onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {!firebaseReady && (
        <div style={s.setupWarning}>
          🔥 <strong>Firebase not configured.</strong> Picks save locally only.{" "}
          Paste your Firebase Realtime Database URL into <code>FIREBASE_URL</code> at the top of App.jsx.
        </div>
      )}
      {!draftState.setupDone
        ? <SetupScreen teams={draftState.teams} onSave={handleSetupSave} />
        : <DraftBoard
            state={draftState}
            onMakePick={handleMakePick}
            onReset={handleReset}
            syncing={syncing}
            firebaseReady={firebaseReady}
          />
      }
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const GREEN = "#1a6b3c";
const GREEN_LIGHT = "#2d9b5a";
const GOLD = "#c9a840";
const CREAM = "#faf7f0";
const DARK = "#0d1f0f";
const GRAY = "#6b7b6e";

const s = {
  loading: {
    minHeight: "100vh", background: DARK, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 10,
    color: CREAM, fontFamily: "'Georgia', serif", fontSize: 18,
  },
  errorBar: {
    background: "#7f1d1d", color: "#fca5a5", padding: "10px 20px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontSize: 13, fontFamily: "'Georgia', serif",
  },
  errorDismiss: { background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16 },
  setupWarning: {
    background: "rgba(201,168,64,0.12)", borderBottom: `1px solid rgba(201,168,64,0.3)`,
    color: GOLD, padding: "10px 20px", fontSize: 13, fontFamily: "'Georgia', serif",
  },
  setupWrap: {
    minHeight: "100vh",
    background: `linear-gradient(160deg, ${DARK} 0%, #0a2e16 60%, #0d1f0f 100%)`,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20, fontFamily: "'Georgia', serif",
  },
  setupCard: {
    background: "rgba(255,255,255,0.04)", border: `1px solid rgba(201,168,64,0.25)`,
    borderRadius: 16, padding: "36px 32px", maxWidth: 600, width: "100%",
  },
  badge: {
    display: "inline-block", background: "rgba(201,168,64,0.15)",
    border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 20,
    padding: "4px 14px", fontSize: 13, letterSpacing: 1, marginBottom: 16,
  },
  setupTitle: { color: CREAM, fontSize: 32, margin: "0 0 8px", fontWeight: 700 },
  setupSub: { color: GRAY, fontSize: 14, marginBottom: 28, lineHeight: 1.6 },
  teamGrid: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 },
  teamRow: { display: "flex", alignItems: "center", gap: 10 },
  teamNum: { color: GOLD, fontWeight: 700, width: 24, textAlign: "right", fontSize: 14, flexShrink: 0 },
  inputName: {
    flex: 2, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, padding: "9px 12px", color: CREAM, fontSize: 14, fontFamily: "inherit", outline: "none",
  },
  inputPhone: {
    flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, padding: "9px 12px", color: CREAM, fontSize: 14, fontFamily: "inherit", outline: "none",
  },
  startBtn: {
    width: "100%", background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`,
    color: "#fff", border: "none", borderRadius: 10, padding: "14px",
    fontSize: 16, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  },
  boardWrap: { minHeight: "100vh", background: DARK, color: CREAM, fontFamily: "'Georgia', serif" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 24px", background: "rgba(0,0,0,0.4)",
    borderBottom: `1px solid rgba(201,168,64,0.2)`,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: { fontSize: 28 },
  logoTitle: { fontSize: 17, fontWeight: 700, color: GOLD, lineHeight: 1.2 },
  logoSub: { fontSize: 12, color: GRAY },
  headerRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  pickCounter: { fontSize: 13, color: GRAY },
  syncing: { fontSize: 11, color: GREEN_LIGHT },
  firebaseWarn: { fontSize: 11, color: GOLD },
  copyBtn: {
    background: "rgba(201,168,64,0.15)", border: `1px solid ${GOLD}`, color: GOLD,
    borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  },
  copiedBtn: {
    background: "rgba(45,155,90,0.2)", border: `1px solid ${GREEN_LIGHT}`, color: GREEN_LIGHT,
    borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  },
  resetBtn: {
    background: "transparent", border: `1px solid rgba(255,255,255,0.15)`, color: GRAY,
    borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  },
  clockBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 24px",
    background: "linear-gradient(90deg, rgba(26,107,60,0.4) 0%, rgba(26,107,60,0.15) 100%)",
    borderBottom: `1px solid rgba(45,155,90,0.3)`, flexWrap: "wrap", gap: 12,
  },
  clockLeft: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  clockDot: {
    width: 10, height: 10, background: "#4ade80", borderRadius: "50%",
    boxShadow: "0 0 8px #4ade80", flexShrink: 0,
  },
  clockLabel: { fontSize: 11, color: "#4ade80", letterSpacing: 2, fontWeight: 700 },
  clockTeam: { fontSize: 18, fontWeight: 700, color: CREAM },
  clockRound: { fontSize: 12, color: GRAY },
  clockRight: { display: "flex", alignItems: "center", gap: 10 },
  smsBtn: {
    background: "rgba(201,168,64,0.15)", border: `1px solid ${GOLD}`, color: GOLD,
    borderRadius: 8, padding: "8px 14px", fontSize: 13, textDecoration: "none", fontFamily: "inherit",
  },
  makePickBtn: {
    background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, border: "none",
    color: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: 14,
    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  completeBanner: {
    padding: "16px 24px",
    background: "linear-gradient(90deg, rgba(201,168,64,0.2), rgba(201,168,64,0.05))",
    borderBottom: `1px solid rgba(201,168,64,0.3)`,
    color: GOLD, fontWeight: 700, fontSize: 16, textAlign: "center",
  },
  smsPromptBar: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 24px",
    background: "rgba(45,155,90,0.15)", borderBottom: `1px solid rgba(45,155,90,0.25)`,
    fontSize: 14, flexWrap: "wrap",
  },
  smsSendBtn: {
    background: GREEN, color: "#fff", borderRadius: 6,
    padding: "5px 12px", textDecoration: "none", fontSize: 13, fontFamily: "inherit",
  },
  smsDismiss: {
    background: "transparent", border: "none", color: GRAY, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
  },
  tabs: {
    display: "flex", padding: "0 24px",
    borderBottom: `1px solid rgba(255,255,255,0.08)`,
    background: "rgba(0,0,0,0.2)", overflowX: "auto",
  },
  tab: {
    background: "transparent", border: "none", borderBottom: "2px solid transparent",
    color: GRAY, padding: "12px 20px", fontSize: 13, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap",
  },
  tabActive: { color: GOLD, borderBottomColor: GOLD },
  tableWrap: { padding: "16px 0 0", overflowX: "auto" },
  tableScroll: { minWidth: 900, padding: "0 8px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  thRound: {
    padding: "8px 10px", color: GRAY, fontWeight: 700, textAlign: "center",
    width: 36, background: "rgba(0,0,0,0.2)",
  },
  thTeam: {
    padding: "8px 6px", color: GOLD, fontWeight: 700, textAlign: "center",
    background: "rgba(0,0,0,0.2)", fontSize: 11, maxWidth: 90,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  trEven: { background: "rgba(255,255,255,0.02)" },
  trOdd: { background: "transparent" },
  tdRound: { padding: "6px 8px", textAlign: "center", color: GRAY, fontWeight: 700, fontSize: 11 },
  tdPick: {
    padding: "5px 4px", textAlign: "center",
    border: "1px solid rgba(255,255,255,0.04)", minWidth: 80, maxWidth: 90,
  },
  tdFilled: { background: "rgba(26,107,60,0.15)" },
  tdCurrent: { background: "rgba(201,168,64,0.12)", border: "1px solid rgba(201,168,64,0.4)" },
  golferName: {
    color: CREAM, fontSize: 11, display: "block",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 88,
  },
  onClockCell: { color: GOLD, fontSize: 14 },
  emptyCell: { color: "rgba(255,255,255,0.1)", fontSize: 10 },
  teamsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12, padding: 16,
  },
  teamCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, overflow: "hidden",
  },
  teamCardHeader: {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
    background: "rgba(26,107,60,0.15)", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  teamCardNum: { color: GOLD, fontWeight: 700, fontSize: 12 },
  teamCardName: { flex: 1, color: CREAM, fontWeight: 700, fontSize: 13 },
  teamCardCount: { color: GRAY, fontSize: 11 },
  teamPickList: { padding: "8px 14px", maxHeight: 220, overflowY: "auto" },
  noPicksYet: { color: GRAY, fontSize: 12, fontStyle: "italic" },
  teamPickItem: {
    display: "flex", gap: 8, padding: "4px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center",
  },
  teamPickRound: { color: GRAY, fontSize: 10, width: 24, flexShrink: 0 },
  teamPickGolfer: { color: CREAM, fontSize: 12 },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
  },
  modal: {
    background: "#112418", border: `1px solid rgba(201,168,64,0.3)`,
    borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, maxHeight: "85vh",
    overflow: "hidden", display: "flex", flexDirection: "column", position: "relative",
  },
  modalClose: {
    position: "absolute", top: 12, right: 14, background: "transparent",
    border: "none", color: GRAY, fontSize: 18, cursor: "pointer", fontFamily: "inherit",
  },
  pickerWrap: { display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" },
  onClockBanner: {
    background: "rgba(26,107,60,0.3)", border: `1px solid rgba(45,155,90,0.4)`,
    borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#a7f3c3", textAlign: "center",
  },
  searchInput: {
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8, padding: "10px 14px", color: CREAM, fontSize: 14,
    fontFamily: "inherit", outline: "none",
  },
  golferList: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  golferItem: {
    padding: "9px 12px", borderRadius: 6, cursor: "pointer",
    fontSize: 14, color: CREAM, background: "transparent",
  },
  golferSelected: { background: "rgba(45,155,90,0.25)", border: `1px solid rgba(45,155,90,0.5)` },
  confirmBtn: {
    background: `linear-gradient(135deg, ${GREEN}, ${GREEN_LIGHT})`, border: "none",
    color: "#fff", borderRadius: 8, padding: "12px", fontSize: 14,
    fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4,
  },
  confirmDisabled: { background: "rgba(255,255,255,0.06)", color: GRAY, cursor: "not-allowed" },
};

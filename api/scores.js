export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const BASE_URL = 'https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1';

  // All tournament dates — fixed list covers entire tournament
  const DATES = [
    '2026/03/19', '2026/03/20',  // R1
    '2026/03/21', '2026/03/22',  // R2
    '2026/03/26', '2026/03/27',  // Sweet 16
    '2026/03/28', '2026/03/29',  // Elite 8
    '2026/04/04',                // Final Four
    '2026/04/06'                 // Championship
  ];

  try {
    const allGames = [];

    for (const date of DATES) {
      try {
        const response = await fetch(`${BASE_URL}/${date}`);
        if (!response.ok) continue;
        const data = await response.json();
        (data.games || []).forEach(entry => {
          const g = entry.game;
          if (!g.championshipGame) return;
          allGames.push({
            gameID:    g.gameID,
            status:    g.gameState,
            awayName:  g.away.names.short,
            homeName:  g.home.names.short,
            awayScore: g.away.score || '',
            homeScore: g.home.score || '',
            clock:     g.contestClock || '',
            period:    g.currentPeriod || '',
            round:     g.championshipGame?.round?.title || '',
            tipTime:   g.startTime || '',
            epoch:     parseInt(g.startTimeEpoch || '0'),
            roundNum:  g.championshipGame?.round?.roundNumber || 99,
          });
        });
      } catch(e) { continue; }
    }

    // Deduplicate
    const seen = new Set();
    const unique = allGames.filter(g => {
      if (seen.has(g.gameID)) return false;
      seen.add(g.gameID);
      return true;
    });

    // Sort: highest round first, then live → finals (recent first) → upcoming (soonest first)
    const statusOrder = { live: 0, final: 1, pre: 2 };
    unique.sort((a, b) => {
      if (b.roundNum !== a.roundNum) return b.roundNum - a.roundNum;
      const sa = statusOrder[a.status] ?? 2;
      const sb = statusOrder[b.status] ?? 2;
      if (sa !== sb) return sa - sb;
      if (a.status === 'final') return b.epoch - a.epoch;
      return a.epoch - b.epoch;
    });

    res.status(200).json({ games: unique, ts: new Date().toISOString() });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

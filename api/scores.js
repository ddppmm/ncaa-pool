export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const BASE_URL = 'https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1';

  // Fetch -2 to +2 days from today to catch all live/recent/upcoming games
  const dates = [];
  for (let offset = -2; offset <= 2; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}/${m}/${day}`);
  }

  try {
    const allGames = [];

    for (const date of dates) {
      try {
        const response = await fetch(`${BASE_URL}/${date}`);
        if (!response.ok) continue;
        const data = await response.json();
        (data.games || []).forEach(entry => {
          const g = entry.game;
          if (!g.championshipGame) return; // filter out NIT etc
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
          });
        });
      } catch(e) { continue; }
    }

    // Remove duplicate gameIDs (same game can appear across date fetches)
    const seen = new Set();
    const unique = allGames.filter(g => {
      if (seen.has(g.gameID)) return false;
      seen.add(g.gameID);
      return true;
    });

    // Sort: live first, then finals (most recent first), then upcoming (soonest first)
    const statusOrder = { live: 0, final: 1, pre: 2 };
    unique.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 2;
      const sb = statusOrder[b.status] ?? 2;
      if (sa !== sb) return sa - sb;
      if (a.status === 'final') return b.epoch - a.epoch; // most recent final first
      return a.epoch - b.epoch; // soonest upcoming first
    });

    res.status(200).json({ games: unique, ts: new Date().toISOString() });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

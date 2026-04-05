export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const BASE_URL = 'https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1';

  const DATES = [
    '2026/03/19', '2026/03/20',
    '2026/03/21', '2026/03/22',
    '2026/03/26', '2026/03/27',
    '2026/03/28', '2026/03/29',
    '2026/04/04',
    '2026/04/06'
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

          // Strip HTML entities and normalize round names to match ROUND_MAP
          const rawRound = g.championshipGame?.round?.title || '';
          const cleanRound = rawRound
            .replace(/&#\d+;|&[a-z]+;/gi, '')
            .trim()
            .replace(/^FINAL FOUR$/i,    'Final Four')
            .replace(/^CHAMPIONSHIP$/i,  'Championship')
            .replace(/^ELITE EIGHT$/i,   'Elite Eight')
            .replace(/^SWEET 16$/i,      'Sweet 16')
            .replace(/^SECOND ROUND$/i,  'Second Round')
            .replace(/^FIRST ROUND$/i,   'First Round');

          allGames.push({
            gameID:    g.gameID,
            status:    g.gameState,
            awayName:  g.away.names.short,
            homeName:  g.home.names.short,
            awayScore: g.away.score || '',
            homeScore: g.home.score || '',
            clock:     g.contestClock || '',
            period:    g.currentPeriod || '',
            round:     cleanRound,
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

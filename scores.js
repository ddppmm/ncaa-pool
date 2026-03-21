export default async function handler(req, res) {
  // Allow requests from any origin (CORS fix)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const BASE_URL = 'https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1';

  const DATES = [
    '2026/03/19', '2026/03/20',
    '2026/03/21', '2026/03/22',
    '2026/03/26', '2026/03/27',
    '2026/03/28', '2026/03/29',
    '2026/04/04', '2026/04/06'
  ];

  try {
    const allGames = [];

    for (const date of DATES) {
      const response = await fetch(`${BASE_URL}/${date}`);
      if (!response.ok) continue;
      const data = await response.json();
      const games = data.games || [];

      games.forEach(entry => {
        const g = entry.game;
        if (!g.championshipGame) return; // filter out NIT
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
        });
      });
    }

    res.status(200).json({ games: allGames, ts: new Date().toISOString() });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
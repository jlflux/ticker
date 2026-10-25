// Sample games for previewing the look: open index.html?demo=1
// Scores are made up. Nothing here is used unless ?demo=1 is in the URL.
window.TICKER_DEMO_GAMES = (fromEspn, fromSheet, parseCsv) => {
  const csv = `league,away,away_score,home,home_score,status,away_rank,home_rank,away_color,home_color
AHSAA 7A,Thompson,28,Hoover,24,Final,1,3,cc0000,002f6c
AHSAA 7A,Central-Phenix City,14,Auburn,17,Q4 2:31,,5,6a1d34,f26722
AHSAA 6A,Saraland,35,Spanish Fort,35,Final/OT,2,,1f4e9c,0b3d91
AHSAA 6A,Clay-Chalkville,,Pinson Valley,,7:00 PM,4,,d4af37,8b0000
AHSAA 5A,Ramsay,10,Pike Road,21,Halftime,,,8b0000,1c2a5a`;
  const games = fromSheet({ id: 'demo', label: 'AHSAA' }, parseCsv(csv));

  // One ESPN-shaped game so both paths are exercised.
  const espn = { id: 'demo-espn', label: 'NCAAF' };
  const team = (abbr, short, color, logo, score, homeAway, winner, rank) => ({
    homeAway, score, winner, curatedRank: { current: rank },
    records: [{ summary: '7-1' }],
    team: { abbreviation: abbr, shortDisplayName: short, displayName: short, color, logo },
  });
  games.push(fromEspn(espn, {
    id: '1', date: new Date(Date.now() - 3 * 3.6e6).toISOString(),
    competitions: [{
      competitors: [
        team('ALA', 'Alabama', '9e1b32', 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png', '31', 'home', true, 6),
        team('AUB', 'Auburn', '03244d', 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png', '20', 'away', false, 99),
      ],
      status: { type: { state: 'post', completed: true, shortDetail: 'Final', name: 'STATUS_FINAL' } },
    }],
  }));
  return games.filter(Boolean);
};

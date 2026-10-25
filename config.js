// ─────────────────────────────────────────────────────────────────────────────
//  Score Ticker settings
//  Edit this file, save it, then right-click the Browser Source in OBS and pick
//  "Refresh". Every setting can also be overridden in the page URL, e.g.
//    index.html?seconds=6&title=FRIDAY%20NIGHT
// ─────────────────────────────────────────────────────────────────────────────
window.TICKER_CONFIG = {
  // ── Friday night scores (Google Sheet) ────────────────────────────────────
  // Paste the link to your Google Sheet (the normal link from the address bar
  // is fine). The sheet must be shared as "Anyone with the link: Viewer".
  // Edits show up on the ticker within about 20 seconds. See README.md.
  sheets: [
    { label: 'AHSAA', url: '' },
  ],

  // ── Automatic college / pro scores from ESPN (optional) ───────────────────
  // Leave empty for high school only. Available keys:
  //   nfl, college-football, college-football-top25, nba, wnba, mlb, nhl,
  //   mens-college-basketball, womens-college-basketball, college-baseball,
  //   mls, epl, laliga, champions-league, nwsl
  // Example for Saturdays: leagues: ['college-football'], teams: ['Alabama', 'Auburn', 'UAB', 'Troy', 'South Alabama', 'Jacksonville State'],
  leagues: [],

  // Only show ESPN games involving these teams (abbreviation like 'ALA' or
  // school name like 'Auburn'). Empty = every game in the chosen leagues.
  teams: [],

  secondsPerGame: 5,        // how long each score stays up
  refreshSeconds: 20,       // how often scores are re-downloaded (10 minimum)

  showUpcoming: true,       // include games that haven't kicked off yet
  upcomingWithinHours: 24,  // (ESPN games) only upcoming games within this many hours
  finalsWithinHours: 30,    // (ESPN games) drop final scores older than this many hours
  hidePostponed: false,     // skip postponed / canceled games

  nameStyle: 'short',       // ESPN games: 'short' (Tide), 'abbr' (ALA), or 'full'
  showLogos: true,
  showRecords: false,       // show W-L record under each team name
  showRankings: true,       // show poll rank before a team name

  title: 'SCORES',          // left-hand label while loading / when empty
  accentColor: '#d50a0a',   // league label color
  winnerColor: '#ffd200',   // color of the winning score on finals
  hideWhenEmpty: false,     // slide the bar away when there are no games to show
  emptyMessage: 'Scores coming up',
};

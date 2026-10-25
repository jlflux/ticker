# Score Ticker for OBS

![Ticker preview](preview.png)

A score bar for the bottom of your stream, styled after ESPN's BottomLine. Instead of scrolling, it shows one game at a time and flips to the next every 5 seconds. Final scores show the winner's score in gold with an arrow, and the loser is dimmed. Live games show the quarter and clock with a red "live" dot. When a score changes while that game is on screen, the score flashes.

It's built for **Alabama high school football**. Scores come from a Google Sheet that you or a helper update from a phone, and the ticker re-reads the sheet every 20 seconds. It can also pull college and pro scores from ESPN automatically, for example Alabama and Auburn on Saturdays.

Preview it with sample games by opening `index.html?demo=1` in a browser.

---

## 1. Put it in OBS (one time)

1. Download this folder (green **Code** button → **Download ZIP**) and unzip it somewhere permanent, like `Documents\ScoreTicker`.
2. In OBS, under **Sources**, click **+** → **Browser**, and name it "Score Ticker".
3. Check **Local file** and browse to `index.html` in the folder.
4. Set **Width 1920** and **Height 1080** (or match your canvas). The page is transparent, so only the bar at the bottom shows.
5. Click **OK**, then put the source at the top of the source list so it sits above your video.

To try the look before setting up the sheet, uncheck **Local file** and paste this as the URL, with your own folder path:
`file:///C:/Users/YOU/Documents/ScoreTicker/index.html?demo=1`

## 2. Set up your score sheet (one time)

1. Go to [sheets.new](https://sheets.new) to create a new Google Sheet.
2. Choose **File → Import → Upload**, select `sheet-template.csv` from this folder, and pick **Replace current sheet**.
3. **Important:** select column F (`status`), then choose **Format → Number → Plain text**. Without this, Google can turn "7:00 PM" into a time and blank out text like "Final".
4. Click **Share** → under General access choose **Anyone with the link** → **Viewer** → **Copy link**.
5. Open `config.js` in Notepad and paste the link between the quotes:
   ```js
   sheets: [
     { label: 'AHSAA', url: 'https://docs.google.com/spreadsheets/d/....../edit?usp=sharing' },
   ],
   ```
6. Save the file. In OBS, right-click the Score Ticker source → **Refresh**.

After that, you never need to touch OBS. Edit the sheet and the ticker picks up the change within about 20 seconds.

## 3. Game night: filling in the sheet

One row is one game. Only `away`, `home` and `status` are required.

| column | what to put | example |
|---|---|---|
| `league` | Small label on the left (class, region, anything) | `7A` |
| `away` / `home` | School names | `Thompson` / `Hoover` |
| `away_score` / `home_score` | Leave **blank** before kickoff | `21` |
| `status` | Kickoff time, quarter + clock, `Halftime`, or `Final` | `7:00 PM`, `Q3 4:12`, `Halftime`, `Final`, `Final/OT` |
| `away_rank` / `home_rank` | Optional poll ranking | `3` |
| `away_record` / `home_record` | Optional (shows when `showRecords: true`) | `8-1` |
| `away_color` / `home_color` | Optional team color stripe, as a hex code | `cc0000` |
| `away_logo` / `home_logo` | Optional link to a logo image | `https://…/logo.png` |
| `show` | Put `no` to hide a game without deleting it | `no` |

How it reads the sheet:
- A game with **no scores** is upcoming, and its `status` shows as the kickoff time.
- A game with scores, whose status doesn't start with "Final", is **live**.
- A `status` starting with **Final** marks the game over. The higher score is highlighted, and a tie gets no highlight.
- Games appear in the same order as the rows in the sheet.

Scorekeeping from your phone works well in the Google Sheets app.

## Where do the scores come from? (and why not ScoreStream directly)

No free, open data feed exists for Alabama high school scores:

- **ScoreStream** has good AHSAA coverage, but its data API is only for approved partners. Its free tools are embeddable widgets, which can't be restyled into this look. Local TV stations get partner access, so if you broadcast games you may qualify. Contact ScoreStream through their partner page at scorestream.com. If they give you an API key and documentation, it's a small addition to this ticker: everything else stays as-is.
- **MaxPreps** and **SI High School / SBLive** publish AHSAA scoreboards, but they don't offer a public API, and their terms forbid pulling data automatically.
- **ESPN** has a free, reliable live feed for college and pro games, but no high school games. That feed is built in (see below).

That's why the Google Sheet is the main feed: it's free, it's instant, and anyone you give edit access can keep it current from the stands.

## Optional: college and pro scores from ESPN (fully automatic)

These update by themselves with no sheet needed. In `config.js`:

```js
leagues: ['college-football'],
teams: ['Alabama', 'Auburn', 'UAB', 'Troy', 'South Alabama', 'Jacksonville State'],
```

Leave `teams: []` to show every game in a league. The available leagues are `nfl`, `college-football`, `college-football-top25`, `nba`, `wnba`, `mlb`, `nhl`, `mens-college-basketball`, `womens-college-basketball`, `college-baseball`, `mls`, `epl`, `laliga`, `champions-league` and `nwsl`.

ESPN games and sheet games can run together. ESPN games come first, then the sheet.

## Customizing

Everything is in `config.js`, with a comment next to each setting:

- `secondsPerGame` is how long each score stays up (default 5).
- `refreshSeconds` is how often the ticker re-downloads scores (default 20).
- `accentColor` and `winnerColor` control the label color and the winning-score highlight. Try your station or school colors.
- `showUpcoming`, `showRankings`, `showRecords` and `showLogos` turn pieces on or off.
- `hideWhenEmpty: true` slides the bar off screen when there are no games.
- To change the size, edit `--bar-height` at the top of `ticker.css` (default `64px`), or just resize the source in OBS.

You can also override any setting in the URL without editing files, for example `index.html?seconds=7&title=FRIDAY%20NIGHT`. Supported parameters: `leagues`, `teams`, `sheet`, `sheetlabel`, `seconds`, `refresh`, `upcoming`, `logos`, `records`, `rankings`, `names`, `title`, `accent`, `winner`, `hideempty` and `demo`.

## Troubleshooting

- **The bar says "Loading scores…" or "Scores coming up."** Check that the sheet's sharing is set to *Anyone with the link* and that the link in `config.js` is inside the quotes. Then right-click the source → **Refresh**.
- **The sheet link still won't load.** In the sheet, choose **File → Share → Publish to web**, pick the tab, choose **Comma-separated values (.csv)**, click **Publish**, and paste that link into `config.js` instead. Published links can lag a few minutes behind your edits, so use this only as a fallback.
- **A status like "Final" is blank on the ticker.** Format the `status` column as Plain text (step 2.3).
- **The internet drops.** The ticker keeps showing the last scores it received and catches up when the connection returns.
- **I changed `config.js` and nothing happened.** OBS only reads that file when the source loads, so right-click → **Refresh**. Sheet edits don't need a refresh.

# TV redesign implementation

Implemented on `tv-ux-redesign` in the fork `ardaerbaharli/kick-tv-webos`.
The original service, HLS engine, app identity, license, saved channels, pins,
recording progress, and transfer format are retained.

## Delivered

- A real Home screen with live saved channels, Continue watching, search, and
  phone entry. New installs open Home; existing installs migrate to Resume last
  watched. This choice is persisted before stamping the first-run marker.
- An immediately interactive cached shell. Network replies and recording
  lookups cannot interrupt subsequent navigation or a newer playback selection.
- Labeled Home/Browse/My channels/Search/Settings navigation, source-screen
  restoration, stable item identity, and a single blocking panel owner.
- Native primary card buttons, a white focus ring shared with DOM focus, visible
  Options actions, complete focused-card reveal, no row wrapping, and preferred
  columns across incomplete grid rows.
- One player action row for live and recordings. First OK reveals; timeline
  arrows preview; OK commits; Back cancels. Live seeking is exposed only for an
  actual media seekable window. Go live is reachable without colored keys.
- An explicit Channels drawer that stays open until dismissed and does not
  resize the hardware video plane. Pointer movement reveals transport controls
  instead of opening navigation. Channel +/- uses the same drawer.
- Save, Pin, Remove, Undo, channel details, recordings, Resume, Start over, and
  Remove from Continue watching through basic-remote paths.
- Full catalog pages with Categories and draft Filters, Apply/Clear, two-line
  titles, selected-title summaries, and bounded virtualized rendering. Standard
  uses four columns; Large uses three with matching logical and rendered geometry.
- Quick settings and grouped full Settings. Toggles, pickers, and adjustable
  ranges have distinct behavior; explicit panels do not time out.
- Per-streamer chat presets for layout, width, text, and background; defaults
  for new channels; and a remote reading mode. Pointer leave does not time out
  remote reading. Batched trimming preserves the reader's scroll position.
- Search results open channel actions. Explicit typed entry still saves a
  channel. The existing token-protected local phone/backup flow is reused.
- Recording error/retry states, an eight-second initial connection recovery
  prompt, a safe exit dialog, preserved raid/next-video behavior, and screen
  protection above every new panel.
- Shared design tokens, reduced-motion support, useful metadata at 24px or
  larger on the 1080p logical canvas, and fixture screenshots in the README.
- Fork-specific update checks and a release manifest that uses the repository
  executing the workflow. No release tag or public release was created.

## Architecture

| Module | Responsibility |
| --- | --- |
| `app/js/focus.js` | Visual/DOM focus and spatial grid movement |
| `app/js/navigation.js` | Panel stack, browsing history, playback return context |
| `app/js/home.js` | Shared saved-channel and resume card models |
| `app/js/tv-app.js` | Screen shell, input ownership, catalog and search integration |
| `app/js/player-ui.js` | Shared transport, seek preview/commit, controls lifecycle |
| `app/js/tv-panels.js` | Channel actions, settings, filters, chat and legacy adapters |
| `app/tokens.css`, `app/tv-ui.css` | Semantic tokens and scoped TV components |

Advanced quality, dim, chat, category blocking, and phone transfer tools retain
their existing implementation behind input adapters. Existing global CSS is
preserved. VirtualGrid now has a disposal method so recreating a saved-channel
screen does not accumulate observers or window listeners. The screen models
also avoid retaining a DOM node for every virtualized saved channel.

The target remains ES5 JavaScript and the original project's Chromium 87
compatibility floor. Colors use sRGB tokens because that engine predates OKLCH.
The product is a 1920×1080 TV canvas, not a mobile website.

## Verification

The isolated harness blocks external requests and uses synthetic channels,
storage, media properties, artwork, and messages. The `boot` suite executes the
actual application startup; other suites exercise controlled fixtures.

```sh
node --test tests/*.test.js
node tests/run-browser.js
```

The full unit run passes 143 checks. The browser run passes 580 checks across 24 suites, including
the original playback/chat/data regressions and the new `tv`, `tvjourneys`,
`boot`, and `tvvisual` suites. Behavioral checks cover remote access, nested
panel ownership, source restoration after cold catalog reload, delayed
responses, seek cancellation, first-run migration, chat reading, and undo.
Design captures cover Home, Browse, Large, Settings, player, and docked chat.

All app scripts were parsed as ES5. CSS was checked against Chromium 87 using
the repository's compatibility check. The webOS CLI successfully packaged the
app and service into `com.barisahmet.kicktv_1.0.0_all.ipk`. The local `.ipk` is
ignored by Git; sideload it using webOS Dev Manager. Packaging alone does not
certify hardware playback.

Some old presentation assertions were updated to the accepted design: reveal
controls before transport actions; use a visible Channels action instead of a
Back/exit ladder; retain full video geometry; use white focus; and use Options
instead of hidden pointer pin icons. The underlying playback, catalog bounds,
stable identity, chat, backup, and service checks remain in the default suite.

## Physical-device acceptance still required

No LG TV was configured or operated during this work. Before treating this as a
hardware-validated release, complete these checks on the oldest supported TV
and at least one physical 4K display:

- Play real live HLS and recordings; check hardware-plane composition with the
  player, Channels, and left/right docked chat. Confirm aspect ratio and that
  overlays cause no repeatable stutter or plane flashing.
- Complete the core journeys with a basic remote, then a Magic Remote and its
  wheel. Verify the LG keyboard, cursor dismissal, held-key behavior, and Back.
- Read Standard and Large layouts at roughly 2.5–3.5m. Check overscan margins,
  long titles, mixed Arabic/Turkish/CJK text, and real chat volume.
- Measure event-to-visible-focus latency on the slowest supported TV. The
  plan's p95 <100ms target has not been measured or claimed as achieved.
- Verify LG accessibility/voice guidance, screen protection, sleep behavior,
  and background/resume with an active nested panel.
- Validate disconnect/reconnect, unavailable recordings, raid/next-video
  interruptions, local phone pairing, and an upgrade from an existing install.

The original app ID is unchanged to preserve local data. The package version
remains 1.0.0 for this development build; select a release version after hardware
acceptance rather than tagging an unverified release.

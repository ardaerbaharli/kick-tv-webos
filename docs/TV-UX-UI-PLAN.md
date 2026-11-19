<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->

# Kick TV: TV UX/UI review and redesign plan

Prepared 19 November 2026. Scope: review and implementation plan; no application changes.

## 1. Recommendation

Make this feel like a TV streaming app: open it, find something worth watching, press OK, and get out of the way. The viewer should always know where focus is, what OK will do, and where Back will take them.

The present implementation has substantial playback and performance work behind it, but the interface exposes features through a collection of overlays and remote shortcuts. Improving colors alone will leave the main problems intact. Prioritize navigation, focus, player controls, and readable screen composition, then refine the visual treatment.

Recommended direction:

- A real Home screen with live saved channels and Continue watching.
- Persistent, labeled navigation on browsing screens: Home, Browse, My channels, Search, Settings.
- One player shell for live streams and recordings, with visible, remote-accessible actions.
- A lightweight Channels drawer for switching while watching.
- Structured settings and simple chat layout presets.
- A restrained dark visual system, using Kick green selectively and keeping the video dominant.

Keep the existing vanilla JavaScript approach, service integration, and playback infrastructure for the first redesign. A framework migration is unnecessary for fixing these problems and would add risk on older webOS engines.

## 2. Evidence and limits

Reviewed the repository README, bundled screenshots, HTML/CSS, startup logic, remote and pointer handlers, settings, browsing, categories, recordings, chat layout, and rendering/runtime utilities.

This is a source review with visual inspection of the four bundled screenshots. It is not a live usability session or a measurement on an LG TV. Some screenshots differ from current source: for example, the screenshot shows a language chip strip, while current HTML uses a Languages dropdown; `ui-polish.css` already removes several older glows and improves selected/focused differentiation. Findings below use current source for behavior and identify screenshot-only observations explicitly.

The black video in the screenshots is documented as a hardware video-plane capture limitation. It is not treated as a playback defect. No tests or application sessions were run for this review.

### Foundations to retain

| Existing capability | Why it matters | Relevant implementation |
| --- | --- | --- |
| Virtualized directory grids | Keeps large catalogs manageable on TV hardware | `app/virtual-grid.js` |
| Bounded requests, cache, and priority scheduling | Keeps thumbnail work from starving playback | `app/ui-runtime.js` |
| Saved recording progress and stable recording IDs | Supports a useful Continue watching experience | `app/js/vods.js`, `app/js/playback.js` |
| Recovery and reconnect behavior | Streaming reliability matters more than decorative polish | `app/js/playback.js`, `app/app.js` |
| Saved chat preferences per streamer | Avoids repeatedly configuring favorite streams | `app/js/settings.js`, `app/chat-window.js` |
| Local phone-assisted channel entry | Reduces TV keyboard friction; already exists under backup/import | `app/js/backup.js`, `app/index.html:293` |
| Recent browse state and focus restoration work | Useful foundation for returning from playback | `app/js/browse.js:178` |
| Immediate focus styling and larger-text support | Good starting points to expand consistently | `app/ui-polish.css` |

## 3. Prioritized review

Severity describes impact on the TV experience, not a claim that code is broken in every environment. Critical means a core task is inaccessible or unusually difficult with the basic remote. Major means a frequent source of confusion or friction. Minor means visual or language polish.

| ID | Severity | Finding and evidence | Required correction |
| --- | --- | --- | --- |
| R1 | Critical | **Core player actions depend on pointer or special keys.** The sidebar branch explicitly describes bottom tools as pointer-only; arrows stay in the channel list or close it. Quality and What to watch have click handlers, while Browse, Chat, Settings, and recordings depend on colored-key shortcuts for direct remote access. See `app/js/input.js:168`, `:192`, `:671`. | Put every core action in a reachable player action row. Colored keys may remain accelerators. |
| R2 | Critical | **Visible channel management actions cannot be selected with ordinary arrows.** Pin/remove spans are rendered in saved rows, but the sidebar key branch offers Up/Down, activation, and closing. Browse card Save is also a secondary pointer target; OK plays the card. See `app/js/sidebar.js:795`, `app/js/input.js:192`, `app/js/browse.js:623`. This is a hover/focus affordance without equivalent action navigation. | Add explicit card/row action zones or a visible Options entry with a deterministic D-pad path. |
| R3 | Major | **The home content has no corresponding D-pad screen model.** Continue watching and live tiles exist in `app/js/playback.js:81`, but the idle key path opens the sidebar and no Home tile zone appears in `app/js/input.js`. | Promote Home into a first-class screen with focusable rails and stable item IDs. |
| R4 | Major | **The same physical input reveals different UI in live and recordings.** Live Left/Right opens Channels unless the timeline has focus; recording Left/Right seeks. OK reveals live information but immediately pauses a recording. See `app/js/input.js:212`, `:247`, `:270`. | Use one reveal-then-activate player model. Seeking happens only when the timeline is focused. |
| R5 | Major | **Back depends on invisible history flags.** `backOpenedSidebar` changes what Back does in the same visible drawer. A recording's exit path can lead into Channels rather than clearly returning to its source. See `app/js/input.js:202`, `:263`, `app/js/core.js:42`. | Use explicit navigation history and a topmost-overlay stack; Back closes one visible layer or returns to the launch screen. |
| R6 | Major | **Ordinary pointer movement opens a large navigation surface.** The live mousemove branch calls `nudgeSidebar`; opening Channels also changes video geometry through `sidecollapse`. See `app/js/input.js:325`, `app/js/sidebar.js:44`, `app/style.css:17`. | Pointer movement reveals player controls only. Channels opens through an explicit action. |
| R7 | Major | **Settings mixes unrelated concerns and overloaded rows.** Playback, library filtering, backup, diagnostics, size, dimming, and timers share one list. Some rows open options on OK but toggle on Right. See `app/js/settings.js:199`, `:398`, `:435`. | Separate Quick settings from grouped full Settings; give each row one clear interaction type. |
| R8 | Major | **Chat layout is designed around dragging.** Movement, corner resizing, docking, and separate-video width are pointer interactions. Chat controls in HTML use `tabindex="-1"`; current D-pad routing supplies no chat navigation zone. See `app/chat-window.js`, `app/index.html:33`, `app/js/input.js`. | Add Off, Right panel, Left panel, and Overlay presets plus width/text choices accessible by remote. |
| R9 | Major | **Focused content can disappear while being read.** Sidebar idle timeout is 10 seconds; settings timeout is 30 seconds. See `app/js/core.js:54`, `app/js/sidebar.js:107`, `app/js/settings.js:110`. | Auto-hide transient playback chrome only. Keep explicitly opened drawers and settings open until dismissed. |
| R10 | Major | **Important metadata is small and frequently truncated.** Current cards use 25px names, 21px titles, and 19px metadata at 1920×1080; the screenshots show heavily clipped titles. See `app/ui-polish.css:149`, `app/style.css:748`. | Set a couch-readable hierarchy, reserve two title lines, and show complete selected-item details in a stable region. |
| R11 | Major | **Launch behavior makes choices on the viewer's behalf.** Startup can select last live, a pinned stream, another live stream, or resume a recording; a fresh install goes to Browse. See `app/app.js:60`, `:150`, `:170`. | Default new installs to Home with clear choices. Retain an explicit Resume last watched startup preference for existing users. |
| R12 | Minor | **Visual hierarchy is scattered across layers.** Base CSS, chat CSS, and a later polish sheet overlap in responsibility. The bundled screenshots show prominent green panel borders, green metadata, bright badges, and detached help competing with focus; current polish partially addresses this. | Introduce semantic tokens and one component/state vocabulary; replace old declarations incrementally as components move. |
| R13 | Minor | **Copy exposes configuration terminology.** “Big UI,” “Dim (night),” “Hide Followed,” and “Separate chat” require interpretation. Some current toggle labels also describe a value rather than the setting, such as “White background.” | Use “Text size,” “Night mode,” “Hide saved channels,” “Chat layout,” and “Background”; show values separately. |

Review count: **2 critical · 9 major · 2 minor.** The main blockers are task access and predictability. Current polish improves appearance but does not resolve those blockers.

## 4. Experience principles and boundaries

1. **Basic remote completeness:** arrows, OK, and Back can complete every core task. No required dragging, long press, number pad, colored key, or hover.
2. **One visible focus:** focus, saved, playing, live, and enabled are different states with different signals.
3. **Stable browsing:** refreshing counts or live status never moves the item being selected. Re-sort on explicit refresh or next visit.
4. **Predictable return:** remember the screen, filters, scroll position, and item from which playback started.
5. **Video first:** avoid large navigation reveals or picture resizing from incidental movement.
6. **Progressive disclosure:** show daily actions first; move diagnostics and fine adjustments into deeper settings.
7. **Honest content:** locally saved channels are not Kick account follows. Discovery is not personalized unless the implementation actually supports it.

The first release should improve the existing single-stream experience. Account login, multiple simultaneous streams, writing chat, personalized recommendations, and new backend dependencies are outside this redesign's initial scope.

## 5. Information architecture

```text
App
├── Home
│   ├── Live from your channels
│   ├── Continue watching
│   └── Discover live → Browse
├── Browse
│   ├── Live streams
│   ├── Categories → Category streams
│   └── Filters
├── My channels
│   ├── Pinned / Live / Offline
│   └── Channel details → Live / Past videos / Save / Pin
├── Search
│   ├── Channel search
│   └── Add channels with phone
├── Settings
└── Player
    ├── Controls and timeline
    ├── Channels drawer
    ├── Channel details / Past videos
    ├── Chat options
    └── Quick settings → Full settings
```

Use a left navigation rail on Home, Browse, My channels, Search, and full Settings. It should be labeled, stationary, and visually quieter than the content. No navigation rail remains visible during clean playback.

Home leads with live saved channels when any are live; otherwise Continue watching moves first. Hide empty rails. Keep the initial screen to two substantial content rows with a partial next-row cue. Avoid a large decorative hero that pushes usable content off screen.

## 6. Remote and focus contract

### Player key behavior

| State | Arrows | OK | Back |
| --- | --- | --- | --- |
| Clean live or recording playback | Reveal controls; focus the main transport action without changing playback | Reveal controls; no immediate pause on the reveal press | Return to the recorded source screen, or Home for direct startup playback |
| Controls visible, action row focused | Move spatially between actions; Up enters timeline if available | Activate the focused action | Hide controls |
| Timeline focused | Left/Right preview a seek; Down returns to actions | Commit preview, then keep focus on timeline | Cancel pending preview; next Back hides controls |
| Channels drawer | Up/Down moves between channels; Right enters that row's Options action; Left returns from Options or closes drawer | Play selected channel or open Options | Close drawer and restore Channels action focus |
| Quick settings or chat options | Up/Down rows; Left/Right changes an explicitly adjustable value | Toggle or open the labeled picker | Close top panel and restore invoking action |

Use the same shared core actions in live and recordings: Play/Pause, Channels, Chat, Quality, More. More contains Channel details, Past videos, Sleep timer, Night mode, and Settings. Show Go live only when behind a seekable live edge. Show recording-specific transport where applicable. Never draw a seek control when the stream offers no usable seek window.

Dedicated Play/Pause and seek keys remain shortcuts. Channel +/- may open and step through the Channels drawer; selecting a stream still requires OK. Colored buttons remain optional shortcuts with contextual hints. Repeated OK keydown must not open and immediately activate a panel; require a fresh press for activation.

### Focus rules

- Model screens, zones, and items explicitly; use channel slug, recording ID, and category slug as stable keys.
- A panel receives focus only after its first usable target is mounted. Its trigger is retained as a return target.
- The topmost blocking panel owns input. Background controls are inactive, including pointer clicks.
- Loading does not leave focus in a disappearing skeleton. Use a stable Back/Retry action until content is ready.
- Preserve a preferred column between rows. An incomplete final row clamps to its last item, then restores the preferred column when moving back up.
- No implicit wrap from the last item to the first. Left at the first content column enters navigation; Right returns to the last focused content item.
- If an item disappears, focus the nearest surviving item in that list; if none remain, focus a meaningful empty-state action.
- Keep the complete focused card visible, including its ring and action region. Current reveal tolerance can leave up to a third of a row clipped; tighten this for remote focus.
- Hover changes focus only after actual pointer movement over an actionable target. Switching to D-pad navigation suppresses a parked cursor until it moves again.
- Home/My channels/details/filter screens stay open while being read. Player chrome hides after approximately five idle seconds during playback, but not while paused, seeking, or using a panel.
- After backgrounding and resuming, recover playback and restore the previous UI location without moving focus to a notification.

### Back and exit

Back unwinds visible layers: picker → parent panel → player controls → clean player → source screen. From a content screen, Back returns through its navigation history to Home. At Home root, show a clear Exit/Stay dialog with Stay focused. Back cancels that dialog. Remove hidden “this drawer was opened by Back” behavior.

When watching a recording from Channel details, return to that recording's card. When starting a channel from Browse, return to the same filtered card. A channel change inside the quick drawer keeps the original browsing return location. Refresh status after return without discarding context.

## 7. Screen specifications

### Home and first launch

- First install: a short welcome, “Browse live streams,” “Search channels,” and “Add with phone.” Focus Browse initially. Explain once that saved channels stay on this TV.
- Returning install: use the normal Home composition immediately from cached local data; refresh asynchronously.
- Live rail: thumbnail, channel name, readable title, Live badge, viewers, saved/pinned indicator.
- Continue watching: recording title, channel, progress, time remaining when duration is known. Offer Resume, Start over, and Remove from Continue watching through Options.
- No saved channels: show a useful Browse entry instead of an empty wall of rows.
- No one live: retain offline channels and recordings; avoid presenting this as an app error.
- Startup preference: Home or Resume last watched. Preserve existing behavior for upgraded installs until they change it; new installs default to Home. Do not silently choose an unrelated live stream when resume is unavailable—show Home with a short explanation.

### Browse and categories

- Full content page rather than a modal nested over the player. Existing playback may continue while browsing; show a small, explicit Return to player action when applicable.
- Default to four stream cards across at 1080p. Use three for Large text if four would compromise readability; update virtual grid geometry and logical column count together.
- Header: Live streams / Categories tabs, one Filters action, and a brief active-filter summary. Keep detailed language and visibility choices inside Filters.
- Filters use labeled selections and Apply/Clear actions. Back cancels uncommitted changes. Preserve current filters on return.
- Selecting a category opens its stream listing. Category Save/Hide lives in an Options action; avoid multiple large badges over every thumbnail.
- A card's main target plays. Each focused card shows a labeled Options button beneath its metadata; Down enters it, Down again continues to the next row. Up from Options returns to the card; Up from a card moves to the previous row's card. Left/Right in either zone moves to the adjacent card in the same zone. Reserve room so showing Options never causes layout movement. Use this same pattern across catalogs.
- Selected stream details appear in a fixed summary area or expanded reserved card text; no floating preview that covers neighboring choices.
- Loading preserves the grid footprint. Empty results offer Clear filters. Pagination failure keeps existing items and provides Retry at the end.
- Thumbnail dwell loads one still preview; no automatic multi-video previews or focus-driven stream requests.

### My channels and quick Channels drawer

- My channels is the management destination. Tabs or sections: Pinned, Live, Offline. Search/Add remains visible in the header.
- Label local storage truthfully as My channels or Saved channels. Pin controls ordering; Save controls membership.
- Channel details offers Watch live, Past videos, Save/Remove, and Pin/Unpin. Offline channels lead to details, with their recordings immediately visible.
- The in-player drawer is a compact switcher, approximately 480–540 logical pixels wide. Keep management under each row's Options.
- Display a playing marker independently from the focus ring. Preserve viewers while focused; current rows hide `.favinfo` to expose actions.
- Do not reorder under the cursor or while the drawer is open. Update badges in place; apply sort on reopen or explicit refresh.
- Keep video geometry stable while opening the drawer. Overlay a legible scrim. Any future fit-video preference should apply once, without animated hardware-plane resizing.
- Removing a saved channel is reversible. Provide an accessible Undo action; do not stop its currently playing stream. If the Undo notice expires, the channel remains easy to save again.

### Player and recordings

- Lower-third control composition: channel/title, optional timeline, then actions. Use an opaque-to-transparent scrim to make controls legible over bright or busy footage.
- Keep transient metadata brief. Put full title, category, recording date, and other secondary information in details.
- Live state must distinguish Live, Paused, and Behind live. Explain when Go live is unavailable; do not imply DVR support where none exists.
- Preview seeking without repeated stream jumps: initial Left/Right step 10 seconds, held input accelerates to 30/60 seconds, visibly showing destination; OK commits and Back cancels. Clamp to recording duration or live window.
- Retain stale-result guards: selecting another stream cancels any pending seek or old loading response.
- When paused, keep controls visible and show a clear Paused state. Screensaver behavior must preserve a route back to the same position.
- Next video and raids use one compact prompt pattern with clear destination and countdown. Present Watch now and Stay; Back cancels. Do not take focus from an active settings or browsing task; defer the prompt/action until playback owns input.
- A quiet loading label becomes actionable recovery after a bounded interval. Suggested UI threshold: show “Still connecting” with Retry and Browse after eight seconds, while existing recovery remains bounded and cancelable. Tune against real service latency.

### Chat

- Present read-only chat honestly; do not show a composer or imply posting is supported.
- Main action toggles visibility. Chat options starts with Layout: Off, Right panel, Left panel, Overlay.
- Right/Left panel presets fit the video alongside chat once; Overlay keeps full-size video with a high-opacity background behind messages.
- Width: Narrow, Standard, Wide; text: Standard, Large, Extra large. Offer background presets before a fine transparency control.
- Persist choices per streamer and display that scope: “For this channel.” Keep detailed delay, emote, timestamp, and filtering options under Advanced.
- Remote reading is an explicit Read chat mode. Up/Down scrolls messages, new messages stop shifting the reading position, and Jump to live is a visible focusable action. Back exits Read chat without hiding chat.
- Do not automatically return to live simply because a pointer leaves while a remote user is reading. Preserve a stable message anchor when the message buffer is trimmed.
- Cap visible message work and batch incoming rendering. High-volume chat must not delay focus or transport actions.
- Keep dragging as an optional advanced pointer feature. A remote user can select and reset every standard layout without using it.

### Quick settings and full Settings

Quick settings opens as one right-side panel: Quality, Chat layout, Sleep timer, Night mode, All settings. Quality is also directly reachable from the player row.

| Settings group | Contents |
| --- | --- |
| Playback | Startup destination, quality preference where supported, low latency, auto-advance, raid behavior, skip watched |
| Chat | Default display choices, current-channel override, message timing, emotes, filters |
| Appearance & accessibility | Text size, reduced motion, night mode, screen protection, contrast option if needed |
| Channels & discovery | Offline visibility, hidden categories, directory preferences, add/import |
| Notifications | Live alerts, pinned-only scope, duration |
| Data & support | Backup/restore, version, update instructions, diagnostics |

- A toggle toggles with OK. An enum opens a picker with a selected mark. A submenu has a chevron. These must not look interchangeable.
- Left/Right adjusts only a focused slider or a visibly segmented value. Never let Right unexpectedly toggle a row whose OK opens a submenu.
- Put a short description below the setting or in a stable help column. Remove detached callout placement logic from the everyday flow.
- Text size previews in place and keeps the focused row visible. Larger text must cover navigation, dialogs, empty states, and player actions, not just parts of the catalogs.
- Full Settings remains open until Back. Keep the existing phone transfer capabilities; surface channel entry separately from backup so viewers can find it.

### Search and phone entry

- Focus the search field on deliberate activation, not every screen visit. Show recents before requiring typing.
- Treat current channel lookup as the baseline capability. Verify endpoint support before promising broad directory search, voice search, or rich offline results.
- Keep a visible Search action and a clear route from the TV keyboard to results. Back closes the keyboard first, then the search screen.
- Promote the existing local phone-entry flow with a readable QR code, short instructions, connection status, cancel, retry, and an explicit same-network requirement.
- Reuse the existing transfer/session protections; channel entry should not become an unauthenticated general settings endpoint.

## 8. Visual specification

### Layout and type

Use a 1920×1080 logical canvas as the initial target, consistent with app metadata. A fixed TV canvas is not itself a defect. Verify how the supported webOS versions scale it on physical 1080p and 4K displays before adding any other resolution strategy.

| Element | Starting specification at 1080p |
| --- | --- |
| Safe area | 64px horizontal, 54px vertical; validate on the target TVs |
| Navigation rail | 240px including internal spacing |
| Main content width | 1,528px with 24px rail/content gap and 64px right margin |
| Four-column stream grid | 364px cards, 24px gaps; 16:9 thumbnail about 205px high |
| Large-text three-column grid | About 493px cards at the same content width |
| Page titles | 44–48px, semibold |
| Selected content title | 32–36px, up to two lines |
| Navigation, buttons, channel names | 28–30px |
| Card title and useful metadata | 24–26px; make 24px the initial floor for useful viewing information |
| Settings rows / player actions | 64–72px minimum height; primary player actions closer to 80px |
| Spacing | 8px base; use 8, 16, 24, 32, 48, 64 |
| Corner radius | 8px controls, 12px cards, 16px panels |

These are design starting values, not claims of measured readability. A 364px card cannot contain all metadata at once: prioritize channel, two title lines, and a short live/viewer line. Move full category/language details into the selected-item summary. Validate at roughly 2.5–3.5m from the physical display.

Use a familiar regular-width sans serif with reliable Latin, Turkish, Arabic, and CJK fallback. Keep the current system stack initially or bundle a verified font subset; do not add a remote font dependency. Use weight and spacing for hierarchy. Avoid condensed or all-caps text for ordinary navigation. Use tabular numerals for duration and viewer counts.

### Semantic visual tokens

Create one token source for background, surface, raised surface, primary/secondary text, divider, focus, brand, live, success, warning, error, spacing, radii, type, and motion. Start from charcoal surfaces and off-white text; retain the existing Kick green as the brand anchor. Final values should be chosen against rendered contrast samples rather than guessed in implementation.

- **Focus:** an immediate 4px high-contrast white ring with a small offset. Green may accent the focused action, but the location indicator must remain distinct from saved/enabled states.
- **Playing:** a small play/equalizer marker plus “Watching” in expanded details.
- **Saved/pinned:** quiet outlined/filled icons with text in the action menu.
- **Live:** a small red dot and the word Live. Do not rely on red alone.
- **Selected filter:** a checkmark and restrained surface fill, with the focus ring added only when navigated to.
- **Enabled toggle:** thumb position and label/state semantics, not green color alone.
- Remove decorative green frames around entire browsing panels and avoid colored glows on dark surfaces.
- Use surface lightness, spacing, and dividers for grouping. Avoid blur/backdrop effects on TV hardware.
- Target at least 4.5:1 text contrast and 3:1 for focus/control boundaries. Check real video backgrounds with scrims, not only solid design swatches.

### Motion and accessibility

Focus indication is instantaneous. Limit panel transitions to roughly 120–160ms opacity/transform and avoid animating video dimensions. Respect reduced motion and eliminate nonessential pulsing after loading. Never animate the focus ring into visibility.

Use native buttons and input controls where possible. For remote-specific virtualized grids, use a documented roving-tabindex or active-descendant strategy; update DOM focus/accessibility state alongside visual focus. Never point an active descendant at an unmounted item. Supply appropriate names, selected/expanded states, and restrained live-region announcements. Verify actual LG accessibility behavior on supported devices; browser ARIA inspection alone is insufficient.

Use direction isolation for mixed-language channel/title metadata. Align interface controls to the UI language while letting individual text content use its natural direction. Handle long unbroken titles without changing card widths or hiding primary actions.

## 9. Loading, failure, and interruption states

| Situation | Screen behavior | Focus / recovery behavior |
| --- | --- | --- |
| Cold launch | Shell and locally available content appear before remote results | Navigation stays usable; no eight-second input lock |
| Browse fetching | Fixed-geometry skeletons, then cards without a layout jump | Keep current focus; initial focus moves to content only if the viewer has not moved elsewhere |
| No connection | “You’re offline” plus cached channels where available | Retry and Browse saved channels; distinguish this from no one live |
| Kick/service failure | “Can’t load streams right now” | Retry, keep existing content, provide service details under Support |
| Selected channel offline | Channel details with recordings or another stream choice | No unexplained silent jump to a different channel |
| Recording gone or restricted | State the availability problem; retain navigable source list | Back, Browse channel, and optionally remove stale progress |
| Filter returns zero items | Explain the active restriction | Clear filters is the primary action |
| Partial pagination failure | Keep loaded cards and show Retry at the end | Retry is a normal remote target |
| Chat disconnected | Quiet chat-local status; video keeps playing | Retry chat without restarting playback |
| Raid/next video | Consistent destination/countdown prompt | Back cancels; no action occurs behind an unrelated panel |
| Sleep warning | Visible countdown and explicit Keep watching / Stop now | Any-key keep-awake may remain a shortcut, with clear feedback |
| TV returns from background | Restore stream/recording and UI context | No duplicate dialogs or unexpected startup replay |

Notifications should not capture OK globally while the viewer is using controls. Route notification activation through a focused visible action. Reversible operations may use Undo; errors and long-running operations need persistent actionable states rather than disappearing toast-only feedback.

## 10. Implementation structure and migration

Add small, ES5-compatible modules with explicit ownership. Preserve classic-script load order and keep existing API/playback functions behind adapters initially.

| Area | Proposed work | Existing integration points |
| --- | --- | --- |
| Navigation | Add `app/js/navigation.js`: screen history, source return context, overlay stack | `app/index.html`, `app/app.js`, open/close functions across panels |
| Focus | Add `app/js/focus.js`: active zone/item, return targets, mounted-item reconciliation | `app/js/input.js`, `app/virtual-grid.js`, `app/js/sidebar.js`, catalogs |
| Input normalization | Convert raw remote keys into actions dispatched only to the active screen/panel | `app/js/core.js`, `app/js/input.js` |
| Home | Add `app/js/home.js`, adapting existing resumable/live rendering | `app/js/playback.js:81`, `app/app.js` |
| Player shell | Add `app/js/player-ui.js`: reveal/hide, shared action row, timeline focus | `app/js/infobar.js`, `app/js/vods.js`, `app/js/playback.js`, `app/js/player-options.js` |
| Channel details | Add `app/js/channel-details.js`: live/recordings/save/pin actions | `app/js/sidebar.js`, `app/js/browse.js`, `app/js/vods.js`, `app/js/api.js` |
| Visual system | Add `app/tokens.css` and scoped TV component rules; move components one at a time | `app/style.css`, `app/ui-polish.css`, `app/chat-window.css` |
| Settings | Group existing schema; separate quick and full settings; migrate descriptions inline | `app/js/settings.js`, `app/ui-polish.js` |
| Chat | Presets and reading mode over existing layout/rendering code | `app/chat-window.js`, `app/js/chat-overlay.js`, `app/js/chat-replay.js` |

### State and async rules

- Keep navigation state separate from playback state: opening Browse must not require pretending playback has stopped.
- Represent return context as screen ID, filters, item key, scroll offset, and origin. Never store transient DOM nodes as the only restoration source.
- Maintain one authoritative active focus target. Existing local focus indexes can remain behind adapters until each screen migrates.
- Opening a blocking overlay pushes a layer; closing it pops the layer and restores a surviving trigger. Avoid independent booleans creating two input owners.
- Normalize pointer and key actions into the same commands so Save, Play, and Close cannot develop different behavior by input method.
- Associate catalog responses with a screen/filter generation. Late results cannot reopen a screen, focus another item, or replace a newly selected stream.
- Keep existing cache bounds and request priorities. Share adapters rather than duplicating data fetches for Home and Browse.
- Preserve favorites, pins, watched history, backup compatibility, and per-channel chat preferences. Version any new settings and migrate once with safe fallbacks.
- Translate legacy arbitrary chat geometry into the closest preset only when the user chooses presets; do not silently overwrite their stored layout.
- Consolidate styles by component ownership. Add scoped styles and remove obsolete rules only after their replacement is validated; do not stack another unbounded set of global overrides.

## 11. Delivery sequence

Indicative effort assumes one experienced developer familiar with this app. These ranges are planning estimates, not a schedule commitment; hardware findings and playback coupling may increase them. Total initial expectation: approximately 22–36 working days, with a usable improvement before the complete redesign.

| Phase | Effort | Deliverables | Completion gate |
| --- | --- | --- | --- |
| 0. Baseline and interaction design | 2–3 days | Supported device matrix; current behavior inventory; 1080p layouts for Home/player/Browse; agreed key map | Walk through ten core tasks on a basic remote; identify every required control and return route |
| 1. Focus and navigation foundation | 3–5 days | Focus manager, screen/overlay stack, normalized keys, stable item IDs, basic-remote paths for currently pointer-only actions | Quality, Chat, Browse, recordings, Save, Pin, Remove, Settings all work without colored keys or pointer |
| 2. Player and quick Channels | 4–6 days | Shared player controls, timeline preview/commit, explicit Channels drawer, predictable Back | Live and recording controls follow the same reveal/navigation model; no incidental resizing or pointer-driven drawer opening |
| 3. Home and channel journeys | 4–7 days | Navigable Home, My channels, details, Continue watching, source restoration, startup preference | Start/resume/switch/return tasks complete without losing the original item or filters |
| 4. Catalog and visual system | 4–6 days | Browse/categories/filter layout, readable cards, tokenized components, standard/Large geometry | All primary labels readable at couch distance; complete focused cards visible; long-title/filter/empty states stable |
| 5. Settings, chat, search entry | 3–5 days | Quick/full settings, chat presets and reading mode, phone entry surfaced in Search | Configure chat and add a channel entirely by remote; phone flow remains optional |
| 6. Hardware refinement and release | 2–4 days | Real-device checks, focus/performance fixes, final screenshots/docs, migration check | Core task, accessibility, rendering, and playback criteria met on each supported target |

Phase 1 should ship as a coherent usability improvement if the full redesign takes longer. Do not release half a screen migration where pointer actions and remote actions use different navigation owners.

### First implementation backlog

| Order | Work item | Definition of done |
| --- | --- | --- |
| 1 | Document and implement focus/overlay contract | One active layer; close returns to trigger; stale mounted targets reconciled |
| 2 | Make player actions D-pad reachable | Quality and More reachable within four directional moves from the initially focused transport action |
| 3 | Add channel/card Options | Save, Pin, Remove, and Past videos reachable with arrows/OK; no long press required |
| 4 | Normalize reveal and Back | First OK reveals; next OK activates; Back consistently closes one layer |
| 5 | Fix auto-hide ownership | Explicit drawers/settings remain open; playing control chrome still hides |
| 6 | Stop automatic Channels reveal | Pointer movement reveals controls without opening navigation or resizing video |
| 7 | Build real Home and source restoration | Live/Continue rails navigable; Back returns to originating stable item |
| 8 | Introduce visual tokens and card geometry | Shared focus/selected/playing language, readable typography, accurate virtualization measurements |
| 9 | Simplify settings/chat | One row action type; remote layout presets; clear setting scope |
| 10 | Complete recovery/migration polish | Offline/removed content/background return all have explicit outcomes |

## 12. Validation plan and acceptance criteria

The following are proposed checks for implementation. None were executed during this review. Performance numbers are targets to instrument and tune against the device baseline, not measured current results.

### Core task walkthroughs

Use only arrows, OK, and Back for the primary pass. Repeat with Magic Remote pointer and wheel after basic-remote completion.

1. Fresh install → browse → play a stream → save it → return to its Browse card.
2. Home → live saved channel → switch through Channels → return Home.
3. Continue watching → Resume → seek → cancel seek → pause → return to the same recording card.
4. Browse → category → language filter → play → Back → verify filters, scroll, and focus.
5. Save a channel, pin it, remove it, undo removal, and verify persistence after relaunch.
6. Player → Quality → choose value → Back → player; verify no playback restart beyond what the quality mechanism requires.
7. Player → Chat → right-side layout → Large text → Read chat → Jump to live → return to controls.
8. Search → keyboard → results → save; repeat adding with a phone.
9. Drop network during live and during catalog loading; recover or leave without a focus trap.
10. Receive a raid/next-video/sleep prompt while using settings; verify no hidden activation or uncontrolled channel switch.
11. Relaunch with a saved recording removed, the last live channel offline, or corrupt/missing preferences.
12. Background/resume with controls, chat reading mode, and a child panel open.

### Acceptance targets

- Every core task works without a pointer or special remote buttons.
- Every actionable item has a visible focus indicator. No remote action lands on hidden, obscured, or unmounted content.
- Home Live rail first item → playback takes one OK press. Home → resume a visible recording takes one OK, with Start over available separately.
- From clean playback: OK reveals controls; at most four directional moves reach each primary action. More actions may take an additional panel step.
- Back restores the correct originating item and filter state; no exit requires remembering how a drawer was opened.
- Focus remains stable across count updates, pagination, image loading, channel offline events, and text-size changes.
- Useful browsing text starts at 24px at the 1080p logical canvas, with a complete Large mode and acceptable couch-distance review.
- Key-to-visible-focus response target: p95 under 100ms on the weakest supported TV. Measure event-to-render timing rather than inferring it from JavaScript execution time alone.
- Opening a panel produces immediate feedback, with cached UI visible within approximately 150ms where device capability permits; network latency is reported separately.
- Catalog node/image counts remain bounded as the viewer browses hundreds of entries. No accumulation after repeatedly opening/closing panels.
- UI changes cause no repeatable playback stutter or video-plane flashing relative to the baseline. Record before/after behavior on hardware.
- No whole-app layout work on every repeated key event; only old/new focus targets and necessary scroll/window updates change.
- Text and control contrast meet the specified targets over both static surfaces and representative bright/dark video.
- Existing saved channels, pins, recording progress, chat settings, and backup/restore data survive the upgrade.

### Device and verification coverage

Identify the oldest supported webOS/browser version before selecting CSS or DOM APIs. Source comments refer both to older engines without `fetch` and to Chromium 87-specific behavior; resolve the actual support floor rather than assuming one comment defines the product contract.

Cover physical 1080p and 4K televisions, at least one lower-powered supported model, a basic remote, and a Magic Remote. Review Standard/Large text, reduced motion, screen protection, mixed RTL/LTR text, long titles, missing artwork, zero/one/many channels, busy chat, and delayed service responses. Modern desktop Chromium is useful for layout iteration but cannot certify hardware playback composition or LG keyboard/accessibility behavior.

During implementation, add focused behavioral checks for focus restoration, overlay ownership, stale async responses, seek cancel/commit, and migration. Reuse the existing fixtures and browser harness where appropriate; avoid screenshot-only assertions for navigation. Tests and hardware sessions should be reported with their actual results separately from this plan.

## 13. Decisions for the first design pass

Proceed with these defaults unless product feedback changes them:

- Home by default for new installs; preserve existing startup behavior for upgrades through an explicit preference.
- Labeled left navigation on browsing screens; no permanent navigation chrome during playback.
- Four stream columns in Standard and three in Large, provided hardware and readability checks support the geometry.
- White focus ring; Kick green for brand and restrained action emphasis; red plus text for Live.
- Shared reveal-first player controls; timeline seeking requires timeline focus.
- Right panel chat as the suggested layout when the viewer enables chat, with Off remaining the first-install visibility default.
- Existing local save model and phone-entry implementation; no account requirement.
- Incremental ES5-compatible modules and component migration; retain the service and playback core.

The first visual deliverable should show three connected states—Home, a focused Browse card with Options, and the live player with Channels/controls—at 1920×1080. Review them together with a complete arrow/OK/Back walkthrough. Visual approval should include navigation behavior before the remaining settings and chat screens are built.

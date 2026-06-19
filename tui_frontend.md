# ctarnith TUI — A Frontend Developer's Guide

This document explains the `ctarnith` terminal UI in terms a web/frontend
developer already knows: components, state, actions, routing, and a render
loop. It is a **TUI** (text user interface) drawn into the terminal, but the
architecture maps almost one-to-one onto patterns from React/Redux and Elm.

> Scope: this is the interactive `ctarnith` binary only —
> `src/bin/ctarnith/`. There is a *separate*, older render layer under
> `src/tui/` used by the headless `bot` binary; ignore it for this guide.

---

## 1. The stack

| Concern | Web equivalent | Here |
| --- | --- | --- |
| Rendering library | React / Vue | [`ratatui`](https://ratatui.rs) (immediate-mode TUI) |
| DOM / canvas | HTML DOM | The terminal screen (a grid of cells) |
| Event source | DOM events | [`crossterm`](https://docs.rs/crossterm) key events |
| Render target | Browser | Alternate screen buffer in the terminal |
| Styling | CSS | `Style` / `Color` / `Modifier` on each span |

Key mental shift: **ratatui is immediate-mode**, not retained-mode. There is
no persistent component tree or virtual DOM that diffs between renders.
Every frame you throw away the previous screen and **redraw the entire UI
from the current state**, ~30 times per second. A "component" is just a
function that takes state and draws into a rectangle. This is closer to
HTML `<canvas>` game loops than to React's reconciler.

---

## 2. Architecture: unidirectional data flow

The app runs as **one render loop plus three background async tasks**,
communicating over channels. The shape is the Elm Architecture / Redux:

```
            ┌──────────────────────────────────────────────┐
            │                 ScanState                     │   <- the single
            │        (Arc<RwLock<ScanState>>)               │      source of truth
            └──────────────────────────────────────────────┘
                  ▲                              │
     write (mutate state)                 read (snapshot)
                  │                              ▼
        ┌───────────────────┐          ┌───────────────────┐
        │  strategy task    │          │   render loop      │
        │  (the "reducer")  │          │  (the "view")      │
        └───────────────────┘          └───────────────────┘
                  ▲                              │
        ScanCommand (actions)            draw(render(state))
                  │                              │
        ┌───────────────────┐                   ▼
        │   input task      │             terminal screen
        │  crossterm keys   │
        └───────────────────┘
                  ▲
        ┌───────────────────┐
        │   tick task       │  emits StateChanged every 40ms (animation clock)
        └───────────────────┘
```

The pieces (all in `main.rs`):

- **`spawn_input`** — reads raw `crossterm` key events and forwards them as
  `ScanCommand::Key(...)` over an mpsc channel. Think: the global event
  listener. It does *not* interpret keys; it just forwards them.
- **`spawn_tick`** — a 40ms heartbeat that sends `ScanEvent::StateChanged`.
  This is the animation clock (spinners, sparklines) so the UI repaints even
  when nothing happened.
- **`spawn_strategy`** — the brain / reducer. It owns the phase state machine,
  consumes commands, runs trades, and mutates `ScanState`. Everything
  meaningful happens here.
- **`run`'s render loop** — at ~30 FPS it takes a **snapshot** of state
  (`state.read().await.clone()`) and calls `render(frame, &snapshot)`.

### Why a snapshot?

`render` never holds the state lock while drawing. The loop clones the state,
releases the lock, then draws. Same reason React renders from immutable props
rather than reaching into a live mutable store mid-render.

---

## 3. State: the store

`ScanState` (in `main.rs`) is the single store. Everything the UI shows is a
field on it. Highlights:

| Field | Role (web analogy) |
| --- | --- |
| `phase: Phase` | The current route/screen (state machine) |
| `theme: Theme` | Active theme token (Dark / Amber / Mono) |
| `mint`, `symbol` | Current token being watched/held |
| `mcap_sol`, `mcap_usd`, `sol_price_usd` | Live market figures |
| `mcap_history: VecDeque<(ts, val)>` | Time series backing the sparkline |
| `entry_lamports`, `entry_usd`, `position_usd` | Open-position economics |
| `logs: VecDeque<String>` | Rolling log buffer (bounded) |
| `show_logs: bool` | Whether the log overlay/modal is open |
| `last_trade: Option<LastTrade>` | Result of the previous trade (welcome card) |
| `trades_taken/won/lost`, `scanned`, ... | Session counters / stats |
| `status_line`, `last_error` | Transient status + error banners |
| `settings: SettingsState` | The Settings form's local state |
| `confirm_exit: bool` | "Press Esc again to confirm" guard |

`SettingsState` is effectively a **controlled form**: each editable field is a
`String` you mutate on keypress, plus `active_field` (which input has focus),
`show_advanced` (collapsible section), and `error`/`saved` (validation +
success flags). See section 7.

---

## 4. Actions and events: two channels

There are two message enums, and the direction matters:

- **`ScanCommand`** — input → strategy. These are *actions* (Redux
  `dispatch`). Examples: `Start`, `Cancel`, `Quit`, `CycleTheme`, `ShowLogs`,
  `PickPaper`, `PickSettings`, `NextField`, `PrevField`, `NextChoice`,
  `Char(c)`, `Backspace`, and the raw `Key(KeyEvent)`.
- **`ScanEvent`** — strategy/tick → render loop. These nudge the render loop
  and carry occasional payloads: `StateChanged`, `McapTick { ... }`,
  `Log(String)`, `PanicSubmitted { ... }`, `TradeClosed(LastTrade)`,
  `ToggleLogs`.

So the data flow for a keystroke is:

```
key → ScanCommand::Key → strategy interprets it for the current phase
    → mutates ScanState → (tick/StateChanged) → render loop redraws
```

---

## 5. Phase-aware input (the event router)

`interpret_key(key, phase)` is the heart of input handling. The **same key
means different things on different screens**, exactly like a SPA where a
keyboard shortcut is scoped to the focused route.

Important detail: while `phase == Settings`, the global single-letter
shortcuts (`q`, `t`, `l`, `s`) are **disabled** so those letters can be typed
into text fields (e.g. a base58 wallet key). Only in non-form phases do
`Q`/`T`/`L` act as Quit/Theme/Logs.

```rust
// simplified
match key.code {
    Char('q') | Char('Q') if !in_settings => Quit,
    Char('t') | Char('T') if !in_settings => CycleTheme,
    Char('1') if phase == ModePicker => PickBot,
    Char('6') | Char('s') | Char('S') if phase == ModePicker => PickSettings,
    Enter => Start,
    Esc   => Cancel,
    Tab | Down => NextField,
    Left  => PrevChoice,
    Right => NextChoice,
    Char(c) => Char(c),   // text entry
    ...
}
```

> Note: there are actually **two** key-handling sites. `interpret_key` is the
> general mapper, but the mode-picker loop inside `spawn_strategy` reads raw
> keys directly (because it needs to block waiting for a selection). Keep the
> two in sync — they both encode the `1..6` picker bindings.

---

## 6. Routing & the screens (Phases)

`Phase` is the router. `render()` is a giant `match` on `state.phase` that
dispatches to one screen-drawing function — the equivalent of
`<Route path=... element={<Screen/>} />`.

| Phase | Screen fn | What the user sees |
| --- | --- | --- |
| `ModePicker` | `render_mode_picker` | The 6-option launch menu |
| `Welcome` | `render_welcome` | "Press any key" splash + last-trade card |
| `Scanning` / `Creating` | `render_scanning` | Spinner while waiting for a mint/tx |
| `Evaluating`/`Holding`/`Selling`/`TradeResult`/`CreatedHolding` | `render_trade_screen` | The live trade dashboard |
| `Settings` | `render_settings` | The settings form |
| `BotRunning` / `BotStopped` | `render_bot_screen` | Scrolling bot log view |

The `Phase` enum doubles as a tiny **finite state machine**: the strategy
task advances it (`ModePicker → Scanning → Evaluating → Holding → Selling →
TradeResult → …`). The UI is a pure function of whichever phase you're in.

---

## 7. Anatomy of a frame (layout & "components")

`render()` builds the screen top-down:

```
┌─────────────────────────────────────────────┐
│ header (height 3)   — title + phase label    │
├─────────────────────────────────────────────┤
│                                              │
│ play area (min 12)  — the active screen      │
│   (ASCII wallpaper drawn behind everything)  │
│                                              │
├─────────────────────────────────────────────┤
│ footer (height 3)   — context key hints      │
└─────────────────────────────────────────────┘
```

- **Layout** uses ratatui's `Layout` + `Constraint` (CSS flexbox-ish:
  `Length(3)` = fixed rows, `Min(12)` = grow). The trade screen splits the
  play area further into **MCAP (4 parts) / Position (1) / Logs (1)** — a
  flex column with weighted children.
- **"Components"** are the `render_*` functions. Each takes
  `(frame, area: Rect, state, palette)` and draws into its rectangle. They
  are stateless: all data arrives via `state`. Reusable helpers like
  `centered_box`, `render_centered`, and `clear_block` are shared layout
  primitives.
- **Background wallpaper**: `render_background` paints the ASCII art from
  `ascii_bg.rs`, and panels render a dimmed clip of it behind their text
  (`render_wallpaper_clip`) so the art "shows through" — a glass/transparency
  effect done by hand since there is no compositor.
- **Log overlay** (`render_log_overlay`) is drawn *last*, over everything,
  when `show_logs` is true — i.e. a modal/z-index layer toggled by `L`.

The terminal is requested at a fixed **93×54** size for a stable, console-like
layout (see `TerminalGuard`).

---

## 8. Theming

`Theme` (Dark / Amber / Mono, default **Mono**) is a theme token. `palette_for`
maps it to a `Palette` struct of named colors (`accent`, `success`, `danger`,
`muted`, `warn`, `fg`, `bg_art`, ...). Every draw call pulls colors from the
palette rather than hardcoding — your design-token system. `T` cycles themes
at runtime (`Theme::cycle`).

---

## 9. The Settings screen (a real form)

`render_settings` + the `run_settings` loop in `main.rs` implement a
controlled form:

- **Fields** are an enum `SettingsField` (Wallet, BuySize, HeliusKey,
  FallbackRpc, JupiterKey, SlippageBps, MaxHoldSecs, Theme, Mode, then the
  advanced ones). `active_field` is the focused input.
- **Focus movement**: `Tab`/`↓` = `next_field`, `Shift-Tab`/`↑` =
  `prev_field`. These two functions skip the advanced fields when the section
  is collapsed.
- **Text inputs** (Wallet/keys/sizes) accept `Char(c)` and `Backspace`.
  Secrets render masked (`*` or `(empty — keeps current)`).
- **Selector inputs** (Theme / Mode / the advanced toggle) change with
  `←`/`→`, not typing. Focused selectors render with `‹ value ›` chevrons.
- **Collapsible "Advanced risk" section** (`show_advanced`): a toggle row that
  expands four extra knobs — Take Profit (bps), Stop Loss (bps), Max Open
  Positions, Daily Loss (SOL). Drawn only when expanded.
- **Validation + submit**: `Enter` runs `save_settings`, which parses/validates
  every field, writes the TOML config *and* the `.env`, then sets
  `saved = true` (green "✓ saved") or `error = Some(..)` (red "✗ …"). `Esc`
  discards and returns to the picker.
- **Guided first run**: when no config and no `.env` exist, the app opens this
  form first with blank fields, so a new user fills in wallet/keys/buy size
  before reaching the picker.

---

## 10. The render loop in detail

```rust
loop {
    if last_render.elapsed() >= refresh {            // ~33ms => 30 FPS
        let snapshot = state.read().await.clone();   // immutable props
        terminal.draw(|frame| render::render(frame, &snapshot));
    }
    // wait up to 5ms for an event so Quit is observed quickly
    match timeout(5ms, event_rx.recv()).await {
        StateChanged        => {}                     // redraw next tick
        McapTick { .. }     => { /* fold into state */ }
        Log(line)           => state.push_log(line),
        TradeClosed(s)      => state.last_trade = Some(s),
        ToggleLogs          => state.show_logs = !state.show_logs,
        None                => break,                 // channels closed → exit
    }
}
```

Two things worth internalizing:

1. **Frame rate is decoupled from events.** Events update state; the clock
   decides when to paint. This is the game-loop pattern, not event-driven
   re-render.
2. **Teardown is guarded.** `TerminalGuard`'s `Drop` always restores the
   terminal (leaves the alternate screen, disables raw mode), and `main` wraps
   the loop in `catch_unwind` as a belt-and-braces restore. The terminal is a
   shared global resource — leaving it in raw mode would wreck the user's
   shell, so cleanup is mandatory on every exit path including panics.

---

## 11. File map

| File | Responsibility |
| --- | --- |
| `src/bin/ctarnith/main.rs` | State, actions/events, the 3 tasks, the render loop, the phase state machine, settings logic |
| `src/bin/ctarnith/render.rs` | All `render_*` "components", layout, palette/theming |
| `src/bin/ctarnith/ascii_bg.rs` + `bg.txt` | The ASCII wallpaper asset + loader |
| `src/bin/ctarnith/scan_executor.rs` | Trade execution glue used by the strategy task (buy/sell) |

---

## 12. TL;DR for a frontend dev

- It's **Elm/Redux in a terminal**: one store (`ScanState`), actions
  (`ScanCommand`), a reducer (`spawn_strategy`), and a pure view (`render`).
- **Immediate-mode**: redraw everything every frame from a state snapshot;
  no virtual DOM.
- **Phase = route.** `render()` switches screens on `state.phase`.
- **Components are functions** `(frame, area, state, palette) -> ()`.
- **Input is phase-scoped** (`interpret_key`), and form phases swallow global
  shortcuts so you can type.
- **Theming via palette tokens**; **modals via a last-drawn overlay**;
  **layout via flex-like constraints**.

You are a senior product designer + front-end engineer. Your job is to redesign and implement the UI/UX for a “Carvana Automations” browser overlay (Shadow DOM panel) that manages many automation scripts currently called “workflows”.

CRITICAL: Your goal here is to implement the redesign across the codebase with a high focus on modern and more importantly SCALABLE UI/UX design. You are allowed to use the playwright mcp server to open the page and inspect your changes, debug, and test! Note that I may need to update the tampermonkey userscripts or you may need to inject the scripts yourself for testing purposes (refreshing between changes).

========================
1) Current UI (baseline)
========================
There is a Shadow-DOM overlay panel titled “Carvana Automations”.

Top navigation currently has many tabs (wrapping / not scalable):
- Workflows (main)
- Hidden (with a count badge)
- Selectors
- Options
- Theme
- Storage
- Logs

In the Workflows tab, there is a vertical list of workflow “cards”. Each card typically includes:
- Title (e.g., “Demo: Page Info”)
- Description line
- Two toggles: “Auto run” and “Repeat”
- Profile selector pills: P1 P2 P3
- Buttons: “Run (Profile X)”, “Selectors”, “Options”, “Hide”
This is repeated per workflow, causing severe UI noise as workflow count grows.

Some workflows are effectively always-on monitors (they should run on page load, maybe repeatedly) and are enabled by default through stored prefs. Others are purely manual tools. But right now everything is presented as the same “workflow card” with the maximum set of controls.

========================
2) The core problem
========================
The UI is not scalable because one list is serving two different mental models:
- Manual tools you run intentionally
- Always-on automations you enable/disable and occasionally tweak

The UI must scale to ~50–200 tasks without becoming a wall of toggles and buttons.

========================
3) Redesign goals
========================
A. Clear mental model
- “Actions” (manual tools): things you RUN.
- “Automations” (always-on): things you ENABLE/MANAGE.

B. Scalable interaction design
- Compact list rows (not full cards with many controls)
- Search + filter + grouping
- Progressive disclosure: heavy controls move into a detail view, not inline per row.

C. Keep power-user features
- Profiles (P1/P2/P3)
- Options and Selectors editors
- Storage tools and Logs
- Theme customization
But these should be less visually dominant.

D. Backwards compatibility
- Existing stored preferences for auto-run, repeat, hidden, ordering, selected profile, etc. must not break.
- Provide a safe migration path.

E. Operator vs Developer experience
- Operator mode: run actions, enable automations, tweak simple options.
- Developer mode: raw selector editor, workflow JSON/diagnostics, advanced tools.

========================
4) Middle-ground architecture (must implement)
========================
Implement a TRIGGERS-FIRST internal model (future-proof), but present a split UX (“Actions” vs “Automations”).

Define a “Task” (currently “workflow”) that can have triggers:
- Manual trigger (always available unless explicitly disabled)
- Auto trigger (runs on page load / URL match)
- Repeat modifier (if your engine supports it)
- (Optional future): Watch DOM, Hotkey, Schedule — do NOT fully implement unless it’s already easy, but structure should allow it.

The UI is two derived views:
- ACTIONS view: tasks intended for manual running.
- AUTOMATIONS view: tasks with auto trigger enabled OR tasks marked “automation-intent”.

Avoid making the user decide “tool vs rule” permanently. A task can be both: show it in both views if appropriate.

========================
5) New information architecture (top-level nav)
========================
Replace the many top tabs with 3 primary top-level sections:

1) Actions
2) Automations
3) Settings

Inside Settings:
- Theme
- Storage
- Logs
- Advanced (developer tools / diagnostics)

Also add a clearly visible toggle:
- Mode: Operator / Developer
Developer mode reveals advanced editors (Selectors/JSON) and diagnostics.

Important: do NOT lose features; reorganize them.

========================
6) Detailed UI spec (no images, implement faithfully)
========================

6.1 Global header (always visible in panel)
- Title: “Carvana Automations”
- A search input that filters the current list (Actions or Automations)
- Mode toggle: Operator | Developer
- Optional: small “filters” button if space is tight (can open a small drawer)

6.2 Actions view (list)
Purpose: quickly run manual tools with minimal noise.

List row layout (compact; aim ~1–2 lines per task):
- Left: Task name (bold)
- Below/inline: short description (1 line, truncated)
- Small badges/icons (only if applicable):
  - Auto enabled badge (e.g., “Auto”)
  - Repeat badge (e.g., “Repeat”)
  - Options badge if options exist
  - Dev badge if selectors exist
  - Error badge if last run errored
- Right side primary control: a single “Run” button (or play icon).
- Do NOT show per-row “Selectors/Options/Hide” buttons by default.
- Clicking the row (not the Run button) opens the Task Detail view.

Profiles:
- Keep the concept, but reduce clutter:
  - Default: Run uses “last selected profile” for that task.
  - Provide a small profile dropdown or pill ONLY when multiple profiles exist.
  - Full profile management happens in detail view.

Hidden handling:
- Replace the old “Hidden tab” concept.
- Use “Hide from Actions” (aka “Archive from Actions”) as a per-task setting.
- Hidden tasks should not appear in Actions by default, but must be findable via a filter (e.g., “Show hidden”) or in a separate “Archived” section within Actions.
- If a task is auto-enabled, it must still be visible/manageable in Automations even if hidden from Actions.

6.3 Automations view (list)
Purpose: manage always-on behaviors with status, not buttons.

List row layout (compact):
- Left: Task name + description (1 line)
- Status line (very important):
  - Enabled toggle (primary control)
  - Last run time (if available)
  - Last outcome: OK / Warn / Error (simple indicator)
  - If it did not run, show a reason if available (no match, cooldown, etc.)
- Right primary control: an Enable/Disable toggle (not “Run”).
- “Run now” is secondary and available in detail view (or in overflow menu).

Repeat:
- Show as a badge in the row if enabled.
- Configure in detail view.

6.4 Grouping + filtering (both views)
Implement:
- Search (name + description + tags if you add them)
- Filter chips (or a filter drawer) at minimum:
  - All
  - Favorites (if you implement favorites)
  - Auto enabled
  - Has options
  - Has errors
  - Hidden (Actions only)
  - “Relevant to this page” (if you have URL/context metadata)
- Sorting:
  - Keep existing custom order by default (do not break).
  - Optional sort: Alphabetical / Last run.

Grouping:
- If the repo already knows page contexts (URL patterns), group tasks by context:
  - Global
  - Listing/Search
  - Vehicle Detail (VDP)
  - Checkout
  - Other/Uncategorized
If context is not available today, implement a minimal grouping:
  - “Relevant to current page” (if match function exists)
  - “All tasks”

6.5 Task Detail view (progressive disclosure)
This is where the “noise” goes.

Interaction:
- Clicking a list row opens a detail view.
- On small panel widths, use a drill-in screen with a Back button.
- If width allows, you may use master-detail (list left, detail right). If not, drill-in.

Detail view contains:
- Title + full description
- Primary actions:
  - Run now (with profile chooser)
  - Enable/disable automation trigger
- Triggers section:
  - Manual (informational)
  - Auto (toggle)
  - Repeat (toggle)
  - Any other trigger supported by your engine
- Profiles:
  - Show P1/P2/P3 selection clearly.
  - Explain which profile is active for runs and for auto runs.
- Options:
  - Provide the existing options UI here (or a link/button).
- Selectors:
  - In Operator mode: hide or show read-only summary.
  - In Developer mode: show the full selector editor UI (existing).
- Visibility:
  - Toggle: “Show in Actions” (hide/archive)
  - Ensure that enabled automations can’t become unmanageable due to hiding.
- Per-task logs (if feasible):
  - Show recent logs/events for this task only.
  - Or provide a shortcut to global Logs filtered by this task.

6.6 Settings section
Combine old scattered tabs into one Settings area with sub-navigation:
- Theme
- Storage
- Logs
- Advanced

Logs:
- Keep current logs features, but add filtering by task if easy.

Advanced (Developer mode only):
- Selector editor access
- Workflow/task definition JSON viewer/export/import (if already present)
- Diagnostics (e.g., current page info, match results)

========================
7) Safety / “auto-run eligibility”
========================
As the task library grows, some auto-runs are unsafe (destructive clicks). Implement a lightweight “risk level” concept if possible:

- safe: read-only extraction/highlighting
- caution: reversible clicks/UI changes
- danger: creates/updates data or submits forms

UI behavior:
- Auto-enable toggle is normal for safe.
- For caution/danger, require an extra confirmation step (modal confirm or hold-to-enable).
If the repo already has something similar, reuse it. If not, add minimal metadata and default everything to safe unless explicitly marked.

========================
8) Data + storage requirements (must not break existing)
========================
- Preserve existing preference keys and behavior as much as possible.
- Implement a migration layer:
  - Old: hidden -> New: hiddenInActions (or showInActions = false)
  - Old: auto run -> New: triggers.auto.enabled
  - Old: repeat -> New: triggers.repeat.enabled
  - Old: selected profile -> keep
  - Old: ordering -> keep
- Do not silently discard any preferences.
- If a workflow was hidden but auto-enabled, it must appear in Automations as enabled.

Also:
- Add new prefs where needed (mode: Operator/Developer, filters, favorites).
- Defaults should not surprise: keep current behavior for auto-run defaults.

========================
9) Implementation constraints
========================
- Keep the overlay footprint small; avoid heavy new dependencies unless the repo already uses them.
- Maintain dark theme styling; use existing theme variables/tokens.
- Ensure the UI remains keyboard accessible:
  - Tab navigable
  - Enter/Space toggles switches and activates buttons
  - Visible focus states
- Performance: list rendering should remain responsive with 200 items.

========================
10) Deliverables
========================
You must implement:
1) New IA: Actions / Automations / Settings + Developer mode
2) Compact list rows + detail view (progressive disclosure)
3) Search + filters + grouping
4) Updated Hidden semantics (hide from Actions only)
5) Automation status display (enabled, last run/outcome if available)
6) Storage migration and backwards compatibility
7) Update any documentation/README notes if they exist.

========================
11) Definition of done / acceptance checklist
========================
- The top nav no longer wraps into many tabs; core usage is 3 sections.
- With 100+ tasks, Actions list is scannable: rows are compact, minimal controls.
- Automations view shows enabled tasks clearly, with a primary enable toggle and status.
- All existing functionality (Run, profiles, options, selectors, logs, theme, storage tools) is still accessible, but moved into detail/settings as appropriate.
- Hidden tasks do not clutter Actions, but enabled automations are always manageable.
- Existing stored prefs continue to work (migration applied once, safely).
- No regressions in auto-run behavior.

========================
12) Working style
========================
- Make incremental, clean refactors.
- Prefer reusing existing components/logic; move UI around rather than rewriting everything.
- When uncertain, choose the approach that preserves existing behavior and minimizes user surprise.
- Do not ask me questions unless truly blocked; make reasonable assumptions and proceed.

Now: inspect the current workflow/task model, runner, and UI components, then implement the redesign end-to-end.

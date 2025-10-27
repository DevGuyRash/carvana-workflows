# Design Document

## Overview

Enhance the Workflow menu with persistent drag-and-drop ordering, keyboard-accessible reordering, and a Hidden workflows surface that declutters the primary list without losing discoverability. The feature extends the existing `MenuUI` Shadow DOM rendering and leverages shared storage utilities so personalization survives reloads and cross-tab usage.

## Steering Document Alignment

### Technical Standards (tech.md)
- Continue to build on the shared `MenuUI` infrastructure and `Store` abstraction, avoiding direct DOM access from workflows.
- Keep business logic separated from rendering by isolating persistence and ordering logic inside new utilities consumed by the UI class.

### Project Structure (structure.md)
- Place new persistence helpers under `packages/core/src/menu/` (new folder) while UI hooks remain inside `MenuUI` in `core/src/ui.ts`.
- Co-locate CSS additions inside `MenuUI.css()` to respect the existing Shadow DOM styling pattern.

## Code Reuse Analysis

### Existing Components to Leverage
- **`Store` (`core/src/storage.ts`)**: Persist order/hidden state using the established GM_* abstraction.
- **`MenuUI` (`core/src/ui.ts`)**: Extend `renderWorkflows`, event binding, and tab system for the new interactions.
- **`autorun` prefs utilities (`core/src/autorun.ts`)**: Follow serialization/validation patterns when storing workflow-specific data.

### Integration Points
- **Workflow registry**: Continue to receive `PageDefinition.workflows` and use IDs as stable keys for ordering.
- **Shadow DOM tabs**: Reuse the existing tab switching logic to add a Hidden tab without rewriting tab state.
- **Keyboard focus management**: Build on current button semantics to ensure new controls are accessible.

## Architecture

Introduce a two-layer solution:
1. **Preferences service** handles serialization, versioning, and reconciliation between stored order and runtime workflow list.
2. **UI interaction layer** augments `MenuUI` with drag handles, keyboard shortcuts, and a Hidden tab populated from the service.

The design keeps persistence independent of the UI so future surfaces (e.g., profile tabs) can reuse ordering metadata.

### Modular Design Principles
- **Single File Responsibility**: `workflow-preferences.ts` manages storage; `drag-controller.ts` focuses on DOM drag mechanics.
- **Component Isolation**: Hidden tab rendering and controls will live in a helper method `renderHiddenWorkflows()`.
- **Service Layer Separation**: UI requests sorted/filtered workflow arrays from the service rather than manipulating raw storage directly.
- **Utility Modularity**: Pointer/keyboard handlers packaged in reusable helpers to support future draggable lists.

```mermaid
graph TD
    Registry -->|workflows[]| PreferencesService
    PreferencesService -->|order/hidden state| MenuUI
    MenuUI -->|render| WorkflowsTab
    MenuUI -->|render| HiddenTab
    DragController -->|events| MenuUI
    MenuUI -->|mutations| PreferencesService
```

## Components and Interfaces

### `WorkflowPreferencesService`
- **Purpose:** Provide order/hidden state retrieval and persistence keyed by workflow IDs.
- **Interfaces:**
  - `getOrdered(workflows: WorkflowDefinition[]): WorkflowDefinition[]`
  - `isHidden(id: string): boolean`
  - `toggleHidden(id: string, hidden?: boolean): void`
  - `applyMove(id: string, targetIndex: number): WorkflowDefinition[]`
  - `restoreDefaults(workflowIds: string[]): void`
- **Dependencies:** `Store`
- **Reuses:** Storage serialization patterns from `autorun.ts`.

### `DragController`
- **Purpose:** Manage pointer and keyboard drag interactions scoped to list items.
- **Interfaces:**
  - `attach(listElement: HTMLElement, options: { onMove(id, index); onCancel(); })`
  - `detach()`
- **Dependencies:** None outside DOM APIs.
- **Reuses:** N/A – new utility, but generic.

### Hidden Tab Renderer (`renderHiddenWorkflows`)
- **Purpose:** Populate the Hidden tab with compact cards and unhide controls, including search/filter.
- **Interfaces:**
  - `renderHiddenWorkflows(hiddenDefs: WorkflowDefinition[], options: HiddenRenderOptions)`
- **Dependencies:** `WorkflowPreferencesService`, standard DOM helpers within `MenuUI`.
- **Reuses:** Tab switching logic already bound in `MenuUI.bind()`.

### Menu Augmentations
- **Purpose:** Extend existing methods (`renderWorkflows`, `bind`) to incorporate new interactions and accessible controls.
- **Interfaces:** Additional private helpers on `MenuUI` such as `renderWorkflowItem`, `attachReorderEvents`, and `announceStatus` for toasts.
- **Dependencies:** Service + Drag controller.
- **Reuses:** Profile activation buttons, run preference toggles, and options navigation.

## Data Models

### `WorkflowListPrefs`
```
type WorkflowListPrefs = {
  version: 1;
  order: string[];        // workflow IDs in user-defined order
  hidden: string[];       // workflow IDs flagged as hidden
};
```
- `version` guards future migrations.
- `order` persists full user ordering; reconcile against runtime list by falling back to append unknown IDs.
- `hidden` stores IDs regardless of ordering.

### `HiddenWorkflowViewModel`
```
type HiddenWorkflowViewModel = {
  id: string;
  label: string;
  description?: string;
  autoRunActive: boolean;
  lastRun?: LastRunInfo;
};
```
- Pre-computed fields allow the Hidden tab to render quickly without re-fetching prefs.

## Error Handling

### Error Scenario 1: Corrupted Stored Preferences
- **Handling:** Detect invalid JSON or missing keys, log a debug message, and rebuild default preferences from the current workflow registry.
- **User Impact:** Users keep default ordering; toast optionally informs them preferences were reset.

### Error Scenario 2: Drag Operation Interrupted
- **Handling:** If pointer events end outside the list, ignore the move and snap the item back to its last persisted position.
- **User Impact:** Item remains in its original spot with a subtle status announcement.

## Testing Strategy

### Unit Testing
- Cover `WorkflowPreferencesService` reconciliation (missing IDs, new workflows, version mismatch).
- Test `toggleHidden` side-effects ensuring hidden workflows are excluded from ordered lists and persisted correctly.

### Integration Testing
- Simulate drag-drop interactions in a jsdom-like environment to verify DOM ordering updates and storage writes (using Vitest + pointer event polyfills).
- Validate Hidden tab search/filter toggles state and unhiding restores items to the right slot.

### End-to-End Testing
- Use existing demo workflows in a browser automation harness (Playwright or manual runbook) to confirm drag handles, keyboard shortcuts, hiding/unhiding, and auto-run prompts behave as specified.

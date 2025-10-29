# Requirements Document

## Introduction

Introduce a customizable workflow menu that lets users reorder and declutter their automation workflows without losing visibility of hidden items. The capability should feel native to modern SaaS tools, emphasizing ease, clarity, and trust that personalizations persist.

## Alignment with Product Vision

Supports the menu’s goal of making automations discoverable and controllable by individual users. Personalized ordering keeps high-value workflows within immediate reach, while a dedicated hide surface prevents noise without permanently removing access to authored automations.

## Requirements

### Requirement 1 — Visual Drag-and-Drop Reordering

**User Story:** As a workflow-heavy operator, I want to drag workflows into my preferred order so that my most-used automations stay at the top of the Workflows tab.

#### Acceptance Criteria

1. WHEN a user hovers over a workflow item THEN the UI SHALL reveal a drag handle affordance without shifting surrounding content.
2. WHEN a user drags a workflow via the handle THEN the list SHALL display a live drop indicator and reflow remaining items without jank at 60fps targets on modern hardware.
3. WHEN a user drops a workflow into a new position THEN the menu SHALL persist the new order in local storage and immediately reflect the updated ordering across all open menu instances.
4. IF a user navigates away or reloads the page THEN the previously saved order SHALL rehydrate before the first render of the Workflows tab.

### Requirement 2 — Quick Hide From Primary List

**User Story:** As a user who only runs a subset of workflows on a page, I want to hide the ones I rarely use so that the Workflows tab stays focused and scannable.

#### Acceptance Criteria

1. WHEN a user activates the hide control on a workflow THEN the item SHALL animate out of the main list and confirm it moved to Hidden workflows via toast or inline confirmation.
2. IF a workflow is hidden THEN it SHALL not appear in auto-run or repeat toggles in the primary list, but its automation metadata SHALL remain intact.
3. WHEN a hidden workflow becomes auto-run enabled through existing preferences THEN the system SHALL prompt the user to unhide or confirm keeping it hidden before activating auto-run.

### Requirement 3 — Discoverable Hidden Workflows Hub

**User Story:** As a cautious user, I want hidden workflows collected in a modern, easy-to-browse space so that I can quickly review, search, and unhide them when needed.

#### Acceptance Criteria

1. WHEN hidden workflows exist THEN the menu SHALL surface a "Hidden" tab (or equivalent pill) with a badge showing the hidden count.
2. WHEN a user opens the Hidden space THEN workflows SHALL render as cards or rows with compact metadata, search/filter controls, and a single-click unhide action.
3. IF no workflows are hidden THEN the Hidden space SHALL collapse into a subtle affordance (e.g., ghost badge) and SHALL describe how to hide workflows.
4. WHEN a user unhides a workflow from the Hidden space THEN it SHALL return to the main list in its previous relative ordering anchor or appended to the bottom if no prior position exists.

## Non-Functional Requirements

### Code Architecture and Modularity
- Persist ordering and hidden-state data through existing `Store` primitives without coupling reordering logic to workflow execution.
- Encapsulate drag-and-drop behaviors in reusable utilities so other tabs can adopt the interaction later.
- Ensure UI components expose clear interfaces for state updates to avoid prop drilling across the Shadow DOM boundaries.

### Performance
- Maintain interactive drag at target 60fps on Chrome/Edge, with frame drops not exceeding 16ms spikes during reorder.
- Limit persistence writes to debounce within 250ms of drop events to avoid storage thrashing.

### Security
- Do not expose workflow metadata beyond the existing Shadow DOM; prevent drag events from leaking to the host page.
- Respect the same origin storage rules, avoiding cross-origin requests or new permissions.

### Reliability
- Persist ordering and hidden states across browser restarts using current storage (e.g., GM_* APIs).
- Ensure fallback rendering retains default ordering when stored data is corrupted or missing.

### Usability
- Provide keyboard support for moving workflows up/down and toggling hide/unhide without requiring pointer input.
- Meet WCAG 2.1 AA contrast and focus requirements for new affordances, including drag handles and Hidden tab indicators.

# Copilot Instructions for angular-test

These instructions define project conventions for frontend work (Angular + RxJS + FHIR), based on the existing codebase and recent implementation decisions.

## Project Architecture

- Use Angular standalone components (no NgModule-based feature modules for new UI features).
- Keep feature code under `frontend/src/app/features/<feature-name>/` with clear separation:
  - `components/`
  - `services/`
  - `models/`
  - `state/` (mandatory for every new module containing business state)
- Reuse existing shells and UI wrappers before creating new layout primitives.
- If a shared component already exists, it must be reused instead of recreating an equivalent local component.
- Shared components to prioritize (non-exhaustive examples):
  - `ModuleShellComponent`
  - `BubbleCardComponent`
  - `ModalComponent`
  - `ToastComponent`

## Reusable UI Patterns

- For list pages, follow the existing card/worklist pattern used in patients, practitioners, and questionnaires:
  - list container with consistent spacing
  - each row as a bordered card (not simple separators)
  - responsive grid collapse on mobile
- Prefer existing button class conventions over custom one-off styles:
  - `btn btn-primary`
  - `btn btn-neutral`
  - `btn icon danger`
- Keep row interactions accessible:
  - use real `button` elements for clickable rows when possible
  - preserve keyboard usability and focus styles

## Theme and Dark Mode

- Do not hardcode UI colors for surfaces, text, borders, and inputs when a CSS variable exists.
- Use theme variables from global styles (for example):
  - `--card-bg`, `--card-bg-soft`
  - `--text-primary`, `--text-secondary`
  - `--border-color`
  - `--input-bg`, `--input-border`, `--input-text`
  - `--btn-primary-bg`, `--btn-primary-text`
- For new inputs/selects/textarea:
  - apply background + text + border variables
  - include visible focus state
- Ensure dark theme readability for:
  - list rows
  - badges/status pills
  - modal forms
  - empty/error state text

## Internationalization (i18n)

- No user-facing hardcoded strings in templates when a translation key is appropriate.
- Use `ngx-translate` keys in templates and TS where relevant.
- Add or update keys in `frontend/public/i18n/fr.json` when introducing new labels.
- Keep translation key namespaces aligned with feature structure, for example:
  - `questionnaires.*`
  - `practitioners.*`
  - `codeSystems.*`

## Forms and Data Entry

- Use Reactive Forms for feature forms and admin edit/create flows.
- Keep field styling and validation visuals consistent with existing form components.
- When a field is conditional by type (for example quantity unit), implement both:
  - edit-time input in the feature form
  - display-time rendering in preview/renderer components

## RxJS and Async Flows

- Follow existing stream patterns:
  - `debounceTime` + `distinctUntilChanged` for live search
  - `switchMap` for query-dependent requests
  - `forkJoin` for parallel resolution operations
  - `catchError` with safe fallback values
- In components with subscriptions, use `destroy$` + `takeUntil(this.destroy$)` and complete in `ngOnDestroy`.
- Keep loading/error state handling explicit and consistent in UI.

## State Organization (Actions/Effects/Reducer/Selectors)

- For each new module with business state, create and use a dedicated `state/` folder.
- The following state files are required in every new module state implementation:
  - `<feature>.actions.ts`
  - `<feature>.effects.ts`
  - `<feature>.reducer.ts`
  - `<feature>.selectors.ts`
- Keep responsibilities clearly separated:
  - actions: event intents and payload contracts
  - effects: async side effects and service/API orchestration
  - reducer: immutable state transitions only
  - selectors: read models and derived state for components
- Components should dispatch actions and select state; they must not contain API orchestration that belongs in effects.

## FHIR and Service Layer

- Keep FHIR mapping/parsing logic inside feature services, not inside templates.
- Components should orchestrate UI state; services should handle API shape conversion.
- Preserve existing profile/summary model distinctions where present.

## Consistency and Scope of Changes

- Prefer small, targeted changes that preserve existing feature structure.
- Keep visual and interaction behavior aligned with existing reference modules:
  - patients
  - practitioners
  - questionnaires
- When updating one module pattern, check nearby modules for consistency if they share the same UI pattern.

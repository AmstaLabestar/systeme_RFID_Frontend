# App Architecture

## Goal
This folder is organized by responsibility:
- `core`: orchestration and module registry
- `layout`: application shell (sidebar, header, layout)
- `modules`: business features (one folder per system/page)
- `shared`: reusable parts (types, data, shared UI, helper components)

## Folder Layout
```text
src/app
  core/
  layout/
  modules/
    dashboard/
    marketplace/
    settings/
    systems/
      rfid-badge/
      rfid-door/
      fingerprint/
      feedback/
  shared/
    data/
    types/
    components/
    ui/
```

## Add a New System
1. Create a new module in `modules/systems/<system-name>/`.
2. Export it from the nearest `index.ts`.
3. Register it in `core/navigation/modules.tsx` with:
   - page `id`
   - sidebar `label`
   - `icon`
   - `render` function

No layout change is required for adding/removing a system page.

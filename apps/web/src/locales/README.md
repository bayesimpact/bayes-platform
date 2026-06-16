# i18n Locales Structure

This directory contains i18n (internationalization) configuration and utilities for managing translations across the application.

## Structure

```
locales/
├── post-processors.ts      # Custom i18next post-processors
├── loader.ts              # Utilities for loading locale files
├── actions.en.json        # Global English translations
├── actions.fr.json        # Global French translations
├── status.en.json         # Global English translations
└── status.fr.json         # Global French translations
```

## How It Works

### Automatic Locale Discovery

Locale files are **automatically discovered** from two sources:

1. **Feature-specific locales**: `/src/features/*/locales/*.{en,fr}.json`
   - Each feature can have its own translation files
   - Example: `src/features/agents/locales/agent.en.json`

2. **Global locales**: `/src/locales/*.{en,fr}.json`
   - Shared translations used across multiple features

The `loadLocaleResources()` function in `src/i18n.ts` uses Vite's `import.meta.glob` to dynamically load and merge all locale files by language.

### Adding New Translations

To add translations for a new feature:

1. Create the locale directory: `src/features/your-feature/locales/`
2. Add translation files:
   - `your-feature.en.json`
   - `your-feature.fr.json`
3. No manual imports needed! The loader will discover them automatically.

Example structure for a new feature:

```json
// src/features/your-feature/locales/your-feature.en.json
{
  "yourFeature": {
    "title": "Your Feature",
    "description": "Description of your feature"
  }
}
```

### Reuse Shared `actions` / `status` Keys First

`actions.{en,fr}.json` and `status.{en,fr}.json` are **shared, reusable** namespaces for
generic UI verbs and states. Before adding a key to a feature locale file, check whether a
shared key already covers it and reuse it via the namespaced lookup — `t("actions:delete")`,
`t("actions:edit")`, `t("actions:update")`, `t("status:loading")`, etc.

Do NOT create feature-specific keys that duplicate a shared action/status (e.g. a per-feature
`deleteResource: "Delete"` when `actions:delete` already exists). Only add a feature key when
the label is genuinely domain-specific. When a generic verb recurs across features, promote it
to the `actions`/`status` namespace rather than repeating it.

## Post-Processors

Custom post-processors handle special text formatting:

- **colonHandler**: Adds language-specific spacing before colons
  - French: Add space before colon (e.g., "Label :")
  - Other languages: No space (e.g., "Label:")

Usage in translation keys:

```typescript
const text = i18n.t("key", { colon: true })
```

## Benefits of This Approach

✅ **Scalable**: New features don't require changes to `i18n.ts`  
✅ **Maintainable**: Translations are colocated with features  
✅ **Organized**: Clear separation of global and feature-specific translations  
✅ **Type-safe**: Leverages TypeScript for better DX

// Storybook builds its manager with the classic JSX transform, which needs React in scope.
// biome-ignore lint/correctness/noUnusedImports: the JSX below compiles to React.createElement.
import React from "react"
import { IconButton } from "storybook/internal/components"
import { addons, types, useGlobals } from "storybook/manager-api"

const ADDON_ID = "eval/device"

/** The phone the toggle opens, among the viewports of `preview.tsx`. */
const PHONE_VIEWPORT = "iphone14"

/**
 * A button of the toolbar, beside the language, that shows the story on a phone or on a desktop:
 * it sets the viewport, as the viewport menu does in one click less.
 */
function DeviceToggle() {
  const [globals, updateGlobals, storyGlobals] = useGlobals()
  const isPhone = globals.viewport?.value === PHONE_VIEWPORT
  // A story that sets its own viewport keeps it, as the viewport menu does.
  const isLocked = storyGlobals.viewport !== undefined
  return (
    <IconButton
      key={ADDON_ID}
      title={isPhone ? "Show the story on a desktop" : "Show the story on a phone"}
      active={isPhone}
      disabled={isLocked}
      onClick={() =>
        updateGlobals({
          viewport: isPhone
            ? { value: undefined, isRotated: false }
            : { value: PHONE_VIEWPORT, isRotated: false },
        })
      }
    >
      {isPhone ? "Mobile" : "Desktop"}
    </IconButton>
  )
}

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    type: types.TOOL,
    title: "Phone or desktop",
    match: ({ viewMode }) => viewMode === "story",
    render: () => <DeviceToggle />,
  })
})

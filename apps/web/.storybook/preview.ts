import type { Preview } from "@storybook/react-vite"
import { INITIAL_VIEWPORTS } from "storybook/viewport"

import "../src/index.css"
import "../src/i18n"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      viewports: {
        ...INITIAL_VIEWPORTS,
        iphoneSE: {
          name: "iPhone SE (375px)",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        iphone14: {
          name: "iPhone 14 (390px)",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
        iphone14ProMax: {
          name: "iPhone 14 Pro Max (430px)",
          styles: { width: "430px", height: "932px" },
          type: "mobile",
        },
      },
    },
  },
}

export default preview

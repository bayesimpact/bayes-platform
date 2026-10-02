import { SIGN_IN_ERRORS } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { AuthErrorRoute as Comp } from "@/common/routes/AuthErrorRoute"
import { withRedux } from "../decorators"

const meta = {
  title: "routes/AuthError",
  component: Comp,
  decorators: [withRouter, withRedux()],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Comp>

export default meta
type Story = StoryObj<typeof meta>

/** The API refused a first sign-in: the provider has not verified the email yet. */
export const EmailNotVerified: Story = {
  args: { error: { code: "sign_in_refused", description: SIGN_IN_ERRORS.EMAIL_NOT_VERIFIED } },
}

/** The API refused a first sign-in: the provider sent no email. */
export const EmailRequired: Story = {
  args: { error: { code: "sign_in_refused", description: SIGN_IN_ERRORS.EMAIL_REQUIRED } },
}

/** The API refused a first sign-in: an account exists and linking by email is off. */
export const EmailLinkingDisabled: Story = {
  args: {
    error: { code: "sign_in_refused", description: SIGN_IN_ERRORS.EMAIL_LINKING_DISABLED },
  },
}

/** Any other error, here one sent by the identity provider: the generic message. */
export const ProviderError: Story = {
  args: {
    error: {
      code: "access_denied",
      description: "user google-oauth2|1234567890 is not part of the org_example organization",
    },
  },
}

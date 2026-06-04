import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Item } from "@caseai-connect/ui/shad/item"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Trash2Icon } from "lucide-react"
import { fn } from "storybook/test"
import { Grid, GridCard, GridContent } from "@/common/components/grid/Grid"

/**
 * GridCard is the composable replacement for the old GridItem. It reads its
 * position from the surrounding GridContent (no `index` prop) and draws the
 * internal grid borders / last-cell column span automatically.
 */
const meta = {
  title: "common/GridCard",
  component: GridCard,
  parameters: { layout: "padded" },
} satisfies Meta<typeof GridCard>

export default meta
type Story = StoryObj<typeof meta>

const onClick = fn()

/** A 3-column list: internal borders between cells, last cell spans the remainder. */
export const SimpleList: Story = {
  render: () => (
    <Grid cols={3}>
      <GridContent>
        {["Helpful Assistant", "Pricing Bot", "Support Agent", "Onboarding Guide"].map((name) => (
          <GridCard key={name}>
            <GridCard.Badge>agent</GridCard.Badge>
            <GridCard.Body>
              <GridCard.Title>{name}</GridCard.Title>
              <GridCard.Description>Updated 2 days ago</GridCard.Description>
              <GridCard.GoButton onClick={onClick} />
            </GridCard.Body>
          </GridCard>
        ))}
      </GridContent>
    </Grid>
  ),
}

/** Footer pinned to the bottom (`mt-auto`); padding collapses (`pb-0`) when a footer is present. */
export const WithFooter: Story = {
  render: () => (
    <Grid cols={2}>
      <GridContent>
        <GridCard>
          <GridCard.Body>
            <GridCard.Title>Analytics</GridCard.Title>
            <GridCard.Description>Track usage over time</GridCard.Description>
            <GridCard.GoButton onClick={onClick} />
          </GridCard.Body>
          <GridCard.Footer>
            <Item variant="outline" className="w-full">
              <div className="flex items-end gap-1 h-12 w-full">
                {[40, 65, 45, 80, 55, 70].map((height) => (
                  <div
                    key={`bar-${height}`}
                    className="flex-1 rounded-sm bg-primary"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </Item>
          </GridCard.Footer>
        </GridCard>
        <GridCard>
          <GridCard.Body>
            <GridCard.Title>Members</GridCard.Title>
            <GridCard.Description>Manage who has access</GridCard.Description>
            <GridCard.GoButton onClick={onClick} />
          </GridCard.Body>
        </GridCard>
      </GridContent>
    </Grid>
  ),
}

/** A delete button anchored to the top-right corner via GridCard.TopAction. */
export const WithTopAction: Story = {
  render: () => (
    <Grid cols={3}>
      <GridContent>
        {["Alice Martin", "Bob Smith", "Carol Diaz"].map((name) => (
          <GridCard key={name}>
            <GridCard.TopAction>
              <Button variant="outline" size="icon-sm" onClick={onClick}>
                <Trash2Icon className="size-3.5" />
              </Button>
            </GridCard.TopAction>
            <GridCard.Badge>member</GridCard.Badge>
            <GridCard.Body>
              <GridCard.Title>{name}</GridCard.Title>
              <GridCard.Description>
                {name.toLowerCase().replace(" ", ".")}@example.com
              </GridCard.Description>
              <GridCard.GoButton onClick={onClick} />
            </GridCard.Body>
          </GridCard>
        ))}
      </GridContent>
    </Grid>
  ),
}

/** String badges auto-wrap in a capitalized <Badge>; node badges pass through unchanged. */
export const Badges: Story = {
  render: () => (
    <Grid cols={2}>
      <GridContent>
        <GridCard>
          <GridCard.Badge>string badge (auto-wrapped + capitalized)</GridCard.Badge>
          <GridCard.Body>
            <GridCard.Title>Auto-wrapped</GridCard.Title>
          </GridCard.Body>
        </GridCard>
        <GridCard>
          <GridCard.Badge variant="destructive">failed</GridCard.Badge>
          <GridCard.Body>
            <GridCard.Title>Destructive variant</GridCard.Title>
          </GridCard.Body>
        </GridCard>
        <GridCard>
          <GridCard.Badge>
            <Badge variant="outline" className="gap-1">
              custom node badge
            </Badge>
          </GridCard.Badge>
          <GridCard.Body>
            <GridCard.Title>Node passthrough</GridCard.Title>
          </GridCard.Body>
        </GridCard>
      </GridContent>
    </Grid>
  ),
}

/** A card with no action at all — no boolean/undefined hack required (the old footgun). */
export const NoAction: Story = {
  render: () => (
    <Grid cols={2}>
      <GridContent>
        <GridCard>
          <GridCard.Body>
            <div className="flex justify-between items-center">
              <GridCard.Title>Workspace A</GridCard.Title>
              <Button variant="outline">Open</Button>
            </div>
          </GridCard.Body>
        </GridCard>
        <GridCard>
          <GridCard.Body>
            <GridCard.Title>Workspace B</GridCard.Title>
          </GridCard.Body>
        </GridCard>
      </GridContent>
    </Grid>
  ),
}

/**
 * Conditional cells: `Children.toArray` drops falsy children, so the grid math
 * counts only the cards that actually render — the removed card is skipped.
 */
export const ConditionalCells: Story = {
  render: () => {
    const showSecond = false
    return (
      <Grid cols={3}>
        <GridContent>
          <GridCard>
            <GridCard.Body>
              <GridCard.Title>Always shown</GridCard.Title>
            </GridCard.Body>
          </GridCard>
          {showSecond && (
            <GridCard>
              <GridCard.Body>
                <GridCard.Title>Hidden</GridCard.Title>
              </GridCard.Body>
            </GridCard>
          )}
          <GridCard>
            <GridCard.Body>
              <GridCard.Title>Also shown</GridCard.Title>
            </GridCard.Body>
          </GridCard>
        </GridContent>
      </Grid>
    )
  },
}

/** A card rendered outside GridContent uses the `span` escape hatch (cols={0} stacked layouts). */
export const SpanFullOutsideGridContent: Story = {
  render: () => (
    <Grid cols={0}>
      <GridCard span="full" className="bg-muted/35 border-b">
        <GridCard.Body>
          <GridCard.Title>Full-width create card</GridCard.Title>
          <GridCard.Description>Rendered directly under Grid, no GridContent</GridCard.Description>
          <Button>Create</Button>
        </GridCard.Body>
      </GridCard>
    </Grid>
  ),
}

/** A nested Grid inside a card body gets its own isolated cell context. */
export const NestedGrid: Story = {
  render: () => (
    <Grid cols={1}>
      <GridContent>
        <GridCard className="bg-muted/20">
          <GridCard.Body>
            <GridCard.Title>Organization</GridCard.Title>
            <Grid cols={2}>
              <GridContent className="bg-white rounded-2xl border">
                {["Project One", "Project Two", "Project Three"].map((name) => (
                  <GridCard key={name}>
                    <GridCard.Body>
                      <GridCard.Title>{name}</GridCard.Title>
                      <GridCard.GoButton onClick={onClick} />
                    </GridCard.Body>
                  </GridCard>
                ))}
              </GridContent>
            </Grid>
          </GridCard.Body>
        </GridCard>
      </GridContent>
    </Grid>
  ),
}

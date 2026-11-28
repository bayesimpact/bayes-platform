/**
 * The embed dev server the launcher stories load in their iframes: in a worktree environment, the
 * embed app of that worktree (`<name>-embed-storybook.<domain>` loads `<name>-embed.<domain>`);
 * otherwise http://localhost:5175, which `npm run dev` in apps/web-embed starts.
 */
export function embedDevServer(): string {
  const { protocol, hostname, port } = window.location
  const worktreeHost = hostname.replace(/-embed-storybook\./, "-embed.")
  if (worktreeHost === hostname) return "http://localhost:5175"
  return `${protocol}//${worktreeHost}${port ? `:${port}` : ""}`
}

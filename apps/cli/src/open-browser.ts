import { spawn } from "node:child_process"

export function openBrowser(url: string): void {
  const child =
    process.platform === "darwin"
      ? spawn("open", [url], { stdio: "ignore", detached: true })
      : process.platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true })
        : spawn("xdg-open", [url], { stdio: "ignore", detached: true })
  child.unref()
}

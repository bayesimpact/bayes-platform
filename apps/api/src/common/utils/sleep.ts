export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function randomSleep(msMin = 200, msMax = 5000): Promise<void> {
  const delay = Math.floor(Math.random() * (msMax - msMin)) + msMin
  return sleep(delay)
}

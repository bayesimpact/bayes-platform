import userEvent from "@testing-library/user-event"

/**
 * Writes in the message box as a paste does, then sends with Enter when asked. The box is a rich
 * text editor, which the tests' DOM feeds badly one key at a time: it drops a letter typed twice
 * in a row. A paste reaches it whole, and still goes through its rules, the code chips included.
 */
export async function writeMessage(
  box: HTMLElement,
  text: string,
  { send = false }: { send?: boolean } = {},
): Promise<void> {
  await userEvent.click(box)
  await userEvent.paste(text)
  if (send) await userEvent.keyboard("{Enter}")
}

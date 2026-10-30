import { required } from "./required"

/**
 * The page's hidden file input, which its "attach" or "choose a file" button opens. The input has
 * no label of its own yet, so this is the one query of the tests that reads the DOM by type.
 */
export function hiddenFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]')
  return required(input instanceof HTMLInputElement ? input : null, "a file input on the page")
}

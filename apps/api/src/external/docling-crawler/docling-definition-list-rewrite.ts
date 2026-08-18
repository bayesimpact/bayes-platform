// Docling's layout parser silently drops <dl>/<dt>/<dd> (definition list) content
// during HTML->Markdown conversion, so rewrite definition lists to <ul> beforehand.
//
// This runs inside a Playwright `page.evaluate()` call, which serializes the function
// and executes it in the browser page — `document` refers to that page's real DOM, not
// anything passed from Node. Keep this function parameterless for that reason.
export function rewriteDefinitionListsAsUnorderedLists(): void {
  document.querySelectorAll("dl").forEach((dl) => {
    const ul = document.createElement("ul")
    dl.querySelectorAll("dt").forEach((dt) => {
      let dd = dt.nextElementSibling
      while (dd && dd.tagName !== "DD") dd = dd.nextElementSibling

      const li = document.createElement("li")
      const strong = document.createElement("strong")
      dt.childNodes.forEach((node) => {
        strong.appendChild(node.cloneNode(true))
      })
      li.appendChild(strong)

      if (dd) {
        li.appendChild(document.createTextNode(" — "))
        dd.childNodes.forEach((node) => {
          li.appendChild(node.cloneNode(true))
        })
      }

      ul.appendChild(li)
    })
    dl.replaceWith(ul)
  })
}

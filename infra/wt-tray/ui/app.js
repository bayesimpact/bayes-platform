// The popover of the menu bar icon. The Rust side polls the dashboard's API and pushes each
// change: the environments as the dashboard computes them, and who the token names. Buttons go
// through the same API, which forwards them to the user's daemon (docs/adr/0026).
const { invoke } = window.__TAURI__.core
const { listen } = window.__TAURI__.event
const { openUrl } = window.__TAURI__.opener

const ONE_SHOT_SERVICES = new Set(["init", "db", "migrate"])
const RUNNING = new Set(["healthy", "running", "starting", "unhealthy"])

// What survives a re-render: open service lists, actions in flight, their last error.
const openServices = new Set()
const pending = new Set()
const errors = new Map()
let snapshot = null

function element(tag, properties = {}, children = []) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null || value === false) continue
    if (key === "text") node.textContent = value
    else if (key === "class") node.className = value
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value)
    else node.setAttribute(key, value === true ? "" : value)
  }
  node.append(...children.filter(Boolean))
  return node
}

function link(text, url) {
  return element("a", { text, title: url, onclick: () => openUrl(url) })
}

function linkLabel(name) {
  return name === "app" ? "App" : name.replaceAll("-", " ")
}

async function act(key, slug, call) {
  pending.add(key)
  errors.delete(slug)
  render()
  try {
    await call()
  } catch (error) {
    errors.set(slug, String(error))
  } finally {
    pending.delete(key)
    render()
  }
}

function actionButton({ key, slug, label, call, primary = false }) {
  const busy = pending.has(key)
  return element("button", {
    class: primary ? "primary" : undefined,
    disabled: busy,
    text: busy ? "…" : label,
    onclick: (event) => {
      event.stopPropagation()
      act(key, slug, call)
    },
  })
}

const post = (path, body = {}) => invoke("post", { path, body })

// A job's output streams in the dashboard, which opens it from the link's fragment.
async function runJob(slug, action) {
  const { job } = await post(`/api/environments/${slug}/${action}`)
  openUrl(`${snapshot.dashboardUrl}/#job=${job.id}`)
}

function serviceRow(environment, service, mine) {
  const slug = environment.slug
  const call = (action) => () =>
    post(`/api/environments/${slug}/${action}`, { service: service.name })
  const key = (action) => `${slug}/${service.name}/${action}`
  const running = RUNNING.has(service.health)
  const buttons = []
  if (!mine) {
    // Someone else's: read-only.
  } else if (ONE_SHOT_SERVICES.has(service.name)) {
    if (!running) {
      buttons.push(actionButton({ key: key("start"), slug, label: "Run", call: call("start") }))
    }
  } else if (running) {
    buttons.push(
      actionButton({ key: key("restart"), slug, label: "Restart", call: call("restart") }),
      actionButton({ key: key("stop"), slug, label: "Stop", call: call("stop") }),
    )
  } else {
    buttons.push(actionButton({ key: key("start"), slug, label: "Start", call: call("start") }))
  }
  return element("div", { class: "service" }, [
    element("span", { class: `dot ${service.health}` }),
    element("span", { class: "grow", text: service.name }),
    element("span", { class: "health", text: service.health }),
    ...buttons,
  ])
}

function environmentCard(environment) {
  const slug = environment.slug
  const me = snapshot.me
  const mine = Boolean(me) && environment.ownerUid === me.uid
  const stopped = environment.state === "stopped"
  const ready = environment.services.filter((service) =>
    ["healthy", "running", "done"].includes(service.health),
  ).length
  const appLink = environment.links.find((entry) => entry.name === "app")
  const otherLinks = environment.links.filter((entry) => entry.name !== "app")
  const actions = mine
    ? [
        actionButton({
          key: `${slug}/env`,
          slug,
          label: stopped ? "Start" : "Stop",
          primary: stopped,
          call: () => post(`/api/environments/${slug}/${stopped ? "start" : "stop"}`),
        }),
      ]
    : []
  const tools = mine
    ? [
        actionButton({ key: `${slug}/up`, slug, label: "Update", call: () => runJob(slug, "up") }),
        me.platform === "darwin" &&
          actionButton({
            key: `${slug}/editor`,
            slug,
            label: "Editor",
            call: () => post(`/api/environments/${slug}/open`, { target: "editor" }),
          }),
        me.platform === "darwin" &&
          actionButton({
            key: `${slug}/terminal`,
            slug,
            label: "Terminal",
            call: () => post(`/api/environments/${slug}/open`, { target: "terminal" }),
          }),
      ]
    : []
  const error = errors.get(slug)
  return element("section", { class: "card" }, [
    element("div", { class: "row" }, [
      element("span", { class: `dot ${environment.state}`, title: environment.state }),
      element("div", { class: "grow" }, [
        element("div", { class: "slug", text: slug }),
        environment.description &&
          element("div", {
            class: "description",
            text: environment.description,
            title: environment.description,
          }),
        element("div", {
          class: "branch",
          text: [environment.branch, !mine && environment.owner && `owned by ${environment.owner}`]
            .filter(Boolean)
            .join(" · "),
        }),
      ]),
      element("span", { class: `pill ${environment.state}`, text: environment.state }),
      ...actions,
    ]),
    element("div", { class: "links" }, [
      appLink && !stopped && link("Open the app", appLink.url),
      environment.pr &&
        link(`#${environment.pr.number} ${environment.pr.state.toLowerCase()}`, environment.pr.url),
      ...(stopped ? [] : otherLinks.map((entry) => link(linkLabel(entry.name), entry.url))),
      environment.tracesUrl && !stopped && link("traces", environment.tracesUrl),
    ]),
    tools.some(Boolean) && element("div", { class: "row tools" }, tools),
    error && element("div", { class: "banner", text: error }),
    element(
      "details",
      {
        open: openServices.has(slug),
        ontoggle: (event) => {
          if (event.target.open) openServices.add(slug)
          else openServices.delete(slug)
        },
      },
      [
        element("summary", { text: `Services: ${ready} of ${environment.services.length} ready` }),
        element(
          "div",
          { class: "services" },
          environment.services.map((service) => serviceRow(environment, service, mine)),
        ),
      ],
    ),
  ])
}

function tokenForm() {
  const input = element("input", {
    type: "password",
    placeholder: "Paste the token of npm run wt -- login",
    autocomplete: "off",
  })
  const save = element("button", {
    class: "primary",
    text: "Save",
    onclick: async () => {
      save.disabled = true
      try {
        await invoke("save_token", { token: input.value })
      } finally {
        save.disabled = false
      }
    },
  })
  return element("div", { class: "card" }, [
    element("div", {
      class: "meta",
      text: "The buttons need your token. Run npm run wt -- login where your environments run (this Mac or the dev VM), then paste the token it prints.",
    }),
    element("div", { class: "row" }, [input, save]),
  ])
}

function render() {
  if (!snapshot) return
  const { state, me, meError, needsToken, error, dashboardUrl } = snapshot
  document.getElementById("dashboard").onclick = () => openUrl(dashboardUrl)
  document
    .getElementById("who")
    .replaceChildren(
      me
        ? element("span", { class: "meta", text: me.user })
        : element("span", { class: "meta", text: "read-only" }),
    )

  const children = []
  if (error) children.push(element("div", { class: "banner", text: error }))
  if (meError) children.push(element("div", { class: "banner", text: meError }))
  if (needsToken) children.push(tokenForm())
  if (state) {
    // The caller's environments first.
    const environments = [...state.environments].sort(
      (first, second) =>
        Number(second.ownerUid === me?.uid) - Number(first.ownerUid === me?.uid) ||
        first.slug.localeCompare(second.slug),
    )
    if (environments.length === 0) {
      children.push(
        element("div", { class: "empty" }, [
          element("p", { text: "No worktree environment on this machine." }),
          element("p", {}, ["Create one from the ", link("dashboard", dashboardUrl), "."]),
        ]),
      )
    }
    children.push(...environments.map(environmentCard))
  }
  document.getElementById("environments").replaceChildren(...children)
  document.getElementById("updated").textContent = state
    ? `Updated ${new Date().toLocaleTimeString()} · ${state.environments.length} environments`
    : "Waiting for the dashboard…"
}

listen("snapshot", (event) => {
  snapshot = event.payload
  render()
})
snapshot = await invoke("current_snapshot")
render()

# Public Chat API

This document explains how to build a custom chat UI on top of the AgentStudio public chat API.  
All endpoints are **unauthenticated** — security is enforced by the `embedToken`, which is scoped to a single agent and can be restricted to specific origins.

Base URL: `https://<your-api-host>`

---

## Overview

| Step | Endpoint | Description |
|------|----------|-------------|
| 1 | `GET /public/agents/:embedToken/config` | Fetch branding (title, logo, color) |
| 2 | `POST /public/agents/:embedToken/sessions` | Create (or resume) a chat session |
| 3 | `GET /public/agents/:embedToken/sessions/:sessionId` | Restore session history |
| 4 | `GET /public/agents/:embedToken/sessions/:sessionId/messages/stream` | Stream an assistant reply (SSE) |

---

## 1. Get embed config

Fetch the agent's branding to customise your UI before the first render.

```
GET /public/agents/:embedToken/config
```

**Response**
```json
{
  "data": {
    "agentName": "Support Bot",
    "title": "Help Center",
    "logoUrl": "https://example.com/logo.png",
    "primaryColor": "#2563eb"
  }
}
```

`title`, `logoUrl`, and `primaryColor` are `null` when not configured — fall back to your own defaults.

---

## 2. Create a session

Call this once per visitor to get a `sessionId` + `sessionToken`. Store both in `localStorage` to resume conversations across page reloads.

```
POST /public/agents/:embedToken/sessions
Content-Type: application/json

{
  "payload": {
    "externalVisitorId": "user-123"   // optional — your own stable visitor ID
  }
}
```

**Response**
```json
{
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionToken": "<signed-token>"
  }
}
```

> The `sessionToken` must be sent as the `X-Session-Token` header on every subsequent request.

---

## 3. Restore session history

Use this on page reload to fetch the full message history for an existing session.

```
GET /public/agents/:embedToken/sessions/:sessionId
X-Session-Token: <sessionToken>
```

**Response**
```json
{
  "data": {
    "id": "550e8400-...",
    "agentId": "...",
    "messages": [
      {
        "id": "msg-1",
        "role": "user",
        "content": "Hello!",
        "status": "completed",
        "createdAt": 1748000000000
      },
      {
        "id": "msg-2",
        "role": "assistant",
        "content": "Hi there, how can I help?",
        "status": "completed",
        "createdAt": 1748000001000
      }
    ],
    "createdAt": 1748000000000
  }
}
```

Message `role` is one of `"user"`, `"assistant"`, or `"tool"`.  
Message `status` is one of `"streaming"`, `"completed"`, `"aborted"`, or `"error"`.

---

## 4. Stream a message (SSE)

Send the user's message and receive the assistant's reply as a Server-Sent Events stream.

```
GET /public/agents/:embedToken/sessions/:sessionId/messages/stream?q=<encoded-payload>
X-Session-Token: <sessionToken>
Accept: text/event-stream
```

The `q` query parameter is a URL-encoded JSON string:

```js
const q = encodeURIComponent(JSON.stringify({ payload: { content: "What is your return policy?" } }))
```

**SSE event format**

Each `data:` line is a JSON object. Events arrive in this order:

```
data: {"type":"start","messageId":"msg-3"}

data: {"type":"chunk","messageId":"msg-3","content":"Our return"}

data: {"type":"chunk","messageId":"msg-3","content":" policy allows"}

data: {"type":"end","messageId":"msg-3","fullContent":"Our return policy allows 30 days..."}
```

| Event type | Fields | Description |
|------------|--------|-------------|
| `start` | `messageId` | Assistant started generating |
| `chunk` | `messageId`, `content` | Partial text to append to the message |
| `notify_client` | `toolName` | Agent is calling a tool (informational) |
| `end` | `messageId`, `fullContent` | Generation complete, full text included |
| `error` | `messageId`, `error` | Generation failed |

> **Why GET instead of POST for SSE?**  
> `EventSource` (native browser API) only supports GET. We encode the payload in the `q` query param to stay compatible. If you use `fetch` with a `ReadableStream` instead, both GET and POST work.

---

## Minimal JavaScript example

```js
const API = "https://<your-api-host>"
const TOKEN = "<embedToken>"

// 1. Create or restore session
let sessionId = localStorage.getItem("chatSessionId")
let sessionToken = localStorage.getItem("chatSessionToken")

if (!sessionId) {
  const res = await fetch(`${API}/public/agents/${TOKEN}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: {} }),
  })
  const { data } = await res.json()
  sessionId = data.sessionId
  sessionToken = data.sessionToken
  localStorage.setItem("chatSessionId", sessionId)
  localStorage.setItem("chatSessionToken", sessionToken)
}

// 2. Stream a message
async function send(userMessage) {
  const q = encodeURIComponent(JSON.stringify({ payload: { content: userMessage } }))
  const url = `${API}/public/agents/${TOKEN}/sessions/${sessionId}/messages/stream?q=${q}`

  const response = await fetch(url, {
    headers: { "X-Session-Token": sessionToken, Accept: "text/event-stream" },
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data: ")) continue
        const raw = line.slice("data: ".length).trim()
        if (!raw || raw === "[DONE]") continue
        const event = JSON.parse(raw)
        if (event.type === "chunk") process.stdout.write(event.content)
        if (event.type === "end") console.log("\n[done]")
      }
    }
  }
}

send("Hello!")
```

---

## Error responses

All error responses follow standard HTTP status codes with a JSON body:

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid `embedToken` |
| `403` | Embed disabled, origin not allowed, or invalid `X-Session-Token` |
| `404` | Session not found |
| `500` | Server error |

```json
{ "statusCode": 403, "message": "Origin not allowed" }
```

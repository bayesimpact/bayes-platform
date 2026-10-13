// The dashboard's API at http://dev.connect.localhost:<router port>, the same on a Mac and on a
// laptop tunnelled to the dev VM: its state, and the actions it forwards to the daemon of the
// token's owner (docs/adr/0026-worktree-control-daemon.md). Plain HTTP/1.0 on 127.0.0.1 with the
// dashboard's Host, so `*.localhost` needs no resolver.
use serde_json::Value;
use std::{
    env, fs,
    io::{Read, Write},
    net::TcpStream,
    path::PathBuf,
    process::{Command, Stdio},
    time::Duration,
};

pub const TOKEN_HEADER: &str = "X-Wt-Token";

pub fn router_port() -> u16 {
    env::var("ROUTER_PORT").ok().and_then(|port| port.parse().ok()).unwrap_or(8800)
}

pub fn dashboard_url() -> String {
    format!("http://dev.connect.localhost:{}", router_port())
}

pub struct Reply {
    pub status: u16,
    pub body: Value,
}

pub fn call(method: &str, path: &str, token: Option<&str>, body: Option<&Value>) -> Result<Reply, String> {
    let port = router_port();
    let mut stream = TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_secs(2))
        .map_err(|_| format!("Nothing answers on 127.0.0.1:{port}: is the shared stack running (or the tunnel to the VM open)?"))?;
    stream.set_read_timeout(Some(Duration::from_secs(60))).ok();
    let payload = body.map(Value::to_string).unwrap_or_default();
    let mut head = format!(
        "{method} {path} HTTP/1.0\r\nHost: dev.connect.localhost:{port}\r\nContent-Length: {}\r\n",
        payload.len()
    );
    if body.is_some() {
        head.push_str("Content-Type: application/json\r\n");
    }
    if let Some(token) = token {
        head.push_str(&format!("{TOKEN_HEADER}: {token}\r\n"));
    }
    head.push_str("\r\n");
    stream
        .write_all(format!("{head}{payload}").as_bytes())
        .map_err(|error| error.to_string())?;
    let mut reply = String::new();
    stream.read_to_string(&mut reply).map_err(|error| error.to_string())?;
    let (head, body) = reply.split_once("\r\n\r\n").unwrap_or((&reply, ""));
    let status = head
        .split_whitespace()
        .nth(1)
        .and_then(|code| code.parse().ok())
        .unwrap_or(0);
    Ok(Reply {
        status,
        body: serde_json::from_str(body).unwrap_or(Value::Null),
    })
}

/// The answer of an action, or its error message.
pub fn act(method: &str, path: &str, token: &str, body: &Value) -> Result<Value, String> {
    let reply = call(method, path, Some(token), Some(body))?;
    if (200..300).contains(&reply.status) {
        Ok(reply.body)
    } else {
        Err(reply.body["error"]
            .as_str()
            .map(String::from)
            .unwrap_or_else(|| format!("HTTP {}", reply.status)))
    }
}

fn state_dir() -> PathBuf {
    env::var_os("DEV_STATE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env::var_os("HOME").unwrap_or_default()).join(".bayes-worktrees"))
}

/// The token of this Mac's user, written by `wt serve` or `wt login`, when there is one.
pub fn local_token() -> Option<String> {
    fs::read_to_string(state_dir().join("api-token"))
        .ok()
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty())
}

/// Starts this Mac's daemon the way `wt serve` recorded it. False when it never ran here.
pub fn start_local_daemon() -> bool {
    let Some(daemon) = fs::read_to_string(state_dir().join("daemon.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
    else {
        return false;
    };
    let (Some(node), Some(main_checkout)) = (daemon["node"].as_str(), daemon["mainCheckout"].as_str()) else {
        return false;
    };
    let Ok(log) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(state_dir().join("serve.log"))
    else {
        return false;
    };
    // A GUI process starts with a bare PATH: give the daemon's commands (docker, git, gh) theirs.
    let path = [
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/Applications/Docker.app/Contents/Resources/bin",
        "/usr/bin",
        "/bin",
        &env::var("PATH").unwrap_or_default(),
    ]
    .join(":");
    Command::new(node)
        .arg(PathBuf::from(main_checkout).join("infra/worktree/wt.mjs"))
        .arg("serve")
        .current_dir(main_checkout)
        .env("PATH", path)
        .stdin(Stdio::null())
        .stdout(log.try_clone().map(Stdio::from).unwrap_or(Stdio::null()))
        .stderr(Stdio::from(log))
        .spawn()
        .is_ok()
}

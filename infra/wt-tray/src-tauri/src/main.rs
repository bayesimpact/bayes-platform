// Worktree environments in the menu bar: a client of the dashboard's API, which forwards its
// buttons to the user's daemon (docs/adr/0026-worktree-control-daemon.md). See
// infra/wt-tray/README.md.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gateway;

use serde_json::{json, Value};
use std::{
    fs,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_positioner::{Position, WindowExt};

const TRAY_ID: &str = "main";
const POLL_EVERY: Duration = Duration::from_secs(3);
const RESTART_DAEMON_EVERY: u64 = 30;

/// A token pasted in the app, for a laptop whose environments run on the dev VM.
struct PastedToken(Mutex<Option<String>>);

static LAST_DAEMON_START: AtomicU64 = AtomicU64::new(0);

fn token(app: &AppHandle) -> Option<String> {
    gateway::local_token().or_else(|| app.state::<PastedToken>().0.lock().ok()?.clone())
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|time| time.as_secs()).unwrap_or(0)
}

/// What the window shows: the dashboard's state, and who the token names.
fn snapshot(app: &AppHandle) -> Value {
    let dashboard = gateway::dashboard_url();
    let state = match gateway::call("GET", "/api/state", None, None) {
        Ok(reply) if reply.status == 200 => reply.body,
        Ok(reply) => return json!({ "error": format!("The dashboard answered {}", reply.status), "dashboardUrl": dashboard }),
        Err(error) => return json!({ "error": error, "dashboardUrl": dashboard }),
    };
    let Some(token) = token(app) else {
        return json!({ "state": state, "me": null, "needsToken": true, "dashboardUrl": dashboard });
    };
    let (me, me_error, needs_token) = match gateway::call("GET", "/api/me", Some(&token), None) {
        Ok(reply) if reply.status == 200 => (reply.body, Value::Null, false),
        Ok(reply) if reply.status == 401 => (Value::Null, json!("The token is not valid any more: paste a new one (npm run wt -- login)."), true),
        Ok(reply) if reply.status == 502 => {
            // This Mac's daemon stopped: start it again, at most every 30 seconds.
            let last = LAST_DAEMON_START.load(Ordering::Relaxed);
            let message = if now() - last > RESTART_DAEMON_EVERY && gateway::start_local_daemon() {
                LAST_DAEMON_START.store(now(), Ordering::Relaxed);
                "Starting your daemon…"
            } else {
                "Your daemon does not run: npm run wt -- serve"
            };
            (Value::Null, json!(message), false)
        }
        Ok(reply) => (Value::Null, reply.body["error"].clone(), false),
        Err(error) => (Value::Null, json!(error), false),
    };
    json!({ "state": state, "me": me, "meError": me_error, "needsToken": needs_token, "dashboardUrl": dashboard })
}

#[tauri::command]
fn current_snapshot(app: AppHandle) -> Value {
    snapshot(&app)
}

/// An action of the dashboard's API: only the routes of environments and of new worktrees.
#[tauri::command]
async fn post(app: AppHandle, path: String, body: Value) -> Result<Value, String> {
    let allowed = path == "/api/worktrees"
        || path
            .strip_prefix("/api/environments/")
            .and_then(|rest| rest.split_once('/'))
            .is_some_and(|(slug, action)| {
                !slug.is_empty()
                    && slug.chars().all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-')
                    && !action.is_empty()
                    && action.chars().all(|character| character.is_ascii_lowercase() || character == '-')
            });
    if !allowed {
        return Err("Unknown action".into());
    }
    let token = token(&app).ok_or("No token yet")?;
    let result = tauri::async_runtime::spawn_blocking(move || gateway::act("POST", &path, &token, &body))
        .await
        .map_err(|error| error.to_string())?;
    // Show the change at once rather than at the next poll.
    app.emit("snapshot", snapshot(&app)).ok();
    result
}

#[tauri::command]
fn save_token(app: AppHandle, token: String, pasted: State<PastedToken>) -> Result<(), String> {
    let token = token.trim().to_string();
    let folder = app.path().app_config_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    let file = folder.join("token");
    fs::write(&file, &token).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&file, fs::Permissions::from_mode(0o600)).ok();
    }
    *pasted.0.lock().map_err(|error| error.to_string())? = Some(token);
    app.emit("snapshot", snapshot(&app)).ok();
    Ok(())
}

fn update_tray(app: &AppHandle, snapshot: &Value) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let environments = snapshot["state"]["environments"].as_array().cloned().unwrap_or_default();
    let running = environments.iter().filter(|environment| environment["state"] != "stopped").count();
    let problem = environments.iter().any(|environment| environment["state"] == "problem");
    let (title, tooltip) = if snapshot["error"].is_string() {
        ("!".to_string(), snapshot["error"].as_str().unwrap_or_default().to_string())
    } else {
        (
            format!("{running}{}", if problem { "!" } else { "" }),
            format!("{running} of {} worktree environments running", environments.len()),
        )
    };
    tray.set_title(Some(title)).ok();
    tray.set_tooltip(Some(tooltip)).ok();
}

/// Polls the dashboard and pushes every change to the window and the menu bar.
fn watch(app: AppHandle) {
    thread::spawn(move || {
        let mut previous = String::new();
        loop {
            let current = snapshot(&app);
            let mut comparable = current.clone();
            comparable["state"]["generatedAt"] = Value::Null;
            let text = comparable.to_string();
            if text != previous {
                update_tray(&app, &current);
                app.emit("snapshot", &current).ok();
                previous = text;
            }
            thread::sleep(POLL_EVERY);
        }
    });
}

fn toggle_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        window.hide().ok();
    } else {
        window.move_window(Position::TrayCenter).ok();
        window.show().ok();
        window.set_focus().ok();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_positioner::init())
        .invoke_handler(tauri::generate_handler![current_snapshot, post, save_token])
        .setup(|app| {
            // A menu bar app: no Dock icon, no app switcher entry.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let pasted = app
                .path()
                .app_config_dir()
                .ok()
                .and_then(|folder| fs::read_to_string(folder.join("token")).ok())
                .map(|token| token.trim().to_string())
                .filter(|token| !token.is_empty());
            app.manage(PastedToken(Mutex::new(pasted)));

            let dashboard = MenuItem::with_id(app, "dashboard", "Open the dashboard", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
            let menu = Menu::with_items(app, &[&dashboard, &quit])?;
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "dashboard" => {
                        app.opener().open_url(gateway::dashboard_url(), None::<&str>).ok();
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            watch(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // A popover: it goes away when another window takes the focus.
            if let WindowEvent::Focused(false) = event {
                window.hide().ok();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running wt-tray");
}

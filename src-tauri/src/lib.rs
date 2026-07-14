use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use serde::Serialize;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_deep_link::DeepLinkExt;

const BRIDGE_SCRIPT: &str = include_str!("../tauri-bridge.js");
const SUPPORTED_EXTENSIONS: &[&str] = &["md", "markdown", "txt", "html", "htm"];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedFile {
    file_path: String,
    name: String,
    content: String,
}

#[derive(Default)]
struct DesktopBridgeState {
    open_file_listener_ready: AtomicBool,
    pending_open_file: Mutex<Option<OpenedFile>>,
}

struct ZoomLevel(Mutex<f64>);

fn read_supported_file(path: &Path) -> Option<OpenedFile> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    if !SUPPORTED_EXTENSIONS.contains(&extension.as_str()) {
        return None;
    }

    Some(OpenedFile {
        file_path: path.to_string_lossy().into_owned(),
        name: path.file_name()?.to_string_lossy().into_owned(),
        content: fs::read_to_string(path).ok()?,
    })
}

fn queue_open_file(app: &tauri::AppHandle, path: PathBuf) {
    let Some(file) = read_supported_file(&path) else {
        return;
    };

    let state = app.state::<DesktopBridgeState>();
    if !state.open_file_listener_ready.load(Ordering::Acquire)
        || app.emit_to("main", "open-file", &file).is_err()
    {
        *state.pending_open_file.lock().unwrap() = Some(file);
    }
}

#[tauri::command]
fn take_pending_open_file(state: tauri::State<'_, DesktopBridgeState>) -> Option<OpenedFile> {
    state
        .open_file_listener_ready
        .store(true, Ordering::Release);
    state.pending_open_file.lock().unwrap().take()
}

fn build_menu(app: &tauri::App) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let settings = MenuItemBuilder::with_id("open-settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let new_document = MenuItemBuilder::with_id("new-document", "New")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_document = MenuItemBuilder::with_id("open-document", "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save_output = MenuItemBuilder::with_id("save-output", "Save Output…")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let paste_match_style = MenuItemBuilder::with_id("paste-match-style", "Paste and Match Style")
        .accelerator("CmdOrCtrl+Shift+V")
        .build(app)?;
    let delete = MenuItemBuilder::with_id("delete", "Delete").build(app)?;
    let reload = MenuItemBuilder::with_id("reload", "Reload")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let force_reload = MenuItemBuilder::with_id("force-reload", "Force Reload")
        .accelerator("CmdOrCtrl+Shift+R")
        .build(app)?;
    let toggle_devtools = MenuItemBuilder::with_id("toggle-devtools", "Toggle Developer Tools")
        .accelerator("Alt+CmdOrCtrl+I")
        .build(app)?;
    let reset_zoom = MenuItemBuilder::with_id("reset-zoom", "Actual Size")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let zoom_in = MenuItemBuilder::with_id("zoom-in", "Zoom In")
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom-out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;

    let app_menu = SubmenuBuilder::new(app, "Inkdown")
        .about(None)
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_document)
        .item(&open_document)
        .separator()
        .item(&save_output)
        .build()?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .item(&paste_match_style)
        .item(&delete)
        .select_all()
        .build()?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&reload)
        .item(&force_reload)
        .item(&toggle_devtools)
        .separator()
        .item(&reset_zoom)
        .item(&zoom_in)
        .item(&zoom_out)
        .separator()
        .fullscreen()
        .build()?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize_with_text("Zoom")
        .separator()
        .bring_all_to_front()
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
        .build()
}

fn handle_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    match event.id().0.as_str() {
        action @ ("open-settings" | "new-document" | "open-document" | "save-output") => {
            let _ = window.emit("menu-action", action);
        }
        "reload" | "force-reload" => {
            let _ = window.eval("location.reload()");
        }
        "toggle-devtools" => {
            if window.is_devtools_open() {
                window.close_devtools();
            } else {
                window.open_devtools();
            }
        }
        "reset-zoom" => {
            *app.state::<ZoomLevel>().0.lock().unwrap() = 1.0;
            let _ = window.set_zoom(1.0);
        }
        "zoom-in" => {
            let state = app.state::<ZoomLevel>();
            let mut zoom = state.0.lock().unwrap();
            *zoom = (*zoom + 0.2).min(5.0);
            let _ = window.set_zoom(*zoom);
        }
        "zoom-out" => {
            let state = app.state::<ZoomLevel>();
            let mut zoom = state.0.lock().unwrap();
            *zoom = (*zoom - 0.2).max(0.2);
            let _ = window.set_zoom(*zoom);
        }
        "paste-match-style" => {
            let _ = window.eval("navigator.clipboard.readText().then(text => document.execCommand('insertText', false, text))");
        }
        "delete" => {
            let _ = window.eval("document.execCommand('delete')");
        }
        _ => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DesktopBridgeState::default())
        .manage(ZoomLevel(Mutex::new(1.0)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![take_pending_open_file])
        .setup(|app| {
            app.set_menu(build_menu(app)?)?;

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Inkdown")
                .inner_size(1440.0, 960.0)
                .min_inner_size(1100.0, 760.0)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .transparent(true)
                .traffic_light_position(tauri::LogicalPosition::new(18.0, 20.0))
                .initialization_script(BRIDGE_SCRIPT)
                .build()?;

            if let Some(urls) = app.deep_link().get_current()? {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        if let Some(file) = read_supported_file(&path) {
                            *app.state::<DesktopBridgeState>()
                                .pending_open_file
                                .lock()
                                .unwrap() = Some(file);
                        }
                    }
                }
            }

            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    if let Ok(path) = url.to_file_path() {
                        queue_open_file(&app_handle, path);
                    }
                }
            });

            Ok(())
        })
        .on_menu_event(handle_menu_event)
        .run(tauri::generate_context!())
        .expect("error while running Inkdown");
}

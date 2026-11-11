use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use base64::Engine as _;
use serde::Serialize;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

const BRIDGE_SCRIPT: &str = include_str!("../tauri-bridge.js");
const SUPPORTED_EXTENSIONS: &[&str] = &["md", "markdown", "txt", "html", "htm"];
const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;

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
    opened_document_paths: Mutex<HashSet<PathBuf>>,
    writable_markdown_paths: Mutex<HashSet<PathBuf>>,
    unsaved_state: Mutex<(u64, bool)>,
    unsaved_prompt_open: AtomicBool,
    quit_requested: AtomicBool,
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

fn authorize_document_path(state: &DesktopBridgeState, path: &Path) {
    let extension = path.extension().and_then(|value| value.to_str());
    if extension
        .is_some_and(|value| SUPPORTED_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
    {
        state
            .opened_document_paths
            .lock()
            .unwrap()
            .insert(path.to_path_buf());
    }
    if extension
        .is_some_and(|value| matches!(value.to_ascii_lowercase().as_str(), "md" | "markdown"))
    {
        state
            .writable_markdown_paths
            .lock()
            .unwrap()
            .insert(path.to_path_buf());
    }
}

fn resolve_relative_path(
    state: &DesktopBridgeState,
    base_file_path: &str,
    reference: &str,
) -> Result<PathBuf, String> {
    let base = Path::new(base_file_path);
    if !state.opened_document_paths.lock().unwrap().contains(base) {
        return Err("Open the document in Asterism before following local links".into());
    }
    let raw_path = reference.trim().split(['?', '#']).next().unwrap_or("");
    let relative = percent_encoding::percent_decode_str(raw_path)
        .decode_utf8()
        .map_err(|_| "Invalid local link".to_string())?;
    let first_segment = relative.split('/').next().unwrap_or("");
    if relative.is_empty()
        || Path::new(relative.as_ref()).is_absolute()
        || relative.contains('\\')
        || relative.contains('\0')
        || first_segment.contains(':')
    {
        return Err("Only relative local links are supported".into());
    }
    let parent = base
        .parent()
        .ok_or_else(|| "Document has no parent folder".to_string())?;
    fs::canonicalize(parent.join(relative.as_ref())).map_err(|error| error.to_string())
}

fn image_mime_type(path: &Path, data: &[u8]) -> Result<&'static str, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" if data.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]) => "image/png",
        "jpg" | "jpeg" if data.starts_with(&[255, 216, 255]) => "image/jpeg",
        "gif" if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") => "image/gif",
        "webp" if data.starts_with(b"RIFF") && data.get(8..12) == Some(b"WEBP") => "image/webp",
        _ => return Err("Only PNG, JPEG, GIF, and WebP images are supported".into()),
    };
    Ok(mime)
}

fn content_conflicts(path: &Path, expected: &str) -> Result<bool, String> {
    match fs::read_to_string(path) {
        Ok(on_disk) => Ok(on_disk != expected),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(true),
        Err(error) => Err(error.to_string()),
    }
}

fn needs_unsaved_prompt(state: &DesktopBridgeState) -> bool {
    state.unsaved_state.lock().unwrap().1
}

fn update_unsaved_state(state: &DesktopBridgeState, needs_prompt: bool, revision: u64) {
    let mut status = state.unsaved_state.lock().unwrap();
    if revision > status.0 {
        *status = (revision, needs_prompt);
    }
}

fn prompt_to_discard(app: tauri::AppHandle, on_discard: impl FnOnce() + Send + 'static) {
    let state = app.state::<DesktopBridgeState>();
    if state.unsaved_prompt_open.swap(true, Ordering::AcqRel) {
        return;
    }
    let callback_app = app.clone();
    app.dialog()
        .message("Your edits have not been saved.")
        .title("Discard unsaved changes?")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Discard Changes".into(),
            "Cancel".into(),
        ))
        .show(move |discard| {
            let state = callback_app.state::<DesktopBridgeState>();
            state.unsaved_prompt_open.store(false, Ordering::Release);
            if discard {
                state.unsaved_state.lock().unwrap().1 = false;
                if state.quit_requested.swap(false, Ordering::AcqRel) {
                    callback_app.exit(0);
                } else {
                    on_discard();
                }
            } else {
                state.quit_requested.store(false, Ordering::Release);
            }
        });
}

fn queue_open_file(app: &tauri::AppHandle, path: PathBuf) {
    let Some(file) = read_supported_file(&path) else {
        return;
    };

    let state = app.state::<DesktopBridgeState>();
    authorize_document_path(&state, &path);
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

#[tauri::command]
fn set_unsaved_state(
    state: tauri::State<'_, DesktopBridgeState>,
    needs_prompt: bool,
    revision: u64,
) {
    update_unsaved_state(&state, needs_prompt, revision);
}

#[tauri::command]
fn open_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopBridgeState>,
) -> Result<Option<OpenedFile>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Supported Documents", SUPPORTED_EXTENSIONS)
        .blocking_pick_file();
    let Some(path) = file else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|error| error.to_string())?;
    let opened =
        read_supported_file(&path).ok_or_else(|| "Could not open this document".to_string())?;
    authorize_document_path(&state, &path);
    Ok(Some(opened))
}

#[tauri::command]
fn save_document_as(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopBridgeState>,
    default_path: String,
    content: String,
) -> Result<Option<String>, String> {
    let requested_path = Path::new(&default_path);
    let file_name = requested_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled.md");
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"])
        .set_file_name(file_name);
    if requested_path.is_absolute() {
        if let Some(directory) = requested_path.parent() {
            dialog = dialog.set_directory(directory);
        }
    }
    let Some(path) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|error| error.to_string())?;
    fs::write(&path, content).map_err(|error| error.to_string())?;
    authorize_document_path(&state, &path);
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn write_document(
    state: tauri::State<'_, DesktopBridgeState>,
    file_path: String,
    content: String,
    expected_content: Option<String>,
    force: bool,
) -> Result<bool, String> {
    let path = Path::new(&file_path);
    if !state.writable_markdown_paths.lock().unwrap().contains(path) {
        return Err("The file must be opened or saved in Asterism first".into());
    }
    if !force {
        let expected =
            expected_content.ok_or_else(|| "Expected file content must be text".to_string())?;
        if content_conflicts(path, &expected)? {
            return Ok(true);
        }
    }
    fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(false)
}

#[tauri::command]
fn open_relative_file(
    state: tauri::State<'_, DesktopBridgeState>,
    base_file_path: String,
    href: String,
) -> Result<OpenedFile, String> {
    let path = resolve_relative_path(&state, &base_file_path, &href)?;
    let opened = read_supported_file(&path)
        .ok_or_else(|| "Only Markdown, text, and HTML documents can be opened".to_string())?;
    authorize_document_path(&state, &path);
    Ok(opened)
}

#[tauri::command]
fn read_relative_image(
    state: tauri::State<'_, DesktopBridgeState>,
    base_file_path: String,
    src: String,
) -> Result<String, String> {
    let path = resolve_relative_path(&state, &base_file_path, &src)?;
    let info = fs::metadata(&path).map_err(|error| error.to_string())?;
    if !info.is_file() || info.len() > MAX_IMAGE_BYTES {
        return Err("Image must be a file under 10 MiB".into());
    }
    let data = fs::read(&path).map_err(|error| error.to_string())?;
    if data.len() as u64 > MAX_IMAGE_BYTES {
        return Err("Image must be under 10 MiB".into());
    }
    let mime = image_mime_type(&path, &data)?;
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(data)
    ))
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
    let save_output = MenuItemBuilder::with_id("save-output", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("save-as", "Save As…")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let replace = MenuItemBuilder::with_id("replace", "Find and Replace…")
        .accelerator("Alt+CmdOrCtrl+F")
        .build(app)?;
    let paste_match_style = MenuItemBuilder::with_id("paste-match-style", "Paste and Match Style")
        .accelerator("CmdOrCtrl+Shift+V")
        .build(app)?;
    let delete = MenuItemBuilder::with_id("delete", "Delete").build(app)?;
    let find = MenuItemBuilder::with_id("find", "Find…")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let find_next = MenuItemBuilder::with_id("find-next", "Find Next")
        .accelerator("CmdOrCtrl+G")
        .build(app)?;
    let find_previous = MenuItemBuilder::with_id("find-previous", "Find Previous")
        .accelerator("CmdOrCtrl+Shift+G")
        .build(app)?;
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

    let app_menu = SubmenuBuilder::new(app, "Asterism")
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
        .item(&save_as)
        .build()?;
    let find_menu = SubmenuBuilder::new(app, "Find")
        .item(&find)
        .item(&replace)
        .item(&find_next)
        .item(&find_previous)
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
        .separator()
        .item(&find_menu)
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
        action @ ("open-settings" | "new-document" | "open-document" | "save-output"
        | "save-as" | "find" | "replace" | "find-next" | "find-previous") => {
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
        .invoke_handler(tauri::generate_handler![
            take_pending_open_file,
            open_document,
            save_document_as,
            write_document,
            open_relative_file,
            read_relative_image,
            set_unsaved_state
        ])
        .setup(|app| {
            app.set_menu(build_menu(app)?)?;

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Asterism")
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
                            let state = app.state::<DesktopBridgeState>();
                            authorize_document_path(&state, &path);
                            *state.pending_open_file.lock().unwrap() = Some(file);
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
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                if needs_unsaved_prompt(&app.state::<DesktopBridgeState>()) {
                    api.prevent_close();
                    let target_window = window.clone();
                    prompt_to_discard(app.clone(), move || {
                        let _ = target_window.close();
                    });
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Asterism")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let state = app.state::<DesktopBridgeState>();
                if needs_unsaved_prompt(&state) {
                    api.prevent_exit();
                    state.quit_requested.store(true, Ordering::Release);
                    let handle = app.clone();
                    prompt_to_discard(handle.clone(), move || handle.exit(0));
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_folder() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let folder =
            std::env::temp_dir().join(format!("asterism-native-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn relative_links_need_an_opened_base_and_resolve_parent_paths() {
        let folder = test_folder();
        let docs = folder.join("docs");
        let assets = folder.join("assets");
        fs::create_dir_all(&docs).unwrap();
        fs::create_dir_all(&assets).unwrap();
        let base = docs.join("note.md");
        let image = assets.join("figure.png");
        fs::write(&base, "# Note").unwrap();
        fs::write(&image, [137, 80, 78, 71, 13, 10, 26, 10]).unwrap();
        let state = DesktopBridgeState::default();
        let base_text = base.to_str().unwrap();
        assert!(resolve_relative_path(&state, base_text, "../assets/figure.png").is_err());
        authorize_document_path(&state, &base);
        assert_eq!(
            resolve_relative_path(&state, base_text, "../assets/figure.png?size=2#top").unwrap(),
            fs::canonicalize(&image).unwrap()
        );
        assert!(resolve_relative_path(&state, base_text, "/etc/passwd").is_err());
        assert!(resolve_relative_path(&state, base_text, "file:///etc/passwd").is_err());
        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn direct_save_detects_changes_and_deleted_files() {
        let folder = test_folder();
        let file = folder.join("note.md");
        fs::write(&file, "original").unwrap();
        assert!(!content_conflicts(&file, "original").unwrap());
        assert!(content_conflicts(&file, "stale").unwrap());
        fs::remove_file(&file).unwrap();
        assert!(content_conflicts(&file, "original").unwrap());
        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn image_type_requires_a_raster_signature() {
        assert_eq!(
            image_mime_type(Path::new("figure.png"), &[137, 80, 78, 71, 13, 10, 26, 10]).unwrap(),
            "image/png"
        );
        assert!(image_mime_type(Path::new("figure.png"), b"<svg></svg>").is_err());
        assert!(
            image_mime_type(Path::new("figure.svg"), &[137, 80, 78, 71, 13, 10, 26, 10]).is_err()
        );
    }

    #[test]
    fn stale_unsaved_updates_cannot_clear_a_newer_dirty_state() {
        let state = DesktopBridgeState::default();
        update_unsaved_state(&state, true, 12);
        update_unsaved_state(&state, false, 11);
        assert!(needs_unsaved_prompt(&state));
        update_unsaved_state(&state, false, 13);
        assert!(!needs_unsaved_prompt(&state));
    }
}

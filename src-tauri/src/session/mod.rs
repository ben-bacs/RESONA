#[repr(C)]
struct LastInputInfo {
    cb_size: u32,
    dw_time: u32,
}

#[cfg(windows)]
#[link(name = "user32")]
extern "system" {
    fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn GetTickCount() -> u32;
}

#[cfg(windows)]
pub fn get_os_idle_seconds() -> f32 {
    unsafe {
        let mut lii = LastInputInfo {
            cb_size: std::mem::size_of::<LastInputInfo>() as u32,
            dw_time: 0,
        };
        if GetLastInputInfo(&mut lii) != 0 {
            let current_tick = GetTickCount();
            let elapsed_ms = current_tick.wrapping_sub(lii.dw_time);
            (elapsed_ms as f32) / 1000.0
        } else {
            0.0
        }
    }
}

#[cfg(not(windows))]
pub fn get_os_idle_seconds() -> f32 {
    0.0
}

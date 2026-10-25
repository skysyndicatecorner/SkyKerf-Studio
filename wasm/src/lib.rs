//! SkyKerf_Studio · numeric kernels compiled to WebAssembly.
//!
//! No standard library, no allocator: JavaScript lays the buffers out in the
//! module's linear memory (starting at `heap_base()`) and passes pointers.
//! Every kernel has a pure-JavaScript twin in `src/js/wasmcore.js`; the app
//! uses the JavaScript version when WebAssembly is unavailable.
#![no_std]

use core::panic::PanicInfo;
use core::slice;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

extern "C" {
    static __heap_base: u8;
}

/// First free byte of linear memory (JavaScript places its buffers from here).
#[no_mangle]
pub extern "C" fn heap_base() -> usize {
    unsafe { &__heap_base as *const u8 as usize }
}

/// Version of the kernel set, checked by the loader.
#[no_mangle]
pub extern "C" fn version() -> i32 {
    3
}

// error-diffusion kernels: (dx, dy, weight), divisor
const FS: ([(i32, i32, f32); 4], f32) = ([(1, 0, 7.), (-1, 1, 3.), (0, 1, 5.), (1, 1, 1.)], 16.);
const ATKINSON: ([(i32, i32, f32); 6], f32) = ([(1, 0, 1.), (2, 0, 1.), (-1, 1, 1.), (0, 1, 1.), (1, 1, 1.), (0, 2, 1.)], 8.);
const JARVIS: ([(i32, i32, f32); 12], f32) = (
    [(1, 0, 7.), (2, 0, 5.), (-2, 1, 3.), (-1, 1, 5.), (0, 1, 7.), (1, 1, 5.), (2, 1, 3.), (-2, 2, 1.), (-1, 2, 3.), (0, 2, 5.), (1, 2, 3.), (2, 2, 1.)],
    48.,
);
const STUCKI: ([(i32, i32, f32); 12], f32) = (
    [(1, 0, 8.), (2, 0, 4.), (-2, 1, 2.), (-1, 1, 4.), (0, 1, 8.), (1, 1, 4.), (2, 1, 2.), (-2, 2, 1.), (-1, 2, 2.), (0, 2, 4.), (1, 2, 2.), (2, 2, 1.)],
    42.,
);

#[inline(always)]
fn diffuse(g: &mut [f32], out: &mut [u8], w: usize, h: usize, k: &[(i32, i32, f32)], div: f32) {
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let v = g[i];
            let nv: f32 = if v > 127.0 { 255.0 } else { 0.0 };
            out[i] = nv as u8;
            let e = (v - nv) / div;
            for &(dx, dy, wt) in k {
                let xx = x as i32 + dx;
                let yy = y + dy as usize;
                if xx >= 0 && (xx as usize) < w && yy < h {
                    g[yy * w + xx as usize] += e * wt;
                }
            }
        }
    }
}

/// Error-diffusion dithering of a darkness map (0 = no burn, 255 = full) into 0/255.
/// kind: 0 Floyd–Steinberg, 1 Atkinson, 2 Jarvis–Judice–Ninke, 3 Stucki.
#[no_mangle]
pub unsafe extern "C" fn dither(g: *mut f32, out: *mut u8, w: i32, h: i32, kind: i32) {
    let (w, h) = (w.max(0) as usize, h.max(0) as usize);
    let g = slice::from_raw_parts_mut(g, w * h);
    let out = slice::from_raw_parts_mut(out, w * h);
    match kind {
        1 => diffuse(g, out, w, h, &ATKINSON.0, ATKINSON.1),
        2 => diffuse(g, out, w, h, &JARVIS.0, JARVIS.1),
        3 => diffuse(g, out, w, h, &STUCKI.0, STUCKI.1),
        _ => diffuse(g, out, w, h, &FS.0, FS.1),
    }
}

/// Box blur of radius r, applied twice (≈ Gaussian); `tmp` must hold w·h floats.
#[no_mangle]
pub unsafe extern "C" fn box_blur(a: *mut f32, tmp: *mut f32, w: i32, h: i32, r: i32) {
    let (w, h, r) = (w.max(0) as usize, h.max(0) as usize, r.max(0) as isize);
    if r == 0 || w == 0 || h == 0 {
        return;
    }
    let a = slice::from_raw_parts_mut(a, w * h);
    let t = slice::from_raw_parts_mut(tmp, w * h);
    for _ in 0..2 {
        for y in 0..h {
            let row = y * w;
            let (mut s, mut n) = (0.0f32, 0.0f32);
            for xx in -r..=r {
                if xx >= 0 && (xx as usize) < w {
                    s += a[row + xx as usize];
                    n += 1.0;
                }
            }
            for x in 0..w {
                t[row + x] = s / n;
                let lo = x as isize - r;
                let hi = x as isize + r + 1;
                if lo >= 0 {
                    s -= a[row + lo as usize];
                    n -= 1.0;
                }
                if (hi as usize) < w {
                    s += a[row + hi as usize];
                    n += 1.0;
                }
            }
        }
        for x in 0..w {
            let (mut s, mut n) = (0.0f32, 0.0f32);
            for yy in -r..=r {
                if yy >= 0 && (yy as usize) < h {
                    s += t[yy as usize * w + x];
                    n += 1.0;
                }
            }
            for y in 0..h {
                a[y * w + x] = s / n;
                let lo = y as isize - r;
                let hi = y as isize + r + 1;
                if lo >= 0 {
                    s -= t[lo as usize * w + x];
                    n -= 1.0;
                }
                if (hi as usize) < h {
                    s += t[hi as usize * w + x];
                    n += 1.0;
                }
            }
        }
    }
}

/// Plane ∩ triangle mesh. For each crossing triangle writes one segment:
/// out[8k..8k+4] = (u0, v0, u1, v1) and keys[4k..4k+4] = edge vertices (a0, b0, a1, b1)
/// so JavaScript can chain the segments into loops by shared edges.
/// `sd` is scratch for nv floats. Returns the number of segments, or −needed when `cap` is too small.
#[no_mangle]
pub unsafe extern "C" fn slice_mesh(
    pos: *const f32, nv: i32, idx: *const u32, ni: i32, sd: *mut f32,
    nx: f32, ny: f32, nz: f32, d: f32, ux: f32, uy: f32, uz: f32, vx: f32, vy: f32, vz: f32,
    out: *mut f32, keys: *mut u32, cap: i32,
) -> i32 {
    let nv = nv.max(0) as usize;
    let p = slice::from_raw_parts(pos, nv * 3);
    let ix = slice::from_raw_parts(idx, ni.max(0) as usize);
    let s = slice::from_raw_parts_mut(sd, nv);
    for i in 0..nv {
        s[i] = p[3 * i] * nx + p[3 * i + 1] * ny + p[3 * i + 2] * nz - d;
    }
    let cap = cap.max(0) as usize;
    let o = slice::from_raw_parts_mut(out, cap * 4);
    let k = slice::from_raw_parts_mut(keys, cap * 4);
    let mut n = 0usize;
    let mut needed = 0usize;
    let mut f = 0;
    while f + 2 < ix.len() {
        let (a, b, c) = (ix[f] as usize, ix[f + 1] as usize, ix[f + 2] as usize);
        f += 3;
        let (sa, sb, sc) = (s[a] >= 0.0, s[b] >= 0.0, s[c] >= 0.0);
        if sa == sb && sb == sc {
            continue;
        }
        let mut e = [(0usize, 0usize); 2];
        let mut m = 0;
        if sa != sb { e[m] = (a, b); m += 1; }
        if sb != sc && m < 2 { e[m] = (b, c); m += 1; }
        if sc != sa && m < 2 { e[m] = (c, a); m += 1; }
        if m != 2 {
            continue;
        }
        needed += 1;
        if n >= cap {
            continue;
        }
        for q in 0..2 {
            let (i0, i1) = e[q];
            let t = s[i0] / (s[i0] - s[i1]);
            let x = p[3 * i0] + (p[3 * i1] - p[3 * i0]) * t;
            let y = p[3 * i0 + 1] + (p[3 * i1 + 1] - p[3 * i0 + 1]) * t;
            let z = p[3 * i0 + 2] + (p[3 * i1 + 2] - p[3 * i0 + 2]) * t;
            o[4 * n + 2 * q] = x * ux + y * uy + z * uz;
            o[4 * n + 2 * q + 1] = x * vx + y * vy + z * vz;
            let (lo, hi) = if i0 < i1 { (i0, i1) } else { (i1, i0) };
            k[4 * n + 2 * q] = lo as u32;
            k[4 * n + 2 * q + 1] = hi as u32;
        }
        n += 1;
    }
    if needed > cap { -(needed as i32) } else { n as i32 }
}

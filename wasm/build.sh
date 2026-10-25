#!/usr/bin/env sh
# Builds wasm/src/lib.rs into WebAssembly and embeds it into src/js/wasm-bin.js (base64).
# Needs Rust with the wasm32-unknown-unknown target:  rustup target add wasm32-unknown-unknown
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
WASM=target/wasm32-unknown-unknown/release/skykerf_core.wasm
node embed.js "$WASM" ../src/js/wasm-bin.js
echo "OK: $(wc -c < "$WASM") bytes -> src/js/wasm-bin.js"

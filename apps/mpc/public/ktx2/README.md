# KTX2 decoder (self-hosted)

Babylon.js 9.29.0 KTX2 decoder and transcoders, copied unmodified from `https://cdn.babylonjs.com/v9.29.0/` so textures decode without a third-party CDN.

- `babylon.ktx2Decoder.js`: Babylon.js, Apache License 2.0 (`LICENSE.txt`).
- `msc_basis_transcoder.js` / `.wasm`: Basis Universal transcoder by Binomial LLC, Apache License 2.0.
- `zstddec.wasm`: Zstandard decoder (Meta Platforms), BSD licence; only used by zstd-supercompressed KTX2 files.

Update these together with `@babylonjs/core`.

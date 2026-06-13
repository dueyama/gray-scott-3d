# AGENTS.md

## Project

This repository contains a public educational browser app for the 3D Gray-Scott reaction-diffusion model.

The public web app lives in `src/`. A local copy of the legacy C implementation may exist in `old_src/`, but that directory is ignored and is not part of the public repository. Treat it as private reference material when present. Do not rewrite or clean it up unless the user explicitly asks.

## Runtime

- App framework: Vite
- Rendering: Three.js, WebGL2, `THREE.Data3DTexture`
- Simulation: explicit finite-difference Euler update in a Web Worker
- Randomness: deterministic Mersenne Twister with a user-visible seed
- Deployment target: GitHub public repository, then Vercel static deployment

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

For Vercel, keep the default Vite settings:

- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Do not commit `.vercel/`, credentials, tokens, or local environment files.

## Numerical Notes

The web version intentionally does not port the legacy ICCG solver. Use the explicit Gray-Scott update:

```text
U_t = Du laplacian(U) - U V^2 + F(1 - U)
V_t = Dv laplacian(V) + U V^2 - (F + k)V
```

Keep parameter names close to the C source and papers: `F`, `k`/`K`, `Du`, `Dv`, `dx`, `init`, `seed`.

The public UI exposes both periodic and zero-flux boundaries. Paper-derived presets may default to `periodic`; the legacy `DiscN` preset should keep `neumann`. Implement boundary modes by changing neighbor indexing only:

- `neumann`: clamp `-1 -> 0`, `size -> size - 1`
- `periodic`: wrap `-1 -> size - 1`, `size -> 0`

The public app should preserve the initial condition previously extracted from the local `old_src/DiscN` parameter files unless the user explicitly asks for more. In the local reference copy, `old_src/DiscN/testFs.fn` points to `old_src/DiscN/testFs.cp`, which sets `init=21`.

For `init=21`, keep these details from `old_src/uv_init.c`:

- initialize `U=1`, `V=0` everywhere
- center the seed near `imax/3`, `jmax/3`, `kmax/3`
- use `xwid=0.1`, radius `xwid/2`
- use a smooth `tanh` transition with width `0.01`
- perturb radius by `(MT(seed)-0.5) * xwid * 0.1`

Other `uv_init.c` branches are reference material only. Do not expose them in the public UI unless requested.

Presets should be added one at a time around the Snake baseline unless the user gives a broader list. Keep the same initial condition and DiscN scale for these presets: `N=64`, `dx=0.01`, `L=0.64`. Phys. Rev. E 75, 046212 Table IX may be used as a source of candidate `F`/`k` values, but do not reintroduce the paper's varying `L` or per-step random forcing unless explicitly requested.

## Visualization Notes

The primary visualization should remain volume raymarching, not a CPU-generated mesh, because the app is for general-public exploration and should update smoothly while parameters move.

Current pipeline:

1. Worker computes `U` and `V` as `Float32Array`.
2. Worker quantizes `V` to `Uint8Array`.
3. Main thread uploads it into a Three.js `Data3DTexture`.
4. Fragment shader raymarches through a cube and accumulates color/opacity above a visible threshold.
5. Optional isosurface mode uses Three.js `MarchingCubes` on the quantized `V` field with `isolation = threshold * 0.5 * 255`, because the mesh needs a lower cutoff than the volume shader's perceptual threshold.
6. 2D slice canvases show central XY/XZ/YZ cuts as a fallback explanation aid.

Keep Marching Cubes as a separate optional view. It is CPU-bound, so do not update it more often than necessary during continuous simulation.

## UX Direction

This is not a research workstation. Keep the first screen approachable:

- presets first
- free parameter controls available but not overwhelming
- Japanese labels for public-facing UI
- explain U/V and F/k in plain language
- show the 3D result immediately

Avoid dense lab dashboards, nested cards, marketing landing pages, decorative blobs, and controls that do not affect the simulation.

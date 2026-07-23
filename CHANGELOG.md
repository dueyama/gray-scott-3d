# Changelog

Notable changes to Gray-Scott 3D are recorded here.

## Unreleased

### Changed

- GPGPU volume rendering now reads the simulation's `RGBA32F` texture directly in the raymarching shader.
- GPU-to-CPU snapshots are limited to periodic updates for metrics, slice views, and Marching Cubes instead of occurring on every displayed frame.
- The GPGPU field uses a compact tiled atlas, allowing a 100 x 100 x 100 field to fit in a 1000 x 1000 texture.
- Added automatic tests for the GPU atlas coordinate mapping.

## 0.1.0 - 2026-06-19

### Added

- Public Japanese and English educational interface for the three-dimensional Gray-Scott model.
- Presets, free parameter controls, deterministic initial conditions, and periodic or zero-flux boundaries.
- CPU Web Worker and WebGL2 GPGPU simulation backends.
- Three.js volume raymarching, Marching Cubes isosurfaces, and three central slice views.
- Automatic GPGPU selection with CPU fallback.
- Demand-driven rendering while the simulation is stopped.
- Vercel deployment and analytics support.


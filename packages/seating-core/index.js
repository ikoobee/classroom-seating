/**
 * @ikoobee/seating-core — public API (single entry).
 *
 * Exposes the stable surface: engine entry points, grid geometry, rotation,
 * models, relations, stats, seeded RNG, demo data and the enum dictionaries.
 * Engine internals (scorers / moves / optimize / construct / precheck /
 * constraints) are implementation details and intentionally NOT re-exported —
 * import those deep paths at your own risk; they may change in minor versions.
 */
export * from './src/constants.js';
export * from './src/models.js';
export * from './src/grid.js';
export * from './src/rotation.js';
export * from './src/relations.js';
export * from './src/stats.js';
export * from './src/rng.js';
export * from './src/datagen.js';
export * from './src/engine/context.js';
export * from './src/engine/evaluate.js';
export * from './src/engine/precheck.js';
export * from './src/engine/engine.js';

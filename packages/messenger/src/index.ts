/**
 * `@harbor/messenger` — the embeddable web messenger (S05). A tiny loader injects an iframe-isolated widget;
 * a typed postMessage bridge connects the host page and the iframe; a pure session model handles the
 * anonymous→identified upgrade. All the logic here is DOM-free and unit-tested; the browser wiring is a thin
 * edge in `loader.ts` and the widget entry point.
 */
export * from "./protocol";
export * from "./bridge";
export * from "./session";
export * from "./loader";
export * from "./entry";

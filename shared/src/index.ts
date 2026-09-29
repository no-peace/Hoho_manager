/**
 * `@dmb/shared` — the vocabulary both workspaces agree on.
 *
 * Anything that must not drift between the editor and the API lives here:
 * Discord constants, the custom-id wire format, and the domain types.
 */
export * from "./constants.js";
export * from "./customId.js";
export * from "./types.js";

/**
 * @module cli/adapters/output/theme
 * @description OutputAdapter — Defines semantic text formatting and colors for the CLI.
 * Colors are defined by purpose (success, error, label) rather than color names
 * so they can be easily redefined or themed.
 */

// ANSI color codes
const C_PRIMARY = "\x1b[38;2;112;205;244m";
const C_SHADOW = "\x1b[38;2;35;84;116m";
const C_SUCCESS = "\x1b[38;2;80;250;123m";
const C_ERROR = "\x1b[38;2;255;85;85m";
const C_WARNING = "\x1b[38;2;241;250;140m";
const C_MUTED = "\x1b[38;2;98;114;164m";
const C_LABEL = "\x1b[38;2;98;114;164m";
const C_VALUE = "\x1b[38;2;248;248;242m";
const C_RST = "\x1b[0m";

export const theme = {
    primary: (text) => `${C_PRIMARY}${text}${C_RST}`,
    success: (text) => `${C_SUCCESS}${text}${C_RST}`,
    error: (text) => `${C_ERROR}${text}${C_RST}`,
    warning: (text) => `${C_WARNING}${text}${C_RST}`,
    label: (text) => `${C_LABEL}${text}${C_RST}`,
    value: (text) => `${C_VALUE}${text}${C_RST}`,
    muted: (text) => `${C_MUTED}${text}${C_RST}`,

    // Reusable UI elements
    iconSuccess: () => `${C_SUCCESS}✓${C_RST}`,
    iconError: () => `${C_ERROR}✗${C_RST}`,
};

export const rawColors = {
    primary: C_PRIMARY,
    shadow: C_SHADOW,
    success: C_SUCCESS,
    error: C_ERROR,
    warning: C_WARNING,
    muted: C_MUTED,
    label: C_LABEL,
    value: C_VALUE,
    reset: C_RST,
};

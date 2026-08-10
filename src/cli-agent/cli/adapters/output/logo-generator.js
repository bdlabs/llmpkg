/**
 * Renders a custom perfectly proportioned ASCII layout for LLM PKG.
 * Features a pure ASCII, filled 3D design like classic package managers.
 * @param {string} text - The project name (defaults to 'llmpkg' which uses the hand-drawn font)
 * @returns {string} The formatted multi-line ANSI logo
 */

// Beautiful custom hand-crafted 3D typography precisely for 'llmpkg'
/**
 * Pixel-art llmpkg logo.
 *
 * Designed specifically to resemble the original llmpkg brand mark:
 * - square pixel proportions
 * - tall "ll"
 * - lowercase blocky "mpkg"
 * - cyan foreground
 * - dark-blue 3D shadow shifted down/right
 *
 * Terminal cells are usually ~2x taller than they are wide,
 * therefore every logical pixel is rendered as two horizontal blocks.
 */

const GLYPHS = {
    l: [
        "## ",
        "## ",
        "## ",
        "## ",
        "## ",
        "## ",
        "## ",
        "## ",
    ],

    m: [
        "          ",
        "          ",
        "## ## ### ",
        "##########",
        "##  ##  ##",
        "##  ##  ##",
        "##  ##  ##",
        "##  ##  ##",
    ],

    p: [
        "       ",
        "       ",
        "#####  ",
        "##  ## ",
        "##  ## ",
        "#####  ",
        "##     ",
        "##     ",
    ],

    k: [
        "##     ",
        "##     ",
        "##  ## ",
        "## ##  ",
        "####   ",
        "## ##  ",
        "##  ## ",
        "##  ## ",
    ],

    g: [
        "      ",
        "      ",
        " #### ",
        "##  ##",
        "##  ##",
        " #####",
        "    ##",
        " #### ",
    ],
};


/**
 * Builds one logical bitmap for "llmpkg".
 */
function buildLogoBitmap(text = "llmpkg") {
    const chars = text.toLowerCase().split("");

    const height = 8;

    // One logical pixel of spacing between letters.
    const spacing = " ";

    const rows = [];

    for (let y = 0; y < height; y++) {
        const row = chars
            .map(char => {
                const glyph = GLYPHS[char];

                if (!glyph) {
                    return "";
                }

                return glyph[y];
            })
            .join(spacing);

        rows.push(row);
    }

    return rows;
}


/**
 * Expands each logical pixel horizontally.
 *
 * Terminal characters are significantly taller than they are wide.
 * "██" makes one logical pixel appear much closer to a square.
 */
function expandBitmap(bitmap) {
    return bitmap.map(row => {
        let result = "";

        for (const char of row) {
            if (char === "#") {
                result += "██";
            } else if (char === "@") {
                result += "██";
            } else {
                result += "  ";
            }
        }

        return result;
    });
}


import { rawColors } from './theme.js';

/**
 * Generates ANSI-colored llmpkg logo.
 */
export function generateLogo(text = "llmpkg") {
    const C_MAIN = rawColors.primary;
    const C_SHADOW = rawColors.shadow;
    const C_RST = rawColors.reset;

    const bitmap = expandBitmap(
        buildLogoBitmap(text)
    );

    /*
     * IMPORTANT:
     *
     * Shadow is expressed in actual terminal character coordinates,
     * not logical bitmap coordinates.
     *
     * x = 2 would give a heavy "one full pixel" shadow.
     * x = 1 gives the thinner offset visible in the visual design.
     */
    const SHADOW_X = 1;
    const SHADOW_Y = 1;

    const height = bitmap.length + SHADOW_Y;

    const width =
        Math.max(...bitmap.map(row => row.length)) +
        SHADOW_X;

    let result = "\n";

    const LEFT_PADDING = "    ";

    for (let y = 0; y < height; y++) {
        let line = LEFT_PADDING;

        // Remember current ANSI color so we don't emit
        // escape codes for every single character.
        let currentColor = null;

        for (let x = 0; x < width; x++) {
            const foreground =
                y < bitmap.length &&
                x < bitmap[y].length &&
                bitmap[y][x] !== " ";

            const sy = y - SHADOW_Y;
            const sx = x - SHADOW_X;

            const shadow =
                !foreground &&
                sy >= 0 &&
                sx >= 0 &&
                sy < bitmap.length &&
                sx < bitmap[sy].length &&
                bitmap[sy][sx] !== " ";

            if (foreground) {
                if (currentColor !== C_MAIN) {
                    line += C_MAIN;
                    currentColor = C_MAIN;
                }

                line += "█";
            } else if (shadow) {
                if (currentColor !== C_SHADOW) {
                    line += C_SHADOW;
                    currentColor = C_SHADOW;
                }

                line += "░"; //▒ ▓
            } else {
                if (currentColor !== null) {
                    line += C_RST;
                    currentColor = null;
                }

                line += " ";
            }
        }

        if (currentColor !== null) {
            line += C_RST;
        }

        result += line.replace(/\s+$/, "") + "\n";
    }

    result += "\n";

    return result;
}
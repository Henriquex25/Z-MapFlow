export function formatKeyLabel(code: string): string {
    if (!code) return "";

    if (code.startsWith("&kp ")) {
        const key = code.replace("&kp ", "");

        const cleanMap: Record<string, string> = {
            ESC: "ESC",
            TAB: "TAB",
            RET: "ENTER",
            BSPC: "BKSP",
            SPACE: "SPACE",
            LSHFT: "SHIFT",
            RSHFT: "SHIFT",
            LCTRL: "CTRL",
            LALT: "ALT",
            RALT: "ALT",
            LGUI: "GUI",
            RGUI: "GUI",
            MINUS: "- _",
            EQUAL: "= +",
            SEMI: "; :",
            SQT: "' \"",
            COMMA: ", <",
            DOT: ". >",
            FSLH: "/ ?",
            N1: "1 !",
            N2: "2 @",
            N3: "3 #",
            N4: "4 $",
            N5: "5 %",
            N6: "6 ^",
            N7: "7 &",
            N8: "8 *",
            N9: "9 (",
            N0: "0 )",
            DEL: "DEL",
            C_MUTE: "MUTE",
            C_PP: "PLAY",
        };

        return cleanMap[key] || key;
    }

    if (code.startsWith("&mo ")) return `MO ${code.replace("&mo ", "")}`;
    if (code.startsWith("&sl ")) return `SL ${code.replace("&sl ", "")}`;

    return code;
}

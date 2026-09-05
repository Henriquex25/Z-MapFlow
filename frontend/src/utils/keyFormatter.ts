export function formatKeyLabel(code: string): string {
    if (!code || code === "&none" || code === "&blank") return "";
    if (code === "&trans") return "▽";

    if (code.startsWith("&bt ")) {
        const btKey = code.replace("&bt ", "");
        if (btKey === "BT_CLR") return "BT CLR";
        if (btKey.startsWith("BT_SEL ")) return `BT ${btKey.replace("BT_SEL ", "")}`;
        return btKey;
    }

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
            PSCRN: "PRT SC",
            SLCK: "SCR LK",
            PAUSE_BREAK: "PAUSE",
            INS: "INS",
            HOME: "HOME",
            PG_UP: "PG UP",
            END: "END",
            PG_DN: "PG DN",
            UP: "UP",
            DOWN: "DOWN",
            LEFT: "LEFT",
            RIGHT: "RIGHT",
            KP_NUM: "NUM LK",
            KP_DIVIDE: "/",
            KP_MULTIPLY: "*",
            KP_MINUS: "-",
            KP_PLUS: "+",
            KP_ENTER: "ENTER",
            KP_DOT: ".",
            KP_N1: "1",
            KP_N2: "2",
            KP_N3: "3",
            KP_N4: "4",
            KP_N5: "5",
            KP_N6: "6",
            KP_N7: "7",
            KP_N8: "8",
            KP_N9: "9",
            KP_N0: "0",
            K_CMENU: "MENU",
        };

        return cleanMap[key] || key;
    }

    if (code.startsWith("&mo ")) return `MO ${code.replace("&mo ", "")}`;
    if (code.startsWith("&sl ")) return `SL ${code.replace("&sl ", "")}`;

    return code;
}

export function getKeyWidth(code: string): string {
    if (code === "&none") return "w-[28px]";
    if (code === "&blank") return "w-[56px]";

    switch (code) {
        case "&kp BSPC":
        case "&kp KP_N0":
            return "w-[120px]";
        case "&kp TAB":
        case "&kp BSLH":
            return "w-[88px]";
        case "&kp CLCK":
            return "w-[104px]";
        case "&kp RET":
        case "&kp LSHFT":
            return "w-[136px]";
        case "&kp RSHFT":
            return "w-[168px]";
        case "&kp SPACE":
            return "w-[392px]";
        case "&kp LCTRL":
        case "&kp LGUI":
        case "&kp LALT":
        case "&kp RALT":
        case "&kp RGUI":
        case "&kp K_CMENU":
        case "&kp RCTRL":
            return "w-[72px]";
        default:
            return "w-14";
    }
}

export function getKeyHeight(code: string): string {
    if (code === "&kp KP_PLUS" || code === "&kp KP_ENTER") {
        return "h-[120px]";
    }
    return "h-14";
}

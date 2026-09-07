export interface KeyVisuals {
    main: string;
    shift?: string;
    modifier?: string;
    icon?: string;
}

export function formatKeyVisuals(code: string): KeyVisuals | null {
    if (!code || code === "&none" || code === "&blank") return null;
    if (code === "&trans") return { main: "", icon: "ChevronsDown" };

    if (code.startsWith("&mt ") || code.startsWith("&lt ")) {
        const parts = code.split(" ");
        if (parts.length >= 3) {
            const isLayerTap = code.startsWith("&lt ");
            const holdPart = isLayerTap ? `LT ${parts[1]}` : cleanModName(parts[1]);
            const tapPart = parts.slice(2).join(" ");

            const tapVisual = formatKeyVisuals(`&kp ${tapPart}`) || { main: tapPart };

            return {
                modifier: holdPart,
                main: tapVisual.main,
                icon: tapVisual.icon,
                shift: tapVisual.shift,
            };
        }
    }

    const modWrapperMatch = code.match(/^&kp\s+([A-Z]{2})\((.+)\)$/);
    if (modWrapperMatch) {
        const mod = cleanModName(modWrapperMatch[1]);
        const innerKey = modWrapperMatch[2];
        const innerVisual = formatKeyVisuals(`&kp ${innerKey}`) || { main: innerKey };

        return {
            modifier: mod,
            main: innerVisual.main,
            icon: innerVisual.icon,
            shift: innerVisual.shift,
        };
    }

    if (code.startsWith("&bt ")) {
        const btKey = code.replace("&bt ", "");
        if (btKey === "BT_CLR") return { main: "CLR", icon: "Bluetooth" };
        if (btKey.startsWith("BT_SEL ")) return { main: btKey.replace("BT_SEL ", ""), icon: "Bluetooth" };
        return { main: btKey, icon: "Bluetooth" };
    }

    if (code.startsWith("&kp ")) {
        const key = code.replace("&kp ", "");

        const visualMap: Record<string, KeyVisuals> = {
            ESC: { main: "ESC" },
            TAB: { main: "TAB", icon: "ArrowRightToLine" },
            RET: { main: "ENTER", icon: "CornerDownLeft" },
            BSPC: { main: "BKSP", icon: "Delete" },
            SPACE: { main: "SPACE" },
            LSHFT: { main: "SHIFT", icon: "ArrowBigUp" },
            RSHFT: { main: "SHIFT", icon: "ArrowBigUp" },
            LCTRL: { main: "CTRL" },
            RCTRL: { main: "CTRL" },
            LALT: { main: "ALT", icon: "Option" },
            RALT: { main: "ALT", icon: "Option" },
            LGUI: { main: "GUI", icon: "Command" },
            RGUI: { main: "GUI", icon: "Command" },
            MINUS: { main: "-", shift: "_" },
            EQUAL: { main: "=", shift: "+" },
            SEMI: { main: ";", shift: ":" },
            SQT: { main: "'", shift: '"' },
            COMMA: { main: ",", shift: "<" },
            DOT: { main: ".", shift: ">" },
            FSLH: { main: "/", shift: "?" },
            GRAVE: { main: "`", shift: "~" },
            LBKT: { main: "[", shift: "{" },
            RBKT: { main: "]", shift: "}" },
            BSLH: { main: "\\", shift: "|" },
            N1: { main: "1", shift: "!" },
            N2: { main: "2", shift: "@" },
            N3: { main: "3", shift: "#" },
            N4: { main: "4", shift: "$" },
            N5: { main: "5", shift: "%" },
            N6: { main: "6", shift: "^" },
            N7: { main: "7", shift: "&" },
            N8: { main: "8", shift: "*" },
            N9: { main: "9", shift: "(" },
            N0: { main: "0", shift: ")" },
            DEL: { main: "DEL" },
            C_MUTE: { main: "MUTE", icon: "VolumeX" },
            C_PP: { main: "PLAY", icon: "Play" },
            UP: { main: "", icon: "ArrowUp" },
            DOWN: { main: "", icon: "ArrowDown" },
            LEFT: { main: "", icon: "ArrowLeft" },
            RIGHT: { main: "", icon: "ArrowRight" },
            KP_DIVIDE: { main: "/" },
            KP_MULTIPLY: { main: "*" },
            KP_MINUS: { main: "-" },
            KP_PLUS: { main: "+" },
            KP_ENTER: { main: "ENTER", icon: "CornerDownLeft" },
            KP_DOT: { main: "." },
            KP_N1: { main: "1" },
            KP_N2: { main: "2" },
            KP_N3: { main: "3" },
            KP_N4: { main: "4" },
            KP_N5: { main: "5" },
            KP_N6: { main: "6" },
            KP_N7: { main: "7" },
            KP_N8: { main: "8" },
            KP_N9: { main: "9" },
            KP_N0: { main: "0" },
            K_CMENU: { main: "MENU", icon: "Menu" },
        };

        return visualMap[key] || { main: key };
    }

    if (code.startsWith("&mo ")) return { main: code.replace("&mo ", ""), icon: "Layers" };
    if (code.startsWith("&sl ")) return { main: code.replace("&sl ", ""), icon: "Layers" };

    return { main: code };
}

function cleanModName(mod: string): string {
    const map: Record<string, string> = {
        LCTRL: "LCtl_T",
        RCTRL: "RCtl_T",
        LC: "CTRL",
        LSHFT: "LSft_T",
        RSHFT: "RSft_T",
        LS: "SHIFT",
        LALT: "LAlt_T",
        RALT: "RAlt_T",
        LA: "ALT",
        LGUI: "LGui_T",
        RGUI: "RGui_T",
        LG: "GUI",
    };
    return map[mod] || mod;
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

export interface KeyVisuals {
  main: string;
  shift?: string;
  modifier?: string;
  icon?: string;
  description?: string;
}

// Display aliases only: the source binding remains unchanged.
const aliases: Record<string, string> = {
  LWIN: "LGUI",
  RWIN: "RGUI",
  LEFT_WIN: "LGUI",
  RIGHT_WIN: "RGUI",
  LEFT_CONTROL: "LCTRL",
  RIGHT_CONTROL: "RCTRL",
  LEFT_SHIFT: "LSHFT",
  RIGHT_SHIFT: "RSHFT",
  LSHIFT: "LSHFT",
  RSHIFT: "RSHFT",
  LEFT_ALT: "LALT",
  RIGHT_ALT: "RALT",
  LEFT_GUI: "LGUI",
  RIGHT_GUI: "RGUI",
  ENTER: "RET",
  RETURN: "RET",
  BACKSPACE: "BSPC",
  DELETE: "DEL",
  INSERT: "INS",
  CAPSLOCK: "CLCK",
  PAGE_UP: "PG_UP",
  PAGE_DOWN: "PG_DN",
  PRINTSCREEN: "PSCRN",
  SCROLLLOCK: "SLCK",
  K_MENU: "K_CMENU",
  K_VOLUME_UP: "K_VOL_UP",
  K_VOLUME_DOWN: "K_VOL_DN",
  C_VOLUME_UP: "C_VOL_UP",
  C_VOLUME_DOWN: "C_VOL_DN",
  C_PLAY_PAUSE: "C_PP",
  K_MUTE: "C_MUTE",
  LEFT_BRACKET: "LBKT",
  RIGHT_BRACKET: "RBKT",
  BACKSLASH: "BSLH",
  PT_DOUBLE_QUOTES: "DQT",
  PT_DQT: "DQT",
  PT_SINGLE_QUOTE: "PT_SQT",
  PT_APOSTROPHE: "PT_SQT",
  PT_APOS: "PT_SQT",
  PT_SEMICOLON: "PT_SEMI",
  PT_PERIOD: "PT_DOT",
  PT_UNDERSCORE: "UNDER",
  PT_CARET: "CARET",
  PT_GRAVE: "GRAVE_SYMBOL",
  PT_LPAR: "LPAR",
  PT_RPAR: "RPAR",
  PT_LBRC: "LBRC",
  PT_RBRC: "RBRC",
  PT_STAR: "STAR",
  PT_ASTRK: "STAR",
  PT_LT: "LT",
  PT_GT: "GT",
  PT_LESS_THAN: "LT",
  PT_GREATER_THAN: "GT",
  PT_AT_SIGN: "AT",
  PT_QMARK: "QUESTION",
  PT_AMPERSAND: "AMPS",
  PT_POUND: "HASH",
  PT_DLLR: "DLLR",
  PT_PRCNT: "PRCNT",
  PT_SLASH: "PT_FSLH",
  PT_BACKSLASH: "PT_BSLH",
  PT_LEFT_BRACKET: "PT_LBKT",
  PT_RIGHT_BRACKET: "PT_RBKT",
  PT_QUESTION: "QUESTION",
  PT_COLON: "COLON",
  PT_UNDER: "UNDER",
  PT_PLUS: "PLUS",
  PT_ASTERISK: "STAR",
  PT_LEFT_PARENTHESIS: "LPAR",
  PT_RIGHT_PARENTHESIS: "RPAR",
  PT_LEFT_BRACE: "LBRC",
  PT_RIGHT_BRACE: "RBRC",
  PT_DOLLAR: "DLLR",
  PT_PERCENT: "PRCNT",
  PT_AMPS: "AMPS",
  PT_PIPE: "PIPE",
  PT_HASH: "HASH",
  PT_AT: "AT",
  PT_EXCLAMATION: "EXCL",
  PT_DEG: "DEG",
  PT_SPACE: "SPACE",
};

export function formatKeyVisuals(code: string): KeyVisuals | null {
  if (!code || code === "&blank") return null;
  if (code === "&none")
    return { main: "Ação", modifier: "Sem", icon: "Ban", description: "Não executar nenhuma ação" };
  if (code === "&trans") return { main: "Transp.", description: "Usar a ação da camada inferior" };

  const mouseClick = code.match(/^&mkp (LCLK|RCLK|MCLK)$/);
  if (mouseClick) {
    const clicks: Record<string, [string, string]> = {
      LCLK: ["Esq.", "esquerdo"],
      RCLK: ["Dir.", "direito"],
      MCLK: ["Meio", "central"],
    };
    const [main, name] = clicks[mouseClick[1]];
    return {
      main,
      modifier: "Mouse",
      icon: "MousePointer2",
      description: `Clique do botão ${name} do mouse`,
    };
  }
  const mouseDirection = code.match(/^&(mmv|msc) (?:MOVE|SCRL)_(UP|DOWN|LEFT|RIGHT)$/);
  if (mouseDirection) {
    const directions: Record<string, [string, string]> = {
      UP: ["ArrowUp", "cima"],
      DOWN: ["ArrowDown", "baixo"],
      LEFT: ["ArrowLeft", "a esquerda"],
      RIGHT: ["ArrowRight", "a direita"],
    };
    const [icon, direction] = directions[mouseDirection[2]];
    const scrolling = mouseDirection[1] === "msc";
    return {
      main: "",
      modifier: scrolling ? "Rolar" : "Mover",
      icon,
      description: `${scrolling ? "Rolar" : "Mover o ponteiro"} para ${direction}`,
    };
  }

  const systemActions: Record<string, KeyVisuals> = {
    "&caps_word": {
      main: "Word",
      modifier: "Caps",
      description: "Digitar a próxima palavra em maiúsculas",
    },
    "&key_repeat": {
      main: "Tecla",
      modifier: "Repetir",
      icon: "Repeat2",
      description: "Repetir a última tecla",
    },
    "&bootloader": {
      main: "Boot",
      icon: "Download",
      description: "Reiniciar em modo bootloader para gravar o firmware",
    },
    "&sys_reset": { main: "Reset", icon: "RotateCcw", description: "Reiniciar o teclado" },
    "&out OUT_USB": {
      main: "USB",
      modifier: "Saída",
      icon: "Usb",
      description: "Enviar digitação pela conexão USB",
    },
    "&out OUT_BLE": {
      main: "BT",
      modifier: "Saída",
      icon: "Bluetooth",
      description: "Enviar digitação pela conexão Bluetooth",
    },
  };
  if (systemActions[code]) return systemActions[code];

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
        description: `Segurar: ${holdPart}; tocar: ${tapVisual.main || tapPart}`,
      };
    }
  }

  const modWrapperMatch = code.match(/^&kp\s+([A-Z]{2})\((.+)\)$/);
  if (modWrapperMatch) {
    const mod = cleanModName(modWrapperMatch[1]);
    const innerKey = modWrapperMatch[2];
    const innerVisual = formatKeyVisuals(`&kp ${innerKey}`) || {
      main: innerKey,
    };

    return {
      modifier: [mod, innerVisual.modifier].filter(Boolean).join("+"),
      main: innerVisual.main,
      icon: innerVisual.icon,
      shift: innerVisual.shift,
      description: `${mod} + ${innerVisual.main || innerKey}`,
    };
  }

  if (code.startsWith("&sk ")) {
    const key = code.slice(4);
    const visual = formatKeyVisuals(`&kp ${key}`);
    return {
      main: visual?.main ?? key,
      modifier: "Sticky",
      description: `Manter ${visual?.main ?? key} até a próxima tecla`,
    };
  }
  const lighting = code.match(/^&(rgb_ug|bl|ext_power) (.+)$/);
  if (lighting) {
    const actions: Record<string, string> = {
      RGB_TOG: "Alternar",
      RGB_BRI: "Brilho +",
      RGB_BRD: "Brilho −",
      BL_TOG: "Alternar",
      BL_INC: "Brilho +",
      BL_DEC: "Brilho −",
      EP_ON: "Ligar",
      EP_OFF: "Desligar",
      EP_TOG: "Alternar",
    };
    const group = lighting[1] === "rgb_ug" ? "RGB" : lighting[1] === "bl" ? "Luz" : "Energia";
    return {
      main: lighting[2].startsWith("RGB_COLOR_HSB") ? "Cor" : (actions[lighting[2]] ?? lighting[2]),
      modifier: group,
      description: `${group}: ${lighting[2]}`,
    };
  }
  if (code === "&soft_off")
    return {
      main: "Desligar",
      modifier: "Teclado",
      description: "Desligar o teclado (requer suporte do hardware)",
    };
  if (code === "&gresc")
    return {
      main: "Esc / `",
      description: "Escape ou grave conforme os modificadores pressionados",
    };
  if (code === "&studio_unlock")
    return {
      main: "Liberar",
      modifier: "Studio",
      description: "Desbloquear alterações pelo ZMK Studio",
    };
  if (code === "&out OUT_TOG")
    return {
      main: "USB / BT",
      modifier: "Alternar",
      description: "Alternar a saída USB / Bluetooth",
    };
  if (code.startsWith("&bt ")) {
    const btKey = code.replace("&bt ", "");
    if (btKey === "BT_CLR")
      return {
        main: "Limpar",
        modifier: "BT",
        description: "Apagar o pareamento do perfil Bluetooth atual",
      };
    if (btKey === "BT_CLR_ALL")
      return {
        main: "Limpar",
        modifier: "Todos BT",
        icon: "Bluetooth",
        description: "Apagar os pareamentos de todos os perfis Bluetooth",
      };
    if (btKey.startsWith("BT_DISC "))
      return {
        main: btKey.slice(8),
        modifier: "Descon.",
        icon: "Bluetooth",
        description: `Desconectar o perfil Bluetooth ${btKey.slice(8)}`,
      };
    if (btKey === "BT_NXT")
      return {
        main: "Próx.",
        modifier: "BT",
        description: "Selecionar o próximo perfil Bluetooth",
      };
    if (btKey === "BT_PRV")
      return {
        main: "Ant.",
        modifier: "BT",
        description: "Selecionar o perfil Bluetooth anterior",
      };
    if (btKey.startsWith("BT_SEL "))
      return {
        main: btKey.replace("BT_SEL ", ""),
        modifier: "BT",
        icon: "Bluetooth",
        description: `Selecionar o perfil Bluetooth ${btKey.replace("BT_SEL ", "")}`,
      };
    return { main: btKey, icon: "Bluetooth" };
  }

  if (code.startsWith("&kp ")) {
    const source = code.replace("&kp ", "").replace(/^\(([A-Z][A-Z0-9_]*)\)$/, "$1");
    const key =
      aliases[source] ?? (/^PT_(?:[A-Z]|N[0-9])$/.test(source) ? source.slice(3) : source);

    const visualMap: Record<string, KeyVisuals> = {
      INS: { main: "Ins" },
      HOME: { main: "Home" },
      END: { main: "End" },
      DQT: { main: '"' },
      CARET: { main: "^" },
      GRAVE_SYMBOL: { main: "`" },
      LT: { main: "<" },
      GT: { main: ">" },
      QUESTION: { main: "?" },
      COLON: { main: ":" },
      UNDER: { main: "_" },
      PLUS: { main: "+" },
      STAR: { main: "*" },
      LPAR: { main: "(" },
      RPAR: { main: ")" },
      LBRC: { main: "{" },
      RBRC: { main: "}" },
      DLLR: { main: "$" },
      PRCNT: { main: "%" },
      AMPS: { main: "&" },
      PIPE: { main: "|" },
      HASH: { main: "#" },
      AT: { main: "@" },
      EXCL: { main: "!" },
      DEG: { main: "°" },
      PT_SQT: { main: "'", shift: '"' },
      PT_SEMI: { main: ";", shift: ":" },
      PT_TILDE: { main: "~", shift: "^" },
      PT_FSLH: { main: "/", shift: "?" },
      PT_BSLH: { main: "\\", shift: "|" },
      PT_LBKT: { main: "[", shift: "{" },
      PT_RBKT: { main: "]", shift: "}" },
      PT_MINUS: { main: "-", shift: "_" },
      PT_EQUAL: { main: "=", shift: "+" },
      PT_COMMA: { main: ",", shift: "<" },
      PT_DOT: { main: ".", shift: ">" },
      PT_C_CEDILLA: { main: "Ç" },
      PT_ACUTE: { main: "´", shift: "`" },
      C_VOL_UP: { main: "Vol +" },
      C_VOL_DN: { main: "Vol −" },
      K_VOL_UP: { main: "Vol +" },
      K_VOL_DN: { main: "Vol −" },
      PG_UP: { main: "PgUp" },
      PG_DN: { main: "PgDn" },
      PSCRN: { main: "PrtSc" },
      SLCK: { main: "ScrLk" },
      PAUSE_BREAK: { main: "Pause" },
      KP_NUM: { main: "Num" },
      CLCK: { main: "Caps" },
      ESC: { main: "ESC" },
      TAB: { main: "TAB", icon: "ArrowRightToLine" },
      RET: { main: "ENTER", icon: "CornerDownLeft" },
      BSPC: { main: "BKSP", icon: "Delete" },
      SPACE: { main: "SPACE" },
      LSHFT: { main: "SHIFT", modifier: "L", icon: "ArrowBigUp", description: "Shift esquerdo" },
      RSHFT: { main: "SHIFT", modifier: "R", icon: "ArrowBigUp", description: "Shift direito" },
      LCTRL: { main: "CTRL", modifier: "L", description: "Control esquerdo" },
      RCTRL: { main: "CTRL", modifier: "R", description: "Control direito" },
      LALT: { main: "ALT", modifier: "L", icon: "Option", description: "Alt esquerdo" },
      RALT: { main: "ALT", modifier: "R", icon: "Option", description: "Alt direito / AltGr" },
      LGUI: {
        main: "GUI",
        modifier: "L",
        icon: "Command",
        description: "Super / Command esquerdo",
      },
      RGUI: { main: "GUI", modifier: "R", icon: "Command", description: "Super / Command direito" },
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

  const layer = code.match(/^&(mo|sl|tog|to) (.+)$/);
  if (layer) {
    const names: Record<string, string> = {
      mo: "Ativar enquanto segura",
      sl: "Ativar para a próxima ação",
      tog: "Alternar",
      to: "Mudar para",
    };
    return {
      main: layer[2],
      modifier: layer[1].toUpperCase(),
      icon: "Layers",
      description: `${names[layer[1]]} a camada ${layer[2]}`,
    };
  }
  if (code.startsWith("&kt ")) {
    const key = code.slice(4);
    const visual = formatKeyVisuals(`&kp ${key}`);
    return {
      main: visual?.main || key,
      modifier: "Alternar",
      description: `Alternar pressionar e soltar ${visual?.main || key}`,
    };
  }

  return { main: code };
}

function cleanModName(mod: string): string {
  const map: Record<string, string> = {
    LEFT_CONTROL: "Ctrl",
    RIGHT_CONTROL: "Ctrl",
    LEFT_SHIFT: "Shift",
    RIGHT_SHIFT: "Shift",
    LEFT_ALT: "Alt",
    RIGHT_ALT: "AltGr",
    RA: "AltGr",
    RC: "Ctrl",
    RS: "Shift",
    RG: "GUI",
    LSHIFT: "Shift",
    RSHIFT: "Shift",
    LCTRL: "Ctrl",
    RCTRL: "Ctrl",
    LC: "CTRL",
    LSHFT: "Shift",
    RSHFT: "Shift",
    LS: "SHIFT",
    LALT: "Alt",
    RALT: "Alt",
    LA: "ALT",
    LGUI: "GUI",
    RGUI: "GUI",
    LG: "GUI",
  };
  return map[mod] || mod;
}

// Palette geometry uses explicit pixels; labels never shrink with CSS zoom.
export function getPaletteKeyWidth(code: string): number {
  const widths: Record<string, number> = {
    "&none": 21,
    "&blank": 42,
    "&kp BSPC": 90,
    "&kp KP_N0": 90,
    "&kp TAB": 66,
    "&kp BSLH": 66,
    "&kp CLCK": 78,
    "&kp RET": 102,
    "&kp LSHFT": 102,
    "&kp RSHFT": 126,
    "&kp SPACE": 294,
    "&kp LCTRL": 54,
    "&kp LGUI": 54,
    "&kp LALT": 54,
    "&kp RALT": 54,
    "&kp RGUI": 54,
    "&kp K_CMENU": 54,
    "&kp RCTRL": 54,
  };
  return widths[code] ?? 42;
}

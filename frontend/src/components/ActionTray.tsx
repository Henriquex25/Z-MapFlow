import { headerSymbols } from "../utils/firmwareSettings";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DraggableKey } from "./DraggableKey";
import { BindingDrop } from "./BindingDrop";
import { getPaletteKeyWidth, formatKeyVisuals } from "../utils/keyFormatter";
import { useKeyboardStore, layerReference, displayCode } from "../store/useKeyboardStore";
import { action, IKeyAction } from "../types/keyboard";
import { behaviorAction, macroAction } from "../utils/resourceActions";

const generateKeys = (codes: string[]): IKeyAction[] => {
  return codes.map((code) => ({
    keymapIndex: -1,
    row: 0,
    col: 0,
    code,
    label: "",
  }));
};

const mainCluster = [
  [
    "&kp ESC",
    "&none",
    "&kp F1",
    "&kp F2",
    "&kp F3",
    "&kp F4",
    "&none",
    "&kp F5",
    "&kp F6",
    "&kp F7",
    "&kp F8",
    "&none",
    "&kp F9",
    "&kp F10",
    "&kp F11",
    "&kp F12",
  ],
  [
    "&kp GRAVE",
    "&kp N1",
    "&kp N2",
    "&kp N3",
    "&kp N4",
    "&kp N5",
    "&kp N6",
    "&kp N7",
    "&kp N8",
    "&kp N9",
    "&kp N0",
    "&kp MINUS",
    "&kp EQUAL",
    "&kp BSPC",
  ],
  [
    "&kp TAB",
    "&kp Q",
    "&kp W",
    "&kp E",
    "&kp R",
    "&kp T",
    "&kp Y",
    "&kp U",
    "&kp I",
    "&kp O",
    "&kp P",
    "&kp LBKT",
    "&kp RBKT",
    "&kp BSLH",
  ],
  [
    "&kp CLCK",
    "&kp A",
    "&kp S",
    "&kp D",
    "&kp F",
    "&kp G",
    "&kp H",
    "&kp J",
    "&kp K",
    "&kp L",
    "&kp SEMI",
    "&kp SQT",
    "&kp RET",
  ],
  [
    "&kp LSHFT",
    "&kp Z",
    "&kp X",
    "&kp C",
    "&kp V",
    "&kp B",
    "&kp N",
    "&kp M",
    "&kp COMMA",
    "&kp DOT",
    "&kp FSLH",
    "&kp RSHFT",
  ],
  [
    "&kp LCTRL",
    "&kp LGUI",
    "&kp LALT",
    "&kp SPACE",
    "&kp RALT",
    "&kp RGUI",
    "&kp K_CMENU",
    "&kp RCTRL",
  ],
];

const navCluster = [
  ["&kp PSCRN", "&kp SLCK", "&kp PAUSE_BREAK"],
  ["&kp INS", "&kp HOME", "&kp PG_UP"],
  ["&kp DEL", "&kp END", "&kp PG_DN"],
  ["&blank", "&blank", "&blank"],
  ["&blank", "&kp UP", "&blank"],
  ["&kp LEFT", "&kp DOWN", "&kp RIGHT"],
];

const numpadCluster = [
  ["&blank", "&blank", "&blank", "&blank"],
  ["&kp KP_NUM", "&kp KP_DIVIDE", "&kp KP_MULTIPLY", "&kp KP_MINUS"],
  ["&kp KP_N7", "&kp KP_N8", "&kp KP_N9", "&kp KP_PLUS"],
  ["&kp KP_N4", "&kp KP_N5", "&kp KP_N6", "&blank"],
  ["&kp KP_N1", "&kp KP_N2", "&kp KP_N3", "&kp KP_ENTER"],
  ["&kp KP_N0", "&kp KP_DOT", "&blank"],
];

const basicKeysQuickList = [
  "&kp A",
  "&kp B",
  "&kp C",
  "&kp D",
  "&kp E",
  "&kp F",
  "&kp G",
  "&kp H",
  "&kp I",
  "&kp J",
  "&kp K",
  "&kp L",
  "&kp M",
  "&kp N",
  "&kp O",
  "&kp P",
  "&kp Q",
  "&kp R",
  "&kp S",
  "&kp T",
  "&kp U",
  "&kp V",
  "&kp W",
  "&kp X",
  "&kp Y",
  "&kp Z",
  "&kp N1",
  "&kp N2",
  "&kp N3",
  "&kp N4",
  "&kp N5",
  "&kp N6",
  "&kp N7",
  "&kp N8",
  "&kp N9",
  "&kp N0",
  "&kp TAB",
  "&kp RET",
  "&kp BSPC",
  "&kp SPACE",
  "&kp ESC",
  "&kp DEL",
];

const modifiers = ["LCTRL", "LSHFT", "LALT", "LGUI", "RCTRL", "RSHFT", "RALT", "RGUI"];
const modifierNames: Record<string, string> = {
  LCTRL: "Ctrl esquerdo",
  LSHFT: "Shift esquerdo",
  LALT: "Alt esquerdo",
  LGUI: "Super esquerdo",
  RCTRL: "Ctrl direito",
  RSHFT: "Shift direito",
  RALT: "Alt direito",
  RGUI: "Super direito",
};
const mouseGroups = [
  { name: "Botões", codes: ["&mkp LCLK", "&mkp RCLK", "&mkp MCLK"] },
  {
    name: "Movimento",
    codes: ["&mmv MOVE_UP", "&mmv MOVE_DOWN", "&mmv MOVE_LEFT", "&mmv MOVE_RIGHT"],
  },
  {
    name: "Rolagem",
    codes: ["&msc SCRL_UP", "&msc SCRL_DOWN", "&msc SCRL_LEFT", "&msc SCRL_RIGHT"],
  },
];
const tabs = [
  "Teclas",
  "Modificadores",
  "Tap/hold",
  "Camadas",
  "Bluetooth",
  "Mouse",
  "Recursos",
  "Idiomas",
] as const;
export function ActionTray() {
  const p = useKeyboardStore((s) => s.project)!;
  const plugin = useKeyboardStore((s) => s.plugin);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Teclas");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
      bodyRef.current.scrollLeft = 0;
    }
  }, [tab, search]);
  const [hold, setHold] = useState("LCTRL");
  const [holdType, setHoldType] = useState("mod");
  const [tap, setTap] = useState("&kp TAB");
  const layerHold = p.layout.layers.some((l) => layerReference(l.id) === hold)
    ? hold
    : layerReference(p.layout.layers[0].id);
  const generated = `${holdType === "mod" ? "&mt" : "&lt"} ${holdType === "mod" ? hold : layerHold} ${tap.replace(/^&kp\s+/, "")}`;
  const localized: Record<string, string> = {
    GRAVE: "PT_SQT",
    MINUS: "PT_MINUS",
    EQUAL: "PT_EQUAL",
    SEMI: "PT_SEMI",
    SQT: "PT_TILDE",
    FSLH: "PT_FSLH",
    BSLH: "PT_BSLH",
    LBKT: "PT_LBKT",
    RBKT: "PT_RBKT",
    COMMA: "PT_COMMA",
    DOT: "PT_DOT",
  };
  const localize = (a: IKeyAction) => {
    if (p.options.locale !== "pt-br") return a;
    const code = a.code.replace(/^&kp ([A-Z_]+)$/, (full, key: string) =>
      localized[key] ? `&kp ${localized[key]}` : full,
    );
    return { ...a, code };
  };
  const filtered = (items: IKeyAction[]) =>
    items.map(localize).filter((a) => {
      const visuals = formatKeyVisuals(displayCode(a.code, p));
      return [a.code, a.label, visuals?.main, visuals?.modifier, visuals?.description]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  const list = (items: IKeyAction[], quick = false) => (
    <div className="palette-action-list">
      {filtered(items).map((a, i) => (
        <DraggableKey
          key={`${a.code}-${i}`}
          action={a}
          className={
            quick
              ? "palette-quick-action"
              : `palette-action ${a.label.length > 10 ? "palette-action-wide" : ""}`
          }
        />
      ))}
    </div>
  );
  const languages = headerSymbols(p.headers).map((symbol) => ({
    ...action(`&kp ${symbol}`),
    label: symbol,
  }));
  const custom = [
    ...(plugin?.actions ?? []).map((a) => ({ ...action(a.code), label: a.name })),
    ...p.layout.macros.map(macroAction),
    ...p.layout.behaviors.map(behaviorAction),
  ];
  return (
    <section aria-label="Paleta de ações" className="palette" data-collapsed={collapsed}>
      <div className="palette-toolbar">
        {tabs.map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <input
          className="field ml-auto max-w-48"
          aria-label="Buscar ações"
          placeholder="Buscar ação…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.trim()) setCollapsed(false);
          }}
        />
        <button
          className="btn icon-btn palette-collapse"
          aria-label={collapsed ? "Expandir paleta" : "Recolher paleta"}
          title={collapsed ? "Expandir paleta" : "Recolher paleta"}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      <div ref={bodyRef} className="palette-body" hidden={collapsed}>
        {search ? (
          list(
            generateKeys(
              [
                ...new Set([
                  ...mainCluster.flat(),
                  ...navCluster.flat(),
                  ...numpadCluster.flat(),
                  ...(p.options.pointing ? mouseGroups.flatMap((group) => group.codes) : []),
                  "&bt BT_CLR",
                  "&bt BT_NXT",
                  "&bt BT_PRV",
                  "&bt BT_CLR_ALL",
                  ...Array.from(
                    { length: p.options.bluetoothProfiles },
                    (_, i) => `&bt BT_SEL ${i}`,
                  ),
                  "&out OUT_USB",
                  "&out OUT_BLE",
                  ...p.layout.layers.flatMap((layer) =>
                    ["mo", "sl", "tog", "to"].map(
                      (behavior) => `&${behavior} ${layerReference(layer.id)}`,
                    ),
                  ),
                  "&trans",
                  "&none",
                  "&caps_word",
                  "&key_repeat",
                  "&kt CLCK",
                  "&bootloader",
                  "&sys_reset",
                ]),
              ].filter((c) => c !== "&blank"),
            ).concat(custom, languages),
          )
        ) : tab === "Teclas" ? (
          <div className="palette-keyboard">
            {[mainCluster, navCluster, numpadCluster].map((cluster, i) => (
              <div key={i} className="palette-keyboard-cluster">
                {cluster.map((row, r) => (
                  <div key={r} className="palette-keyboard-row">
                    {row.map((code, c) =>
                      code === "&none" || code === "&blank" ? (
                        <div
                          key={c}
                          className="palette-key-slot"
                          style={{ width: getPaletteKeyWidth(code) }}
                        />
                      ) : (
                        <div
                          key={c}
                          className="palette-key-slot"
                          style={{ width: getPaletteKeyWidth(code) }}
                        >
                          <DraggableKey action={localize(action(code))} className="w-full h-full" />
                        </div>
                      ),
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : tab === "Idiomas" ? (
          <div>
            {languages.length ? (
              list(languages)
            ) : (
              <p className="hint">
                Adicione um header em Configurações → Headers e idiomas. Português ABNT2 também está
                disponível no seletor de layout do sistema.
              </p>
            )}
          </div>
        ) : tab === "Modificadores" ? (
          list(generateKeys(modifiers.map((m) => `&kp ${m}`)))
        ) : tab === "Camadas" ? (
          <div className="space-y-3">
            {p.layout.layers.map((l, i) => (
              <div key={l.id} className="flex gap-3 items-center">
                <span className="w-36 text-sm">
                  {i}: {l.name}
                </span>
                {["mo", "sl", "tog", "to"].map((b) => (
                  <DraggableKey
                    key={b}
                    className="palette-action"
                    action={{
                      ...action(`&${b} ${layerReference(l.id)}`),
                      label: `${b} ${l.name}`,
                    }}
                  />
                ))}
              </div>
            ))}
            <p className="hint">
              MO: enquanto segura · SL: próxima ação · TOG: alternar · TO: ativar
            </p>
          </div>
        ) : tab === "Bluetooth" ? (
          list(
            generateKeys([
              "&bt BT_CLR",
              "&bt BT_NXT",
              "&bt BT_PRV",
              "&bt BT_CLR_ALL",
              ...Array.from({ length: p.options.bluetoothProfiles }, (_, i) => `&bt BT_SEL ${i}`),
              ...Array.from({ length: p.options.bluetoothProfiles }, (_, i) => `&bt BT_DISC ${i}`),
              "&out OUT_USB",
              "&out OUT_BLE",
            ]),
          )
        ) : tab === "Mouse" ? (
          <div className="space-y-3">
            {p.options.pointing ? (
              <div className="palette-mouse-groups">
                {mouseGroups.map((group) => (
                  <div className="palette-mouse-group" key={group.name}>
                    <h3>{group.name}</h3>
                    {list(generateKeys(group.codes))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">
                Ative ações de mouse em Configurações para usar estes bindings.
              </p>
            )}
          </div>
        ) : tab === "Recursos" ? (
          <div className="space-y-3">
            {list([
              ...custom,
              ...generateKeys([
                "&trans",
                "&none",
                "&caps_word",
                "&key_repeat",
                "&gresc",
                "&studio_unlock",
                ...modifiers.map((m) => `&sk ${m}`),
                ...modifiers.map((m) => `&kt ${m}`),
                "&out OUT_TOG",
                "&ext_power EP_ON",
                "&ext_power EP_OFF",
                "&ext_power EP_TOG",
                "&rgb_ug RGB_TOG",
                "&rgb_ug RGB_BRI",
                "&rgb_ug RGB_BRD",
                "&rgb_ug RGB_COLOR_HSB(128,100,100)",
                "&bl BL_TOG",
                "&bl BL_INC",
                "&bl BL_DEC",
                "&soft_off",
                "&kt CLCK",
                "&bootloader",
                "&sys_reset",
              ]),
            ])}
            <p className="hint">
              Macros e comportamentos criados nas abas acima aparecem aqui para arrastar até o
              teclado.
            </p>
          </div>
        ) : (
          <div className="tap-hold-builder">
            <div className="tap-hold-controls">
              <span className="text-sm">Ao segurar</span>
              <select
                className="field"
                aria-label="Tipo da ação ao segurar"
                value={holdType}
                onChange={(e) => {
                  setHoldType(e.target.value);
                  setHold(e.target.value === "mod" ? "LCTRL" : layerHold);
                }}
              >
                <option value="mod">Modificador</option>
                <option value="layer">Camada</option>
              </select>
              <select
                className="field"
                aria-label="Ação ao segurar"
                value={holdType === "mod" ? hold : layerHold}
                onChange={(e) => setHold(e.target.value)}
              >
                {holdType === "mod"
                  ? modifiers.map((m) => (
                      <option key={m} value={m}>
                        {modifierNames[m]}
                      </option>
                    ))
                  : p.layout.layers.map((l, i) => (
                      <option key={l.id} value={layerReference(l.id)}>
                        {i}: {l.name}
                      </option>
                    ))}
              </select>
              <BindingDrop
                label="Ao tocar"
                compact
                code={tap}
                onChange={(c) => {
                  if (/^&kp [A-Z0-9_]+$/.test(c)) setTap(c);
                  else
                    useKeyboardStore.setState({
                      error: "O tap do hold-tap deve ser uma tecla simples.",
                    });
                }}
              />
              <span>→</span>
              <DraggableKey action={action(generated)} className="palette-action" />
            </div>
            {list(generateKeys(basicKeysQuickList), true)}
          </div>
        )}
      </div>
    </section>
  );
}

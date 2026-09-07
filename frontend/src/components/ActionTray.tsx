import { useState } from "react";
import { useDroppable, useDndMonitor } from "@dnd-kit/core";
import { IKeyAction } from "../types/keyboard";
import { DraggableKey } from "./DraggableKey";
import { getKeyWidth, getKeyHeight } from "../utils/keyFormatter";

const generateKeys = (codes: string[]): IKeyAction[] => {
    return codes.map((code) => ({ keymapIndex: -1, row: 0, col: 0, code, label: "" }));
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
    ["&kp LCTRL", "&kp LGUI", "&kp LALT", "&kp SPACE", "&kp RALT", "&kp RGUI", "&kp K_CMENU", "&kp RCTRL"],
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

const presetDualKeys = [
    "&mt LCTRL TAB",
    "&mt LSHFT BSPC",
    "&mt LALT DEL",
    "&mt LGUI ESC",
    "&lt 1 RET",
    "&lt 1 SPACE",
    "&lt 2 SPACE",
    "&lt 2 RET",
    "&kp LC(C)",
    "&kp LC(V)",
    "&kp LC(Z)",
    "&kp LC(A)",
];

const keyCategories: Record<string, IKeyAction[]> = {
    Modifiers: generateKeys([
        "&kp LCTRL",
        "&kp LSHFT",
        "&kp LALT",
        "&kp LGUI",
        "&kp RCTRL",
        "&kp RSHFT",
        "&kp RALT",
        "&kp RGUI",
    ]),
    "Dual/Tap": generateKeys(presetDualKeys),
    Layers: generateKeys(["&mo 0", "&mo 1", "&mo 2", "&mo 3", "&sl 0", "&sl 1", "&sl 2", "&sl 3"]),
    Bluetooth: generateKeys([
        "&bt BT_CLR",
        "&bt BT_SEL 0",
        "&bt BT_SEL 1",
        "&bt BT_SEL 2",
        "&bt BT_SEL 3",
        "&bt BT_SEL 4",
    ]),
};

type TabName = "Basic" | "Modifiers" | "Dual/Tap" | "Layers" | "Bluetooth";

export function ActionTray() {
    const [activeTab, setActiveTab] = useState<TabName>("Basic");
    const tabs: TabName[] = ["Basic", "Modifiers", "Dual/Tap", "Layers", "Bluetooth"];

    const [holdType, setHoldType] = useState<"mod" | "layer">("mod");
    const [selectedHoldMod, setSelectedHoldMod] = useState("LCTRL");
    const [selectedHoldLayer, setSelectedHoldLayer] = useState("1");
    const [droppedTapCode, setDroppedTapCode] = useState("TAB");

    const [isInvalidDrag, setIsInvalidDrag] = useState(false);
    const [activeDraggedCode, setActiveDraggedCode] = useState<string | null>(null);

    const { setNodeRef: setTapDropRef, isOver: isTapOver } = useDroppable({
        id: "tap-drop-zone",
    });

    const isValidTapKey = (code: string): boolean => {
        if (!code) return false;
        const clean = code.trim();

        const forbiddenBehaviors = [
            "&mt",
            "&lt",
            "&mo",
            "&sl",
            "&tog",
            "&to",
            "&bt",
            "&none",
            "&blank",
            "&trans",
            "&reset",
            "&bootloader",
        ];
        if (forbiddenBehaviors.some((b) => clean.includes(b))) {
            return false;
        }

        if (clean.includes("(") || clean.includes(")")) {
            return false;
        }

        const withoutKp = clean.replace(/^&kp\s+/, "").trim();
        if (withoutKp.includes(" ")) {
            return false;
        }

        return true;
    };

    useDndMonitor({
        onDragStart(event) {
            const code = event.active.data.current?.code || event.active.data.current?.action?.code || "";
            setActiveDraggedCode(code);
        },
        onDragEnd(event) {
            setActiveDraggedCode(null);
            const { active, over } = event;

            if (over && over.id === "tap-drop-zone") {
                const code = active.data.current?.code || active.data.current?.action?.code || "";
                if (isValidTapKey(code)) {
                    setIsInvalidDrag(false);
                    const cleanKey = code.replace(/^&kp\s+/, "").trim();
                    setDroppedTapCode(cleanKey);
                } else {
                    setIsInvalidDrag(true);
                    setTimeout(() => setIsInvalidDrag(false), 1500);
                }
            }
        },
        onDragCancel() {
            setActiveDraggedCode(null);
        },
    });

    const isCurrentDragValid = activeDraggedCode ? isValidTapKey(activeDraggedCode) : false;

    const renderCluster = (cluster: string[][]) => (
        <div className="flex flex-col gap-2 items-start">
            {cluster.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="flex gap-2">
                    {generateKeys(row).map((action, keyIndex) => {
                        const widthClass = getKeyWidth(action.code);
                        const heightClass = getKeyHeight(action.code);
                        const isVertical = heightClass.includes("h-30");

                        if (action.code === "&none" || action.code === "&blank") {
                            return <div key={`empty-${rowIndex}-${keyIndex}`} className={`${widthClass} h-14`} />;
                        }

                        return (
                            <div key={`basic-${rowIndex}-${keyIndex}`} className={`${widthClass} h-14 relative`}>
                                <DraggableKey
                                    action={action}
                                    className={`${widthClass} ${heightClass} ${isVertical ? "absolute top-0 left-0 z-10" : ""}`}
                                />
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );

    const generatedCode =
        holdType === "mod" ? `&mt ${selectedHoldMod} ${droppedTapCode}` : `&lt ${selectedHoldLayer} ${droppedTapCode}`;

    const selectClass =
        "bg-slate-800 text-slate-100 border border-slate-600 text-xs font-semibold px-3 py-2 rounded-md outline-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
    const selectStyle = { colorScheme: "dark" as const, backgroundColor: "#1e293b", color: "#f8fafc" };

    return (
        <div className="h-96 w-full bg-slate-900 border-t border-slate-700 p-4 flex flex-col shrink-0 z-10">
            <div className="flex gap-4 mb-4 border-b border-slate-700 pb-2 shrink-0">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`text-sm font-semibold cursor-pointer transition-colors ${
                            activeTab === tab
                                ? "text-blue-400 border-b-2 border-blue-400 pb-2 -mb-2.25"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-auto p-2 w-full">
                {activeTab === "Basic" ? (
                    <div className="flex justify-center gap-8 min-w-max pb-4 mx-auto">
                        {renderCluster(mainCluster)}
                        {renderCluster(navCluster)}
                        {renderCluster(numpadCluster)}
                    </div>
                ) : activeTab === "Dual/Tap" ? (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-4 bg-slate-800/60 p-3 rounded-lg border border-slate-700/80 w-fit">
                            <span className="text-xs font-semibold text-slate-300">Hold Action:</span>

                            <select
                                value={holdType}
                                onChange={(e) => setHoldType(e.target.value as "mod" | "layer")}
                                className={selectClass}
                                style={selectStyle}
                            >
                                <option value="mod" style={selectStyle}>
                                    Modifier (Mod-Tap)
                                </option>
                                <option value="layer" style={selectStyle}>
                                    Layer (Layer-Tap)
                                </option>
                            </select>

                            {holdType === "mod" ? (
                                <select
                                    value={selectedHoldMod}
                                    onChange={(e) => setSelectedHoldMod(e.target.value)}
                                    className={selectClass}
                                    style={selectStyle}
                                >
                                    <option value="LCTRL" style={selectStyle}>
                                        LCTRL
                                    </option>
                                    <option value="LSHFT" style={selectStyle}>
                                        LSHFT
                                    </option>
                                    <option value="LALT" style={selectStyle}>
                                        LALT
                                    </option>
                                    <option value="LGUI" style={selectStyle}>
                                        LGUI
                                    </option>
                                    <option value="RCTRL" style={selectStyle}>
                                        RCTRL
                                    </option>
                                    <option value="RSHFT" style={selectStyle}>
                                        RSHFT
                                    </option>
                                    <option value="RALT" style={selectStyle}>
                                        RALT
                                    </option>
                                    <option value="RGUI" style={selectStyle}>
                                        RGUI
                                    </option>
                                </select>
                            ) : (
                                <select
                                    value={selectedHoldLayer}
                                    onChange={(e) => setSelectedHoldLayer(e.target.value)}
                                    className={selectClass}
                                    style={selectStyle}
                                >
                                    <option value="1" style={selectStyle}>
                                        Layer 1
                                    </option>
                                    <option value="2" style={selectStyle}>
                                        Layer 2
                                    </option>
                                    <option value="3" style={selectStyle}>
                                        Layer 3
                                    </option>
                                    <option value="4" style={selectStyle}>
                                        Layer 4
                                    </option>
                                </select>
                            )}

                            <span className="text-slate-400 font-semibold text-xs">+ Drop Tap Key:</span>

                            <div
                                ref={setTapDropRef}
                                className={`w-32 h-12 border-2 border-dashed rounded-lg flex items-center justify-center transition-all ${
                                    isInvalidDrag
                                        ? "border-red-500 bg-red-500/20 text-red-300 animate-pulse"
                                        : isTapOver && isCurrentDragValid
                                          ? "border-blue-400 bg-blue-500/30 text-blue-300 scale-105 shadow-lg shadow-blue-500/10 cursor-copy"
                                          : isTapOver && !isCurrentDragValid
                                            ? "border-red-500/60 bg-red-500/10 text-red-400 cursor-not-allowed"
                                            : "border-slate-600 bg-slate-900/50 text-slate-300"
                                }`}
                            >
                                <span className="text-xs font-bold truncate px-2 select-none pointer-events-none">
                                    {isInvalidDrag
                                        ? "Invalid!"
                                        : isTapOver && !isCurrentDragValid
                                          ? "Invalid"
                                          : `Tap: ${droppedTapCode}`}
                                </span>
                            </div>

                            <span className="text-slate-500 text-xs mx-1">→</span>

                            <DraggableKey
                                action={{ keymapIndex: -1, row: 0, col: 0, code: generatedCode, label: "" }}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-slate-400">
                                Drag a simple key to the slot above:
                            </span>
                            <div className="flex flex-wrap gap-2 content-start max-w-4xl">
                                {generateKeys(basicKeysQuickList).map((action, index) => (
                                    <DraggableKey key={`quick-tap-${index}`} action={action} />
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                            <span className="text-xs font-semibold text-slate-400">Common Presets:</span>
                            <div className="flex flex-wrap gap-2 content-start">
                                {keyCategories["Dual/Tap"].map((action, index) => (
                                    <DraggableKey key={`tray-dualtap-${index}`} action={action} />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 content-start">
                        {keyCategories[activeTab].map((action, index) => (
                            <DraggableKey key={`tray-${activeTab}-${index}`} action={action} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

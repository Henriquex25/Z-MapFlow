import { useState } from "react";
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

type TabName = "Basic" | "Modifiers" | "Layers" | "Bluetooth";

export function ActionTray() {
    const [activeTab, setActiveTab] = useState<TabName>("Basic");
    const tabs: TabName[] = ["Basic", "Modifiers", "Layers", "Bluetooth"];

    const renderCluster = (cluster: string[][]) => (
        <div className="flex flex-col gap-2 items-start">
            {cluster.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="flex gap-2">
                    {generateKeys(row).map((action, keyIndex) => {
                        const widthClass = getKeyWidth(action.code);
                        const heightClass = getKeyHeight(action.code);
                        const isVertical = heightClass.includes("120px");

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

    return (
        <div className="h-96 w-full bg-gray-900 border-t border-gray-700 p-4 flex flex-col shrink-0 z-10">
            <div className="flex gap-4 mb-4 border-b border-gray-700 pb-2 shrink-0">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`text-sm font-semibold cursor-pointer transition-colors ${
                            activeTab === tab
                                ? "text-blue-400 border-b-2 border-blue-400 pb-2 -mb-2.25"
                                : "text-gray-500 hover:text-gray-300"
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

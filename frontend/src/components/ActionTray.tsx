import { useState } from "react";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";
import { DraggableKey } from "./DraggableKey";

const generateKeys = (codes: string[]): IKeyAction[] => {
    return codes.map((code) => ({ keymapIndex: -1, row: 0, col: 0, code, label: "" }));
};

const keyCategories: Record<string, IKeyAction[]> = {
    Basic: generateKeys([
        "&none",
        "&trans",
        "&kp ESC",
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
        "&kp LBRC",
        "&kp RBRC",
        "&kp BSLH",
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
        "&kp SPACE",
    ]),
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

    return (
        <div className="h-72 bg-gray-900 border-t border-gray-700 p-4 flex flex-col shrink-0 z-10">
            <div className="flex gap-4 mb-4 border-b border-gray-700 pb-2">
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

            <div className="flex flex-wrap gap-2 overflow-y-auto content-start flex-1 p-2">
                {keyCategories[activeTab].map((action, index) => (
                    <DraggableKey key={`tray-${activeTab}-${index}`} action={action} />
                ))}
            </div>
        </div>
    );
}

export interface IKeyAction {
    keymapIndex: number;
    row: number;
    col: number;
    code: string;
    label: string;
}

export interface ISensorAction {
    id: string;
    label: string;
    codeCW: string;
    codeCCW: string;
    codeClick: string;
    clickKeymapIndex: number;
}

export interface ILayer {
    name: string;
    keys: IKeyAction[];
    sensors: ISensorAction[];
}

export interface IKeyboardLayout {
    name: string;
    layers: ILayer[];
}

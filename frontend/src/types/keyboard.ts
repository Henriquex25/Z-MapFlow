import type { models, firmware, flash } from "../../wailsjs/go/models";
// Keep frontend data contracts derived from the generated Go models.
type Data<T> = T extends (...args: never[]) => unknown
  ? never
  : T extends Array<infer U>
    ? Data<U>[]
    : T extends object
      ? {
          [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: Data<T[K]>;
        }
      : T;
export type IKeyAction = Data<models.KeyAction>;
export type ISensorAction = Data<models.SensorAction>;
export type ILayer = Data<models.LayerData>;
export type IKeyboardLayout = Data<models.KeyboardLayout>;
export type Project = Data<models.Project>;
export type Plugin = Data<models.Plugin>;
export type Session = Data<models.Session>;
export type Macro = Data<models.Macro>;
export type Combo = Data<models.Combo>;
export type Behavior = Data<models.Behavior>;
export type Build = Data<firmware.Build>;
export type Volume = Data<flash.Volume>;
export const uid = (prefix = "zm") => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
export const action = (code: string): IKeyAction => ({
  keymapIndex: -1,
  row: 0,
  col: 0,
  code,
  label: "",
});

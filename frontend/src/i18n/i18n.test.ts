import { act } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { localizeMessage, tr, useAppPreferences } from "./index";

beforeEach(() => {
  localStorage.clear();
  useAppPreferences.setState({ locale: "en" });
});
it("defaults to English and interpolates user data without translating it", () => {
  expect(tr("Save")).toBe("Save");
  expect(tr("Assign {0} to keyboard", "Salvar")).toBe("Assign Salvar to keyboard");
  useAppPreferences.getState().setLocale("pt-BR");
  expect(tr("Save")).toBe("Salvar");
  expect(tr("Assign {0} to keyboard", "Save &kp Ç")).toBe("Atribuir Save &kp Ç ao teclado");
  expect(document.documentElement.lang).toBe("pt-BR");
});
it("restores the saved language and ignores unsupported preferences", async () => {
  useAppPreferences.getState().setLocale("pt-BR");
  const saved = localStorage.getItem("z-mapflow.preferences")!;
  useAppPreferences.setState({ locale: "en" });
  localStorage.setItem("z-mapflow.preferences", saved);
  await act(async () => {
    await useAppPreferences.persist.rehydrate();
  });
  expect(useAppPreferences.getState().locale).toBe("pt-BR");
  localStorage.setItem(
    "z-mapflow.preferences",
    JSON.stringify({ state: { locale: "invalid" }, version: 1 }),
  );
  await act(async () => {
    await useAppPreferences.persist.rehydrate();
  });
  expect(useAppPreferences.getState().locale).toBe("en");
});
it("translates native errors, nested reasons and paths without changing names", () => {
  expect(
    localizeMessage('não foi possível importar o .keymap: binding inválido: "&kp FDSFSD"'),
  ).toBe('Could not import the .keymap: Invalid binding: "&kp FDSFSD"');
  expect(localizeMessage('Salvar, tecla 36: binding inválido: "&kp FDSFSD"')).toBe(
    'Salvar, key 36: Invalid binding: "&kp FDSFSD"',
  );
  expect(
    localizeMessage("header fora da pasta da configuração: /tmp/minha configuração/keys.h"),
  ).toBe("The header is outside the configuration folder: /tmp/minha configuração/keys.h");
  useAppPreferences.getState().setLocale("pt-BR");
  expect(localizeMessage('Could not import the .keymap: Invalid binding: "&kp FDSFSD"')).toBe(
    'não foi possível importar o .keymap: binding inválido: "&kp FDSFSD"',
  );
  expect(localizeMessage("An unknown compiler message with user-defined names")).toBe(
    "An unknown compiler message with user-defined names",
  );
});

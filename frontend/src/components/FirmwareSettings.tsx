import { tr, useLocale } from "../i18n";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useKeyboardStore } from "../store/useKeyboardStore";
import {
  configEntries,
  enableStudioUSB,
  headerSymbols,
  setConfig,
} from "../utils/firmwareSettings";

// Keep separators while typing, while persisting normalized build settings.
function DraftField({
  value,
  onChange,
  normalize,
  multiline = false,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  normalize: (value: string) => string;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
}) {
  useLocale();
  const [text, setText] = useState(value);
  useEffect(() => {
    setText((current) => (normalize(current) === value ? current : value));
  }, [value, normalize]);
  const change = (value: string) => {
    setText(value);
    onChange(value);
  };
  return multiline ? (
    <textarea {...props} rows={3} value={text} onChange={(e) => change(e.target.value)} />
  ) : (
    <input {...props} value={text} onChange={(e) => change(e.target.value)} />
  );
}
const snippetTokens = (value: string) => value.trim().split(/\s+/).filter(Boolean);
const cmakeLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function ConfigFlags({ source, onChange }: { source: string; onChange: (source: string) => void }) {
  useLocale();
  const [name, setName] = useState("");
  const [value, setValue] = useState("y");
  const entries = [...new Map(configEntries(source).map((entry) => [entry.name, entry])).values()];
  return (
    <>
      {entries.map((entry) => (
        <div className="flex items-center gap-2 mt-2" key={entry.name}>
          <code className="grow text-sm break-all">{entry.name}</code>
          <DraftField
            normalize={(value) => value.trim()}
            className="field w-40"
            aria-label={tr("Value of {0}", entry.name)}
            value={entry.value}
            onChange={(value) => onChange(setConfig(source, entry.name, value))}
          />
          <button
            className="btn"
            aria-label={tr("Remove {0}", entry.name)}
            onClick={() => onChange(setConfig(source, entry.name))}
          >
            {tr("Remove")}{" "}
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <input
          className="field grow"
          aria-label={tr("New Kconfig flag")}
          placeholder="CONFIG_ZMK_STUDIO"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field w-32"
          aria-label={tr("New flag value")}
          placeholder={tr("y, n, number or quoted text")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="btn"
          disabled={!/^CONFIG_[A-Za-z0-9_]+$/.test(name) || !value.trim()}
          onClick={() => {
            onChange(setConfig(source, name, value));
            setName("");
          }}
        >
          {tr("Add flag")}{" "}
        </button>
      </div>
    </>
  );
}
export function FirmwareSettings() {
  useLocale();
  const { project: p, plugin, edit } = useKeyboardStore();
  const [headerName, setHeaderName] = useState("");
  if (!p || !plugin) return null;
  const variant = plugin.variants.find((v) => v.id === p.variantId)!;
  const central = variant.targets.find((t) => t.role === "central" || t.role === "standalone");
  const updateTarget = (id: string, patch: { snippets?: string[]; cmakeArgs?: string[] }) =>
    edit((p) => {
      p.buildTargets ??= [];
      let target = p.buildTargets.find((s) => s.targetId === id);
      if (!target) {
        target = { targetId: id };
        p.buildTargets.push(target);
      }
      Object.assign(target, patch);
    });
  const importHeaders = async () => {
    try {
      const bundle = await api.importHeaders();
      if (!bundle?.name) return;
      const headers = bundle.files;
      const conflicts = Object.keys(headers).filter(
        (name) => p.headers?.[name] !== undefined && p.headers[name] !== headers[name],
      );
      if (conflicts.length) {
        useKeyboardStore.setState({
          error: tr(
            "Headers already exist with different contents: {0}. Rename or edit the existing header.",
            conflicts.join(", "),
          ),
        });
        return;
      }
      edit((p) => {
        p.headers = { ...p.headers, ...headers };
        p.options.locale = bundle.name === "keys_pt_abnt2.h" ? "pt-br" : `header:${bundle.name}`;
        if (!(p.preamble ?? "").includes(`"${bundle.name}"`))
          p.preamble = `${p.preamble ?? ""}\n#include "${bundle.name}"\n`;
      });
    } catch (e) {
      useKeyboardStore.setState({ error: String(e) });
    }
  };
  return (
    <>
      <div className="resource-card">
        <h3>{tr("Firmware flags (.conf)")}</h3>
        <p className="hint">
          {tr(
            "Add ZMK and module flags. Use y/n, numbers or quoted text. OLED, mouse and sleep options are in the controls above; additional flags take precedence.",
          )}{" "}
        </p>
        <ConfigFlags
          source={p.extraConfig ?? ""}
          onChange={(value) =>
            edit((p) => {
              p.extraConfig = value;
            })
          }
        />
      </div>
      <div className="resource-card">
        <div className="section-toolbar">
          <h3>{tr("Build and USB connection")}</h3>
          {central && (
            <button className="btn" onClick={() => edit((p) => enableStudioUSB(p, central.id))}>
              {tr("Enable Studio over USB —")} {tr(central.name)}
            </button>
          )}
        </div>
        <p className="hint">
          {tr(
            "USB typing uses CONFIG_ZMK_USB=y. Studio over USB also requires CONFIG_ZMK_STUDIO=y and the studio-rpc-usb-uart snippet on the central target. The preset keeps the security lock enabled: assign &studio_unlock to a key from the Resources palette.",
          )}{" "}
        </p>
        <p className="hint">
          {tr(
            "Settings saved by Studio override the .keymap until you use “Restore Stock Settings” in Studio.",
          )}{" "}
        </p>
        {variant.targets.map((target) => {
          const settings = p.buildTargets?.find((s) => s.targetId === target.id);
          const args = settings?.cmakeArgs ?? [];
          const config = args
            .filter((arg) => /^-DCONFIG_/.test(arg))
            .map((arg) => arg.slice(2).replace(/:[A-Za-z]+=/, "="))
            .join("\n");
          return (
            <div className="mt-4" key={target.id}>
              <h4>
                {tr(target.name)}
                {target.role === "central"
                  ? tr("· Central")
                  : target.role === "peripheral"
                    ? tr("· Peripheral")
                    : ""}
              </h4>
              <label className="form-label mt-2">
                {tr("Snippets (space-separated)")}{" "}
                <DraftField
                  className="field"
                  value={(settings?.snippets ?? []).join(" ")}
                  placeholder="studio-rpc-usb-uart"
                  normalize={(value) => snippetTokens(value).join(" ")}
                  onChange={(value) => updateTarget(target.id, { snippets: snippetTokens(value) })}
                />
              </label>
              <ConfigFlags
                source={config}
                onChange={(value) =>
                  updateTarget(target.id, {
                    cmakeArgs: [
                      ...args.filter((a) => !/^-DCONFIG_/.test(a)),
                      ...configEntries(value).map((flag) => `-D${flag.name}=${flag.value}`),
                    ],
                  })
                }
              />
              <label className="form-label mt-2">
                {tr("CMake arguments (one per line)")}{" "}
                <DraftField
                  multiline
                  className="field source-editor"
                  value={args.join("\n")}
                  placeholder="-DCONFIG_ZMK_STUDIO=y"
                  normalize={(value) => cmakeLines(value).join("\n")}
                  onChange={(value) => updateTarget(target.id, { cmakeArgs: cmakeLines(value) })}
                />
              </label>
            </div>
          );
        })}
        <p className="hint mt-3">
          {tr(
            "These options apply to local builds and the exported build.yaml. Put build.yaml at the root of the zmk-config repository; put the .keymap, .conf and headers in config/.",
          )}{" "}
        </p>
      </div>
      <div className="resource-card">
        <div className="section-toolbar">
          <h3>{tr("Headers and languages")}</h3>
          <button className="btn" onClick={importHeaders}>
            {tr("Import .h header")}{" "}
          </button>
        </div>
        <p className="hint">
          {tr(
            "Add ZMK headers for other languages. Their aliases appear in the Languages palette tab, and the files are included in the project and exports. Configure the same layout in your operating system.",
          )}{" "}
        </p>
        <div className="flex gap-2 mt-3">
          <input
            className="field grow"
            aria-label={tr("New header name")}
            placeholder="keys_es.h"
            value={headerName}
            onChange={(e) => setHeaderName(e.target.value)}
          />
          <button
            className="btn"
            disabled={!/^[A-Za-z0-9_-]+\.h$/.test(headerName) || !!p.headers?.[headerName]}
            onClick={() => {
              edit((p) => {
                p.headers = {
                  ...p.headers,
                  [headerName]:
                    "#pragma once\n#include <dt-bindings/zmk/keys.h>\n\n// Exemplo: #define ES_NTIL SEMI\n",
                };
                p.preamble = `${p.preamble ?? ""}\n#include "${headerName}"\n`;
                p.options.locale = `header:${headerName}`;
              });
              setHeaderName("");
            }}
          >
            {tr("Create header")}{" "}
          </button>
        </div>
        {Object.entries(p.headers ?? {}).map(([name, content]) => (
          <details className="mt-3" key={name}>
            <summary className="cursor-pointer">
              {name} · {headerSymbols({ [name]: content }).length} aliases
            </summary>
            <textarea
              className="field source-editor mt-2"
              aria-label={tr("Contents of {0}", name)}
              rows={8}
              value={content}
              onChange={(e) =>
                edit((p) => {
                  p.headers![name] = e.target.value;
                })
              }
            />
          </details>
        ))}
      </div>
    </>
  );
}

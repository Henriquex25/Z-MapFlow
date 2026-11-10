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
            aria-label={`Valor de ${entry.name}`}
            value={entry.value}
            onChange={(value) => onChange(setConfig(source, entry.name, value))}
          />
          <button
            className="btn"
            aria-label={`Remover ${entry.name}`}
            onClick={() => onChange(setConfig(source, entry.name))}
          >
            Remover
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <input
          className="field grow"
          aria-label="Nova flag Kconfig"
          placeholder="CONFIG_ZMK_STUDIO"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field w-32"
          aria-label="Valor da nova flag"
          placeholder="y, n, número ou texto entre aspas"
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
          Adicionar flag
        </button>
      </div>
    </>
  );
}
export function FirmwareSettings() {
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
          error: `Headers já existentes com conteúdo diferente: ${conflicts.join(", ")}. Renomeie ou edite o header existente.`,
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
        <h3>Flags de firmware (.conf)</h3>
        <p className="hint">
          Adicione flags do ZMK e de módulos. Use y/n, números ou textos entre aspas. As opções
          visuais de OLED, mouse e repouso ficam nos controles acima; flags adicionais têm
          precedência.
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
          <h3>Compilação e conexão USB</h3>
          {central && (
            <button className="btn" onClick={() => edit((p) => enableStudioUSB(p, central.id))}>
              Habilitar Studio via USB — {central.name}
            </button>
          )}
        </div>
        <p className="hint">
          USB para digitação usa CONFIG_ZMK_USB=y. Studio via USB também exige CONFIG_ZMK_STUDIO=y e
          o snippet studio-rpc-usb-uart no alvo central. O preset mantém o bloqueio de segurança:
          atribua &amp;studio_unlock a uma tecla na paleta Recursos.
        </p>
        <p className="hint">
          Configurações gravadas pelo Studio prevalecem sobre o .keymap até usar “Restore Stock
          Settings” no Studio.
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
                {target.name}
                {target.role === "central"
                  ? " · Central"
                  : target.role === "peripheral"
                    ? " · Periférico"
                    : ""}
              </h4>
              <label className="form-label mt-2">
                Snippets (separados por espaço)
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
                Argumentos CMake (um por linha)
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
          Estas opções são aplicadas no build local e no build.yaml exportado. Coloque o build.yaml
          na raiz do repositório zmk-config; o .keymap, .conf e headers vão em config/.
        </p>
      </div>
      <div className="resource-card">
        <div className="section-toolbar">
          <h3>Headers e idiomas</h3>
          <button className="btn" onClick={importHeaders}>
            Importar header .h
          </button>
        </div>
        <p className="hint">
          Adicione headers ZMK para outros idiomas. Seus aliases aparecem na aba Idiomas da paleta e
          os arquivos acompanham o projeto e a exportação. Configure o mesmo idioma no sistema
          operacional.
        </p>
        <div className="flex gap-2 mt-3">
          <input
            className="field grow"
            aria-label="Nome do novo header"
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
            Criar header
          </button>
        </div>
        {Object.entries(p.headers ?? {}).map(([name, content]) => (
          <details className="mt-3" key={name}>
            <summary className="cursor-pointer">
              {name} · {headerSymbols({ [name]: content }).length} aliases
            </summary>
            <textarea
              className="field source-editor mt-2"
              aria-label={`Conteúdo de ${name}`}
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

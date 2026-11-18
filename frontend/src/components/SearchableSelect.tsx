import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { tr, useLocale } from "../i18n";
import { ResourceVisibility } from "../utils/resourceVisibility";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  description?: string;
  searchText?: string;
  disabled?: boolean;
}
const rowHeight = 48;
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Search is navigation only. Values are committed by selecting an enabled option. */
export function SearchableSelect({
  label,
  value,
  options,
  selectedLabel,
  onChange,
  placeholder,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  options: SelectOption[] | (() => SelectOption[]);
  selectedLabel?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  useLocale();
  const visible = useContext(ResourceVisibility);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [scroll, setScroll] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 240, height: 288 });
  const isOpen = open && visible && !disabled;
  const available = useMemo(
    () => (typeof options === "function" ? (isOpen ? options() : []) : options),
    [options, isOpen],
  );
  const indexed = useMemo(
    () =>
      !isOpen
        ? []
        : available.map((option) => ({
            option,
            text: normalize(
              [option.label, option.value, option.group, option.searchText]
                .filter(Boolean)
                .join(" "),
            ),
          })),
    [available, isOpen],
  );
  const filtered = useMemo(() => {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    const matches = indexed
      .filter((item) => words.every((word) => item.text.includes(word)))
      .map((item) => item.option);
    const text = normalize(query).trim();
    const rank = (option: SelectOption) =>
      normalize(option.value) === text ? 0 : normalize(option.label) === text ? 1 : 2;
    return text ? matches.sort((a, b) => rank(a) - rank(b)) : matches;
  }, [indexed, query]);
  const previousQuery = useRef("");
  const selected = available.find((option) => option.value === value);
  const displayValue = selected?.label ?? selectedLabel ?? value ?? "";
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };
  const show = () => {
    if (disabled || !visible) return;
    setQuery("");
    setOpen(true);
    setScroll(0);
    previousQuery.current = "";
    const choices = typeof options === "function" ? options() : options;
    const selectedIndex = choices.findIndex((option) => option.value === value && !option.disabled);
    setActive(selectedIndex >= 0 ? selectedIndex : choices.findIndex((option) => !option.disabled));
  };
  useEffect(() => {
    if (!visible || disabled) {
      setOpen(false);
      setQuery("");
    }
  }, [visible, disabled]);
  useLayoutEffect(() => {
    if (!isOpen) return;
    let frame = 0;
    const place = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const useAbove = below < 180 && above > below;
      const height = Math.max(48, Math.min(288, useAbove ? above : below));
      const menuHeight = Math.min(height, Math.max(1, filtered.length) * rowHeight);
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: useAbove ? rect.top - menuHeight - 6 : rect.bottom + 6,
        width,
        height,
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("resize", schedule);
    const parentScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node) && event.target !== input.current) close();
    };
    window.addEventListener("scroll", parentScroll, true);
    const outside = (event: PointerEvent) => {
      if (
        !input.current?.parentElement?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", parentScroll, true);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [isOpen, filtered.length]);
  useLayoutEffect(() => {
    if (!isOpen || active < 0 || !list.current) return;
    const el = list.current,
      top = active * rowHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowHeight > el.scrollTop + position.height)
      el.scrollTop = top + rowHeight - position.height;
    setScroll(el.scrollTop);
  }, [active, isOpen, position.height]);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const changed = previousQuery.current !== query;
    previousQuery.current = query;
    setActive((index) =>
      changed || index >= filtered.length || filtered[index]?.disabled
        ? filtered.findIndex((option) => !option.disabled)
        : index,
    );
  }, [filtered, isOpen, query]);
  const move = (direction: number, edge = false) => {
    let index = edge ? (direction > 0 ? 0 : filtered.length - 1) : active + direction;
    while (index >= 0 && index < filtered.length && filtered[index].disabled) index += direction;
    if (index >= 0 && index < filtered.length) setActive(index);
  };
  const start = Math.max(0, Math.floor(scroll / rowHeight) - 3);
  const end = Math.min(filtered.length, start + Math.ceil(position.height / rowHeight) + 7);
  return (
    <div className={`search-select ${className}`}>
      <input
        ref={input}
        className="field search-select-input"
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-list` : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={isOpen && active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        readOnly={!isOpen}
        disabled={disabled}
        placeholder={isOpen ? tr("Search options…") : (placeholder ?? tr("Choose an option"))}
        value={isOpen ? query : displayValue}
        title={!isOpen ? displayValue : undefined}
        onFocus={show}
        onClick={() => {
          if (!isOpen) show();
        }}
        onBlur={(event) => {
          if (!menu.current?.contains(event.relatedTarget)) close();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setScroll(0);
          if (list.current) list.current.scrollTop = 0;
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === "Tab") close();
          else if (event.key === "Enter") {
            event.preventDefault();
            if (!isOpen) show();
            else if (filtered[active]) choose(filtered[active]);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!isOpen) show();
            else move(event.key === "ArrowDown" ? 1 : -1);
          } else if ((event.key === "Home" || event.key === "End") && isOpen && event.ctrlKey) {
            event.preventDefault();
            move(event.key === "Home" ? 1 : -1, true);
          } else if (!isOpen && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            show();
            setQuery(event.key);
            setActive(0);
          }
        }}
      />
      <button
        type="button"
        className="search-select-toggle"
        tabIndex={-1}
        disabled={disabled}
        aria-label={tr("Show options for {0}", label)}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          if (isOpen) close();
          else {
            input.current?.focus();
            show();
          }
        }}
      >
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menu}
            className="search-select-menu"
            style={{ left: position.left, top: position.top, width: position.width }}
          >
            {filtered.length ? (
              <div
                ref={list}
                role="listbox"
                aria-label={label}
                id={`${id}-list`}
                style={{ height: Math.min(position.height, filtered.length * rowHeight) }}
                onScroll={(event) => setScroll(event.currentTarget.scrollTop)}
              >
                <div
                  className="search-select-items"
                  style={{ height: filtered.length * rowHeight }}
                >
                  {filtered.slice(start, end).map((option, offset) => {
                    const index = start + offset;
                    return (
                      <div
                        key={option.value}
                        id={`${id}-option-${index}`}
                        role="option"
                        aria-label={option.label}
                        aria-description={option.description}
                        data-value={option.value}
                        aria-selected={option.value === value}
                        aria-disabled={!!option.disabled}
                        className={`search-select-option${index === active ? " active" : ""}`}
                        style={{ top: index * rowHeight, height: rowHeight }}
                        title={option.description || option.label}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                        onPointerMove={() => {
                          if (!option.disabled) setActive(index);
                        }}
                      >
                        <span className="search-select-option-copy">
                          <span>{option.label}</span>
                          {(option.group || option.description) && (
                            <small>
                              {[option.group, option.description].filter(Boolean).join(" · ")}
                            </small>
                          )}
                        </span>
                        {option.value === value && <Check size={16} aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="hint search-select-empty" role="status">
                {tr("No matching options")}
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

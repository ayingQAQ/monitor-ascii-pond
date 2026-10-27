import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type Option = { value: string; label: string };

export function PaperSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null), search = useRef({ text: "", at: 0 });
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const [open, setOpen] = useState(false), [active, setActive] = useState(selected), [above, setAbove] = useState(false);
  const activeIndex = Math.min(active, options.length - 1);
  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    setAbove(!!rect && innerHeight - rect.bottom < Math.min(260, options.length * 36) && rect.top > 260);
    setActive(selected);
    setOpen(true);
  };
  const choose = (index: number) => {
    if (options[index]) onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (!open || !list.current) return;
    const item = list.current.children[activeIndex] as HTMLElement | undefined;
    if (!item) return;
    if (item.offsetTop < list.current.scrollTop) list.current.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.current.scrollTop + list.current.clientHeight)
      list.current.scrollTop = item.offsetTop + item.offsetHeight - list.current.clientHeight;
  }, [activeIndex, open]);
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") { setOpen(false); event.preventDefault(); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      if (event.key === "Enter" || event.key === " ") choose(activeIndex);
      else if (event.key === "Home") setActive(0);
      else if (event.key === "End") setActive(options.length - 1);
      else setActive((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      search.current = { text: (Date.now() - search.current.at < 800 ? search.current.text : "") + event.key.toLowerCase(), at: Date.now() };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.text));
      if (!open) show();
      if (index >= 0) setActive(index);
    }
  }
  return (
    <div className="paper-select" ref={root} data-pond-ignore onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={trigger} type="button" role="combobox" className="paper-select-trigger"
        aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${activeIndex}` : undefined}
        onKeyDown={keyDown} onClick={() => open ? setOpen(false) : show()}>
        <span>{options[selected]?.label}</span><span className="select-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && <div ref={list} className={"paper-options" + (above ? " above" : "")} id={id} role="listbox" aria-label={label}>
        {options.map((option, index) => <button key={option.value} type="button" role="option" tabIndex={-1}
          id={`${id}-${index}`} aria-selected={option.value === value} className={index === activeIndex ? "active" : ""}
          onPointerDown={event => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>
          {option.label}
        </button>)}
      </div>}
    </div>
  );
}

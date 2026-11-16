import { motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getServerNow } from "../../store/globalStore";
import { calculateFloatingPosition } from "../../utils/floatingPosition";

export interface DateTimePickerPopoverProps {
  value?: string | Date | null;
  onChange: (value: string | null) => void;
  allowPastDates?: boolean;
  placeholder?: string;
  className?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const DateTimePickerPopover = ({
  value,
  onChange,
  allowPastDates = false,
  placeholder = "Choose date and time",
  className = "",
}: DateTimePickerPopoverProps) => {
  const parsedValue = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; above: boolean; maxHeight: number }>({ top: 0, left: 0, above: false, maxHeight: 420 });
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parsedValue && !Number.isNaN(parsedValue.getTime()) ? parsedValue : getServerNow();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() =>
    parsedValue && !Number.isNaN(parsedValue.getTime()) ? parsedValue : getServerNow(),
  );
  const serverNow = getServerNow();
  const today = startOfDay(serverNow);
  const selectedKey = dateKey(selected);
  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const offset = first.getDay();
    const count = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= count ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null;
    });
  }, [visibleMonth]);

  const getFloatingPosition = () => {
    const anchor = triggerRef.current;
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const placement = calculateFloatingPosition(
      { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
        offsetTop: viewport?.offsetTop,
      },
      { menuWidth: 292, maxMenuHeight: 440, margin: 12, gap: 8 },
    );
    return {
      top: placement.top,
      left: placement.left,
      above: placement.side === "top",
      maxHeight: Math.max(80, placement.maxHeight),
    };
  };

  useEffect(() => {
    if (!open) return;
    const nextPosition = getFloatingPosition();
    if (nextPosition) setPosition(nextPosition);
    const next = parsedValue && !Number.isNaN(parsedValue.getTime()) ? parsedValue : getServerNow();
    setSelected(next);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const nextPosition = getFloatingPosition();
      if (nextPosition) setPosition(nextPosition);
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open]);

  const chooseDay = (day: Date) => {
    const next = new Date(day);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    if (!allowPastDates && startOfDay(next) < today) return;
    if (!allowPastDates && dateKey(next) === dateKey(serverNow) && next.getTime() < serverNow.getTime() + 5 * 60_000) {
      next.setTime(serverNow.getTime() + 5 * 60_000);
      next.setSeconds(0, 0);
    }
    setSelected(next);
  };

  const changeTime = (hours: number, minutes: number) => {
    const next = new Date(selected);
    next.setHours(hours, minutes, 0, 0);
    if (!allowPastDates && dateKey(next) === dateKey(serverNow) && next.getTime() < serverNow.getTime() + 5 * 60_000) {
      next.setTime(serverNow.getTime() + 5 * 60_000);
      next.setSeconds(0, 0);
    }
    setSelected(next);
  };

  const hour12 = selected.getHours() % 12 || 12;
  const label = parsedValue && !Number.isNaN(parsedValue.getTime())
    ? parsedValue.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className={`relative inline-block ${className}`}>
      <button ref={triggerRef} type="button" onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#161A23] bg-[#1D2230] px-3 py-1.5 text-xs font-medium text-[#F1F3F9] hover:border-[#3f4147]">
        <CalendarDays size={13} className="text-[#A1A8B8]" />
        <span className="tabular-nums">{label ?? placeholder}</span>
      </button>
      {open && createPortal(
        <>
          <>
            <button type="button" aria-label="Close date picker" className="fixed inset-0 z-[10049] cursor-default" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: position.above ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.165, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, scale: 0.95, y: position.above ? 4 : -4, transition: { duration: 0.13, ease: [0.4, 0, 1, 1] } }}
              style={{ position: "fixed", top: position.top, left: position.left, maxHeight: position.maxHeight, transformOrigin: position.above ? "bottom left" : "top left" }}
              className="z-[10050] w-[292px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[10px] border border-[#272D3A] bg-[#161A23] p-3 shadow-xl">
              <div className="mb-3">
                <div className="text-sm font-semibold text-[#F1F3F9]">{selected.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                    disabled={!allowPastDates && (visibleMonth.getFullYear() < today.getFullYear() || (visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() <= today.getMonth()))}
                    className="rounded-md p-1.5 text-[#A1A8B8] hover:bg-[#161A23] disabled:opacity-30"><ChevronLeft size={15} /></button>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F1F3F9]">{visibleMonth.toLocaleDateString([], { month: "long", year: "numeric" })}</span>
                  <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                    className="rounded-md p-1.5 text-[#A1A8B8] hover:bg-[#161A23]"><ChevronRight size={15} /></button>
                </div>
              </div>
              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold text-[#A1A8B8]">
                {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => <span key={day} className="py-1">{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[8px] border border-[#272D3A] bg-[#1D2230]">
                {days.map((day, index) => {
                  if (!day) return <span key={index} className="h-8 bg-[#10131A]" />;
                  const disabled = !allowPastDates && startOfDay(day) < today;
                  const active = dateKey(day) === selectedKey;
                  return <button key={dateKey(day)} type="button" disabled={disabled} onClick={() => chooseDay(day)}
                    className={`h-8 bg-[#161A23] text-xs tabular-nums ${disabled ? "cursor-not-allowed bg-[#10131A] text-[#6F788A]" : active ? "bg-[#818CF8] font-bold text-white" : "font-medium text-[#F1F3F9] hover:bg-[#252B3A]"}`}>{day.getDate()}</button>;
                })}
              </div>
              <div className="mt-3 border-t border-[#272D3A] pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#A1A8B8]"><Clock size={12} /> TIME</div>
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="Decrease hour" onClick={() => changeTime((selected.getHours() + 23) % 24, selected.getMinutes())} className="h-8 w-7 rounded-md border border-[#161A23] bg-[#1D2230] text-sm text-white">−</button>
                  <span className="min-w-6 text-center text-xs font-semibold tabular-nums text-white">{pad(hour12)}</span>
                  <button type="button" aria-label="Increase hour" onClick={() => changeTime((selected.getHours() + 1) % 24, selected.getMinutes())} className="h-8 w-7 rounded-md border border-[#161A23] bg-[#1D2230] text-sm text-white">+</button>
                  <span className="text-xs text-[#A1A8B8]">:</span>
                  <button type="button" aria-label="Decrease minute" onClick={(event) => changeTime(selected.getHours(), (selected.getMinutes() + (event.shiftKey ? 55 : 59)) % 60)} className="h-8 w-7 rounded-md border border-[#161A23] bg-[#1D2230] text-sm text-white">−</button>
                  <span className="min-w-6 text-center text-xs font-semibold tabular-nums text-white">{pad(selected.getMinutes())}</span>
                  <button type="button" aria-label="Increase minute" onClick={(event) => changeTime(selected.getHours(), (selected.getMinutes() + (event.shiftKey ? 5 : 1)) % 60)} className="h-8 w-7 rounded-md border border-[#161A23] bg-[#1D2230] text-sm text-white">+</button>
                  <button type="button" onClick={() => changeTime(selected.getHours() >= 12 ? selected.getHours() - 12 : selected.getHours() + 12, selected.getMinutes())} className="h-8 rounded-md border border-[#161A23] bg-[#1D2230] px-2 text-xs font-semibold text-white">{selected.getHours() >= 12 ? "PM" : "AM"}</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["+1h", "+24h", "14d"].map((preset) => <button key={preset} type="button" onClick={() => { const next = new Date(selected); next.setTime(next.getTime() + (preset === "+1h" ? 3600000 : preset === "+24h" ? 86400000 : 14 * 86400000)); setSelected(next); }} className="rounded-md border border-[#161A23] px-2 py-1 text-[10px] font-semibold text-[#A1A8B8] hover:bg-[#161A23]">{preset}</button>)}
                </div>
              </div>
              <div className="mt-3 flex justify-between">
                <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="rounded-md px-2 py-1.5 text-xs text-[#A1A8B8] hover:bg-[#161A23]">Clear</button>
                <button type="button" onClick={() => { onChange(selected.toISOString()); setOpen(false); }} className="rounded-md bg-[#818CF8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6366F1]">Apply</button>
              </div>
            </motion.div>
          </>
        </>,
        document.body,
      )}
    </div>
  );
};

export default DateTimePickerPopover;
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getServerNow } from "../../store/globalStore";

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

  useEffect(() => {
    if (open) {
      const next = parsedValue && !Number.isNaN(parsedValue.getTime()) ? parsedValue : getServerNow();
      setSelected(next);
      setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
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
      <button type="button" onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#2b2d31] bg-[#1e1f22] px-3 py-1.5 text-xs font-medium text-[#dbdee1] hover:border-[#3f4147]">
        <CalendarDays size={13} className="text-[#949ba4]" />
        <span className="tabular-nums">{label ?? placeholder}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button type="button" aria-label="Close date picker" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "top left" }}
              className="absolute left-0 top-full z-50 mt-2 w-[292px] rounded-xl border border-[#26282d] bg-[#18191c] p-3 shadow-xl">
              <div className="mb-3">
                <div className="text-sm font-semibold text-[#f2f3f5]">{selected.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                    disabled={!allowPastDates && (visibleMonth.getFullYear() < today.getFullYear() || (visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() <= today.getMonth()))}
                    className="rounded-md p-1.5 text-[#949ba4] hover:bg-[#2b2d31] disabled:opacity-30"><ChevronLeft size={15} /></button>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#dbdee1]">{visibleMonth.toLocaleDateString([], { month: "long", year: "numeric" })}</span>
                  <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                    className="rounded-md p-1.5 text-[#949ba4] hover:bg-[#2b2d31]"><ChevronRight size={15} /></button>
                </div>
              </div>
              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold text-[#787c87]">
                {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => <span key={day} className="py-1">{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[#232428] bg-[#232428]">
                {days.map((day, index) => {
                  if (!day) return <span key={index} className="h-8 bg-[#1a1b1e]" />;
                  const disabled = !allowPastDates && startOfDay(day) < today;
                  const active = dateKey(day) === selectedKey;
                  return <button key={dateKey(day)} type="button" disabled={disabled} onClick={() => chooseDay(day)}
                    className={`h-8 bg-[#2b2d31] text-xs tabular-nums ${disabled ? "cursor-not-allowed bg-[#1a1b1e] text-[#4e5058]" : active ? "bg-[#5865f2] font-bold text-white" : "font-medium text-[#f2f3f5] hover:bg-[#35373c]"}`}>{day.getDate()}</button>;
                })}
              </div>
              <div className="mt-3 border-t border-[#26282d] pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#949ba4]"><Clock size={12} /> TIME</div>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Increase hour" onClick={() => changeTime((selected.getHours() + 1) % 24, selected.getMinutes())}
                    className="h-8 flex-1 rounded-md border border-[#2b2d31] bg-[#232428] text-xs font-semibold tabular-nums text-[#f2f3f5]">{pad(hour12)}</button>
                  <span className="text-xs text-[#949ba4]">:</span>
                  <button type="button" aria-label="Increase minute" onClick={() => changeTime(selected.getHours(), (selected.getMinutes() + 1) % 60)}
                    className="h-8 flex-1 rounded-md border border-[#2b2d31] bg-[#232428] text-xs font-semibold tabular-nums text-[#f2f3f5]">{pad(selected.getMinutes())}</button>
                  <button type="button" onClick={() => changeTime(selected.getHours() >= 12 ? selected.getHours() - 12 : selected.getHours() + 12, selected.getMinutes())}
                    className="h-8 rounded-md border border-[#2b2d31] bg-[#232428] px-3 text-xs font-semibold text-[#f2f3f5]">{selected.getHours() >= 12 ? "PM" : "AM"}</button>
                </div>
              </div>
              <div className="mt-3 flex justify-between">
                <button type="button" onClick={() => onChange(null)} className="rounded-md px-2 py-1.5 text-xs text-[#949ba4] hover:bg-[#2b2d31]">Clear</button>
                <button type="button" onClick={() => { onChange(selected.toISOString()); setOpen(false); }} className="rounded-md bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4752c4]">Apply</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateTimePickerPopover;
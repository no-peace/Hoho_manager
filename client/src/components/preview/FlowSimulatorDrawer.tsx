import React from "react";
import { Play, X, CheckCircle2, GitBranch, MessageSquare, ShieldCheck, ClipboardList } from "lucide-react";
import type { FlowSimulationResult } from "../../utils/flowSimulator";

export interface SimulatorRole {
  id: string;
  name: string;
}

interface FlowSimulatorDrawerProps {
  result: FlowSimulationResult;
  roles: SimulatorRole[];
  heldRoleIds: string[];
  modalFieldIds: string[];
  modalInputs: Record<string, string>;
  onToggleRole: (roleId: string) => void;
  onModalInputChange: (fieldId: string, value: string) => void;
  onClose: () => void;
}

export const FlowSimulatorDrawer: React.FC<FlowSimulatorDrawerProps> = ({
  result,
  roles,
  heldRoleIds,
  modalFieldIds,
  modalInputs,
  onToggleRole,
  onModalInputChange,
  onClose,
}) => (
  <section className="max-h-[48vh] overflow-hidden rounded-t-xl border border-[#272D3A] bg-[#10131A]/[0.98] shadow-2xl backdrop-blur-md">
    <div className="flex items-center justify-between gap-2 border-b border-[#272D3A] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#5865F2]/20 text-[#818CF8]"><Play size={12} /></span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#F1F3F9]">Flow Simulation</p>
          <p className="text-[10px] text-[#A1A8B8]">{result.trace.length} step(s) simulated · no Discord requests sent</p>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close flow simulator" className="rounded-md p-1.5 text-[#A1A8B8] transition-colors hover:bg-[#252B3A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"><X size={14} /></button>
    </div>
    <div className="max-h-[calc(48vh-44px)] space-y-3 overflow-y-auto p-3 custom-scrollbar">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]"><ShieldCheck size={12} /> Simulated Roles</p>
        {roles.length ? (
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => {
              const selected = heldRoleIds.includes(role.id);
              return <button key={role.id} type="button" onClick={() => onToggleRole(role.id)} aria-pressed={selected} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${selected ? "border-[#818CF8]/60 bg-[#818CF8]/20 text-[#F1F3F9]" : "border-[#272D3A] bg-[#161A23] text-[#A1A8B8] hover:text-white"}`}>{role.name}</button>;
            })}
          </div>
        ) : <p className="text-[10px] text-[#A1A8B8]">No cached roles are available for the selected server.</p>}
      </div>

      {modalFieldIds.length > 0 && (
        <div className="space-y-2 rounded-lg border border-[#272D3A] bg-[#161A23] p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]"><ClipboardList size={12} /> Mock modal submission</p>
          {modalFieldIds.map((fieldId) => (
            <label key={fieldId} className="block text-[10px] text-[#A1A8B8]">
              {fieldId}
              <input value={modalInputs[fieldId] ?? ""} onChange={(event) => onModalInputChange(fieldId, event.target.value)} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#10131A] px-2.5 py-1.5 text-xs text-[#F1F3F9] outline-none focus:border-[#818CF8]" />
            </label>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]"><GitBranch size={12} /> Execution trace</p>
        {result.trace.length ? (
          <ol className="space-y-1.5">
            {result.trace.map((entry) => (
              <li key={entry.stepIndex} className="flex gap-2 rounded-md border border-[#272D3A] bg-[#161A23] px-2.5 py-2">
                <span className="mt-0.5 shrink-0 font-mono text-[10px] text-[#818CF8]">#{entry.stepIndex + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase text-[#F1F3F9]">{entry.type.replace(/_/g, " ")} · {entry.status.replace(/_/g, " ")}</p>
                  <p className="mt-0.5 break-words text-[11px] text-[#A1A8B8]">{entry.summary}</p>
                  {entry.previewMessage && <div className="mt-1.5 rounded-md border border-[#272D3A] bg-[#2b2d31] p-2"><p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase text-[#818CF8]"><MessageSquare size={10} /> Simulated {entry.previewMessage.kind}</p><p className="whitespace-pre-wrap break-words text-[11px] text-[#F1F3F9]">{entry.previewMessage.content || "(empty message)"}</p></div>}
                </div>
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#34D399]" />
              </li>
            ))}
          </ol>
        ) : <p className="text-[11px] text-[#A1A8B8]">This component has no configured action steps.</p>}
      </div>
    </div>
  </section>
);

export default FlowSimulatorDrawer;

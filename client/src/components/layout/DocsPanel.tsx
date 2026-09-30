import { BookOpen } from "lucide-react";

export const DocsPanel = () => {
  return (
    <div className="bg-[#2b2d31] p-5 rounded-lg border border-[#1e1f22] shadow-sm font-sans flex flex-col gap-4 text-[#dbdee1] h-full overflow-y-auto custom-scrollbar">
      <h3 className="font-bold uppercase text-xs tracking-wider flex items-center gap-2 mb-2">
        <BookOpen size={16} className="text-[#5865f2]" /> Variable Documentation
      </h3>
      
      <p className="text-[12px] text-[#949ba4] leading-relaxed mb-4">
        You can use these variables in your message content, embeds, and action flows. When a user clicks a button or triggers an action, the bot will dynamically replace them with live data.
      </p>

      {/* User Section */}
      <div className="mb-4">
        <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase border-b border-[#1e1f22] pb-1 mb-2">User</h4>
        <div className="flex flex-col gap-1 text-[12px]">
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{user.mention}'}</code><span className="text-[#949ba4]">Mentions the clicker (@ada).</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{user.id}'}</code><span className="text-[#949ba4]">Their numeric ID.</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{user.name}'}</code><span className="text-[#949ba4]">The exact username.</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{user.displayname}'}</code><span className="text-[#949ba4]">The server nickname.</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{user.avatar}'}</code><span className="text-[#949ba4]">A link to their avatar URL.</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{user.clantag}'}</code><span className="text-[#949ba4]">Extracts [TAG] from their name.</span></div>
        </div>
      </div>

      {/* Server & Channel Section */}
      <div className="mb-4">
        <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase border-b border-[#1e1f22] pb-1 mb-2">Server & Channel</h4>
        <div className="flex flex-col gap-1 text-[12px]">
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{server.id}'}</code><span className="text-[#949ba4]">The server ID.</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{channel.mention}'}</code><span className="text-[#949ba4]">Mentions the current channel.</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{channel.id}'}</code><span className="text-[#949ba4]">The channel ID.</span></div>
        </div>
      </div>

      {/* Time Section */}
      <div className="mb-4">
        <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase border-b border-[#1e1f22] pb-1 mb-2">Time of Click</h4>
        <div className="flex flex-col gap-1 text-[12px]">
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{now}'}</code><span className="text-[#949ba4]">Current time (Oct 24, 12:00 PM).</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{now.relative}'}</code><span className="text-[#949ba4]">Relative (2 minutes ago).</span></div>
            <div className="flex gap-2 items-center"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded w-32 shrink-0">{'{now.long}'}</code><span className="text-[#949ba4]">Long format (Tuesday, Oct 24).</span></div>
        </div>
      </div>
    </div>
  );
};
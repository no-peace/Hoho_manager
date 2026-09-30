import { ArrowLeft, BookOpen } from "lucide-react";

export const DocsPage = () => {
  return (
    <div className="min-h-screen bg-[#313338] text-[#dbdee1] font-sans selection:bg-[#5865f2]/30 selection:text-white pb-20">
      {/* Header */}
      <div className="h-14 flex items-center px-6 border-b border-[#1e1f22] bg-[#2b2d31] sticky top-0 z-50 shadow-sm">
        <a href="/" className="flex items-center gap-2 text-[#b5bac1] hover:text-white transition-colors text-sm font-bold">
          <ArrowLeft size={16} /> Back to Builder
        </a>
        <div className="ml-auto flex items-center gap-2 font-bold text-white">
          <BookOpen size={18} className="text-[#5865f2]" /> Variable Documentation
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-10 px-6">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-white mb-4">Dynamic Variables</h1>
          <p className="text-[#b5bac1] text-base leading-relaxed">
            Variables allow your bot to dynamically inject live data into messages, embeds, and action flows at the exact moment a user clicks a button or triggers an event. We have standardized all variables to use the <code>{'{variable.name}'}</code> syntax.
          </p>
        </div>

        {/* User / Member */}
        <section className="mb-10 bg-[#2b2d31] border border-[#1e1f22] rounded-lg overflow-hidden shadow-sm">
          <h2 className="text-lg font-bold text-white px-5 py-4 border-b border-[#1e1f22] bg-[#1e1f22]/50">User & Member</h2>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[12px] uppercase tracking-wider text-[#949ba4] border-b border-[#1e1f22] bg-[#2b2d31]">
                  <th className="px-5 py-3 font-semibold">Variable</th>
                  <th className="px-5 py-3 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[#1e1f22]">
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{user.mention}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">Mentions the user who interacted with the component.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{user.name}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The member's exact username (e.g., <code>ada</code>).</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{user.displayname}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The member's server nickname or global display name.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{user.id}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The member's numeric Discord ID.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{user.avatar}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">A direct URL link to the member's profile picture.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{user.created}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">When the account was created (Dynamic Discord Timestamp).</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{user.joined}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">When the member joined the server (Relative Timestamp).</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3 flex items-center gap-2"><code className="text-[#23a559] bg-[#1e1f22] border border-[#23a559]/30 px-1.5 py-0.5 rounded font-mono">{'{user.clantag}'}</code> <span className="text-[10px] bg-[#23a559] text-white px-1.5 py-0.5 rounded uppercase font-bold">Custom</span></td>
                  <td className="px-5 py-3 text-[#b5bac1]">Extracts the Clan Tag if their name starts with <code>[TAG]</code>, <code>(TAG)</code>, or <code>{'{TAG}'}</code>.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Server & Channel */}
        <section className="mb-10 bg-[#2b2d31] border border-[#1e1f22] rounded-lg overflow-hidden shadow-sm">
          <h2 className="text-lg font-bold text-white px-5 py-4 border-b border-[#1e1f22] bg-[#1e1f22]/50">Server, Channel & Bot</h2>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <tbody className="text-sm divide-y divide-[#1e1f22]">
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3 w-[30%]"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{server.name}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The name of the server.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{server.id}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The server's numeric ID.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{server.icon}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">A URL link to the server's icon.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{channel.mention}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">Mentions the channel where the interaction occurred.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{channel.id}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The channel's numeric ID.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{bot.mention}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">Mentions the bot executing the action.</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{bot.id}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The bot's numeric ID.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Time */}
        <section className="mb-10 bg-[#2b2d31] border border-[#1e1f22] rounded-lg overflow-hidden shadow-sm">
          <h2 className="text-lg font-bold text-white px-5 py-4 border-b border-[#1e1f22] bg-[#1e1f22]/50">Time & Date</h2>
          <p className="text-xs text-[#949ba4] px-5 py-3 border-b border-[#1e1f22] bg-[#2b2d31]">Note: Except for UNIX, these utilize Discord's dynamic timestamps. Every reader sees them converted to their own local timezone.</p>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <tbody className="text-sm divide-y divide-[#1e1f22]">
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3 w-[30%]"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{now}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">The current time (e.g., 12:00 PM).</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{now.relative}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">Relative time (e.g., 2 minutes ago).</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{now.long}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">Long-form date (e.g., Tuesday, October 24).</td>
                </tr>
                <tr className="hover:bg-[#1e1f22]/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-[#5865f2] bg-[#1e1f22] px-1.5 py-0.5 rounded font-mono">{'{now.unix}'}</code></td>
                  <td className="px-5 py-3 text-[#b5bac1]">Unix time as a plain raw number.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
};

export default DocsPage;
import { useState, useMemo, useEffect } from "react";
import { updatePageSeo } from "../utils/seo";
import { SplitTextReveal, SpotlightCard } from "../components/reactbits/ReactBitsPrimitives";
import { PublicPageHeader } from "../components/layout/PublicPageHeader";
import { UI_THEME_CONFIG } from "../config/uiThemeConfig";
import { motion } from "motion/react";
import {
  Search,
  User,
  Sparkles,
  RefreshCw,
  Code2,
  Terminal,
  Copy,
  Check,
} from "lucide-react";

interface DocItem {
  tag: string;
  desc: string;
  example: string;
  category: "user" | "server" | "time" | "form" | "exploit" | "author";
}

const DOC_ITEMS: DocItem[] = [
  // User & Member
  { tag: "{user.mention}", desc: "Pings/mentions the interacting user (<@id>)", example: "@Nexus42", category: "user" },
  { tag: "{user.name}", desc: "Server nickname, falling back to the account username", example: "Nexus", category: "user" },
  { tag: "{user.tag}", desc: "Alias for the user's username", example: "nexus42", category: "user" },
  { tag: "{user.displayname}", desc: "Discord global display name, falling back to username", example: "Nexus", category: "user" },
  { tag: "{user.id}", desc: "Discord numeric Snowflake ID", example: "708504312862474282", category: "user" },
  { tag: "{user.avatar}", desc: "Direct CDN URL to the user's avatar image", example: "https://cdn.discordapp.com/...", category: "user" },
  { tag: "{user.roles}", desc: "Space-separated list of all role mentions the user has", example: "@Member @VIP", category: "user" },
  { tag: "{user.clantag}", desc: "Official Discord primary-guild tag when the user's identity is enabled; does not require membership in the selected server", example: "HOHO", category: "user" },
  { tag: "{user.created}", desc: "Account creation date formatted in user's local timezone", example: "<t:1571875200:d>", category: "user" },
  { tag: "{user.created.relative}", desc: "Account age as a relative timestamp (e.g. 5 years ago)", example: "<t:1571875200:R>", category: "user" },
  { tag: "{user.joined}", desc: "Server join time as a relative timestamp", example: "<t:1655251200:R>", category: "user" },
  { tag: "{user.joined.date}", desc: "Server join date formatted in user's timezone", example: "<t:1655251200:d>", category: "user" },
  { tag: "{user.<id>.username}", desc: "Discord username of the specified account", example: "nexus42", category: "user" },
  { tag: "{user.<id>.tag}", desc: "Alias for the specified account username", example: "nexus42", category: "user" },
  { tag: "{user.<id>.displayname}", desc: "Global display name, falling back to username", example: "Nexus", category: "user" },
  { tag: "{user.<id>.globalname}", desc: "Alias for the global display name", example: "Nexus", category: "user" },
  { tag: "{user.<id>.profile}", desc: "Direct Discord profile URL", example: "https://discord.com/users/708504312862474282", category: "user" },
  { tag: "{user.<id>.roles}", desc: "Roles held by the specified Discord user in the target server", example: "@Member @VIP", category: "user" },
  { tag: "{user.<id>.clantag}", desc: "Official primary-guild tag when that identity is enabled. Does not require selected-server membership", example: "HOHO", category: "user" },
  { tag: "{user.<id>.created}", desc: "Specified user's account creation date", example: "<t:1571875200:d>", category: "user" },
  { tag: "{user.<id>.created.relative}", desc: "Specified user's account age", example: "<t:1571875200:R>", category: "user" },
  { tag: "{user.<id>.joined}", desc: "Specified user's server join time", example: "<t:1655251200:R>", category: "user" },
  { tag: "{user.<id>.joined.date}", desc: "Specified user's server join date", example: "<t:1655251200:d>", category: "user" },

  // Server & Channel
  { tag: "{server.id}", desc: "Current Discord Guild (Server) ID", example: "906426036772818954", category: "server" },
  { tag: "{server.name}", desc: "Name of the Discord server", example: "HoHo Hub", category: "server" },
  { tag: "{server.icon}", desc: "Direct CDN URL to the server's icon", example: "https://cdn.discordapp.com/icons/...", category: "server" },
  { tag: "{channel.mention}", desc: "Channel mention (<#id>) where interaction occurred", example: "#announcements", category: "server" },
  { tag: "{channel.id}", desc: "Current channel's numeric ID", example: "123456789012345678", category: "server" },
  { tag: "{bot.mention}", desc: "Mentions the bot account dispatching the message", example: "@HoHo Bot", category: "server" },
  { tag: "{bot.id}", desc: "Numeric Application ID of the active bot", example: "112233445566778899", category: "server" },
  { tag: "{message.id}", desc: "Discord message ID of the container message", example: "135792468013579246", category: "server" },
  { tag: "{message.url}", desc: "Direct jump link to the Discord message", example: "https://discord.com/channels/...", category: "server" },

  // Time & Timestamps (All 7 Discord Styles + Aliases)
  { tag: "{now}", desc: "Current short time in user's timezone (<t:unix:t>)", example: "12:00 PM", category: "time" },
  { tag: "{now.t}", desc: "Discord Style :t — Short Time (<t:unix:t>)", example: "12:00 PM", category: "time" },
  { tag: "{now.T}", desc: "Discord Style :T — Long Time with seconds (<t:unix:T>)", example: "12:00:45 PM", category: "time" },
  { tag: "{now.time}", desc: "Long Time with seconds (<t:unix:T>)", example: "12:00:45 PM", category: "time" },
  { tag: "{now.short_time}", desc: "Short Time (<t:unix:t>)", example: "12:00 PM", category: "time" },
  { tag: "{now.d}", desc: "Discord Style :d — Short Date (<t:unix:d>)", example: "11/11/2026", category: "time" },
  { tag: "{now.date}", desc: "Long Date (<t:unix:D>)", example: "November 11, 2026", category: "time" },
  { tag: "{now.short_date}", desc: "Short Date (<t:unix:d>)", example: "11/11/2026", category: "time" },
  { tag: "{now.D}", desc: "Discord Style :D — Long Date (<t:unix:D>)", example: "November 11, 2026", category: "time" },
  { tag: "{now.longdate}", desc: "Alias for Long Date (<t:unix:D>)", example: "November 11, 2026", category: "time" },
  { tag: "{now.datetime}", desc: "Long Date & Time (<t:unix:F>)", example: "Wednesday, November 11, 2026 12:00 PM", category: "time" },
  { tag: "{now.short_datetime}", desc: "Short Date & Time (<t:unix:f>)", example: "Nov 11, 2026 12:00 PM", category: "time" },
  { tag: "{now.f}", desc: "Discord Style :f — Short Date/Time (<t:unix:f>)", example: "November 11, 2026 12:00 PM", category: "time" },
  { tag: "{now.short}", desc: "Alias for Short Date/Time (<t:unix:f>)", example: "Nov 11, 2026 12:00 PM", category: "time" },
  { tag: "{now.F}", desc: "Discord Style :F — Long Weekday, Date & Time (<t:unix:F>)", example: "Wednesday, November 11, 2026 12:00 PM", category: "time" },
  { tag: "{now.long}", desc: "Alias for Long Weekday, Date & Time (<t:unix:F>)", example: "Wednesday, Nov 11, 2026 12:00 PM", category: "time" },
  { tag: "{now.R}", desc: "Discord Style :R — Relative Time (<t:unix:R>)", example: "in a few seconds / 2 mins ago", category: "time" },
  { tag: "{now.relative}", desc: "Alias for Relative Time (<t:unix:R>)", example: "just now", category: "time" },
  { tag: "{now.unix}", desc: "Raw numeric Unix epoch timestamp in seconds", example: "1794380400", category: "time" },
  { tag: "{now.iso}", desc: "ISO-8601 UTC timestamp string", example: "2026-11-11T12:00:00.000Z", category: "time" },
  { tag: "{timestamp}", desc: "Alias for the long date and time timestamp (<t:unix:F>)", example: "Wednesday, November 11, 2026 12:00 PM", category: "time" },

  // Forms, Modals & Select Menus
  { tag: "{selected}", desc: "Comma-separated list of values selected in a dropdown", example: "opt_vip, opt_beta", category: "form" },
  { tag: "{selected.0}", desc: "The first value chosen in a single or multi-select dropdown", example: "opt_vip", category: "form" },
  { tag: "{input.<custom_id>}", desc: "Submitted text value from a modal input with matching custom ID", example: "My Feedback", category: "form" },
  { tag: "{modal.<custom_id>}", desc: "Alias for modal input field value", example: "user_email@domain.com", category: "form" },

  // WEAO & Custom Exploits (Chained `{exploit.<Name>.<Field>}` & Default `{exploit.<Field>}`)
  { tag: "{exploit.Delta.status}", desc: "Status badge with circle for a specific exploit", example: "🟢 Updated", category: "exploit" },
  { tag: "{exploit.Delta.circle}", desc: "Status indicator circle only (🟢 or 🔴)", example: "🟢", category: "exploit" },
  { tag: "{exploit.Delta.statusText}", desc: "Status word only (Updated or Outdated)", example: "Updated", category: "exploit" },
  { tag: "{exploit.Delta.version}", desc: "Current live version string of the named exploit", example: "v2.652", category: "exploit" },
  { tag: "{exploit.Delta.rbxversion}", desc: "Target Roblox client version hash", example: "version-9045f7465...", category: "exploit" },
  { tag: "{exploit.Delta.sunc}", desc: "sUNC percentage score", example: "100%", category: "exploit" },
  { tag: "{exploit.Delta.unc}", desc: "UNC percentage score", example: "99%", category: "exploit" },
  { tag: "{exploit.Delta.updatedDate}", desc: "Last updated date string from WEAO", example: "11/11/2026, 10:15:00 AM UTC", category: "exploit" },
  { tag: "{exploit.Delta.detected}", desc: "Detection status (Detected / Undetected)", example: "Undetected", category: "exploit" },
  { tag: "{exploit.Delta.free}", desc: "Pricing tier (Free or Paid / cost)", example: "Free", category: "exploit" },
  { tag: "{exploit.Delta.platform}", desc: "Target OS / Platform", example: "Android / iOS / Windows", category: "exploit" },
  { tag: "{exploit.Delta.decompiler}", desc: "Decompiler support badge (✅ or ❌)", example: "✅", category: "exploit" },
  { tag: "{exploit.Delta.multiInject}", desc: "Multi-inject support badge (✅ or ❌)", example: "✅", category: "exploit" },
  { tag: "{exploit.Delta.keysystem}", desc: "Key system status (Key System / Keyless)", example: "Key System", category: "exploit" },
  { tag: "{exploit.Delta.websitelink}", desc: "Official website URL", example: "https://deltaexploits.gg", category: "exploit" },
  { tag: "{exploit.Delta.discordlink}", desc: "Official Discord invite link", example: "https://discord.gg/...", category: "exploit" },
  { tag: "{exploit.Delta.changelogs}", desc: "Formatted WEAO changelog entries for the named exploit", example: "• New version released — Fixed injection", category: "exploit" },
  { tag: "{exploit.<trackerId>.changelogs}", desc: "Formatted WEAO changelog entries fetched by tracker ID", example: "• Release 1 — Fixed injection", category: "exploit" },
  { tag: "{exploit.Delta.changelogs[0:3]}", desc: "Only the first three changelog entries (zero-based slice)", example: "• Entry 1\\n• Entry 2\\n• Entry 3", category: "exploit" },
  { tag: "{exploit.Delta.changelogs[2]}", desc: "Only the third changelog entry (zero-based index)", example: "• Entry 3", category: "exploit" },
  { tag: "{exploit.Solara.changelogs[-3:]}", desc: "Only the latest three changelog entries", example: "• Latest entry 1\\n• Latest entry 2\\n• Latest entry 3", category: "exploit" },
  { tag: "{exploit.Delta.changelogs.compare}", desc: "Compare the latest WEAO changelog snapshot with the previous check and show added or removed entries", example: "New entries / Removed entries", category: "exploit" },
  { tag: "{exploit.Delta.purchaselink}", desc: "Official purchase URL", example: "https://...", category: "exploit" },

  // Dynamic Author Auto-Resolution
  { tag: "{user.<id>.name}", desc: "Server nickname when the user belongs to the selected server; otherwise their account username", example: "Nexus42", category: "author" },
  { tag: "{user.<id>.avatar}", desc: "Fetches user's current avatar CDN link (auto-updates when they change pfp)", example: "https://cdn.discordapp.com/avatars/...", category: "author" },
  { tag: "{user.<id>.url}", desc: "Direct profile link to the user (https://discord.com/users/<id>)", example: "https://discord.com/users/708504312862474282", category: "author" },
  { tag: "{user.<id>.mention}", desc: "Pings/mentions the specific user by ID (<@id>)", example: "<@708504312862474282>", category: "author" },
];

export const DocsPage = () => {
  useEffect(() => {
    updatePageSeo({ title: "HoHo Manager Docs — Variables & Dynamic Tracking", description: "Complete reference for HoHo Manager dynamic variables, tracking, and interactive flows.", path: "/docs", schemaType: "TechArticle" });
  }, []);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const copyToClipboard = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedTag(tag);
      window.setTimeout(() => setCopiedTag((current) => current === tag ? null : current), 1500);
    } catch {
      setCopiedTag(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return DOC_ITEMS.filter((item) => {
      const matchesCat = activeCategory === "all" || item.category === activeCategory;
      const matchesQuery =
        !q ||
        item.tag.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.example.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [search, activeCategory]);

  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar bg-[#0B0D12] text-[#F1F3F9] font-sans selection:bg-[#818CF8]/30 selection:text-white pb-24">
      <PublicPageHeader activePage="docs" />

      <div className="max-w-6xl mx-auto mt-8 px-4 sm:px-6">
        {/* Hero Section */}
        <div className="mb-8 rounded-xl bg-[#161A23] border border-[#272D3A] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[#818CF8] font-bold text-xs uppercase tracking-wider mb-2">
            <Sparkles size={14} /> FULL SYSTEM GUIDE & REFERENCE
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            <SplitTextReveal text="Variables, Dynamic Tracking & Executors" />
          </h1>
          <p className="text-[#A1A8B8] text-sm leading-relaxed max-w-3xl">
            HoHo Manager supports live dynamic variables, executor status interpolation, and automatic author profile resolution.
            Use <code className="text-[#A78BFA] font-mono bg-[#1D2230] px-1.5 py-0.5 rounded font-bold">{"{variable}"}</code> anywhere in message content, embeds, buttons, or action flows.
            Interaction variables such as <code>{"{user.avatar}"}</code> refer to the user who triggered the interaction; ID-based variables such as <code>{"{user.<id>.avatar}"}</code> fetch another Discord account. Roles and join dates require selected-server membership; primary-guild clan tags do not. Interaction-user clan tags also retain legacy nickname parsing.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <section className="p-4 rounded-xl bg-[#161A23] border border-[#1D2230]">
            <h2 className="flex items-center gap-2 text-[#A78BFA] font-bold text-xs uppercase tracking-wider mb-1.5">
              <User size={14} /> Author Profile Auto-Fetch
            </h2>
            <p className="text-xs text-[#A1A8B8] leading-relaxed">
              Set embed author URL to <code className="text-white bg-[#1D2230] px-1 rounded">https://discord.com/users/USER_ID</code>.
              The bot automatically fetches their username, avatar pfp, and Discord link, and keeps them
            </p>
          </section>

          <SpotlightCard className="p-4 rounded-xl bg-[#161A23] border border-[#1D2230]">
            <h2 className="flex items-center gap-2 text-[#34D399] font-bold text-xs uppercase tracking-wider mb-1.5">
              <RefreshCw size={14} /> Live Message Auto-Tracking
            </h2>
            <p className="text-xs text-[#A1A8B8] leading-relaxed">
              Messages containing <code className="text-white bg-[#1D2230] px-1 rounded">{"{exploit.*}"}</code> or developer author tokens are auto-registered into the tracking daemon.
              When status or profiles change, the bot automatically edits existing messages.
            </p>
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl bg-[#161A23] border border-[#1D2230]">
            <h2 className="flex items-center gap-2 text-[#FBBF24] font-bold text-xs uppercase tracking-wider mb-1.5">
              <Terminal size={14} /> Slash Commands & Sync
            </h2>
            <p className="text-xs text-[#A1A8B8] leading-relaxed">
              Use <code className="text-white bg-[#1D2230] px-1 rounded">/exploit</code> to send customized executor status cards with custom templates, and <code className="text-white bg-[#1D2230] px-1 rounded">/sync</code> to immediately reconcile all tracked messages in your server.
            </p>
          </SpotlightCard>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-6">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-2.5 text-[#A1A8B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variables or syntax..."
              className="w-full bg-[#1D2230] text-xs text-[#F1F3F9] pl-9 pr-3 py-2 rounded-lg border border-[#161A23] focus:border-[#818CF8] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All" },
              { id: "user", label: "User" },
              { id: "server", label: "Server" },
              { id: "time", label: "Time" },
              { id: "form", label: "Forms & Modals" },
              { id: "exploit", label: "Exploits" },
              { id: "author", label: "Author Resolution" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeCategory === cat.id
                    ? "text-white"
                    : "text-[#A1A8B8] hover:text-white bg-[#161A23] border border-[#1D2230] hover:bg-[#252B3A]"
                }`}
              >
                {activeCategory === cat.id && (
                  <motion.span
                    layoutId="docsCategoryPill"
                    className="absolute inset-0 rounded-lg bg-[#818CF8]"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  />
                )}
                <span className="relative z-10">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Variables Table */}
        <SpotlightCard className={UI_THEME_CONFIG.surfaces.docsTableCard}>
          <div className={UI_THEME_CONFIG.surfaces.docsTableHeader}>
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A8B8]">
              Available Variables ({filteredItems.length})
            </span>
            <span className="text-[11px] text-[#A1A8B8]">Copy a variable tag with the copy icon</span>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[#A1A8B8] border-b border-[#1D2230] bg-[#1D2230]">
                  <th className="px-5 py-3 font-semibold w-[28%]">Variable Tag</th>
                  <th className="px-5 py-3 font-semibold">Description</th>
                  <th className="px-5 py-3 font-semibold w-[24%]">Output Example</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-[#1D2230]">
                {filteredItems.map((item) => (
                  <tr key={item.tag} className="hover:bg-[#1D2230]/40 transition-colors">
                    <td className="px-5 py-3 font-mono">
                      <button type="button" onClick={() => void copyToClipboard(item.tag)} className={UI_THEME_CONFIG.surfaces.docsCopyButton} title={copiedTag === item.tag ? "Copied" : "Copy variable"} aria-label={copiedTag === item.tag ? `Copied ${item.tag}` : `Copy ${item.tag}`}>
                        <span>{item.tag}</span>{copiedTag === item.tag ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-[#F1F3F9] leading-relaxed">{item.desc}</td>
                    <td className="px-5 py-3 font-mono text-[#A1A8B8] break-all max-w-[200px]">{item.example}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 && <tr><td colSpan={3} className="px-5 py-8 text-center text-[#A1A8B8]">No variables matching &ldquo;{search}&rdquo; in this category.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {filteredItems.map((item) => (
              <article key={item.tag} className={UI_THEME_CONFIG.surfaces.docsVariableCard}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <code className="min-w-0 break-all text-xs font-semibold text-[#A5B4FC]">{item.tag}</code>
                  <button type="button" onClick={() => void copyToClipboard(item.tag)} className="shrink-0 rounded-md border border-[#818CF8]/40 bg-[#1D2230] p-2 text-[#A5B4FC] hover:bg-[#252B3A]" title={copiedTag === item.tag ? "Copied" : "Copy variable"} aria-label={copiedTag === item.tag ? `Copied ${item.tag}` : `Copy ${item.tag}`}>
                    {copiedTag === item.tag ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#F1F3F9]">{item.desc}</p>
                <p className="mt-2 break-all rounded bg-[#10131A] p-2 font-mono text-[11px] text-[#A1A8B8]">{item.example}</p>
              </article>
            ))}
            {filteredItems.length === 0 && <p className="py-8 text-center text-xs text-[#A1A8B8]">No variables matching &ldquo;{search}&rdquo; in this category.</p>}
          </div>
        </SpotlightCard>

        {/* Custom Executor Configuration Guide */}
        <section className="p-6 rounded-xl bg-[#161A23] border border-[#272D3A] space-y-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-white font-bold text-base">
            <Code2 size={18} className="text-[#A78BFA]" /> Custom Executor Payloads & Auto-Updates
          </h2>
          <p className="text-xs text-[#A1A8B8] leading-relaxed">
            You can fully customize executor messages by creating custom executor templates.
            Provide your own Discohook/Discord JSON payload. The bot inspects embed authors and auto-fetches the owner&apos;s name and avatar directly from Discord.
          </p>

          <div className="bg-[#1D2230] rounded-xl p-4 border border-[#10131A] font-mono text-xs text-[#F1F3F9] overflow-x-auto">
            <pre className="text-[11px] leading-relaxed text-[#A1A8B8]">
{`{
  "embeds": [
    {
      "description": "# Macsploit\\n> **Status:** {exploit.status}\\n> Paid **$10 Lifetime**",
      "color": 15329769,
      "footer": { "text": ".gg/hohohub" },
      "author": {
        "name": "{user.708504312862474282.name}",
        "url": "{user.708504312862474282.url}"
      }
    }
  ]
}`}
            </pre>
          </div>
          <p className="text-[11px] text-[#A1A8B8]">
            💡 Notice that the <code className="text-white font-mono bg-[#10131A] px-1 rounded">author.name</code> and <code className="text-white font-mono bg-[#10131A] px-1 rounded">author.icon_url</code> are omitted: When the message is sent, the server attempts to fetch the Discord user and fills blank author name and icon fields. The live editor preview does not fetch Discord profiles. If Discord lookup fails, the original author values are kept.
          </p>
        </section>

        {/* Internal Links & Official Backlinks Footer */}
        <footer className="mt-10 pt-6 border-t border-[#272D3A] flex flex-wrap items-center justify-between gap-4 text-xs text-[#A1A8B8]">
          <div className="flex items-center gap-4">
            <a href="/" className="hover:text-white transition-colors font-semibold">Studio Builder</a>
            <a href="/docs" className="text-[#A78BFA] font-semibold">Documentation</a>
            <a href="/privacy" className="hover:text-white transition-colors font-semibold">Privacy &amp; Bot Policy</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://discord.gg/hohohub" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">HoHo Hub Discord</a>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default DocsPage;

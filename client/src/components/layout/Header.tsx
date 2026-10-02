import { MessageSquare } from "lucide-react";

export const Header = () => {
  return (
    <header className="h-12 shrink-0 flex items-center justify-between border-b border-[#111214] bg-[#1e1f22] px-4 z-20 font-sans">
      <div className="flex items-center gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="bg-[#5865f2] text-white p-1 rounded">
             <MessageSquare size={16} fill="currentColor" />
          </div>
        </div>

        {/* Navigation & Profile */}
        <div className="flex items-center gap-2">
          <button className="hidden sm:flex text-[13px] font-bold text-[#dbdee1] items-center gap-2 hover:bg-[#2b2d31] px-2 py-1 rounded transition-colors">
             <div className="w-5 h-5 rounded-full bg-[#f28b8b] border border-[#1e1f22]"></div>
             Peace
          </button>
          <button className="text-[13px] font-medium text-[#b5bac1] hover:text-[#dbdee1] border border-[#35373c] bg-[#2b2d31] px-3 py-1 rounded-full transition-colors">Settings</button>
          <button className="text-[13px] font-medium text-[#b5bac1] hover:text-[#dbdee1] border border-[#35373c] bg-[#2b2d31] px-3 py-1 rounded-full transition-colors hidden sm:block">History</button>
          <a href="/docs" className="text-[13px] font-medium text-[#b5bac1] hover:text-[#dbdee1] border border-[#35373c] bg-[#2b2d31] px-3 py-1 rounded-full transition-colors">Docs</a>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-3">
         <button className="text-[13px] font-medium text-[#b5bac1] hover:text-[#dbdee1] border border-[#35373c] bg-[#2b2d31] px-3 py-1 rounded-full transition-colors hidden sm:block">Help</button>
         <button className="text-[13px] font-medium text-white bg-[#5865f2] hover:bg-[#4752c4] px-4 py-1 rounded-full transition-colors shadow-sm">Donate</button>
      </div>
    </header>
  );
};

export default Header;
import { useState, useEffect } from "react";
import { Trash2, Save, Users } from "lucide-react";
import { useProfileStore } from "../../store/profileStore";

export const ProfilesPanel = () => {
  const { botProfiles, fetchProfiles, status } = useProfileStore();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const handleSave = async () => {
    if (!name.trim() || !token.trim() || !applicationId.trim() || !publicKey.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "";

      const response = await fetch(`${baseUrl}/api/profiles/bots`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-key": adminKey 
        },
        body: JSON.stringify({ name: name.trim(), token: token.trim(), applicationId: applicationId.trim(), publicKey: publicKey.trim() })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result && typeof result.error === "string"
            ? result.error
            : `Could not save bot profile (${response.status})`,
        );
      }

      setName("");
      setToken("");
      setApplicationId("");
      setPublicKey("");
      void fetchProfiles();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this bot profile?")) return;
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "";
      
      await fetch(`${baseUrl}/api/profiles/bots/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey }
      });
      
      void fetchProfiles();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="bg-[#2b2d31] p-5 rounded-lg border border-[#1e1f22] shadow-sm font-sans flex flex-col gap-5">
      <h3 className="font-bold text-[#dbdee1] uppercase text-xs tracking-wider flex items-center gap-2">
        <Users size={16} className="text-[#5865f2]" />
        Bot Profiles
      </h3>

      {/* Add New Profile Form */}
      <div className="bg-[#1e1f22] p-4 rounded border border-[#111214] space-y-3">
        <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase">Add New Bot</h4>
        
        <div>
          <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Profile Name</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#2b2d31] text-[#dbdee1] border border-[#111214] rounded p-2 text-sm focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] outline-none transition-all"
            placeholder="e.g. Production Bot"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Bot Token</label>
          <input 
            type="password" 
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-[#2b2d31] text-[#dbdee1] border border-[#111214] rounded p-2 text-sm focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] outline-none transition-all"
            placeholder="Paste Discord Bot Token here"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Application ID</label>
          <input
            type="text"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="w-full bg-[#2b2d31] text-[#dbdee1] border border-[#111214] rounded p-2 text-sm focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] outline-none transition-all"
            placeholder="Discord application ID"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Public Key</label>
          <input
            type="text"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            className="w-full bg-[#2b2d31] text-[#dbdee1] border border-[#111214] rounded p-2 text-sm focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] outline-none transition-all"
            placeholder="Discord application public key"
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={!name.trim() || !token.trim() || !applicationId.trim() || !publicKey.trim() || isSaving}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} /> {isSaving ? "Saving..." : "Save Bot Profile"}
        </button>
        {saveError && <p className="text-[11px] text-[#f28b8b]">{saveError}</p>}
        <p className="text-[10px] text-[#949ba4] mt-2 text-center">Tokens are encrypted and stored securely in your server's database.</p>
      </div>

      {/* Saved Profiles List */}
      <div className="space-y-2 mt-2">
        <h4 className="text-[12px] font-bold text-[#b5bac1] uppercase mb-3">Saved Bots</h4>
        
        {status === "loading" ? (
          <p className="text-[12px] text-[#949ba4]">Loading profiles...</p>
        ) : botProfiles.length === 0 ? (
          <p className="text-[12px] text-[#949ba4] bg-[#1e1f22] p-3 rounded text-center border border-[#111214]">No custom bots saved yet.</p>
        ) : (
          botProfiles.map(profile => (
            <div key={profile.id} className="flex items-center justify-between bg-[#1e1f22] p-3 rounded border border-[#111214]">
              <span className="text-sm font-medium text-[#dbdee1]">{profile.name}</span>
              <button 
                onClick={() => handleDelete(profile.id)}
                className="text-[#f28b8b] hover:text-[#da373c] p-1.5 rounded hover:bg-[#da373c]/10 transition-colors"
                title="Delete Profile"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
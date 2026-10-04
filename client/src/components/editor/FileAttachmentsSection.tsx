import React, { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Paperclip,
  Trash2,
  Upload,
  AlertCircle,
  FileText,
  Film,
  Link2,
  Music,
  Plus,
  X,
} from "lucide-react";
import { useMessageStore, type AttachedFile } from "../../store/messageStore";

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileAttachmentsSection: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const addFiles = useMessageStore((state) => state.addFiles);
  const addUrlAttachment = useMessageStore((state) => state.addUrlAttachment);
  const removeFile = useMessageStore((state) => state.removeFile);
  const toggleFileSpoiler = useMessageStore((state) => state.toggleFileSpoiler);

  const handleAddUrl = () => {
    setUrlError(null);
    const value = urlValue.trim();
    if (!/^https?:\/\//i.test(value)) {
      setUrlError("Enter a valid http(s) URL.");
      return;
    }
    if (attachedFiles.length >= MAX_FILES) {
      setUrlError(`Maximum ${MAX_FILES} attachments allowed per message.`);
      return;
    }
    addUrlAttachment(value);
    setUrlValue("");
    setUrlOpen(false);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);
    const files = Array.from(fileList);

    if (attachedFiles.length + files.length > MAX_FILES) {
      setErrorMsg(`Maximum ${MAX_FILES} attachments allowed per message.`);
      return;
    }

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setErrorMsg(`File "${oversized[0].name}" exceeds the 25 MB limit.`);
      return;
    }

    addFiles(files);
  };

  const renderFileThumbnail = (file: AttachedFile) => {
    if (file.type.startsWith("image/")) {
      return (
        <img
          src={file.previewUrl}
          alt={file.name}
          className="object-contain w-full h-full max-h-full rounded m-auto select-none"
        />
      );
    }
    if (file.url) {
      return (
        <div className="flex flex-col items-center justify-center text-[#949ba4] gap-1">
          <Link2 size={26} />
          <span className="text-[9px] uppercase font-bold">URL</span>
        </div>
      );
    }
    if (file.type.startsWith("video/")) {
      return (
        <div className="flex flex-col items-center justify-center text-[#949ba4] gap-1">
          <Film size={26} />
          <span className="text-[9px] uppercase font-bold">Video</span>
        </div>
      );
    }
    if (file.type.startsWith("audio/")) {
      return (
        <div className="flex flex-col items-center justify-center text-[#949ba4] gap-1">
          <Music size={26} />
          <span className="text-[9px] uppercase font-bold">Audio</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center text-[#949ba4] gap-1">
        <FileText size={26} />
        <span className="text-[9px] uppercase font-bold">Document</span>
      </div>
    );
  };

  return (
    <section className="bg-[#1e1f22] rounded-lg border border-[#111214] overflow-hidden">
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left text-xs font-bold text-[#949ba4] hover:text-[#dbdee1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
      >
        <span className="flex items-center gap-2 uppercase tracking-wider text-[11px] text-[#dbdee1]">
          <Paperclip size={14} className="text-[#5865f2]" />
          <span>Files ({attachedFiles.length}/{MAX_FILES})</span>
        </span>
        <div className="flex items-center gap-2">
          {attachedFiles.length < MAX_FILES && (
            <>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setUrlOpen((v) => !v);
                  setUrlError(null);
                }}
                className="text-[11px] font-semibold text-[#5865f2] hover:underline cursor-pointer normal-case flex items-center gap-1"
              >
                <Link2 size={11} /> Add URL
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-[11px] font-semibold text-[#5865f2] hover:underline cursor-pointer normal-case"
              >
                + Add File
              </span>
            </>
          )}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {open && (
        <div className="p-3 pt-0 border-t border-[#111214] space-y-3 mt-1">
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = ""; // Reset so same file can be re-selected if deleted
            }}
          />

          {/* Add Attachment by External URL (Discohook-style) */}
          {urlOpen && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5 items-center">
                <Link2 size={14} className="text-[#949ba4] shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddUrl();
                    if (e.key === "Escape") setUrlOpen(false);
                  }}
                  placeholder="https://example.com/image.png"
                  className="flex-1 min-w-0 bg-[#1e1f22] border border-[#111214] text-[#dbdee1] text-xs px-2.5 py-1.5 rounded outline-none focus:border-[#5865f2] placeholder-[#6d6f78]"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  disabled={urlValue.trim() === ""}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Plus size={13} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUrlOpen(false);
                    setUrlValue("");
                    setUrlError(null);
                  }}
                  className="p-1.5 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors shrink-0"
                  title="Cancel"
                  aria-label="Cancel adding URL"
                >
                  <X size={13} />
                </button>
              </div>
              {urlError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={12} /> {urlError}
                </p>
              )}
              <p className="text-[10px] text-[#6d6f78]">
                External URLs are downloaded by the server and forwarded to Discord as real attachments.
              </p>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-3.5 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-[#5865f2] bg-[#5865f2]/10"
                : "border-[#35373c] hover:border-[#4e5058] bg-[#2b2d31]/40 hover:bg-[#2b2d31]/80"
            }`}
          >
            <Upload size={18} className="mx-auto text-[#949ba4] mb-1.5" />
            <p className="text-xs font-medium text-[#dbdee1]">
              Drag & drop files here, or <span className="text-[#5865f2] hover:underline">browse</span>
            </p>
            <p className="text-[10px] text-[#949ba4] mt-0.5">
              Images, videos, audio, or documents up to 25 MB each (up to 10 files).
            </p>
          </div>

          {/* Attached Files List (Horizontal scroll cards) */}
          {attachedFiles.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 custom-scrollbar">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="relative group rounded-lg bg-[#2b2d31] border border-[#35373c] p-2 w-32 shrink-0 flex flex-col justify-between hover:border-[#4e5058] transition-colors"
                >
                  {/* Media Thumbnail Container */}
                  <div className="w-full aspect-[1.15/1] rounded bg-[#1e1f22] flex relative overflow-hidden items-center justify-center p-1">
                    {renderFileThumbnail(file)}

                    {/* Spoiler Overlay */}
                    {file.spoiler && (
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex items-center justify-center z-10 pointer-events-none">
                        <span className="text-[9px] font-bold text-white uppercase tracking-wider bg-black/70 px-2 py-0.5 rounded-full border border-white/20">
                          Spoiler
                        </span>
                      </div>
                    )}

                    {/* Action buttons (top right overlay) */}
                    <div className="absolute top-1 right-1 flex gap-1 bg-[#1e1f22]/90 rounded p-0.5 opacity-90 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFileSpoiler(file.id);
                        }}
                        title={file.spoiler ? "Remove spoiler" : "Mark as spoiler"}
                        className={`p-1 rounded transition-colors ${
                          file.spoiler
                            ? "text-[#5865f2] hover:text-[#4752c4]"
                            : "text-[#949ba4] hover:text-white"
                        }`}
                      >
                        {file.spoiler ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        title="Delete file"
                        className="p-1 rounded text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/15 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Metadata labels */}
                  <div className="mt-1.5 min-w-0">
                    <p
                      className="text-[11px] font-medium text-[#dbdee1] truncate leading-tight"
                      title={file.url ?? file.name}
                    >
                      {file.spoiler ? `SPOILER_${file.name}` : file.name}
                    </p>
                    <p className="text-[10px] text-[#949ba4] mt-0.5 flex items-center gap-1">
                      {file.url ? (
                        <>
                          <Link2 size={10} /> External URL
                        </>
                      ) : (
                        formatBytes(file.size)
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default FileAttachmentsSection;

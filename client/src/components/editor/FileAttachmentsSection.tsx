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
  const [isOpen, setIsOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlErrorMessage, setUrlErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const addFiles = useMessageStore((state) => state.addFiles);
  const addUrlAttachment = useMessageStore((state) => state.addUrlAttachment);
  const removeFile = useMessageStore((state) => state.removeFile);
  const toggleFileSpoiler = useMessageStore((state) => state.toggleFileSpoiler);

  const handleAddUrl = () => {
    setUrlErrorMessage(null);
    const value = urlValue.trim();
    if (!/^https?:\/\//i.test(value)) {
      setUrlErrorMessage("Enter a valid http(s) URL.");
      return;
    }
    if (attachedFiles.length >= MAX_FILES) {
      setUrlErrorMessage(`Maximum ${MAX_FILES} attachments allowed per message.`);
      return;
    }
    addUrlAttachment(value);
    setUrlValue("");
    setUrlOpen(false);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);
    const files = Array.from(fileList);

    if (attachedFiles.length + files.length > MAX_FILES) {
      setErrorMessage(`Maximum ${MAX_FILES} attachments allowed per message.`);
      return;
    }

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setErrorMessage(`File "${oversized[0].name}" exceeds the 25 MB limit.`);
      return;
    }

    addFiles(files);
  };

  const renderFileThumbnail = (file: AttachedFile) => {
    const isUrl = Boolean(file.url && !file.file);
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");

    if (isImage) {
      return (
        <img
          src={file.previewUrl}
          alt={file.name}
          className="h-full w-full object-cover rounded"
        />
      );
    }
    if (isVideo) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#1e1f22] text-[#949ba4]">
          <Film size={24} />
        </div>
      );
    }
    if (isAudio) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#1e1f22] text-[#949ba4]">
          <Music size={24} />
        </div>
      );
    }
    if (isUrl) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#1e1f22] text-[#949ba4]">
          <Link2 size={24} />
        </div>
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1e1f22] text-[#949ba4]">
        <FileText size={24} />
      </div>
    );
  };

  return (
    <section className="rounded-lg border border-[#202225] bg-[#202225]/40 overflow-hidden text-xs">
      {/* ── Section Trigger Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#202225]">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#dbdee1] hover:text-white"
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Files</span>
          {attachedFiles.length > 0 && (
            <span className="rounded bg-[#5865f2] px-1.5 py-0.2 text-[10px] font-bold text-white">
              {attachedFiles.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setUrlOpen(!urlOpen)}
            className="flex items-center gap-1 rounded bg-[#35373c] px-2 py-1 text-[11px] font-medium text-[#dbdee1] hover:bg-[#404249] hover:text-white transition-colors"
          >
            <Link2 size={12} />
            <span>Add URL</span>
          </button>
          <button
            type="button"
            disabled={attachedFiles.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded bg-[#5865f2] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#4752c4] disabled:opacity-40 transition-colors"
          >
            <Upload size={12} />
            <span>Upload</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {isOpen && (
        <div className="p-3 space-y-3">
          {/* External URL attachment bar */}
          {urlOpen && (
            <div className="flex items-center gap-2 rounded bg-[#1e1f22] p-2 border border-[#2b2d31]">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddUrl();
                }}
                placeholder="https://example.com/image.png"
                className="flex-1 rounded bg-[#2b2d31] px-2 py-1 text-xs text-[#dbdee1] placeholder-[#949ba4]/50 outline-none ring-1 ring-transparent focus:ring-[#5865f2]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="rounded bg-[#5865f2] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4752c4]"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlOpen(false);
                  setUrlErrorMessage(null);
                }}
                className="p-1 text-[#949ba4] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {urlErrorMessage && (
            <p className="flex items-center gap-1 text-[11px] text-[#da373c]">
              <AlertCircle size={12} /> {urlErrorMessage}
            </p>
          )}

          {errorMessage && (
            <p className="flex items-center gap-1 text-[11px] text-[#da373c]">
              <AlertCircle size={12} /> {errorMessage}
            </p>
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
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              isDragging
                ? "border-[#5865f2] bg-[#5865f2]/10"
                : "border-[#35373c] bg-[#1e1f22]/50 hover:border-[#4e5058] hover:bg-[#1e1f22]"
            }`}
          >
            <Paperclip size={20} className="mb-1 text-[#949ba4]" />
            <p className="text-xs font-medium text-[#dbdee1]">
              Drop files here or <span className="text-[#5865f2]">browse</span>
            </p>
            <p className="mt-0.5 text-[10px] text-[#949ba4]">
              Up to 10 files, max 25 MB each. Supports images, audio, video, documents.
            </p>
          </div>

          {/* Attachments List */}
          {attachedFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex flex-col rounded border border-[#2b2d31] bg-[#1e1f22] p-2"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded bg-[#111214]">
                    {renderFileThumbnail(file)}

                    {/* Action buttons overlay */}
                    <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFileSpoiler(file.id);
                        }}
                        title={file.spoiler ? "Remove spoiler" : "Mark as spoiler"}
                        className={`rounded p-1 text-white shadow backdrop-blur-sm transition-colors ${
                          file.spoiler
                            ? "bg-[#5865f2] hover:bg-[#4752c4]"
                            : "bg-black/60 hover:bg-black/80"
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
                        title="Remove file"
                        className="rounded bg-black/60 p-1 text-white shadow backdrop-blur-sm hover:bg-[#da373c] transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {file.spoiler && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none">
                        <span className="rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
                          SPOILER
                        </span>
                      </div>
                    )}
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

export default React.memo(FileAttachmentsSection);
import React, { useEffect, useRef, useState } from "react";
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
import { useGlobalStore } from "../../store/globalStore";

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileAttachmentsSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
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

  useEffect(() => {
    if (attachedFiles.length > 0) setIsOpen(true);
  }, [attachedFiles.length]);

  const handleAddUrl = () => {
    setUrlErrorMessage(null);
    const value = urlValue.trim();
    if (!/^https?:\/\//i.test(value)) {
      const message = "Enter a valid http(s) URL.";
      setUrlErrorMessage(message);
      useGlobalStore.getState().showToast(message, "error");
      return;
    }
    if (attachedFiles.length >= MAX_FILES) {
      const message = `Maximum ${MAX_FILES} attachments allowed per message.`;
      setUrlErrorMessage(message);
      useGlobalStore.getState().showToast(message, "error");
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
      const message = `Maximum ${MAX_FILES} attachments allowed per message.`;
      setErrorMessage(message);
      useGlobalStore.getState().showToast(message, "error");
      return;
    }

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      const message = `File "${oversized[0].name}" exceeds the 25 MB limit.`;
      setErrorMessage(message);
      useGlobalStore.getState().showToast(message, "error");
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
        <div className="flex h-full w-full items-center justify-center bg-[#1D2230] text-[#A1A8B8]">
          <Film size={24} />
        </div>
      );
    }
    if (isAudio) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#1D2230] text-[#A1A8B8]">
          <Music size={24} />
        </div>
      );
    }
    if (isUrl) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#1D2230] text-[#A1A8B8]">
          <Link2 size={24} />
        </div>
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1D2230] text-[#A1A8B8]">
        <FileText size={24} />
      </div>
    );
  };

  return (
    <section className="overflow-hidden rounded-[10px] border border-[#272D3A] bg-[#161A23] text-xs">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#10131A] border-b border-[#1D2230]">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#F1F3F9] hover:text-white"
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Files</span>
          {attachedFiles.length > 0 && (
            <span className="rounded-md bg-[#10131A] border border-[#272D3A] px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-bold text-white">
              {attachedFiles.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setUrlOpen(!urlOpen)}
            className="flex items-center gap-1 rounded bg-[#252B3A] px-2 py-1 text-[11px] font-medium text-[#F1F3F9] hover:bg-[#404249] hover:text-white transition-colors"
          >
            <Link2 size={12} />
            <span>Add URL</span>
          </button>
          <button
            type="button"
            disabled={attachedFiles.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded bg-[#5865F2] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#4752C4] active:bg-[#3C45A5] disabled:opacity-40 transition-colors"
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
          {urlOpen && (
            <div className="flex items-center gap-2 rounded bg-[#1D2230] p-2 border border-[#161A23]">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddUrl();
                }}
                placeholder="https://example.com/image.png"
                className="flex-1 rounded bg-[#161A23] px-2 py-1 text-xs text-[#F1F3F9] placeholder-[#A1A8B8]/50 outline-none ring-1 ring-transparent focus:ring-[#818CF8]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="rounded bg-[#5865F2] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4752C4] active:bg-[#3C45A5]"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlOpen(false);
                  setUrlErrorMessage(null);
                }}
                className="p-1 text-[#A1A8B8] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {urlErrorMessage && (
            <p className="flex items-center gap-1 text-[11px] text-[#F87171]">
              <AlertCircle size={12} /> {urlErrorMessage}
            </p>
          )}

          {errorMessage && (
            <p className="flex items-center gap-1 text-[11px] text-[#F87171]">
              <AlertCircle size={12} /> {errorMessage}
            </p>
          )}

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
                ? "border-[#818CF8] bg-[#818CF8]/10"
                : "border-[#272D3A] bg-[#10131A]/60 hover:border-[#818CF8]/60 hover:bg-[#1D2230]"
            }`}
          >
            <Paperclip size={20} className="mb-1 text-[#A1A8B8]" />
            <p className="text-xs font-medium text-[#F1F3F9]">
              Drop files here or <span className="text-[#A78BFA] underline underline-offset-2 font-semibold">browse</span>
            </p>
            <p className="mt-0.5 text-[10px] text-[#A1A8B8]">
              Up to 10 files, max 25 MB each. Supports images, audio, video, documents.
            </p>
          </div>

          {attachedFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex flex-col rounded border border-[#161A23] bg-[#1D2230] p-2"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded bg-[#10131A]">
                    {renderFileThumbnail(file)}

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
                            ? "bg-[#818CF8] hover:bg-[#6366F1]"
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
                        className="rounded bg-black/60 p-1 text-white shadow backdrop-blur-sm hover:bg-[#F87171] transition-colors"
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

                  <div className="mt-1.5 min-w-0">
                    <p
                      className="truncate font-mono text-[11px] font-medium leading-tight text-[#F1F3F9]"
                      title={file.url ?? file.name}
                    >
                      {file.spoiler ? `SPOILER_${file.name}` : file.name}
                    </p>
                    <p className="text-[10px] text-[#A1A8B8] mt-0.5 flex items-center gap-1">
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
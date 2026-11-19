import type { Request, Response, NextFunction } from "express";
import type { Readable } from "node:stream";
import busboy from "busboy";
import { ApiError } from "../utils/errors.js";

export interface UploadedFile {
  key: string;
  filename: string;
  size: number;
  type: string;
  file: File | Blob;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 MB total attachments across all files
const MAX_FIELD_SIZE = 2 * 1024 * 1024; // 2 MB per field (e.g. payload_json)
const MAX_FIELDS = 100;
const MAX_PARTS = 120;

export const multipartParser = (req: Request, _res: Response, next: NextFunction): void => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  req.body = req.body && typeof req.body === "object" ? req.body : {};

  // 1. Early Content-Length validation before reading stream
  const rawContentLength = req.headers["content-length"];
  if (rawContentLength) {
    const contentLength = parseInt(rawContentLength, 10);
    const maxAllowedPayload = MAX_TOTAL_SIZE + MAX_FIELD_SIZE + (128 * 1024);
    if (!isNaN(contentLength) && contentLength > maxAllowedPayload) {
      return next(
        ApiError.payloadTooLarge(
          `Request payload exceeds maximum allowed size of ${Math.round(maxAllowedPayload / (1024 * 1024))} MB`,
        ),
      );
    }
  }

  // 2. Initialize Busboy with streaming limits
  let bb: busboy.Busboy;
  try {
    bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
        fieldSize: MAX_FIELD_SIZE,
        fields: MAX_FIELDS,
        parts: MAX_PARTS,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return next(ApiError.badRequest(`Malformed multipart request: ${message}`));
  }

  let hasEnded = false;
  let fileCount = 0;
  let totalFileBytes = 0;
  let payloadJsonStr: string | null = null;
  const textFields: Record<string, string> = {};
  const uploadedFiles: UploadedFile[] = [];
  const filePromises: Promise<void>[] = [];
  let fileIdx = 0;

  const cleanup = () => {
    try {
      req.unpipe(bb);
    } catch {}
    try {
      bb.removeAllListeners();
    } catch {}
    try {
      req.resume(); // drain incoming socket bytes to prevent TCP socket hang
    } catch {}
  };

  const finishWithError = (err: ApiError | Error) => {
    if (hasEnded) return;
    hasEnded = true;
    cleanup();

    const apiErr =
      err instanceof ApiError
        ? err
        : ApiError.badRequest(`Failed to parse multipart request: ${err.message}`);

    return next(apiErr);
  };

  const finishWithSuccess = () => {
    if (hasEnded) return;
    hasEnded = true;
    return next();
  };

  // Guard against client abort
  req.on("close", () => {
    if (!req.complete && !hasEnded) {
      hasEnded = true;
      cleanup();
    }
  });

  req.on("error", (err: Error) => {
    finishWithError(new ApiError(400, `Request stream error: ${err.message}`));
  });

  bb.on("error", (err: Error) => {
    finishWithError(new ApiError(400, `Failed to parse multipart request: ${err.message}`));
  });

  // Limit event listeners
  bb.on("filesLimit", () => {
    finishWithError(
      ApiError.badRequest(`Too many files: maximum ${MAX_FILES} attachments allowed per message`),
    );
  });

  bb.on("fieldsLimit", () => {
    finishWithError(ApiError.badRequest(`Too many fields: maximum ${MAX_FIELDS} allowed`));
  });

  bb.on("partsLimit", () => {
    finishWithError(ApiError.badRequest(`Too many multipart parts: maximum ${MAX_PARTS} allowed`));
  });

  // Field handler
  bb.on("field", (name: string, value: string, info: busboy.FieldInfo) => {
    if (hasEnded) return;

    if (info.valueTruncated) {
      finishWithError(
        ApiError.payloadTooLarge(
          `Field "${name}" exceeds maximum allowed field size of ${MAX_FIELD_SIZE / (1024 * 1024)} MB`,
        ),
      );
      return;
    }

    if (name === "payload_json") {
      payloadJsonStr = value;
    } else if (!name.startsWith("files")) {
      textFields[name] = value;
    }
  });

  // File stream handler
  bb.on("file", (fieldname: string, fileStream: Readable, info: busboy.FileInfo) => {
    if (hasEnded) {
      fileStream.resume();
      return;
    }

    const { filename, mimeType } = info;
    if (!filename || filename.trim() === "") {
      fileStream.resume();
      return;
    }

    fileCount++;
    if (fileCount > MAX_FILES) {
      fileStream.resume();
      finishWithError(
        ApiError.badRequest(`Too many files: maximum ${MAX_FILES} attachments allowed per message`),
      );
      return;
    }

    const chunks: Buffer[] = [];
    const currentKey = fieldname.startsWith("files[") ? fieldname : `files[${fileIdx}]`;
    fileIdx++;

    const filePromise = new Promise<void>((resolve, reject) => {
      fileStream.on("data", (chunk: Buffer) => {
        if (hasEnded) {
          fileStream.resume();
          return;
        }

        totalFileBytes += chunk.length;
        if (totalFileBytes > MAX_TOTAL_SIZE) {
          fileStream.resume();
          finishWithError(
            ApiError.payloadTooLarge(
              `Total multipart attachments exceed maximum allowed size of ${MAX_TOTAL_SIZE / (1024 * 1024)} MB`,
            ),
          );
          return;
        }

        chunks.push(chunk);
      });

      fileStream.on("limit", () => {
        fileStream.resume();
        finishWithError(
          ApiError.payloadTooLarge(
            `File "${filename}" exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
          ),
        );
      });

      fileStream.on("end", () => {
        if (hasEnded) {
          resolve();
          return;
        }

        const buffer = Buffer.concat(chunks);
        const fileObj = new File([buffer], filename, {
          type: mimeType || "application/octet-stream",
        });

        uploadedFiles.push({
          key: currentKey,
          filename,
          size: buffer.length,
          type: mimeType || "application/octet-stream",
          file: fileObj,
        });
        resolve();
      });

      fileStream.on("error", (err: Error) => {
        reject(err);
      });
    });

    filePromises.push(filePromise);
  });

  // Close event handler
  bb.on("close", async () => {
    if (hasEnded) return;

    try {
      await Promise.all(filePromises);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      finishWithError(error);
      return;
    }

    if (hasEnded) return;

    if (typeof payloadJsonStr === "string") {
      try {
        const parsed = JSON.parse(payloadJsonStr);
        if (parsed && typeof parsed === "object") {
          if ("payload" in parsed || "mode" in parsed || "messages" in parsed) {
            req.body = { ...parsed, ...req.body };
          } else {
            req.body = { ...req.body, payload: parsed };
          }
        }
      } catch {
        finishWithError(ApiError.badRequest("Invalid JSON format in payload_json"));
        return;
      }
    }

    req.body = req.body && typeof req.body === "object" ? req.body : {};
    for (const [key, value] of Object.entries(textFields)) {
      if (req.body[key] === undefined) {
        req.body[key] = value;
      }
    }

    (req as any).uploadedFiles = uploadedFiles;
    finishWithSuccess();
  });

  req.pipe(bb);
};

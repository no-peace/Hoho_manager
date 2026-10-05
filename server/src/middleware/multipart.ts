import type { Request, Response, NextFunction } from "express";
import { Readable } from "node:stream";
import { ApiError } from "../utils/errors.js";

export interface UploadedFile {
  key: string;
  filename: string;
  size: number;
  type: string;
  file: File | Blob;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const multipartParser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  try {
    const host = req.headers.host || "localhost";
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) {
        for (const item of v) headers.append(k, item);
      } else if (v !== undefined) {
        headers.set(k, v);
      }
    }

    const webReq = new Request(`http://${host}${req.url}`, {
      method: req.method,
      headers,
      body: Readable.toWeb(req),
      duplex: "half",
    });

    const formData = await webReq.formData();
    const payloadJsonStr = formData.get("payload_json");

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
        return next(ApiError.badRequest("Invalid JSON format in payload_json"));
      }
    }

    // Merge any other text fields from formData into req.body if not already populated
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && key !== "payload_json" && !key.startsWith("files")) {
        if (req.body[key] === undefined) {
          req.body[key] = value;
        }
      }
    }

    const files: UploadedFile[] = [];
    let fileIdx = 0;
    for (const [key, value] of formData.entries()) {
      if (typeof value === "object" && value !== null && "name" in value && "size" in value) {
        const fileObj = value as File;
        if (fileObj.size > MAX_FILE_SIZE) {
          return next(ApiError.badRequest(`File "${fileObj.name}" exceeds maximum allowed size of 25 MB`));
        }
        files.push({
          key: key.startsWith("files[") ? key : `files[${fileIdx}]`,
          filename: fileObj.name,
          size: fileObj.size,
          type: fileObj.type || "application/octet-stream",
          file: fileObj,
        });
        fileIdx++;
      }
    }

    if (files.length > MAX_FILES) {
      return next(ApiError.badRequest(`Too many files: maximum ${MAX_FILES} attachments allowed per message`));
    }

    (req as any).uploadedFiles = files;
    next();
  } catch (err) {
    next(ApiError.badRequest(`Failed to parse multipart request: ${err instanceof Error ? err.message : String(err)}`));
  }
};

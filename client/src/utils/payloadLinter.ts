import { ButtonStyle, ComponentType } from "@dmb/shared";
import type { ComponentNode, EmbedData, MessageData } from "@dmb/shared";

export interface PayloadLintIssue {
  severity: "error" | "warning";
  messageIndex: number;
  componentId?: string;
  message: string;
}

export interface LintAttachment {
  name: string;
  spoiler?: boolean;
}

const countComponents = (nodes: ComponentNode[]): number =>
  nodes.reduce((total, node) =>
    total + 1 +
    (node.components ? countComponents(node.components) : 0) +
    (node.accessory ? countComponents([node.accessory]) : 0), 0);

const countTextDisplayCharacters = (nodes: ComponentNode[]): number =>
  nodes.reduce((total, node) =>
    total +
    (node.type === ComponentType.TextDisplay ? (node.content?.length ?? 0) : 0) +
    (node.components ? countTextDisplayCharacters(node.components) : 0) +
    (node.accessory ? countTextDisplayCharacters([node.accessory]) : 0), 0);

const embedCharacters = (embed: EmbedData): number =>
  (embed.title?.length ?? 0) +
  (embed.description?.length ?? 0) +
  (embed.author?.name?.length ?? 0) +
  (embed.footer?.text?.length ?? 0) +
  (embed.fields ?? []).reduce((sum, field) =>
    sum + (field.name?.length ?? 0) + (field.value?.length ?? 0), 0);

const walkComponents = (
  nodes: ComponentNode[],
  visit: (node: ComponentNode) => void,
): void => {
  for (const node of nodes) {
    visit(node);
    if (node.components) walkComponents(node.components, visit);
    if (node.accessory) walkComponents([node.accessory], visit);
  }
};

const collectAttachmentReferences = (value: unknown, output: Set<string>): void => {
  if (typeof value === "string") {
    const matches = value.matchAll(/attachment:\/\/([^\s"'<>]+)/gi);
    for (const match of matches) {
      if (match[1]) {
        try { output.add(decodeURIComponent(match[1])); }
        catch { output.add(match[1]); }
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAttachmentReferences(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectAttachmentReferences(item, output));
  }
};

export const lintPayloads = (
  messages: MessageData[],
  attachments: LintAttachment[] = [],
  activeMessageIndex = 0,
): PayloadLintIssue[] => {
  const issues: PayloadLintIssue[] = [];
  const attachedNames = new Set(attachments.flatMap((file) => [file.name, ...(file.spoiler ? [`SPOILER_${file.name}`] : [])].map((name) => name.toLowerCase())));

  messages.forEach((message, messageIndex) => {
    const components = message.components ?? [];
    const embeds = message.embeds ?? [];
    const isV2 = Boolean((message.flags ?? 0) & 32768) ||
      (message as MessageData & { mode?: string }).mode === "v2";
    const add = (
      severity: PayloadLintIssue["severity"],
      messageText: string,
      componentId?: string,
    ) => issues.push({
      severity,
      messageIndex,
      ...(componentId ? { componentId } : {}),
      message: messageText,
    });

    if (isV2) {
      const componentCount = countComponents(components);
      const textCharacters = countTextDisplayCharacters(components);
      if (componentCount > 40) add("error", `Components V2 has ${componentCount} components; Discord allows at most 40.`);
      if (textCharacters > 4000) add("error", `Components V2 text is ${textCharacters} characters; the limit is 4,000.`);
    } else {
      if ((message.content ?? "").length > 2000) {
        add("error", `Classic message content is ${message.content.length} characters; the limit is 2,000.`);
      }
      const totalEmbedCharacters = embeds.reduce((sum, embed) => sum + embedCharacters(embed), 0);
      if (totalEmbedCharacters > 6000) {
        add("error", `Embed text totals ${totalEmbedCharacters} characters; the combined limit is 6,000.`);
      }
    }

    const customIds = new Set<string>();
    walkComponents(components, (component) => {
      const id = component._id;
      const customId = component.custom_id;
      if (customId) {
        if (customIds.has(customId)) {
          add("error", `Duplicate custom_id "${customId}" in this message.`, id);
        } else {
          customIds.add(customId);
        }
      }

      if (component.type === ComponentType.Button && component.style === ButtonStyle.Link) {
        if (!component.url?.trim()) {
          add("error", "Link button is missing its URL.", id);
        } else if (!/^https?:\/\//i.test(component.url.trim())) {
          add("error", "Link button URL must use HTTP or HTTPS.", id);
        }
      }

      if (component.type === ComponentType.StringSelect) {
        const options = component.options ?? [];
        const min = component.min_values ?? 1;
        const max = component.max_values ?? 1;
        if (options.length === 0) add("error", "String Select has no options.", id);
        if (min > max) add("error", "String Select min_values cannot exceed max_values.", id);
        if (max > options.length && options.length > 0) {
          add("error", "String Select max_values cannot exceed its option count.", id);
        }
      }
    });

    const attachmentReferences = new Set<string>();
    collectAttachmentReferences(embeds, attachmentReferences);
    collectAttachmentReferences(components, attachmentReferences);
    for (const filename of attachmentReferences) {
      if (!attachedNames.has(filename.toLowerCase())) {
        add("error", `Attachment reference "attachment://${filename}" has no matching attached file.`);
      }
    }

    if (message.poll) {
      if (message.poll.question.text.trim().length === 0 || message.poll.question.text.length > 300) {
        add("error", "Poll question must contain 1–300 characters.");
      }
      if (message.poll.answers.length < 1 || message.poll.answers.length > 10) {
        add("error", "Poll must contain between 1 and 10 answers.");
      }
      if (message.poll.answers.some((answer) => !answer.poll_media.text.trim() || answer.poll_media.text.length > 55)) {
        add("error", "Each poll answer must contain 1–55 characters.");
      }
      if (message.poll.duration < 1 || message.poll.duration > 168) {
        add("error", "Poll duration must be between 1 and 168 hours.");
      }
      if (isV2) add("error", "Discord polls cannot be combined with Components V2.");
    }
    const hasAttachments = messageIndex === activeMessageIndex && attachments.length > 0;
    const hasPoll = Boolean((message as MessageData & { poll?: unknown }).poll);
    if (
      !(message.content ?? "").trim() &&
      embeds.length === 0 &&
      components.length === 0 &&
      !hasAttachments &&
      !hasPoll
    ) {
      add("warning", "This message is empty and may be rejected by Discord.");
    }
  });

  return issues;
};

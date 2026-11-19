import { describe, expect, it } from "vitest";
import { validateMessagePayload } from "../src/utils/validation.js";

describe("Discord poll payload validation", () => {
  const validPoll = {
    question: { text: "What should we build next?" },
    answers: [
      { poll_media: { text: "Editor features" } },
      { poll_media: { text: "Automation" } },
    ],
    duration: 24,
    allow_multiselect: false,
  };

  it("accepts a valid native poll payload", () => {
    expect(validateMessagePayload({ poll: validPoll })).toMatchObject({ poll: validPoll });
  });

  it("rejects polls with fewer than two answers", () => {
    expect(() => validateMessagePayload({
      poll: { ...validPoll, answers: [validPoll.answers[0]] },
    })).toThrow("Message payload failed validation");
  });

  it("rejects polls combined with Components V2", () => {
    expect(() => validateMessagePayload({
      flags: 32768,
      components: [{ type: 10, content: "Hello" }],
      poll: validPoll,
    })).toThrow("Message payload failed validation");
  });
});

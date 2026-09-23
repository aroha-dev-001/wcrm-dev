import { describe, expect, it } from "vitest";
import {
  broadcastStatusConfig,
  getBroadcastStatus,
  getRecipientStatus,
  recipientStatusConfig,
} from "./broadcast-status";

describe("getBroadcastStatus", () => {
  it("returns the matching config for known statuses", () => {
    expect(getBroadcastStatus("sending")).toBe(broadcastStatusConfig.sending);
    expect(getBroadcastStatus("sent")).toBe(broadcastStatusConfig.sent);
    expect(getBroadcastStatus("failed")).toBe(broadcastStatusConfig.failed);
  });

  it("flags `sending` as a live/pulsing state", () => {
    expect(getBroadcastStatus("sending").pulse).toBe(true);
    expect(getBroadcastStatus("sent").pulse).toBeFalsy();
  });

  it("falls back to draft on an unknown status string", () => {
    expect(getBroadcastStatus("not-a-real-status")).toBe(
      broadcastStatusConfig.draft,
    );
    expect(getBroadcastStatus("")).toBe(broadcastStatusConfig.draft);
  });

  it("each variant has a fill, text and border class", () => {
    // Statuses use semantic theme tokens (bg-success/10, text-warning,
    // border-destructive/25, bg-muted …) so they follow light/dark mode.
    for (const v of Object.values(broadcastStatusConfig)) {
      expect(v.classes).toMatch(/\bbg-[a-z-]+(\/\d+)?/);
      expect(v.classes).toMatch(/\btext-[a-z-]+/);
      expect(v.classes).toMatch(/\bborder-[a-z-]+(\/\d+)?/);
    }
  });
});

describe("getRecipientStatus", () => {
  it("returns the matching config for known statuses", () => {
    expect(getRecipientStatus("delivered")).toBe(
      recipientStatusConfig.delivered,
    );
    expect(getRecipientStatus("read")).toBe(recipientStatusConfig.read);
  });

  it("falls back to pending on an unknown status string", () => {
    expect(getRecipientStatus("???")).toBe(recipientStatusConfig.pending);
  });
});

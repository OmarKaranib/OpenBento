import test from "node:test";
import assert from "node:assert/strict";
import { applyYouTubeRefresh } from "../../server/services/stream-refresh";

const channel = {
  id: "news",
  videoId: "working1234",
  isLive: true,
  lastUpdated: 1_000,
};

test("temporary YouTube failure keeps the last working stream", () => {
  const updated = applyYouTubeRefresh(
    channel,
    { videoId: null, isLive: false, apiError: true },
    2_000,
  );

  assert.deepEqual(updated, channel);
});

test("successful YouTube refresh replaces the stream", () => {
  const updated = applyYouTubeRefresh(
    channel,
    { videoId: "newstream12", isLive: true, apiError: false },
    2_000,
  );

  assert.equal(updated.videoId, "newstream12");
  assert.equal(updated.isLive, true);
  assert.equal(updated.lastUpdated, 2_000);
});

test("confirmed offline result keeps the last video but removes live status", () => {
  const updated = applyYouTubeRefresh(
    channel,
    { videoId: null, isLive: false, apiError: false },
    2_000,
  );

  assert.equal(updated.videoId, channel.videoId);
  assert.equal(updated.isLive, false);
  assert.equal(updated.lastUpdated, 2_000);
});

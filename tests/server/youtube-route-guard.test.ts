import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('public YouTube search routes share a request limit', () => {
  const routes = readFileSync('server/routes.ts', 'utf8');
  const channelRoute = routes.slice(
    routes.indexOf('app.get("/api/youtube/channel-live/:channelId"'),
    routes.indexOf('app.get("/api/youtube/video-live/:videoId"'),
  );
  const handleRoute = routes.slice(
    routes.indexOf('app.get("/api/youtube/search-live/:channelHandle"'),
    routes.indexOf('app.post("/api/stream/heal"'),
  );

  assert.match(channelRoute, /youtubeSearchRateLimit\.allow\(requestIp\(req\)\)/);
  assert.match(handleRoute, /youtubeSearchRateLimit\.allow\(requestIp\(req\)\)/);
  assert.match(channelRoute, /channelId\.length > 200/);
  assert.match(handleRoute, /channelHandle\.length > 200/);
});

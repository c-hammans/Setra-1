// Limit outbound delivery to the browser push providers Setra supports.
const pushEndpoint = /^https:\/\/(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.(?:notify|wns)\.windows\.com)\/[^\s\\#]+$/i;

export function isSupportedPushEndpoint(endpoint: unknown): endpoint is string {
  return typeof endpoint === "string" && endpoint.length <= 2048 && pushEndpoint.test(endpoint);
}

// Live updates. One Durable Object holds every open WebSocket; when the API changes something, it hands the change
// here and it goes out to everyone at once. Sockets hibernate between messages, so an idle family costs nothing.
//
// Clients only listen. They send "ping" every so often to keep the connection up; that's answered without waking
// this object. Each socket is tagged with its user id, so taking someone off the family list can close theirs.
import { DurableObject } from 'cloudflare:workers'

export class Live extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  // The Worker has already checked the session; it passes who this is in x-user-id.
  async fetch(req) {
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1], [req.headers.get('x-user-id') || 'unknown'])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  /** Send one change ({ table, op, row }, already JSON) to everyone connected. */
  broadcast(message) {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(message) } catch { /* already closing */ }
    }
  }

  /** Close someone's connections (they were taken off the family list). */
  kick(userId) {
    for (const ws of this.ctx.getWebSockets(userId)) {
      try { ws.close(4003, 'Not on the family list') } catch { /* already closed */ }
    }
  }

  webSocketMessage() {}

  webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code) } catch { /* already closed */ }
  }
}

import { Api } from 'telegram';
import { CustomFile } from 'telegram/client/uploads.js';
import { getClient } from './client.js';
import { getChannelEntity } from './channel.js';

// In-memory download cache (TG message contents never change → safe to cache).
// Avoids re-downloading from Telegram when thumbnail/preview/download
// are accessed repeatedly. Bounded so it doesn't exhaust RAM.
const MAX_CACHE_BYTES = 256 * 1024 * 1024; // 256 MB total
const MAX_ITEM_BYTES = 25 * 1024 * 1024;   // only cache files <= 25 MB
const cache = new Map<number, Buffer>();    // insertion order = access order, oldest→newest
let cacheBytes = 0;

function cacheGet(id: number): Buffer | undefined {
  const buf = cache.get(id);
  if (buf) {
    // refresh position (mark as most recent) for simple LRU eviction
    cache.delete(id);
    cache.set(id, buf);
  }
  return buf;
}

function cachePut(id: number, buf: Buffer): void {
  if (buf.length > MAX_ITEM_BYTES) return;
  while (cacheBytes + buf.length > MAX_CACHE_BYTES && cache.size > 0) {
    const oldest = cache.keys().next().value as number;
    const old = cache.get(oldest)!;
    cache.delete(oldest);
    cacheBytes -= old.length;
  }
  cache.set(id, buf);
  cacheBytes += buf.length;
}

export function evictCache(messageId: number): void {
  const buf = cache.get(messageId);
  if (buf) {
    cache.delete(messageId);
    cacheBytes -= buf.length;
  }
}

// Upload a buffer as a document to the storage channel. Returns the message id.
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<number> {
  const client = await getClient();
  const channel = await getChannelEntity();
  const file = new CustomFile(filename, buffer.length, '', buffer);
  const message = await client.sendFile(channel, {
    file,
    forceDocument: true,
    attributes: [new Api.DocumentAttributeFilename({ fileName: filename })],
    caption: mimeType,
  });
  return message.id;
}

// Download a file's contents (as a Buffer) from a channel message. Uses the in-memory cache.
export async function downloadFile(messageId: number): Promise<Buffer> {
  const cached = cacheGet(messageId);
  if (cached) return cached;

  const client = await getClient();
  const channel = await getChannelEntity();
  const messages = await client.getMessages(channel, { ids: messageId });
  const msg = messages[0];
  if (!msg || !msg.media) throw new Error('File not found in Telegram');
  const data = await client.downloadMedia(msg.media);
  if (!data || typeof data === 'string') {
    throw new Error('Failed to download file contents from Telegram');
  }
  cachePut(messageId, data);
  return data;
}

// Delete a message (file) from the channel.
export async function deleteMessage(messageId: number): Promise<void> {
  const client = await getClient();
  const channel = await getChannelEntity();
  await client.deleteMessages(channel, [messageId], { revoke: true });
  evictCache(messageId);
}

import { describe, expect, it } from 'vitest';
import { BodyLimitError, readBoundedBody } from './boundedBody';

describe('bounded body reader', () => {
  it('preserves binary bytes across chunks', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(c) {
      c.enqueue(new Uint8Array([0, 255]));
      c.enqueue(new Uint8Array([128, 42]));
      c.close();
    } });
    expect(new Uint8Array(await readBoundedBody(stream, 4, new AbortController().signal)))
      .toEqual(new Uint8Array([0, 255, 128, 42]));
  });

  it('cancels a chunked body when its actual size exceeds the limit', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(c) {
      c.enqueue(new Uint8Array(3));
      c.enqueue(new Uint8Array(3));
    }, cancel() { cancelled = true; } });
    await expect(readBoundedBody(stream, 5, new AbortController().signal)).rejects.toBeInstanceOf(BodyLimitError);
    expect(cancelled).toBe(true);
  });

  it('interrupts a client that never finishes sending', async () => {
    const controller = new AbortController();
    const reading = readBoundedBody(new ReadableStream(), 10, controller.signal);
    controller.abort();
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function mockVersions(versions: Record<string, number[]>) {
  const fetchMock = vi.fn(async (url: string) => {
    const version = versions[url]?.shift();
    if (version === undefined) throw new Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify({ data_version: version }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("dataset snapshot", () => {
  it("loads matching versions and reuses the consistent responses", async () => {
    const fetchMock = mockVersions({ "/api/meta": [1], "/api/matches": [1] });
    const api = await import("./client");
    const snapshot = await api.getDatasetSnapshot();
    expect(snapshot.meta.data_version).toBe(1);
    expect(snapshot.matches.data_version).toBe(1);
    expect(await api.getMeta()).toBe(snapshot.meta);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates old responses and retries after a refresh between requests", async () => {
    const fetchMock = mockVersions({
      "/api/meta": [0, 1, 2],
      "/api/matches": [2, 2],
    });
    const api = await import("./client");
    expect((await api.getMeta()).data_version).toBe(0);
    const snapshot = await api.getDatasetSnapshot();
    expect(snapshot.meta.data_version).toBe(2);
    expect(snapshot.matches.data_version).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("stops after three attempts, reports the update and clears inconsistent cache", async () => {
    const fetchMock = mockVersions({
      "/api/meta": [1, 2, 3, 4],
      "/api/matches": [2, 3, 4],
    });
    const api = await import("./client");
    await expect(api.getDatasetSnapshot()).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Bitte die Seite erneut laden"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect((await api.getMeta()).data_version).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});

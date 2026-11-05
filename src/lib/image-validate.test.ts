import { describe, it, expect } from "vitest";
import { sniffImage, validatePhotoFile, MAX_PHOTO_BYTES } from "./image-validate";

const pad = (a: number[]) => new Uint8Array([...a, ...new Array(16).fill(0)]);

describe("photo content validation", () => {
  it("accepts real JPEG and PNG bytes", () => {
    expect(sniffImage(pad([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
  });
  it("rejects HTML renamed to .jpg", async () => {
    const f = new File(["<html><script>alert(1)</script></html>"], "x.jpg", { type: "image/jpeg" });
    expect(await validatePhotoFile(f)).toHaveProperty("error");
  });
  it("rejects files over 5 MB", async () => {
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1); big.set([0xff, 0xd8, 0xff]);
    expect(await validatePhotoFile(new File([big], "a.jpg"))).toHaveProperty("error");
  });
});

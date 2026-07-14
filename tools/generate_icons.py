#!/usr/bin/env python3
"""Generate placeholder app icons (no dependencies — raw PNG encoder).

Draws a rounded red square with a white "!" mark on a dark background.
Run: python3 tools/generate_icons.py
Swap the output PNGs in icons/ for real artwork whenever you like.
"""
import struct
import zlib
import os

BG = (15, 23, 42, 255)       # #0f172a
ACCENT = (236, 72, 153, 255)  # #ec4899 (pink)
WHITE = (232, 236, 247, 255)


def rounded_square_mask(x, y, size, margin, radius):
    x0, y0, x1, y1 = margin, margin, size - margin, size - margin
    if x0 <= x < x1 and y0 <= y < y1:
        # corner distance checks
        if x < x0 + radius and y < y0 + radius:
            return (x - (x0 + radius)) ** 2 + (y - (y0 + radius)) ** 2 <= radius ** 2
        if x >= x1 - radius and y < y0 + radius:
            return (x - (x1 - radius)) ** 2 + (y - (y0 + radius)) ** 2 <= radius ** 2
        if x < x0 + radius and y >= y1 - radius:
            return (x - (x0 + radius)) ** 2 + (y - (y1 - radius)) ** 2 <= radius ** 2
        if x >= x1 - radius and y >= y1 - radius:
            return (x - (x1 - radius)) ** 2 + (y - (y1 - radius)) ** 2 <= radius ** 2
        return True
    return False


def exclamation_mask(x, y, size):
    cx = size / 2
    stem_w = size * 0.09
    stem_top = size * 0.28
    stem_bottom = size * 0.62
    dot_r = size * 0.06
    dot_cy = size * 0.74

    if stem_top <= y <= stem_bottom and abs(x - cx) <= stem_w / 2:
        return True
    if (x - cx) ** 2 + (y - dot_cy) ** 2 <= dot_r ** 2:
        return True
    return False


def render(size, maskable=False):
    margin = size * 0.16 if maskable else size * 0.06
    radius = size * 0.22
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)  # filter byte per scanline
        for x in range(size):
            if rounded_square_mask(x, y, size, margin, radius):
                r, g, b, a = ACCENT
                if exclamation_mask(x, y, size):
                    r, g, b, a = WHITE
            else:
                r, g, b, a = BG
            pixels += bytes((r, g, b, a))
    return bytes(pixels)


def write_png(path, size, maskable=False):
    raw = render(size, maskable)

    def chunk(tag, data):
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)
    print(f'wrote {path}')


if __name__ == '__main__':
    base = os.path.join(os.path.dirname(__file__), '..', 'icons')
    write_png(os.path.join(base, 'icon-192.png'), 192)
    write_png(os.path.join(base, 'icon-512.png'), 512)
    write_png(os.path.join(base, 'icon-512-maskable.png'), 512, maskable=True)
    write_png(os.path.join(base, 'apple-touch-icon.png'), 180)
    write_png(os.path.join(base, 'favicon-32.png'), 32)

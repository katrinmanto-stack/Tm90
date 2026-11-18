#!/usr/bin/env python3
"""ساخت تصاویر آزمایشی مورد نیاز تست‌های e2e (بدون وابستگی). اجرا: python3 tools/make-fixtures.py"""
import os, struct, zlib
def png(w, h, rgb, path):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def ch(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b''))
os.makedirs('/tmp/shots', exist_ok=True)
png(120, 120, (246, 185, 59), '/tmp/logo.png')
png(1600, 900, (35, 44, 110), '/tmp/banner.png')
png(800, 800, (200, 60, 60), '/tmp/banner2.png')
print('fixtures ready')

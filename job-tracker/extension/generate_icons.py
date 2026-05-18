"""Generate simple indigo PNG icons for the JobTrack extension."""
import struct
import zlib
import os

# Indigo #6366f1
COLOR = (99, 102, 241)


def _chunk(tag: bytes, data: bytes) -> bytes:
    length = struct.pack('>I', len(data))
    body = tag + data
    crc = struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)
    return length + body + crc


def make_png(size: int, rgb: tuple) -> bytes:
    r, g, b = rgb
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    rows = b''.join(b'\x00' + bytes([r, g, b]) * size for _ in range(size))
    return (
        b'\x89PNG\r\n\x1a\n'
        + _chunk(b'IHDR', ihdr)
        + _chunk(b'IDAT', zlib.compress(rows, 9))
        + _chunk(b'IEND', b'')
    )


if __name__ == '__main__':
    os.makedirs('icons', exist_ok=True)
    for s in (16, 48, 128):
        path = os.path.join('icons', f'icon{s}.png')
        with open(path, 'wb') as f:
            f.write(make_png(s, COLOR))
        print(f'  Created {path}')
    print('Icons generated.')

"""Reproducible conversion of SMK KAS2232 to David Light Lab's DLB1 format.

This is a separate plaster-cast scan, never a replacement for the original
Scan the World model. Source bytes and SHA-1 are pinned to Wikimedia Commons.
"""
from __future__ import annotations

import hashlib
import io
import struct
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np

SOURCE = (
    "https://upload.wikimedia.org/wikipedia/commons/4/44/"
    "Michelangelo_Buonarroti%2C_Hoved_fra_statuen_af_David%2C_%2C_"
    "KAS2232%2C_Statens_Museum_for_Kunst%2C_3D_model.stl"
)
SOURCE_SHA1 = "ead5fae70be51dfc883a232ffd633ec236967c4a"
SOURCE_BYTES = 54_168_584
TRIANGLES = (SOURCE_BYTES - 84) // 50

OUT = Path(__file__).resolve().parents[1] / "assets/david-smk-kas2232.dlb"


def download_original() -> bytes:
    req = Request(
        SOURCE,
        headers={
            "User-Agent": "DavidLightLab/1.0 (https://salmonofdoubt.github.io/; archival research)",
            "Accept": "application/octet-stream, */*",
        },
    )
    with urlopen(req, timeout=240) as response:
        contents = response.read()
    if len(contents) != SOURCE_BYTES:
        raise ValueError(f"Unexpected SMK source size: {len(contents):,} bytes")
    sha1 = hashlib.sha1(contents).hexdigest()
    if sha1 != SOURCE_SHA1:
        raise ValueError(f"SMK source SHA-1 mismatch: {sha1}")
    count = struct.unpack_from("<I", contents, 80)[0]
    if count != TRIANGLES or 84 + 50 * count != len(contents):
        raise ValueError(f"STL triangle count invalid: {count}")
    print(f"Verified SMK KAS2232 source: {count:,} triangles, SHA-1 {sha1}")
    return contents


def convert(data: bytes) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    dtype = np.dtype(
        [("normal", "<f4", (3,)), ("vertices", "<f4", (3, 3)), ("attr", "<u2")]
    )
    triangles = np.frombuffer(data, dtype=dtype, count=TRIANGLES, offset=84)
    source = np.asarray(triangles["vertices"], dtype=np.float64)
    source_normals = np.asarray(triangles["normal"], dtype=np.float64)
    if not np.isfinite(source).all() or not np.isfinite(source_normals).all():
        raise ValueError("Source STL contains non-finite coordinates")

    flat = source.reshape(-1, 3)
    low, high = flat.min(axis=0), flat.max(axis=0)
    extent = high - low
    height_axis = int(np.argmax(extent))
    remaining = [axis for axis in range(3) if axis != height_axis]
    width_axis = max(remaining, key=lambda axis: extent[axis])
    depth_axis = next(axis for axis in remaining if axis != width_axis)
    print("Source axes: width/height/depth", width_axis, height_axis, depth_axis)

    # Match David Light Lab's existing artist coordinates and scale convention.
    order = [width_axis, height_axis, depth_axis]
    mapped = source[:, :, order].copy()
    supplied_normals = source_normals[:, order].copy()
    z = mapped[:, :, 2].reshape(-1)
    if z.mean() > (z.min() + z.max()) * 0.5:
        mapped[:, :, 2] *= -1.0
        supplied_normals[:, 2] *= -1.0

    flat = mapped.reshape(-1, 3)
    low, high = flat.min(axis=0), flat.max(axis=0)
    centre = (low + high) * 0.5
    span = float(np.max(high - low))
    if not np.isfinite(span) or span <= 0:
        raise ValueError("Degenerate source dimensions")
    mapped = (mapped - centre) * (2.0 / span)

    raw = mapped.reshape(-1, 3)
    quantized = np.round(raw * 100000.0).astype(np.int64)
    _, chosen, inverse = np.unique(
        quantized, axis=0, return_index=True, return_inverse=True
    )
    positions = raw[chosen].astype(np.float32)
    faces = inverse.reshape(-1, 3).astype(np.uint32)
    good = (
        (faces[:, 0] != faces[:, 1])
        & (faces[:, 1] != faces[:, 2])
        & (faces[:, 2] != faces[:, 0])
    )
    faces = faces[good]
    supplied_normals = supplied_normals[good]

    a, b, c = (positions[faces[:, i]].astype(np.float64) for i in range(3))
    computed = np.cross(b - a, c - a)
    signed = np.einsum("ij,ij->i", computed, supplied_normals)
    if np.nanmedian(signed) < 0:
        faces[:, [1, 2]] = faces[:, [2, 1]]
        computed *= -1

    # Rebuild smooth normals from the actual geometry, rather than interpolating
    # pre-existing source normals at unrelated STL triangle corners.
    normals = np.zeros_like(positions, dtype=np.float64)
    for index in range(3):
        np.add.at(normals, faces[:, index], computed)
    lengths = np.linalg.norm(normals, axis=1)
    valid = lengths > 1e-14
    normals[valid] /= lengths[valid, None]
    normals[~valid] = (0.0, 0.0, 1.0)
    normals = normals.astype(np.float32)
    indices = faces.reshape(-1).astype(np.uint32)

    if len(faces) < 900000 or len(positions) < 100000:
        raise ValueError("Unexpectedly small SMK model after preprocessing")
    if not np.isfinite(positions).all() or not np.isfinite(normals).all():
        raise ValueError("Processed mesh contains non-finite values")

    print(f"Model: {len(positions):,} vertices; {len(faces):,} triangles")
    print(f"Bounds: {positions.min(axis=0)} → {positions.max(axis=0)}")
    return positions, normals, indices


def write_dlb(positions: np.ndarray, normals: np.ndarray, indices: np.ndarray) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("wb") as output:
        output.write(b"DLB1")
        output.write(struct.pack("<II", len(positions), len(indices)))
        for array in (positions, normals, indices):
            output.write(array.astype("<f4" if array.dtype.kind == "f" else "<u4",
                                      copy=False).tobytes(order="C"))
    expected = 12 + len(positions) * 24 + len(indices) * 4
    if OUT.stat().st_size != expected:
        raise ValueError("Unexpected DLB output size")
    print(f"Wrote {OUT} ({expected / 1048576:.2f} MiB)")
    print(f"Output SHA-256: {hashlib.sha256(OUT.read_bytes()).hexdigest()}")


def main() -> None:
    positions, normals, indices = convert(download_original())
    write_dlb(positions, normals, indices)


if __name__ == "__main__":
    main()

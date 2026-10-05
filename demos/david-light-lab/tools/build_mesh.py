from __future__ import annotations

import struct
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np

SOURCE = "https://upload.wikimedia.org/wikipedia/commons/4/4d/David_%28Michelangelo%29.stl"
OUT = Path("demos/david-light-lab/assets/david-head.dlb")

print("Downloading David source scan...")
req = Request(SOURCE, headers={"User-Agent": "DavidLightLab/0.1 (+https://salmonofdoubt.github.io/)"})
with urlopen(req, timeout=180) as r:
    data = r.read()
print(f"Downloaded {len(data)/1024/1024:.1f} MB")

if len(data) < 84:
    raise RuntimeError("Source STL is too small")
tri_count = struct.unpack_from("<I", data, 80)[0]
if 84 + tri_count * 50 != len(data):
    raise RuntimeError("Expected binary STL")

dtype = np.dtype([
    ("normal", "<f4", (3,)),
    ("vertices", "<f4", (3, 3)),
    ("attr", "<u2"),
])
tri = np.frombuffer(data, dtype=dtype, count=tri_count, offset=84)
verts_src = np.asarray(tri["vertices"], dtype=np.float64)
normals_src = np.asarray(tri["normal"], dtype=np.float64)

flat = verts_src.reshape(-1, 3)
mins = flat.min(axis=0)
maxs = flat.max(axis=0)
ext = maxs - mins

height_axis = int(np.argmax(ext))
remaining = [i for i in range(3) if i != height_axis]
width_axis = remaining[int(ext[remaining[1]] > ext[remaining[0]])]
depth_axis = remaining[0] if remaining[1] == width_axis else remaining[1]

# Keep the upper ~18% of the statue, enough for hair, head, neck and shoulder base.
cut = mins[height_axis] + ext[height_axis] * 0.82
centres = verts_src.mean(axis=1)
keep = centres[:, height_axis] >= cut
verts_src = verts_src[keep]
normals_src = normals_src[keep]
print(f"Retained {len(verts_src):,} / {tri_count:,} triangles")

# Reorient into artist-view coordinates.
mapped = np.empty_like(verts_src, dtype=np.float64)
mapped[:, :, 0] = verts_src[:, :, width_axis]
mapped[:, :, 1] = verts_src[:, :, height_axis]
mapped[:, :, 2] = verts_src[:, :, depth_axis]

mapped_normals = np.empty_like(normals_src, dtype=np.float64)
mapped_normals[:, 0] = normals_src[:, width_axis]
mapped_normals[:, 1] = normals_src[:, height_axis]
mapped_normals[:, 2] = normals_src[:, depth_axis]

# Pick Z direction so the face projects toward +Z.
z_all = mapped[:, :, 2].reshape(-1)
z_mid = (z_all.min() + z_all.max()) * 0.5
if z_all.mean() > z_mid:
    mapped[:, :, 2] *= -1.0
    mapped_normals[:, 2] *= -1.0

# Centre and scale the retained head/bust.
mflat = mapped.reshape(-1, 3)
lo = mflat.min(axis=0)
hi = mflat.max(axis=0)
centre = (lo + hi) * 0.5
span = np.max(hi - lo)
mapped = (mapped - centre) * (2.0 / span)

# Weld coincident STL triangle vertices into an indexed mesh.
raw = mapped.reshape(-1, 3)
quant = np.round(raw * 100000.0).astype(np.int64)
_, unique_idx, inverse = np.unique(quant, axis=0, return_index=True, return_inverse=True)
vertices = raw[unique_idx].astype(np.float32)
faces = inverse.reshape(-1, 3).astype(np.uint32)

# Remove degenerate triangles after welding.
good = (faces[:,0] != faces[:,1]) & (faces[:,1] != faces[:,2]) & (faces[:,2] != faces[:,0])
faces = faces[good]
mapped_normals = mapped_normals[good]

# Ensure the indexed face winding agrees globally with the STL source normals.
v0 = vertices[faces[:,0]].astype(np.float64)
v1 = vertices[faces[:,1]].astype(np.float64)
v2 = vertices[faces[:,2]].astype(np.float64)
computed = np.cross(v1-v0, v2-v0)
agreement = np.einsum("ij,ij->i", computed, mapped_normals)
if np.nanmedian(agreement) < 0:
    faces[:, [1,2]] = faces[:, [2,1]]
    v1, v2 = v2, v1
    computed = -computed

# Area-weighted smooth vertex normals.
normals = np.zeros((len(vertices), 3), dtype=np.float64)
np.add.at(normals, faces[:,0], computed)
np.add.at(normals, faces[:,1], computed)
np.add.at(normals, faces[:,2], computed)
lengths = np.linalg.norm(normals, axis=1)
valid = lengths > 1e-14
normals[valid] /= lengths[valid, None]
normals[~valid] = np.array([0.0, 0.0, 1.0])
normals = normals.astype(np.float32)

indices = faces.reshape(-1).astype(np.uint32)

if not np.isfinite(vertices).all() or not np.isfinite(normals).all():
    raise RuntimeError("Generated mesh contains non-finite values")
if len(vertices) < 10000 or len(indices) < 30000:
    raise RuntimeError("Generated head mesh is unexpectedly small")

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("wb") as f:
    f.write(b"DLB1")
    f.write(struct.pack("<II", len(vertices), len(indices)))
    f.write(vertices.astype("<f4", copy=False).tobytes(order="C"))
    f.write(normals.astype("<f4", copy=False).tobytes(order="C"))
    f.write(indices.astype("<u4", copy=False).tobytes(order="C"))

print("Generated", OUT)
print("Vertices:", len(vertices))
print("Triangles:", len(indices)//3)
print("Bounds:", vertices.min(axis=0), vertices.max(axis=0))
print("Size MB:", OUT.stat().st_size/1024/1024)

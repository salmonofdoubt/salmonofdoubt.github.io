from __future__ import annotations

import io
import struct
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
import trimesh

SOURCE = "https://upload.wikimedia.org/wikipedia/commons/4/4d/David_%28Michelangelo%29.stl"
OUT = Path("demos/david-light-lab/assets/david-head.dlb")

print("Downloading David source scan...")
req = Request(SOURCE, headers={"User-Agent": "DavidLightLab/0.1 (+https://salmonofdoubt.github.io/)"})
with urlopen(req, timeout=180) as r:
    data = r.read()
print(f"Downloaded {len(data)/1024/1024:.1f} MB")

mesh = trimesh.load(io.BytesIO(data), file_type="stl", force="mesh", process=False)
if not isinstance(mesh, trimesh.Trimesh):
    mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))

mesh.remove_unreferenced_vertices()
mesh.merge_vertices(digits_vertex=6)
mesh.remove_unreferenced_vertices()

ext = np.asarray(mesh.extents, dtype=float)
height_axis = int(np.argmax(ext))
other = [i for i in range(3) if i != height_axis]
# Of the remaining dimensions, width is normally larger than depth.
width_axis = other[int(ext[other[1]] > ext[other[0]])]
depth_axis = other[0] if other[1] == width_axis else other[1]

v = np.asarray(mesh.vertices, dtype=np.float64)
mins = v.min(axis=0)
maxs = v.max(axis=0)
center = (mins + maxs) * 0.5
height = maxs[height_axis] - mins[height_axis]

# Keep roughly the top quarter of the statue: hair through upper chest.
# This avoids the damaged lower-body regions while retaining a useful bust.
cut = mins[height_axis] + height * 0.73
face_centres = v[np.asarray(mesh.faces)].mean(axis=1)
keep = face_centres[:, height_axis] >= cut
mesh.update_faces(keep)
mesh.remove_unreferenced_vertices()

# Reorient to X=width, Y=up, Z=depth.
v = np.asarray(mesh.vertices, dtype=np.float64)
mapped = np.column_stack((
    v[:, width_axis],
    v[:, height_axis],
    v[:, depth_axis],
))

# Choose a front sign heuristically: the face/nose is the thinner protruding side,
# so the vertex distribution is more skewed toward the rear bulk.
z = mapped[:, 2]
z_mid = (z.min() + z.max()) * 0.5
if z.mean() > z_mid:
    mapped[:, 2] *= -1.0

mapped -= (mapped.min(axis=0) + mapped.max(axis=0)) * 0.5
scale = 2.0 / max(np.ptp(mapped, axis=0))
mapped *= scale
mesh.vertices = mapped

# Repair topology and normals once, offline, rather than guessing in WebGL.
mesh.merge_vertices(digits_vertex=5)
mesh.remove_unreferenced_vertices()
trimesh.repair.fix_normals(mesh, multibody=True)

# Drop tiny disconnected scan fragments: retain the largest connected component.
parts = mesh.split(only_watertight=False)
if len(parts) > 1:
    parts = sorted(parts, key=lambda m: len(m.faces), reverse=True)
    main = parts[0]
    if len(main.faces) >= len(mesh.faces) * 0.80:
        mesh = main
        mesh.remove_unreferenced_vertices()
        trimesh.repair.fix_normals(mesh, multibody=True)

positions = np.asarray(mesh.vertices, dtype="<f4")
normals = np.asarray(mesh.vertex_normals, dtype="<f4")
indices = np.asarray(mesh.faces, dtype="<u4").reshape(-1)

if not np.isfinite(positions).all() or not np.isfinite(normals).all():
    raise RuntimeError("Generated mesh contains non-finite values")
if len(positions) < 1000 or len(indices) < 3000:
    raise RuntimeError("Generated head mesh is unexpectedly small")

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("wb") as f:
    f.write(b"DLB1")
    f.write(struct.pack("<II", len(positions), len(indices)))
    f.write(positions.tobytes(order="C"))
    f.write(normals.tobytes(order="C"))
    f.write(indices.tobytes(order="C"))

print("Generated", OUT)
print("Vertices:", len(positions))
print("Triangles:", len(indices)//3)
print("Bounds:", positions.min(axis=0), positions.max(axis=0))
print("Size MB:", OUT.stat().st_size/1024/1024)

"""Build the web rig from Maximilian's SO101 Assembly.stl (millimetres, Z up).

Requires numpy, scipy, trimesh, fast-simplification. The original is read-only.
Usage: python scripts/prepare-robot.py "path/to/SO101 Assembly.stl"
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Optional checkout-local tooling; never shipped to visitors.
sys.path.insert(0, str(ROOT / '.preview/python-libs'))
import numpy as np
import trimesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

source = Path(sys.argv[1])
data = source.read_bytes()
assert hashlib.sha256(data).hexdigest() == 'efe5ed131286e0fa2b95c355886cd9009a34ad5d6a0c7f042a1ba5071f1520cb', 'This rig mapping requires the original supplied assembly; inspect changed CAD before rebuilding.'
raw = np.frombuffer(data, offset=84, dtype=[('n','<f4',3),('v','<f4',(3,3)),('a','<u2')])
assert len(raw) == 752714, 'Component mapping is specific to the supplied SO101 assembly.'
v, inv = np.unique(np.round(raw['v'].reshape(-1,3), 4), axis=0, return_inverse=True)
f = inv.reshape(-1,3)
edges = f[:,[[0,1],[1,2],[2,0]]].reshape(-1,2)
graph = coo_matrix((np.ones(len(edges),dtype=np.uint8),(edges[:,0],edges[:,1])),shape=(len(v),len(v))).tocsr()
count, labels = connected_components(graph,directed=False)
face_labels = labels[f[:,0]]
ordered = np.argsort(-np.bincount(face_labels))
remap = np.empty(count,dtype=np.int32); remap[ordered] = np.arange(count)
c = remap[face_labels]
assert count == 311, 'Unexpected source geometry; inspect before assigning joints.'

# Measured from the circular servo horns, including the CAD's small axis offsets.
disks = [68,72,70,71,69,67]
names = ['base','shoulder_pan','shoulder_lift','elbow','wrist_pitch','wrist_roll','gripper']
joints = [dict(name='base',parent=-1,pivot=[0,0,0.39429554],axis=[0,0,1])]
for i, component in enumerate(disks):
    pts = v[np.unique(f[c==component])]
    _,axes = np.linalg.eigh(np.cov(pts.T)); axis = axes[:,0]
    if axis[np.argmax(abs(axis))] < 0: axis = -axis
    joints.append(dict(name=names[i+1],parent=i,pivot=pts.mean(0).tolist(),axis=axis.tolist()))

# The supplied assembly is folded. These assignments keep the actual rigid
# shells intact; the child horn moves with its output, not its servo housing.
assigned = {17:0,20:0,16:1,18:2,11:3,13:4,14:5,15:6,186:6,
            0:3,1:2,2:1,3:4,4:6,5:5,
            68:1,72:2,70:3,71:4,69:5,67:6,
            129:3,130:2,131:6,132:4,133:1}
servos = [[26,36,79,62,152,156],[27,34,78,60,147,154],
          [30,35,83,58,150,157],[31,33,80,63,151,153],
          [29,37,82,61,149,155],[28,38,81,59,148,158]]
for parent,components in enumerate(servos):
    for component in components: assigned[component] = parent

# Wires are flexible, not rigid links. Omit them and submillimetre electronic
# internals instead of making them stretch or detach during joint movement.
omitted = {0,1,2,3,4,5,6,7,8,9,10,12,58,59,60,61,62,63,*range(147,159)}
anchors=[]; owners=[]
for component,joint in assigned.items():
    pts=v[np.unique(f[c==component])]
    anchors.append(pts); owners.extend([joint]*len(pts))
tree=cKDTree(np.concatenate(anchors)); owners=np.array(owners)
meshes={}; kept=[]
for component in range(count):
    if component in omitted: continue
    faces=f[c==component]; pts=v[np.unique(faces)]
    size=np.ptp(pts,axis=0)
    if component not in assigned and size.max()<4: continue
    center=(pts.min(0)+pts.max(0))/2
    if component in assigned: joint=assigned[component]
    elif center[1]>55 and center[2]<80: joint=0
    else:
        _,near=tree.query(pts)
        joint=int(np.bincount(owners[near],minlength=7).argmax())
    attribute=int(np.bincount(raw['a'][c==component]).argmax())
    material='shell' if attribute==30653 else 'servo' if attribute==3171 else 'metal'
    mesh=trimesh.Trimesh(vertices=v,faces=faces,process=False)
    mesh.remove_unreferenced_vertices()
    target=max(48,min(2400 if material=='shell' else 700,int(len(faces)*.18)))
    if len(faces)>target:
        mesh=mesh.simplify_quadric_decimation(face_count=target,aggression=7)
    mesh.update_faces(mesh.nondegenerate_faces(height=1e-6))
    mesh.remove_unreferenced_vertices()
    mesh=trimesh.graph.smooth_shade(mesh,angle=np.radians(32))
    meshes.setdefault((joint,material),[]).append(mesh)
    kept.append(dict(component=component,joint=names[joint],triangles=len(mesh.faces)))

chunks=[]; groups=[]; offset=0; total=0
for (joint,material),parts in sorted(meshes.items()):
    mesh=trimesh.util.concatenate(parts)
    # Coordinates are relative to their measured pivot; nested groups hold
    # pivot-to-pivot translations. No geometry is stretched to animate the arm.
    pos=(mesh.vertices-np.array(joints[joint]['pivot'])).astype('<f4')
    normals=mesh.vertex_normals.copy()
    # A few two-sided CAD sheets cancel their averaged vertex normal. Use an
    # incident face normal there so the shader never receives a zero vector.
    for index in np.flatnonzero(np.linalg.norm(normals,axis=1)<.5):
        adjacent=mesh.vertex_faces[index]
        normals[index]=mesh.face_normals[adjacent[adjacent>=0][0]]
    normal=np.round(np.clip(normals,-1,1)*32767).astype('<i2')
    assert len(pos)<65536
    idx=mesh.faces.reshape(-1).astype('<u2')
    payload=pos.tobytes()+normal.tobytes()+idx.tobytes()
    payload+=b'\0'*((-len(payload))%4)
    groups.append(dict(joint=joint,material=material,offset=offset,vertices=len(pos),indices=len(idx)))
    chunks.append(payload); offset+=len(payload); total+=len(idx)//3

destination=ROOT/'assets/robot'; destination.mkdir(exist_ok=True)
binary=b''.join(chunks)
(destination/'so101.bin').write_bytes(binary)
manifest=dict(version=2,source='SO101 Assembly.stl',sourceSHA256=hashlib.sha256(data).hexdigest(),
              units='mm',up='Z',sourceTriangles=len(raw),triangles=total,bytes=len(binary),
              joints=joints,groups=groups,components=kept)
(destination/'so101.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(sourceTriangles=len(raw),triangles=total,bytes=len(binary),drawCalls=len(groups),components=len(kept))))

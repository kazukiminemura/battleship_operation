"""Run with Blender --background --python scripts/blender/build_battleship.py.

Original modular, WWII-inspired artwork; not a replica of an individual ship.
Blender is the authoring source. Export evaluated bevels and split normals to a
small indexed runtime mesh kit, so synchronous designer/combat builds agree.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src/game/rendering/assets'
SOURCE = ROOT / 'assets/blender'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
FREEBOARD = .028
L, W, H = 12.825, 12.825 / 7.3, 12.825 * FREEBOARD / .44
D = H * .44
materials = {}
for name, color, rough, metal in [
    ('paint', (.29, .34, .35, 1), .64, .35),
    ('edge', (.42, .46, .46, 1), .48, .55),
    ('dark', (.065, .08, .082, 1), .60, .35),
    ('red', (.25, .065, .05, 1), .82, .1),
    ('timber', (.47, .36, .22, 1), .9, 0),
    ('glass', (.07, .16, .19, 1), .2, .6),
]:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    materials[name] = mat

collections = {}
for name in ['hull', 'bridge', 'turret', 'funnel', 'barrel']:
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    collections[name] = col
active = 'hull'

def register(obj, name, mat, bevel=0, smooth=False):
    obj.name = name
    for col in list(obj.users_collection): col.objects.unlink(obj)
    collections[active].objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(materials[mat])
    if smooth:
        for poly in obj.data.polygons: poly.use_smooth = True
    if bevel:
        mod = obj.modifiers.new('Manufactured edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return obj

def box(name, pos, dims, mat='paint', bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return register(obj, name, mat, bevel)

def rod(name, a, b, radius=.008, mat='edge', vertices=8):
    a, b = Vector(a), Vector(b)
    direction = b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_euler = direction.to_track_quat('Z','Y').to_euler()
    return register(obj, name, mat, smooth=True)

def mesh(name, vertices, faces, mat, smooth=False, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collections[active].objects.link(obj)
    register(obj, name, mat, bevel, smooth)
    # Recalculate outward normals before exporting evaluated geometry.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return obj

def half(u):
    stern = math.sqrt(max(0, 1-(1-min(1,u/.22))**2))
    bow = math.sin(min(1,(1-u)/.36)*math.pi/2)**.85
    return W*.5*stern*bow

def sheer(u):
    t = min(1,max(0,(u-.60)/.28))
    return H*.14*t*t*(3-2*t)

# Smooth longitudinal loft, with flared shoulders and rounded underwater bilges.
stations = 96
sections = [(-.48,.13),(-.46,.40),(-.40,.66),(-.29,.82),(-.12,.91),
            (0,.945),(.20,.976),(.36,.995),(.44,1)]
vertices=[]
ring = len(sections)*2
for i in range(stations+1):
    u = .001 + .998*i/stations
    for side, levels in [(-1, sections), (1,list(reversed(sections)))]:
        for z, width in levels:
            # Rake the stem aft below the forecastle instead of a vertical cut.
            rake = max(0, (u-.78)/.22)**3 * max(0, .44-z) * .52
            # Continuous sheer avoids a kink between adjacent shell strakes.
            raised = sheer(u) * max(0, min(1, (z+.12)/.56))
            vertices.append(((u-.5)*L-rake,side*half(u)*width,z*H+raised))
faces=[]
for i in range(stations):
    for j in range(ring):
        if j == len(sections)-1: continue  # open weather deck, separate surface
        a=i*ring+j; b=i*ring+(j+1)%ring
        faces.append((a,b,b+ring,a+ring))
faces.extend([tuple(reversed(range(ring))),tuple(stations*ring+j for j in range(ring))])
obj=mesh('Lofted shell plating',vertices,faces,'paint',True)
obj.data.materials.append(materials['red'])
obj.data.materials.append(materials['dark'])
for p in obj.data.polygons:
    z=sum(obj.data.vertices[n].co.z for n in p.vertices)/len(p.vertices)
    p.material_index=1 if z < -.12*H else 2 if z < 0 else 0

v=[];f=[]
for i in range(stations+1):
    u=i/stations
    for side in [-1,1]: v.append(((u-.5)*L,side*half(u)*.992,D+sheer(u)+.005))
    if i<stations:
        a=i*2;f.append((a,a+2,a+3,a+1))
mesh('Laid teak weather deck',v,f,'timber')

# Low submerged bow bulb, smoothly joined under the raked stem.
bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,location=(L*.459,0,-H*.34))
bulb=bpy.context.object
bulb.scale=(.48,.135,.16)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
register(bulb,'Submerged bow bulb','red',smooth=True)
for side in [-1,1]:
    x=L*.422;u=x/L+.5;y=side*half(u)*.985;z=D+sheer(u)-.15
    rod('Anchor shank',(x,y,z),(x-.11,y,z-.16),.019,'dark',8)
    rod('Anchor stock',(x-.07,y-.07,z-.1),(x-.07,y+.07,z-.1),.015,'edge',8)
    for dx in [-1,1]:
        mesh('Stockless anchor fluke',[(x-.11,y,z-.16),(x-.11+dx*.09,y-.025,z-.12),(x-.11+dx*.065,y+.025,z-.22)],[(0,1,2)],'dark')

for side in [-1,1]:
    for tier in [.055,.105]:
        for i in range(62):
            u=.025+.95*i/62; t=.025+.95*(i+1)/62
            rod('Safety rail',((u-.5)*L,side*half(u)*.975,D+sheer(u)+tier),((t-.5)*L,side*half(t)*.975,D+sheer(t)+tier),.0045)
    for i in range(63):
        u=.025+.95*i/62;x=(u-.5)*L;y=side*half(u)*.975;z=D+sheer(u)
        rod('Rail stanchion',(x,y,z),(x,y,z+.11),.005)
    # Thin longitudinal strake outlines and subtle scupper apertures.
    for i in range(34):
        u=.12+i*.022;x=(u-.5)*L
        box('Scupper',(x,side*half(u)*.986,H*.31+sheer(u)),(.042,.009,.012),'dark',.002)
    for u in [.12,.25,.76,.87]:
        x=(u-.5)*L;y=side*half(u)*.77;z=D+sheer(u)
        box('Bollard foot',(x,y,z+.008),(.14,.09,.017),'dark',.005)
        for dx in [-.044,.044]:
            rod('Mooring bollard',(x+dx,y,z),(x+dx,y,z+.065),.021,'paint',12)
            rod('Bollard rim',(x+dx,y,z+.06),(x+dx,y,z+.074),.029,'edge',12)
    # Chain cable: a low-poly, alternating-link run, never extra weaponry.
    for i in range(25):
        u=.83+i*.0023;x=(u-.5)*L;y=side*.17;z=D+sheer(u)+.019
        bpy.ops.mesh.primitive_torus_add(major_segments=8,minor_segments=4,location=(x,y,z),major_radius=.018,minor_radius=.004)
        obj=bpy.context.object
        obj.scale.x=1.3
        if i%2:obj.rotation_euler.x=math.pi/2
        register(obj,'Anchor chain link','dark')
    x=L*.325;z=D+sheer(.825)
    rod('Windlass shaft',(x,side*.11,z+.065),(x,side*.28,z+.065),.04,'paint',12)
    # Stern propeller shafts and rudders are visible when orbiting below deck.
    rod('Propeller shaft',(-L*.32,side*.34,-H*.30),(-L*.45,side*.40,-H*.35),.028,'edge',12)
    for angle in [0,math.pi/2,math.pi,3*math.pi/2]:
        blade=box('Propeller blade',(-L*.44,side*.40+math.cos(angle)*.09,-H*.35+math.sin(angle)*.09),(.026,.17,.055),'edge',.013)
        blade.rotation_euler.x=angle
    box('Rudder',(-L*.47,side*.15,-H*.34),(.18,.022,.27),'red',.016)

# A modular pagoda bridge: all coordinates relative to its deck seat.
active='bridge'
box('Armored conning base',(0,0,.20),(.72,.65,.40),'paint',.045)
box('Tower core',(-.07,0,.76),(.39,.39,.98),'paint',.055)
box('Lower chart house',(.045,0,.51),(.67,.62,.23),'paint',.035)
box('Signal and operations deck',(-.025,0,.79),(.57,.57,.28),'paint',.045)
box('Aft communications room',(-.35,0,.20),(.48,.58,.38),'paint',.04)
for side in [-1,1]:
    # Enclosed wings, supporting brackets and ventilators replace empty terraces.
    box('Bridge wing',(.04,side*.39,.46),(.39,.23,.12),'paint',.015)
    for x in [-.10,.14]:
        rod('Wing brace',(x,side*.21,.21),(x,side*.46,.40),.013,'paint',8)
    for x in [-.22,-.09,.04,.17]:
        box('Signal deck glazing',(x,side*.288,.84),(.077,.009,.056),'glass',.002)
        box('Chart room glazing',(x,side*.314,.55),(.077,.009,.052),'glass',.002)
    for z in [.13,.17,.21,.25]:
        box('Conning ventilation',(-.36,side*.296,z),(.21,.009,.014),'dark',.001)
    box('Watertight door',(.02,side*.328,.19),(.093,.016,.18),'edge',.014)
    rod('Door handle',(.02,side*.344,.18),(.052,side*.344,.18),.005,'dark',6)
for z,a,b in [(.39,.82,.76),(.66,.67,.72),(.96,.73,.85),(1.25,.61,.65)]:
    box('Observation platform',(0,0,z),(a,b,.045),'edge',.022)
    for side in [-1,1]:
        for i in range(7):
            x=-a*.46+i*a*.92/6
            rod('Platform guard post',(x,side*b*.46,z),(x,side*b*.46,z+.075),.004)
        rod('Platform guard rail',(-a*.46,side*b*.46,z+.075),(a*.46,side*b*.46,z+.075),.004)
box('Navigation bridge',(.06,0,1.08),(.53,.58,.21),'paint',.03)
for side in [-1,1]:
    for i in range(5):
        box('Bridge side glazing',(-.13+i*.085,side*.295,1.11),(.064,.009,.063),'glass',.002)
for i in range(6):box('Forward glazing',(.329,-.235+i*.094,1.11),(.01,.069,.065),'glass',.002)
rod('Director pedestal',(0,0,1.27),(0,0,1.43),.14,'paint',20)
rod('Optical rangefinder',(0,-.57,1.46),(0,.57,1.46),.054,'edge',16)
for side in [-1,1]:
    box('Rangefinder hood',(0,side*.56,1.47),(.15,.13,.14),'paint',.02)
    rod('Tripod mast foot',(-.3,side*.26,.50),(-.34,0,1.93),.016,'edge')
rod('Mast',(-.34,0,.4),(-.34,0,2.11),.014,'edge')
rod('Yardarm',(-.34,-.67,1.84),(-.34,.67,1.84),.01,'dark')
for side in [-1,1]:
    rod('Aerial rigging',(-.34,side*.66,1.84),(-.34,0,2.11),.002,'dark',4)
for i in range(16):
    z=.4+i*.052
    rod('Ladder rung',(-.277,-.048,z),(-.277,.048,z),.004,'edge',6)

# Optical instruments, shielded lookout tubs and structural supports make the
# bridge read as working naval architecture rather than a stack of boxes.
for side in [-1,1]:
    rod('Lookout pedestal',(.03,side*.40,.52),(.03,side*.40,.65),.021,'paint',10)
    rod('Binocular crossbar',(.03,side*.36,.66),(.03,side*.44,.66),.018,'dark',10)
    for dy in [-.033,.033]:
        rod('Binocular tube',(.015,side*.40+dy,.66),(.105,side*.40+dy,.66),.017,'edge',10)
    # A recessed searchlight behind a protective hood, no emissive night beam.
    rod('Searchlight yoke',(-.23,side*.35,.97),(-.23,side*.35,1.075),.018,'paint',10)
    rod('Searchlight casing',(-.26,side*.35,1.085),(-.15,side*.35,1.085),.057,'paint',20)
    rod('Searchlight lens',(-.147,side*.35,1.085),(-.144,side*.35,1.085),.047,'glass',20)
    for z in [.40,.67,.97]:
        for x in [-.22,.22]:
            rod('Observation deck diagonal',(x,side*.19,z-.13),(x,side*.35,z-.01),.009,'paint',6)
for i in range(6):
    z=.51+i*.044
    box('External stair tread',(-.38-i*.018,-.28,z),(.052,.15,.012),'edge',.001)

# Gun housing only. Gameplay creates the requested number of barrels separately.
# Blender +Y front becomes Three.js -Z front.
active='turret'
outline=[(-.35,-.29),(.35,-.29),(.40,.10),(.28,.35),(-.28,.35),(-.40,.10)]
v=[(x,y,.07) for x,y in outline]+[(x*.84,y*.83,.35) for x,y in outline]
f=[tuple(reversed(range(6))),tuple(range(6,12))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
mesh('Sloped armored gunhouse',v,f,'paint',False,.016)
rod('Turret race',(0,0,-.05),(0,0,.075),.365,'dark',32)
box('Roof access hatch',(0,-.08,.36),(.20,.15,.025),'edge',.012)
for side in [-1,1]:
    box('Sighting hood',(side*.31,-.08,.31),(.11,.19,.10),'paint',.012)
    box('Optical aperture',(side*.31,.02,.31),(.067,.008,.038),'glass',.001)
    for i in range(4):
        box('Rear ventilation slit',(side*(.14+i*.04),-.286,.17),(.017,.009,.074),'dark',.002)

active='barrel'
# A separate, hollow stepped gun tube. One instance per *actual* game barrel.
# Rings run along Blender +Y (Three -Z); the muzzle has real inner geometry.
rings=[(.19,.061),(.28,.059),(.42,.052),(.43,.044),(.74,.037),(.75,.033),(1.22,.026),(1.25,.027),(1.25,.019),(1.16,.018)]
v=[];f=[]
for y,r in rings:
    for i in range(24):
        a=i*math.tau/24
        v.append((math.cos(a)*r,y,.23+math.sin(a)*r))
for j in range(len(rings)-1):
    for i in range(24):
        a=j*24+i;b=j*24+(i+1)%24;f.append((a,b,b+24,a+24))
tube=mesh('Built-up rifled gun tube',v,f,'paint',True)
tube.data.materials.append(materials['dark'])
for poly in tube.data.polygons:
    if poly.index>=8*24:poly.material_index=1
rod('Recessed bore shadow',(0,1.153,.23),(0,1.156,.23),.018,'dark',24)
bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,location=(0,.21,.23))
bag=bpy.context.object;bag.scale=(.073,.112,.068)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# Soft irregular canvas folds, distinct from the metal gun tube.
for vertex in bag.data.vertices:
    angle=math.atan2(vertex.co.z,vertex.co.x)
    factor=1+.065*math.sin(angle*10+vertex.co.y*30)
    vertex.co.x*=factor;vertex.co.z*=factor
register(bag,'Canvas blast bag','dark',smooth=True)

active='funnel'
# Raked oval uptake with an open soot-dark mouth, reinforcing bands and pipes.
for level, radius, z in [('body',1,0),('lip',1.03,.89)]:
    verts=[];faces=[]
    for h,r in ([(0,1),(.88,.87),(.94,.90)] if level=='body' else [(0,1),(.065,1)]):
        for i in range(40):
            angle=i*math.tau/40
            verts.append((math.cos(angle)*.42*r*radius-(h+z)*.16,math.sin(angle)*.255*r*radius,h+z))
    rings=len(verts)//40
    for j in range(rings-1):
        for i in range(40):
            a=j*40+i;b=j*40+(i+1)%40;faces.append((a,b,b+40,a+40))
    mesh('Raked funnel '+level,verts,faces,'paint' if level=='body' else 'dark',True)
box('Uptake casing',(0,0,.07),(.88,.61,.14),'paint',.04)
box('Exhaust darkness',(-.12,0,.84),(.57,.32,.008),'dark',.07)
for z in [.24,.53,.76]:
    for i in range(40):
        a=i*math.tau/40;b=(i+1)*math.tau/40;r=1-z*.14
        rod('Funnel reinforcing band',(math.cos(a)*.425*r-z*.16,math.sin(a)*.26*r,z),(math.cos(b)*.425*r-z*.16,math.sin(b)*.26*r,z),.006,'edge',6)
for side in [-1,1]:
    rod('Steam pipe',(.29,side*.22,.05),(.20,side*.22,.77),.018,'edge',10)
    for i in range(9):box('Uptake louvre',(-.28+i*.062,side*.308,.085),(.034,.008,.061),'dark',.002)

# Export evaluated Blender meshes, grouped by material to bound runtime draw calls.
depsgraph=bpy.context.evaluated_depsgraph_get()
kit={'version':2,'generator':'Blender '+bpy.app.version_string,'referenceLength':L,'freeboardRatio':FREEBOARD,'parts':{}}
for name,col in collections.items():
    groups={}
    for obj in col.objects:
        if obj.type!='MESH':continue
        evaluated=obj.evaluated_get(depsgraph)
        data=evaluated.to_mesh()
        data.calc_loop_triangles()
        matrix=obj.matrix_world
        normal_matrix=matrix.to_3x3().inverted().transposed()
        for tri in data.loop_triangles:
            mat=data.materials[tri.material_index].name
            g=groups.setdefault(mat,{'material':mat,'positions':[],'normals':[],'uv':[],'indices':[],'lookup':{}})
            for loop in tri.loops:
                co=matrix@data.vertices[data.loops[loop].vertex_index].co
                normal=(normal_matrix@data.corner_normals[loop].vector).normalized()
                # Right-handed Z-up -> Y-up, same as glTF's Blender convention.
                p=tuple(round(n,5) for n in (co.x,co.z,-co.y))
                n=tuple(round(n,5) for n in (normal.x,normal.z,-normal.y))
                key=p+n
                if key not in g['lookup']:
                    g['lookup'][key]=len(g['positions'])//3
                    g['positions'].extend(p);g['normals'].extend(n)
                    # Wall surfaces need vertical UVs; top-down projection alone
                    # stretched all hull paint into featureless stripes.
                    uv=(co.x,co.z) if abs(normal.y)>.6 else (co.y,co.z) if abs(normal.x)>.6 else (co.x,-co.y)
                    g['uv'].extend([round(uv[0],5),round(uv[1],5)])
                g['indices'].append(g['lookup'][key])
        evaluated.to_mesh_clear()
    kit['parts'][name]=[]
    for g in groups.values():
        del g['lookup'];kit['parts'][name].append(g)
(OUT/'battleship-kit.json').write_text(json.dumps(kit,separators=(',',':')),encoding='utf8')
print('EXPORTED', {k:sum(len(g['indices'])//3 for g in v) for k,v in kit['parts'].items()})

# Show an assembled reference ship on opening the .blend, with reusable source
# collections linked by instances. The game's actual loadout remains authoritative.
for col in collections.values():bpy.context.scene.collection.children.unlink(col)
def instance(name, part, pos, angle=0):
    obj=bpy.data.objects.new(name,None)
    obj.instance_type='COLLECTION';obj.instance_collection=collections[part]
    obj.location=pos;obj.rotation_euler.z=angle
    bpy.context.scene.collection.objects.link(obj)
instance('Reference hull','hull',(0,0,0))
instance('Reference bridge','bridge',(0,0,D))
instance('Reference funnel','funnel',(-1.6,0,D))
for x in [-4.7,2.4,4.8]:
    angle=math.pi/2 if x<0 else -math.pi/2
    seat=D+sheer(x/L+.5)
    instance('Reference gunhouse','turret',(x,0,seat),angle)
    for offset in [-.18,0,.18]:
        instance('Reference gun barrel','barrel',(x+math.cos(angle)*offset,math.sin(angle)*offset,seat),angle)
bpy.context.scene.world.color=(.18,.18,.18)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=17
            area.spaces.active.region_3d.view_location=(0,0,.6)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'battleship-kit.blend'))

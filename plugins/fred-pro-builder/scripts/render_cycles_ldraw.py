#!/usr/bin/env python3
"""
Fred Pro-Builder Plugin: Headless Blender Cycles + ImportLDraw Photorealistic Studio Renderer.

Aufruf:
  blender --background --python plugins/fred-pro-builder/scripts/render_cycles_ldraw.py -- \
    --input model.ldr --output render.png --samples 128 --width 1920 --height 1080
"""

import argparse
import math
import os
import sys


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    parser = argparse.ArgumentParser(description="Fred Blender Cycles LDraw Studio Renderer")
    parser.add_argument("--input", required=True, help="Pfad zur .ldr/.mpd Datei")
    parser.add_argument("--output", required=True, help="Ausgabepfad für das PNG-Rendering")
    parser.add_argument("--samples", type=int, default=128, help="Cycles Path-Tracing Samples")
    parser.add_argument("--width", type=int, default=1920, help="Bildbreite in Pixel")
    parser.add_argument("--height", type=int, default=1080, help="Bildhöhe in Pixel")
    return parser.parse_args(argv)


def render_ldraw_cycles(input_path: str, output_path: str, samples: int, width: int, height: int):
    import bpy  # type: ignore

    # 1. Reset scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # 2. Configure Cycles Path-Tracer with OpenImageDenoise
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"

    # 3. Import LDraw model via ImportLDraw add-on (photorealistic ABS shaders + bevels + studs)
    if not hasattr(bpy.ops.import_scene, "importldraw"):
        raise RuntimeError(
            "Blender Add-on 'ImportLDraw' ist nicht installiert. "
            "Bitte von https://github.com/TobyLobster/ImportLDraw installieren."
        )

    bpy.ops.import_scene.importldraw(
        filepath=os.path.abspath(input_path),
        addEnvironment=False,
        useLogoStuds=False,
        look="normal",
        bevelEdges=True,
        bevelWidth=0.5,
        gaps=True,
    )

    # 4. Studio white cyclorama floor + soft 3-point lighting rig
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.02))
    floor = bpy.context.active_object
    floor_mat = bpy.data.materials.new(name="FredStudioFloor")
    floor_mat.use_nodes = True
    bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.96, 0.97, 0.98, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.35
    floor.data.materials.append(floor_mat)

    def add_area_light(name: str, loc, rot_deg, energy: float, size: float):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light_obj = bpy.context.active_object
        light_obj.name = name
        light_obj.data.energy = energy
        light_obj.data.size = size
        light_obj.rotation_euler = tuple(math.radians(a) for a in rot_deg)

    add_area_light("KeySoftbox", (18, -22, 24), (48, 0, 38), 1800.0, 12.0)
    add_area_light("FillSoftbox", (-20, -14, 16), (55, 0, -45), 650.0, 16.0)
    add_area_light("RimSoftbox", (0, 22, 18), (-55, 0, 180), 900.0, 14.0)

    # 5. Frame camera at crisp 3/4 catalog isometric angle (50mm lens)
    bpy.ops.object.camera_add(location=(24, -28, 18))
    cam = bpy.context.active_object
    cam.data.lens = 50.0
    scene.camera = cam

    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type == "MESH" and obj != floor:
            obj.select_set(True)
    bpy.ops.view3d.camera_to_view_selected()

    # 6. Render output PNG
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    scene.render.filepath = os.path.abspath(output_path)
    bpy.ops.render.render(write_still=True)
    print(f"Fred Cycles Render abgeschlossen: {output_path}")


if __name__ == "__main__":
    args = parse_args()
    render_ldraw_cycles(args.input, args.output, args.samples, args.width, args.height)

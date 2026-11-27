import * as THREE from 'three';
import { MATS } from '../assets/models.js';

/**
 * See-through cutout: buildings and props between the camera and the hero are
 * dithered away inside a soft cylinder along the camera → hero line, so walls
 * and the map edge never hide the fight. Only the world's merged building/prop
 * meshes use this material; heroes, mobs and the ground are untouched.
 * Run.updateCamera feeds the uniforms every frame (setSeeThrough).
 */
const uniforms = {
  uCam: { value: new THREE.Vector3() },
  uTarget: { value: new THREE.Vector3() },
  uR: { value: 2.4 },
};

let material = null;

/** The shared world material (a MATS.flat clone with the cutout patched in). */
export function seeThroughMaterial() {
  if (material) return material;
  material = MATS.flat.clone();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeeWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSeeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vSeeWorld;
uniform vec3 uCam;
uniform vec3 uTarget;
uniform float uR;
float seeBayer(vec2 p) {
  // 4x4 ordered dither, 0..1
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  float v = 0.0;
  if (i < 1.0) v = 0.0; else if (i < 2.0) v = 8.0; else if (i < 3.0) v = 2.0; else if (i < 4.0) v = 10.0;
  else if (i < 5.0) v = 12.0; else if (i < 6.0) v = 4.0; else if (i < 7.0) v = 14.0; else if (i < 8.0) v = 6.0;
  else if (i < 9.0) v = 3.0; else if (i < 10.0) v = 11.0; else if (i < 11.0) v = 1.0; else if (i < 12.0) v = 9.0;
  else if (i < 13.0) v = 15.0; else if (i < 14.0) v = 7.0; else if (i < 15.0) v = 13.0; else v = 5.0;
  return (v + 0.5) / 16.0;
}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
{
  vec3 ab = uTarget - uCam;
  float L = length(ab);
  vec3 dir = ab / L;
  vec3 ap = vSeeWorld - uCam;
  float t = dot(ap, dir);
  if (t > 0.0 && t < L - 0.8 && vSeeWorld.y > 0.12) {
    float d = length(ap - dir * t);
    float rr = uR * mix(0.55, 1.0, t / L);
    float fade = 1.0 - smoothstep(rr * 0.45, rr, d);
    if (fade > seeBayer(gl_FragCoord.xy)) discard;
  }
}`);
  };
  material.customProgramCacheKey = () => 'thugrats-see-through';
  return material;
}

/** Point the cutout at the hero (call after the camera moves). */
export function setSeeThrough(camera, x, y, z, camDist = 1) {
  uniforms.uCam.value.copy(camera.position);
  uniforms.uTarget.value.set(x, y, z);
  uniforms.uR.value = 3.2 * camDist;
}

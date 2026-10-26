// Entrada do motor para a página 3D (index.html): o vite empacota em anim-engine.js (IIFE, globalThis.Anim).
// Gerado por scripts/anim-stills.mjs; o arquivo gerado fica fora do git.
import { SEG, STAND_Y } from '../../src/anim/body'
import { EXERCISES } from '../../src/anim/exercises'
import { MUSCLES } from '../../src/anim/muscles'
import { DIM, insideSolid, legPressPlatform, midHands, solidsAt } from '../../src/anim/props'
import { DEFAULT_CAMERA, makeCamera, viewBoxFor } from '../../src/anim/render/camera'
import { discBasis, shapesOf } from '../../src/anim/render/propGeom'
import { cycleMs, musclesOf, sampleAt, stillFrames } from '../../src/anim/spec'

;(globalThis as Record<string, unknown>).Anim = {
  EXERCISES, cycleMs, sampleAt, musclesOf, stillFrames, MUSCLES, DEFAULT_CAMERA, makeCamera, viewBoxFor,
  DIM, midHands, SEG, STAND_Y, shapesOf, discBasis, solidsAt, insideSolid, legPressPlatform,
}

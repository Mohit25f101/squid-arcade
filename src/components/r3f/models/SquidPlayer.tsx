"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";

export const SQUID_SCALE = 0.25;
export const SQUID_Y_OFF = 3.25 * SQUID_SCALE;

const MODEL_PATH = "/models/minecraft_squid/minecraft_squid.gltf";
useGLTF.preload(MODEL_PATH);

export type SquidAnimState = "idle" | "running" | "jumping" | "hit" | "finished";

export interface SquidPlayerProps {
  position: [number, number, number];
  facing?: 1 | -1;
  animState?: SquidAnimState;
  animPhase?: number;
  opacity?: number;
  squash?: [number, number, number];
  isHuman?: boolean;
  isEliminated?: boolean;
}

const SquidPlayer = React.memo(function SquidPlayer({
  position, facing = 1, animState = "idle", animPhase = 0,
  opacity = 1, squash = [1, 1, 1], isHuman = false, isEliminated = false,
}: SquidPlayerProps) {
  
  const { scene: srcScene } = useGLTF(MODEL_PATH) as GLTF & { scene: THREE.Group };

  // Clone scene without destroying the original textures!
  const clonedScene = useMemo(() => {
    const clone = srcScene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Clone material so we can adjust opacity independently
        if (child.material) {
          child.material = (child.material as THREE.Material).clone();
        }
      }
    });
    return clone;
  }, [srcScene]);

  // Flash red ONLY when eliminated, otherwise show normal textures
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
        
        if (isEliminated) {
          mat.emissive = new THREE.Color("#ff0000");
          mat.emissiveIntensity = 0.8;
        } else {
          mat.emissive = new THREE.Color("#000000");
          mat.emissiveIntensity = 0;
        }
      }
    });
  }, [isEliminated, opacity, clonedScene]);

  const groupRef = useRef<THREE.Group>(null!);
  const modelRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (!groupRef.current || !modelRef.current) return;
    const g = groupRef.current;
    const m = modelRef.current;

    m.scale.x = THREE.MathUtils.lerp(m.scale.x, squash[0] * SQUID_SCALE, delta * 14);
    m.scale.y = THREE.MathUtils.lerp(m.scale.y, squash[1] * SQUID_SCALE, delta * 14);
    m.scale.z = THREE.MathUtils.lerp(m.scale.z, squash[2] * SQUID_SCALE, delta * 14);

    const isRunning = animState === "running";
    const bobY = isRunning ? Math.sin(animPhase * Math.PI * 2) * 0.06 : 0;
    const leanTarget = isRunning ? (facing === 1 ? -0.18 : 0.18) : 0;
    
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, leanTarget, delta * 8);
    if (animState === "jumping") g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, facing === 1 ? -0.35 : 0.35, delta * 12);
    
    m.position.y = SQUID_Y_OFF + bobY;
    const targetScaleX = (facing === 1 ? 1 : -1) * Math.abs(m.scale.x);
    if (Math.sign(m.scale.x) !== Math.sign(targetScaleX)) m.scale.x = targetScaleX;
  });

  return (
    <group ref={groupRef} position={position}>
      <group ref={modelRef} scale={SQUID_SCALE} position={[0, SQUID_Y_OFF, 0]}>
        <primitive object={clonedScene} />
      </group>
      {/* Subtle spotlight on the human player so they stand out in the crowd */}
      {isHuman && <pointLight color="#ffffff" intensity={1} distance={4} position={[0, 2, 0]} />}
    </group>
  );
});

export default SquidPlayer;
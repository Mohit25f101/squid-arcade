"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";

const MODEL_PATH = "/models/soldier/soldier.gltf";
const SOLDIER_SCALE = 0.01;

export interface SoldierModelProps {
  position: [number, number, number];
  facing: 1 | -1;
  isShooting: boolean;
  targetPosition: THREE.Vector3 | null;
  shootProgress: number;
}

const SoldierModel = React.memo(function SoldierModel({
  position,
  facing,
  isShooting,
  targetPosition,
  shootProgress,
}: SoldierModelProps) {
  const { scene: srcScene } = useGLTF(MODEL_PATH) as GLTF & {
    scene: THREE.Group;
  };

  const clonedScene = useMemo(() => {
    const clone = srcScene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [srcScene]);

  const groupRef = useRef<THREE.Group>(null!);
  const spineRef = useRef<THREE.Bone | null>(null);

  // Locate the spine/head bone for procedural aiming
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.type === "Bone" && (child.name.includes("Spine") || child.name.includes("Head"))) {
        if (!spineRef.current) spineRef.current = child as THREE.Bone;
      }
    });
  }, [clonedScene]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Flip the soldier based on which side of the finish line they stand
    const targetScaleX = facing * Math.abs(groupRef.current.scale.x);
    if (Math.sign(groupRef.current.scale.x) !== Math.sign(targetScaleX)) {
      groupRef.current.scale.x = targetScaleX;
    }

    // Procedurally track the player when eliminating
    if (isShooting && targetPosition && spineRef.current) {
      spineRef.current.lookAt(targetPosition);
    }
  });

  // Time the muzzle flash to the exact moment of the slow-mo impact in the simulation
  const showFlash = isShooting && shootProgress > 0.45 && shootProgress < 0.65;

  return (
    <group position={position}>
      <group ref={groupRef} scale={SOLDIER_SCALE}>
        <primitive object={clonedScene} />
      </group>

      {/* Gun Muzzle Flash */}
      {showFlash && (
        <pointLight
          color="#ffaa00"
          intensity={12}
          distance={15}
          decay={2}
          position={[facing === 1 ? 0.8 : -0.8, 1.4, 0.5]} 
        />
      )}
    </group>
  );
});

useGLTF.preload(MODEL_PATH);

export default SoldierModel;
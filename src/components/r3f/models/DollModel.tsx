"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";

const MODEL_PATH = "/models/doll/doll.gltf";
const DOLL_SCALE = 0.015;

useGLTF.preload(MODEL_PATH);

export interface DollModelProps {
  position: [number, number, number];
  lightPhase: "green" | "warning" | "turning" | "red" | "fake_out";
  headAngle: number;
  isHostile: boolean;
  atmosphericT: number;
}

const DollModel = React.memo(function DollModel({
  position,
  headAngle,
  isHostile,
  atmosphericT,
}: DollModelProps) {
  const { scene: srcScene } = useGLTF(MODEL_PATH) as GLTF & {
    scene: THREE.Group;
  };

  // Clone so each instance is independent
  const clonedScene = useMemo(() => srcScene.clone(true), [srcScene]);

  const headRef = useRef<THREE.Object3D | null>(null);
  const eyesRef = useRef<THREE.MeshStandardMaterial[]>([]);

  // Locate Head node and Eye materials on mount
  useEffect(() => {
    eyesRef.current = []; // Reset on remount

    clonedScene.traverse((child) => {
      // Node 12 is the Head based on the GLTF hierarchy
      if (child.name.toLowerCase().includes("head") || child.name === "Node_12") {
        headRef.current = child;
      }

      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat && mat.name) {
          const name = mat.name.toLowerCase();
          if (name.includes("eye_black") || name.includes("lens")) {
            // Isolate the eye materials so they glow independently
            child.material = mat.clone();
            eyesRef.current.push(child.material as THREE.MeshStandardMaterial);
          }
        }
      }
    });

    // Hard fallback if traversal by name fails
    if (!headRef.current && clonedScene.children.length > 12) {
      headRef.current = clonedScene.children[12];
    }
  }, [clonedScene]);

  // Drive Emissive Eye Glow when Hostile
  useEffect(() => {
    const glowColor = new THREE.Color(isHostile ? "#ff0000" : "#000000");
    const intensity = isHostile ? 8.0 : 0.0;

    eyesRef.current.forEach((mat) => {
      mat.emissive = glowColor;
      mat.emissiveIntensity = intensity;
    });
  }, [isHostile]);

  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;

    // 1. Procedural breathing
    const breathe = Math.sin(atmosphericT * 1.5) * 0.03;
    groupRef.current.position.y = breathe;

    // 2. Head Rotation (Driven by game sim, Math.PI = red, 0 = green)
    if (headRef.current) {
      // The doll rotates her head based on the phase
      headRef.current.rotation.y = headAngle;
    }
  });

  return (
    <group position={position}>
      <group ref={groupRef} scale={DOLL_SCALE}>
        <primitive object={clonedScene} />
      </group>

      {/* Environmental Red Light cast from the Doll's face when hostile */}
      {isHostile && (
        <pointLight
          color="#ff0000"
          intensity={5}
          distance={20}
          decay={2}
          position={[0, 4.5, -1]}
        />
      )}
    </group>
  );
});

export default DollModel;
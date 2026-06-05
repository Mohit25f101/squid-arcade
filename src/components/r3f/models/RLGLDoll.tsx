"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * RLGL Doll (Procedural Young-Hee)
 * 
 * GREEN LIGHT: faces tree (rotation = 0)
 * RED LIGHT: turns toward contestants (rotation = Math.PI)
 * 
 * Smooth body turn + smooth head turn
 */

interface RLGLDollProps {
  position: [number, number, number];
  targetRotation: number;
  isRed: boolean;
  scanIntensity: number;
}

export function RLGLDoll({ position, targetRotation, isRed, scanIntensity }: RLGLDollProps) {
  const group = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const bodyLean = isRed ? -0.12 : 0;
  const bodyRise = isRed ? 0.08 : 0;

  useFrame((state, dt) => {
    if (!group.current) return;

    // Smooth body turn
    const bodySpeed = 1 - Math.exp(-5.5 * dt);
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      targetRotation,
      bodySpeed
    );

    // Smooth head turn (slightly overshoots body)
    if (headRef.current) {
      const headTargetY = targetRotation * 1.18;
      const headSpeed = 1 - Math.exp(-4.0 * dt);
      headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y,
        headTargetY,
        headSpeed
      );
    }
    
    if (isRed) {
      group.current.position.y = position[1] + bodyRise + Math.sin(state.clock.elapsedTime * 3) * 0.02;
      group.current.rotation.x = bodyLean;
      group.current.rotation.z = 0;
    } else if (Math.abs(targetRotation) < 0.1) {
      const t = state.clock.elapsedTime;
      group.current.rotation.z = Math.sin(t * 1.8) * 0.035;
      group.current.position.y = position[1] + Math.sin(t * 1.2) * 0.04;
      group.current.rotation.x = Math.sin(t * 0.8) * 0.015;
    } else {
      group.current.rotation.z = 0;
      group.current.rotation.x = 0;
      group.current.position.y = position[1];
    }
  });

  const eyeColor = isRed ? "#ff0000" : "#111";
  const eyeIntensity = isRed ? (0.8 + scanIntensity * 0.2) * 8 : 0;

  return (
    <group ref={group} position={position}>
      <group ref={bodyRef}>
        <mesh position={[0, 1.8, 0]}>
          <coneGeometry args={[1.5, 3.6, 32]} />
          <meshStandardMaterial color="#f9a03f" roughness={0.7} />
        </mesh>
        <mesh position={[0, 3.2, 0]}>
          <cylinderGeometry args={[0.7, 1.2, 1.0, 32]} />
          <meshStandardMaterial color="#fde74c" roughness={0.8} />
        </mesh>
      </group>
      
      <group ref={headRef}>
        <mesh position={[0, 4.3, 0]}>
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshStandardMaterial color="#ffe1d4" roughness={0.5} />
        </mesh>
        <mesh position={[0, 4.4, -0.1]}>
          <sphereGeometry args={[0.72, 32, 32]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>
        <mesh position={[-0.8, 4.2, -0.2]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[0.8, 4.2, -0.2]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[-0.25, 4.4, 0.62]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={eyeIntensity} />
        </mesh>
        <mesh position={[0.25, 4.4, 0.62]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={eyeIntensity} />
        </mesh>
      </group>

      {isRed && (
        <>
          <spotLight
            position={[0, 4.4, 0.6]}
            target-position={[0, 0, 40]}
            intensity={8 + scanIntensity * 12}
            angle={0.85}
            penumbra={0.2}
            color="#ff1a1a"
            distance={140}
            decay={1.8}
            castShadow
          />
          <spotLight
            position={[0, 4.4, 0]}
            target-position={[0, 0, 50]}
            intensity={4}
            angle={1.2}
            penumbra={0.5}
            color="#ff4444"
            distance={100}
            decay={2}
          />
        </>
      )}
    </group>
  );
}

export default RLGLDoll;
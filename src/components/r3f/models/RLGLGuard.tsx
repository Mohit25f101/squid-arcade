"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * RLGL Guard (Procedural Squid Game Style)
 * 
 * Requirements:
 * - Guard near doll
 * - Guard near finish area
 * - Aim animation
 * - Fire animation
 */

interface RLGLGuardProps {
  position: [number, number, number];
  rotationY?: number;
  isAiming?: boolean;
  isFiring?: boolean;
  targetPosition?: [number, number, number];
}

export function RLGLGuard({ 
  position, 
  rotationY = 0, 
  isAiming = false, 
  isFiring = false,
  targetPosition 
}: RLGLGuardProps) {
  const group = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const rifleRef = useRef<THREE.Group>(null);
  const muzzleFlashRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;

    // Breathing animation when idle
    if (torsoRef.current && !isAiming) {
      const breathCycle = Math.sin(t * 1.5) * 0.012;
      torsoRef.current.scale.y = 1 + breathCycle;
      torsoRef.current.position.y = 1.3 + breathCycle * 0.5;
    }

    // Aim animation
    if (isAiming && leftArmRef.current && rightArmRef.current && rifleRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -1.4, 0.12);
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, -0.3, 0.12);
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -1.4, 0.12);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.3, 0.12);
      rifleRef.current.rotation.x = THREE.MathUtils.lerp(rifleRef.current.rotation.x, -Math.PI / 2, 0.12);
      rifleRef.current.position.z = THREE.MathUtils.lerp(rifleRef.current.position.z, 0.4, 0.12);

      if (torsoRef.current) {
        torsoRef.current.rotation.x = Math.sin(t * 2) * 0.01;
      }
    } else {
      // Rest position
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0.15, 0.1);
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, -0.15, 0.1);
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0.15, 0.1);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.15, 0.1);
      }
      if (rifleRef.current) {
        rifleRef.current.rotation.x = THREE.MathUtils.lerp(rifleRef.current.rotation.x, Math.PI / 2.5, 0.1);
        rifleRef.current.position.z = THREE.MathUtils.lerp(rifleRef.current.position.z, 0.2, 0.1);
      }
    }

    // Fire animation (recoil)
    if (isFiring && rifleRef.current && torsoRef.current) {
      const recoilPhase = (Math.sin(t * 35) + 1) * 0.5;
      rifleRef.current.position.z -= recoilPhase * 0.08;
      torsoRef.current.rotation.x = -recoilPhase * 0.15;
      
      if (muzzleFlashRef.current) {
        muzzleFlashRef.current.intensity = 25 * recoilPhase;
      }
    } else if (muzzleFlashRef.current) {
      muzzleFlashRef.current.intensity = 0;
    }
  });

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      {/* Boots */}
      <mesh position={[-0.13, 0.05, 0.02]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.22]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0.13, 0.05, 0.02]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.22]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Legs (pink guard suit) */}
      <mesh position={[-0.13, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.095, 0.9, 12]} />
        <meshStandardMaterial color="#e34a8a" roughness={0.75} />
      </mesh>
      <mesh position={[0.13, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.095, 0.9, 12]} />
        <meshStandardMaterial color="#e34a8a" roughness={0.75} />
      </mesh>

      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.12, 16]} />
        <meshStandardMaterial color="#c43278" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
      </mesh>

      {/* Torso */}
      <group ref={torsoRef}>
        <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.75, 0.28]} />
          <meshStandardMaterial color="#e34a8a" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.45, 0.145]} castShadow>
          <boxGeometry args={[0.3, 0.4, 0.02]} />
          <meshStandardMaterial color="#c43278" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.45, 0.16]} castShadow>
          <boxGeometry args={[0.015, 0.45, 0.01]} />
          <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.6} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 1.75, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.11, 0.15, 12]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.4} />
      </mesh>

      {/* Head (mask) */}
      <mesh position={[0, 1.95, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Mask symbol */}
      <mesh position={[0, 1.95, 0.24]}>
        <planeGeometry args={[0.22, 0.22]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.95, 0.235]}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>

      {/* Left arm */}
      <group ref={leftArmRef} position={[-0.35, 1.5, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.08, 0.6, 12]} />
          <meshStandardMaterial color="#e34a8a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.65, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.07, 0.3, 12]} />
          <meshStandardMaterial color="#e34a8a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.85, 0]} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.5} />
        </mesh>
      </group>

      {/* Right arm */}
      <group ref={rightArmRef} position={[0.35, 1.5, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.08, 0.6, 12]} />
          <meshStandardMaterial color="#e34a8a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.65, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.07, 0.3, 12]} />
          <meshStandardMaterial color="#e34a8a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.85, 0]} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.5} />
        </mesh>
      </group>

      {/* Rifle */}
      <group ref={rifleRef} position={[0, 1.15, 0.2]} rotation={[Math.PI / 2.5, 0, 0]}>
        <mesh position={[0, 0, -0.25]} castShadow>
          <boxGeometry args={[0.08, 0.15, 0.3]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.06, 0.1, 0.35]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.35]} castShadow>
          <cylinderGeometry args={[0.022, 0.025, 0.5, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.04, 0.55]} castShadow>
          <boxGeometry args={[0.01, 0.03, 0.01]} />
          <meshStandardMaterial color="#333333" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.12, 0.05]} castShadow>
          <boxGeometry args={[0.04, 0.18, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.08, 0.1]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.15, 16]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.2} metalness={0.4} />
        </mesh>
        
        {/* Muzzle flash point light */}
        <pointLight
          ref={muzzleFlashRef}
          position={[0, 0, 0.62]}
          intensity={0}
          distance={20}
          color="#ffaa33"
          decay={2}
        />
        
        {/* Muzzle flash geometry */}
        {isFiring && (
          <mesh position={[0, 0, 0.65]} rotation={[0, 0, Math.random() * Math.PI * 2]}>
            <coneGeometry args={[0.12, 0.25, 6]} />
            <meshBasicMaterial color="#ffdd44" transparent opacity={0.9} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export default RLGLGuard;
"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * RLGL Contestant (Procedural Enhanced Style)
 * 
 * Movement: instant stop/start (no inertia)
 * Animation: instant switch between RUN and IDLE
 * 
 * Used in both RLGL and Glass Bridge games
 */

export interface RLGLContestantEntity {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  alive: boolean;
  finished: boolean;
  isHuman: boolean;
  number: number;
  fallProgress: number;
  fallAxis: [number, number, number];
}

interface RLGLContestantProps {
  player: RLGLContestantEntity;
  isMoving: boolean;
}

export const RLGLContestant = React.memo(function RLGLContestant({ player, isMoving }: RLGLContestantProps) {
  const group = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);

  const animStateRef = useRef<"run" | "sprint" | "freeze" | "fall" | "victory">("freeze");
  const animPhaseRef = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.position.x = player.x;
    group.current.position.z = player.z;

    const speed = Math.abs(player.vz);
    const isSprinting = speed > 10;
    
    // Animation state: instant switch between RUN and IDLE
    if (!player.alive) {
      animStateRef.current = "fall";
    } else if (player.finished) {
      animStateRef.current = "victory";
    } else if (speed > 0.01) {
      // Moving: switch to run/sprint instantly
      animStateRef.current = isSprinting ? "sprint" : "run";
    } else {
      // Stopped: switch to freeze instantly
      animStateRef.current = "freeze";
    }

    if (!player.alive) {
      const t = Math.min(1, player.fallProgress);
      group.current.rotation.x = -player.fallAxis[0] * t * Math.PI / 2;
      group.current.rotation.z = -player.fallAxis[2] * t * Math.PI / 2;
      group.current.position.y = THREE.MathUtils.lerp(0, -0.35, t);
      
      if (legLRef.current) legLRef.current.rotation.x = THREE.MathUtils.lerp(0, 1.2, t);
      if (legRRef.current) legRRef.current.rotation.x = THREE.MathUtils.lerp(0, -1.2, t);
      if (armLRef.current) armLRef.current.rotation.x = THREE.MathUtils.lerp(0, 1.8, t);
      if (armRRef.current) armRRef.current.rotation.x = THREE.MathUtils.lerp(0, -1.8, t);
      return;
    }

    group.current.rotation.x = 0;
    group.current.rotation.z = 0;

    const t = state.clock.elapsedTime;

    if (animStateRef.current === "victory") {
      group.current.position.y = 0.05 + Math.sin(t * 4) * 0.03;
      if (armLRef.current) armLRef.current.rotation.x = -2.8;
      if (armRRef.current) armRRef.current.rotation.x = -2.8;
      if (armLRef.current) armLRef.current.rotation.z = -0.3;
      if (armRRef.current) armRRef.current.rotation.z = 0.3;
      if (legLRef.current) legLRef.current.rotation.x = 0;
      if (legRRef.current) legRRef.current.rotation.x = 0;
      if (headRef.current) headRef.current.rotation.x = -0.2;
    } else if (animStateRef.current === "freeze") {
      group.current.position.y = 0;
    } else if (animStateRef.current === "run" || animStateRef.current === "sprint") {
      const freq = animStateRef.current === "sprint" ? 14 : 11;
      animPhaseRef.current += delta * freq;
      
      const swingAmount = animStateRef.current === "sprint" ? 0.65 : 0.5;
      const swing = Math.sin(animPhaseRef.current) * swingAmount;
      
      if (legLRef.current) legLRef.current.rotation.x = swing;
      if (legRRef.current) legRRef.current.rotation.x = -swing;
      
      if (armLRef.current) armLRef.current.rotation.x = -swing * 0.75;
      if (armRRef.current) armRRef.current.rotation.x = swing * 0.75;
      
      const bob = Math.abs(Math.sin(animPhaseRef.current)) * (animStateRef.current === "sprint" ? 0.08 : 0.06);
      group.current.position.y = bob;
      
      if (torsoRef.current) {
        const lean = animStateRef.current === "sprint" ? -0.15 : -0.08;
        torsoRef.current.rotation.x = THREE.MathUtils.lerp(torsoRef.current.rotation.x, lean, 0.1);
      }
      
      if (headRef.current) {
        headRef.current.rotation.x = Math.sin(animPhaseRef.current * 2) * 0.04;
      }
    }
  });

  return (
    <group ref={group}>
      <group ref={legLRef} position={[-0.14, 0.92, 0]}>
        <mesh position={[0, -0.42, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.085, 0.84, 12]} />
          <meshStandardMaterial color="#1a8a7a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.2, 0]} castShadow>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color="#158070" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.87, 0.05]} castShadow>
          <boxGeometry args={[0.14, 0.08, 0.22]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.88, 0.1]} castShadow>
          <boxGeometry args={[0.12, 0.06, 0.08]} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.7} />
        </mesh>
      </group>

      <group ref={legRRef} position={[0.14, 0.92, 0]}>
        <mesh position={[0, -0.42, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.085, 0.84, 12]} />
          <meshStandardMaterial color="#1a8a7a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.2, 0]} castShadow>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color="#158070" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.87, 0.05]} castShadow>
          <boxGeometry args={[0.14, 0.08, 0.22]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.88, 0.1]} castShadow>
          <boxGeometry args={[0.12, 0.06, 0.08]} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.7} />
        </mesh>
      </group>

      <group ref={torsoRef}>
        <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.45, 0.65, 0.26]} />
          <meshStandardMaterial color="#1a8a7a" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.25, 0.135]} castShadow>
          <boxGeometry args={[0.012, 0.6, 0.01]} />
          <meshStandardMaterial color="#0d5a4d" roughness={0.4} />
        </mesh>
        <mesh position={[-0.12, 1.35, 0.135]} castShadow>
          <boxGeometry args={[0.08, 0.1, 0.01]} />
          <meshStandardMaterial color="#158070" roughness={0.8} />
        </mesh>
        <mesh position={[0.12, 1.35, 0.135]} castShadow>
          <boxGeometry args={[0.08, 0.1, 0.01]} />
          <meshStandardMaterial color="#158070" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.93, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.08, 16]} />
          <meshStandardMaterial color="#0d5a4d" roughness={0.7} />
        </mesh>
      </group>

      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.09, 0.12, 12]} />
        <meshStandardMaterial color="#ffe1d4" roughness={0.5} />
      </mesh>

      <group ref={headRef} position={[0, 1.78, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.19, 20, 20]} />
          <meshStandardMaterial color="#ffe1d4" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.08, 0]} castShadow>
          <sphereGeometry args={[0.195, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
        <mesh position={[-0.08, 0.04, 0.17]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.08, 0.04, 0.17]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      <group ref={armLRef} position={[-0.3, 1.48, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.065, 0.44, 10]} />
          <meshStandardMaterial color="#1a8a7a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <sphereGeometry args={[0.072, 10, 10]} />
          <meshStandardMaterial color="#158070" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.06, 0.4, 10]} />
          <meshStandardMaterial color="#1a8a7a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.88, 0]} castShadow>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#ffe1d4" roughness={0.6} />
        </mesh>
      </group>

      <group ref={armRRef} position={[0.3, 1.48, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.065, 0.44, 10]} />
          <meshStandardMaterial color="#1a8a7a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.44, 0]} castShadow>
          <sphereGeometry args={[0.072, 10, 10]} />
          <meshStandardMaterial color="#158070" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.66, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.06, 0.4, 10]} />
          <meshStandardMaterial color="#1a8a7a" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.88, 0]} castShadow>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#ffe1d4" roughness={0.6} />
        </mesh>
      </group>
      
      <Html position={[0, 1.2, -0.15]} center distanceFactor={6} occlude={false}>
        <div
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.04em",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {player.number.toString().padStart(3, "0")}
        </div>
      </Html>

      {!player.alive && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.6 + player.fallProgress * 0.45, 20]} />
          <meshBasicMaterial color="#9b1414" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
});

export default RLGLContestant;
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Float,
  Html,
  Sky,
  Stars,
  ContactShadows,
  Line,
} from "@react-three/drei";
import * as THREE from "three";
import { Howl } from "howler";
import { useGameStore } from "@/store/gameStore";
import { inputManager } from "@/managers/InputManager";

/* ─────────────────────────────────────────────────────────────────────────────
 * CONSTANTS — world layout, gameplay tunables
 * ────────────────────────────────────────────────────────────────────────────*/

const FIELD_LEN          = 90;          // distance from start line to doll
const FIELD_WIDTH        = 30;
const FINISH_Z           = -10;         // player Z when crossing finish (near doll)
const START_Z            = FIELD_LEN - 10;
const PLAYER_SPEED       = 8.0;
const PLAYER_SPRINT_MULT = 1.55;
const TURN_DURATION      = 0.55;        // seconds doll takes to spin around
const RED_DURATION_BASE  = 3.2;         // seconds doll stays facing players
const RED_DURATION_MIN   = 2.0;
const MOVE_THRESHOLD     = 0.05;        // m/sec — any motion above this in red = death
const NPC_COUNT          = 18;
const ROUND_TIMER        = 90;

/* ─────────────────────────────────────────────────────────────────────────────
 * STATE MACHINE ENUMS
 * ────────────────────────────────────────────────────────────────────────────*/

export enum LightPhase {
  GREEN = "green",
  TURNING_RED = "turning_red",
  RED = "red",
  TURNING_GREEN = "turning_green"
}

export enum GamePhase {
  COUNTDOWN = "countdown",
  PLAYING = "playing",
  ELIMINATED = "eliminated",
  VICTORY = "victory",
  TIMEOUT = "timeout"
}

interface PlayerEntity {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  alive: boolean;
  finished: boolean;
  isHuman: boolean;
  number: number;
  npcStopOffsetMs: number; 
  npcResumeOffsetMs: number;
  npcStopTimer: number;
  npcResumeTimer: number;
  npcMoving: boolean;
  fallProgress: number;
  fallAxis: [number, number, number];
}

/* ─────────────────────────────────────────────────────────────────────────────
 * AUDIO
 * ────────────────────────────────────────────────────────────────────────────*/

interface AudioHandles {
  dollSong: Howl;
  redLight: Howl;
  greenLight: Howl;
  elimination: Howl;
  victory: Howl;
  gasp: Howl;
  heartbeat: Howl;
  alarm: Howl;
  beep: Howl;
  go: Howl;
  cheer: Howl;
  step: Howl;
  shatter: Howl;
}

function buildAudio(volumes: { master: number; sfx: number; music: number }): AudioHandles {
  const mk = (src: string, vol: number, opts: Record<string, any> = {}) =>
    new Howl({
      src: [src],
      volume: Math.max(0, Math.min(1, vol * volumes.master)),
      html5: false,
      preload: true,
      ...opts,
    } as ConstructorParameters<typeof Howl>[0]);

  return {
    dollSong:    mk("/audio/sfx/squid_game_doll_song.mp3", 1.0 * volumes.music),
    redLight:    mk("/audio/sfx/red_light.mp3",            0.85 * volumes.sfx),
    greenLight:  mk("/audio/sfx/green_light.mp3",          0.6  * volumes.sfx),
    elimination: mk("/audio/sfx/elimination.mp3",          0.9  * volumes.sfx),
    victory:     mk("/audio/sfx/victory.mp3",              0.9  * volumes.sfx),
    gasp:        mk("/audio/sfx/gasp.mp3",                 0.7  * volumes.sfx),
    heartbeat:   mk("/audio/sfx/heartbeat.mp3",            0.55 * volumes.sfx, { loop: true }),
    alarm:       mk("/audio/sfx/alarm.mp3",                0.5  * volumes.sfx),
    beep:        mk("/audio/sfx/beep.mp3",                 0.6  * volumes.sfx),
    go:          mk("/audio/sfx/go.mp3",                   0.8  * volumes.sfx),
    cheer:       mk("/audio/sfx/cheer.mp3",                0.7  * volumes.sfx),
    step:        mk("/audio/sfx/step.mp3",                 0.25 * volumes.sfx),
    shatter:     mk("/audio/sfx/shatter.mp3",              0.7  * volumes.sfx),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * DOLL MODEL
 * ────────────────────────────────────────────────────────────────────────────*/

interface DollProps {
  position: [number, number, number];
  facing: "away" | "players"; 
  turnProgress: number;       
  isRed: boolean;
  scanIntensity: number;      
}

function Doll({ position, facing, turnProgress, isRed, scanIntensity }: DollProps) {
  const group = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);

  const targetY = facing === "away" ? 0 : Math.PI;
  const fromY   = facing === "away" ? Math.PI : 0;
  const yRot    = THREE.MathUtils.lerp(fromY, targetY, turnProgress);

  // Menacing forward lean during red light
  const bodyLean = isRed ? -0.12 : 0;
  const bodyRise = isRed ? 0.08 : 0;

  useFrame((state) => {
    if (!group.current) return;
    
    const turnSpeed = turnProgress < 0.3 ? 0.6 : turnProgress > 0.7 ? 0.4 : 1;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y, 
      yRot, 
      0.08 * turnSpeed
    );
    
    // Apply threatening lean during red
    if (isRed && turnProgress > 0.9) {
      group.current.position.y = position[1] + bodyRise + Math.sin(state.clock.elapsedTime * 3) * 0.02;
      group.current.rotation.x = bodyLean;
      group.current.rotation.z = 0;
    } else if (facing === "away" && turnProgress < 0.05) {
      const t = state.clock.elapsedTime;
      group.current.rotation.z = Math.sin(t * 1.8) * 0.035;
      group.current.position.y = position[1] + Math.sin(t * 1.2) * 0.04;
      group.current.rotation.x = Math.sin(t * 0.8) * 0.015;
    } else {
      group.current.rotation.z = 0;
      group.current.rotation.x = 0;
      group.current.position.y = position[1];
    }

    if (eyeL.current && eyeR.current) {
      const mat = eyeL.current.material as THREE.MeshStandardMaterial;
      const mat2 = eyeR.current.material as THREE.MeshStandardMaterial;
      const pulse = isRed 
        ? 0.8 + Math.sin(state.clock.elapsedTime * 15) * 0.2 * scanIntensity 
        : 0;
      mat.emissiveIntensity = pulse * 8;
      mat2.emissiveIntensity = pulse * 8;
    }
  });

  return (
    <group ref={group} position={position} dispose={null}>
      <mesh position={[0, 1.45, 0]} castShadow>
        <coneGeometry args={[1.55, 2.55, 32]} />
        <meshStandardMaterial color="#e89c2a" roughness={0.65} metalness={0.05} />
      </mesh>
      <mesh position={[0, 2.55, 0]} castShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.7, 24]} />
        <meshStandardMaterial color="#f4d34c" roughness={0.7} />
      </mesh>
      <mesh position={[-1.0, 2.4, 0]} rotation={[0, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 1.3, 12]} />
        <meshStandardMaterial color="#f4d34c" roughness={0.7} />
      </mesh>
      <mesh position={[1.0, 2.4, 0]} rotation={[0, 0, -0.2]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 1.3, 12]} />
        <meshStandardMaterial color="#f4d34c" roughness={0.7} />
      </mesh>
      <mesh position={[-1.15, 1.75, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#f5d3a8" roughness={0.6} />
      </mesh>
      <mesh position={[1.15, 1.75, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#f5d3a8" roughness={0.6} />
      </mesh>
      <mesh position={[-0.45, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 1.1, 12]} />
        <meshStandardMaterial color="#f3eee2" roughness={0.85} />
      </mesh>
      <mesh position={[0.45, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 1.1, 12]} />
        <meshStandardMaterial color="#f3eee2" roughness={0.85} />
      </mesh>
      <mesh position={[-0.45, -0.05, 0.08]} castShadow>
        <boxGeometry args={[0.4, 0.18, 0.6]} />
        <meshStandardMaterial color="#222" roughness={0.5} />
      </mesh>
      <mesh position={[0.45, -0.05, 0.08]} castShadow>
        <boxGeometry args={[0.4, 0.18, 0.6]} />
        <meshStandardMaterial color="#222" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.35, 0]} castShadow>
        <sphereGeometry args={[0.65, 32, 32]} />
        <meshStandardMaterial color="#f5d3a8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.55, -0.05]} castShadow>
        <sphereGeometry args={[0.72, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color="#191510" roughness={0.85} />
      </mesh>
      <mesh position={[-0.7, 3.25, -0.1]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#191510" roughness={0.85} />
      </mesh>
      <mesh position={[0.7, 3.25, -0.1]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#191510" roughness={0.85} />
      </mesh>
      <mesh position={[-0.78, 3.05, -0.1]}>
        <boxGeometry args={[0.16, 0.12, 0.05]} />
        <meshStandardMaterial color="#c52525" emissive="#600" emissiveIntensity={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0.78, 3.05, -0.1]}>
        <boxGeometry args={[0.16, 0.12, 0.05]} />
        <meshStandardMaterial color="#c52525" emissive="#600" emissiveIntensity={0.4} roughness={0.5} />
      </mesh>
      <mesh ref={eyeL} position={[-0.22, 3.4, 0.55]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={isRed ? "#ff1a1a" : "#111"}
          emissive={isRed ? "#ff0000" : "#000"}
          emissiveIntensity={0}
          roughness={0.2}
        />
      </mesh>
      <mesh ref={eyeR} position={[0.22, 3.4, 0.55]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={isRed ? "#ff1a1a" : "#111"}
          emissive={isRed ? "#ff0000" : "#000"}
          emissiveIntensity={0}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 3.18, 0.6]}>
        <boxGeometry args={[0.18, 0.04, 0.02]} />
        <meshStandardMaterial color="#8a2222" roughness={0.6} />
      </mesh>
      <mesh position={[-0.32, 3.25, 0.58]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#f0a4a4" transparent opacity={0.55} roughness={0.6} />
      </mesh>
      <mesh position={[0.32, 3.25, 0.58]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#f0a4a4" transparent opacity={0.55} roughness={0.6} />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.35, 8]} />
        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.4, 0]}>
        <sphereGeometry args={[isRed ? 0.16 : 0.13, 16, 16]} />
        <meshStandardMaterial
          color={isRed ? "#ff0000" : "#26d671"}
          emissive={isRed ? "#ff0000" : "#26d671"}
          emissiveIntensity={isRed ? 5 + scanIntensity * 4 : 0.8}
          toneMapped={false}
        />
      </mesh>
      {isRed && (
        <>
          {/* Main scanning beam */}
          <spotLight
            position={[0, 3.4, 0.6]}
            target-position={[0, 0, 40]}
            intensity={8 + scanIntensity * 12}
            angle={0.85}
            penumbra={0.2}
            color="#ff1a1a"
            distance={140}
            decay={1.8}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
          />
          {/* Wide area fill light */}
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

/* ─────────────────────────────────────────────────────────────────────────────
 * PLAYER MODEL
 * ────────────────────────────────────────────────────────────────────────────*/

interface PlayerMeshProps {
  player: PlayerEntity;
  isMoving: boolean;
}

const PlayerMesh = React.memo(function PlayerMesh({ player, isMoving }: PlayerMeshProps) {
  const group = useRef<THREE.Group>(null);
  const legL  = useRef<THREE.Mesh>(null);
  const legR  = useRef<THREE.Mesh>(null);
  const armL  = useRef<THREE.Mesh>(null);
  const armR  = useRef<THREE.Mesh>(null);

  const SUIT = "#0fa07d";
  const SUIT_DARK = "#0b6e57";

  useFrame((state) => {
    if (!group.current) return;
    group.current.position.x = player.x;
    group.current.position.z = player.z;

    if (!player.alive) {
      const t = Math.min(1, player.fallProgress);
      group.current.rotation.x = -player.fallAxis[0] * t * Math.PI / 2;
      group.current.rotation.z = -player.fallAxis[2] * t * Math.PI / 2;
      group.current.position.y = THREE.MathUtils.lerp(0, -0.4, t);
      return;
    }
    group.current.rotation.x = 0;
    group.current.rotation.z = 0;
    group.current.position.y = 0;

    const swing = isMoving ? Math.sin(state.clock.elapsedTime * 10) * 0.45 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.7;
    if (armR.current) armR.current.rotation.x = swing * 0.7;

    group.current.position.y = isMoving ? Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.06 : 0;
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.55, 0.7, 0.32]} />
        <meshStandardMaterial color={SUIT} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.0, -0.165]}>
        <planeGeometry args={[0.32, 0.18]} />
        <meshStandardMaterial color="#fafaf6" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[0.35, 0.36, 0.32]} />
        <meshStandardMaterial color="#e8c79c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.79, 0.02]}>
        <boxGeometry args={[0.36, 0.07, 0.34]} />
        <meshStandardMaterial color="#1c1611" roughness={0.85} />
      </mesh>
      <mesh ref={armL} position={[-0.36, 1.0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.7, 0.18]} />
        <meshStandardMaterial color={SUIT} roughness={0.7} />
      </mesh>
      <mesh ref={armR} position={[0.36, 1.0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.7, 0.18]} />
        <meshStandardMaterial color={SUIT} roughness={0.7} />
      </mesh>
      <mesh ref={legL} position={[-0.14, 0.35, 0]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color={SUIT_DARK} roughness={0.75} />
      </mesh>
      <mesh ref={legR} position={[0.14, 0.35, 0]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color={SUIT_DARK} roughness={0.75} />
      </mesh>
      <Html position={[0, 1.05, -0.18]} center distanceFactor={6} occlude={false}>
        <div
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 14,
            fontWeight: 700,
            color: "#111",
            letterSpacing: "0.04em",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {player.number.toString().padStart(3, "0")}
        </div>
      </Html>

      {!player.alive && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.55 + player.fallProgress * 0.4, 16]} />
          <meshBasicMaterial color="#9b1414" transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
 * GUARD
 * ────────────────────────────────────────────────────────────────────────────*/

function Guard({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Body */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.85, 1.7, 0.5]} />
        <meshStandardMaterial color="#e92076" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Mask/helmet */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <boxGeometry args={[0.5, 0.52, 0.45]} />
        <meshStandardMaterial color="#0b0b0b" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Mask shape */}
      <mesh position={[0, 2.1, 0.23]}>
        <boxGeometry args={[0.22, 0.22, 0.02]} />
        <meshStandardMaterial 
          color="#fff" 
          emissive="#fff" 
          emissiveIntensity={0.6} 
        />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.5, 1.0, 0]} castShadow>
        <boxGeometry args={[0.22, 1.4, 0.22]} />
        <meshStandardMaterial color="#e92076" roughness={0.5} />
      </mesh>
      <mesh position={[0.5, 1.0, 0]} castShadow>
        <boxGeometry args={[0.22, 1.4, 0.22]} />
        <meshStandardMaterial color="#e92076" roughness={0.5} />
      </mesh>
      {/* Rifle */}
      <mesh position={[0, 1.2, 0.4]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.08, 1.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.2, -0.2]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.18, 0.35]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.2, 0.15, 0]} castShadow>
        <boxGeometry args={[0.24, 1.1, 0.24]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>
      <mesh position={[0.2, 0.15, 0]} castShadow>
        <boxGeometry args={[0.24, 1.1, 0.24]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT DYNAMIC FEATURES
 * ────────────────────────────────────────────────────────────────────────────*/

function GuardLasers() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    // Update will trigger slight sweep movement over time natively
    group.current.rotation.y = state.clock.elapsedTime * 0.001;
  });

  return (
    <group ref={group}>
      <Line
        points={[
          new THREE.Vector3(-FIELD_WIDTH / 2 + 2, 2.2, FINISH_Z + 1.5),
          new THREE.Vector3(0, 1.5, START_Z / 2),
        ]}
        color="#ff0000"
        lineWidth={0.8}
        transparent
        opacity={0.7}
      />
      <Line
        points={[
          new THREE.Vector3(FIELD_WIDTH / 2 - 2, 2.2, FINISH_Z + 1.5),
          new THREE.Vector3(0, 1.5, START_Z / 2),
        ]}
        color="#ff0000"
        lineWidth={0.8}
        transparent
        opacity={0.7}
      />
    </group>
  );
}

function Arena({ isRed }: { isRed: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, FIELD_LEN / 2 - 5]} receiveShadow>
        <planeGeometry args={[FIELD_WIDTH + 6, FIELD_LEN + 20]} />
        <meshStandardMaterial color="#cda878" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, FIELD_LEN / 2 - 5]}>
        <ringGeometry args={[FIELD_WIDTH / 2 - 3, FIELD_WIDTH / 2 + 10, 64]} />
        <meshStandardMaterial color="#a8865d" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, START_Z]}>
        <planeGeometry args={[FIELD_WIDTH, 0.6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} emissive="#ffffff" emissiveIntensity={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, FINISH_Z]}>
        <planeGeometry args={[FIELD_WIDTH, 0.6]} />
        <meshStandardMaterial color="#f5c542" roughness={0.85} emissive="#f5c542" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-FIELD_WIDTH / 2 - 0.5, 5, FIELD_LEN / 2 - 5]} castShadow receiveShadow>
        <boxGeometry args={[1, 10, FIELD_LEN + 14]} />
        <meshStandardMaterial color="#e34a8a" roughness={0.65} />
      </mesh>
      <mesh position={[FIELD_WIDTH / 2 + 0.5, 5, FIELD_LEN / 2 - 5]} castShadow receiveShadow>
        <boxGeometry args={[1, 10, FIELD_LEN + 14]} />
        <meshStandardMaterial color="#e34a8a" roughness={0.65} />
      </mesh>
      <mesh position={[0, 6, -14]} castShadow receiveShadow>
        <boxGeometry args={[FIELD_WIDTH + 2, 12, 1]} />
        <meshStandardMaterial color="#75a1d1" roughness={0.8} />
      </mesh>
      <mesh position={[0, 11, -14.6]}>
        <planeGeometry args={[FIELD_WIDTH + 2, 4]} />
        <meshStandardMaterial color="#a7c3df" roughness={0.95} />
      </mesh>
      <mesh position={[0, 6, FIELD_LEN]} >
        <boxGeometry args={[FIELD_WIDTH + 2, 12, 1]} />
        <meshStandardMaterial color="#3d2c1f" roughness={0.85} />
      </mesh>
      {[20, 45, 70].map((z) => (
        <React.Fragment key={z}>
          <mesh position={[-FIELD_WIDTH / 2 + 0.1, 3.5, z]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[6, 6]} />
            <meshStandardMaterial color="#7a8a3a" transparent opacity={0.55} roughness={0.85} />
          </mesh>
          <mesh position={[FIELD_WIDTH / 2 - 0.1, 3.5, z]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[6, 6]} />
            <meshStandardMaterial color="#7a8a3a" transparent opacity={0.55} roughness={0.85} />
          </mesh>
        </React.Fragment>
      ))}
      <mesh position={[0, 6, -13.5]}>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#3c5a2a" transparent opacity={0.75} roughness={0.9} />
      </mesh>
      <ContactShadows
        position={[0, 0.02, -10]}
        opacity={0.5}
        scale={20}
        blur={2.2}
        far={4}
        resolution={512}
        color="#000"
      />
      
      {/* Guards at finish line */}
      <Guard position={[-FIELD_WIDTH / 2 + 2, 0, FINISH_Z + 1.5]} rotationY={Math.PI / 2} />
      <Guard position={[FIELD_WIDTH / 2 - 2, 0, FINISH_Z + 1.5]} rotationY={-Math.PI / 2} />
      <Guard position={[-FIELD_WIDTH / 2 + 4, 0, FINISH_Z - 2]} rotationY={Math.PI / 3} />
      <Guard position={[FIELD_WIDTH / 2 - 4, 0, FINISH_Z - 2]} rotationY={-Math.PI / 3} />
      
      {/* Guards along walls */}
      <Guard position={[-FIELD_WIDTH / 2 + 1, 0, START_Z - 20]} rotationY={Math.PI / 2} />
      <Guard position={[FIELD_WIDTH / 2 - 1, 0, START_Z - 20]} rotationY={-Math.PI / 2} />
      <Guard position={[-FIELD_WIDTH / 2 + 1, 0, 40]} rotationY={Math.PI / 2} />
      <Guard position={[FIELD_WIDTH / 2 - 1, 0, 40]} rotationY={-Math.PI / 2} />

      {/* Guard laser sights during RED LIGHT */}
      {isRed && <GuardLasers />}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CAMERA
 * ────────────────────────────────────────────────────────────────────────────*/

function FollowCamera({
  targetX,
  targetZ,
  phase,
  shake,
}: {
  targetX: number;
  targetZ: number;
  phase: GamePhase;
  shake: number;
}) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const ds = Math.min(dt, 0.05);

    let desiredX: number, desiredY: number, desiredZ: number;
    let lookX: number, lookY: number, lookZ: number;

    if (phase === GamePhase.COUNTDOWN) {
      const t = performance.now() * 0.0002;
      desiredX = Math.sin(t) * 12;
      desiredY = 5.5;
      desiredZ = -2 + Math.cos(t) * 8;
      lookX = 0;
      lookY = 2.5;
      lookZ = -8;
    } else if (phase === GamePhase.VICTORY) {
      desiredX = targetX + 2.5;
      desiredY = 3.0;
      desiredZ = targetZ - 3;
      lookX = targetX;
      lookY = 1.5;
      lookZ = targetZ - 5;
    } else {
      desiredX = targetX;
      desiredY = 4.2;
      desiredZ = targetZ + 7.5;
      lookX = targetX * 0.4;
      lookY = 1.6;
      lookZ = targetZ - 18;
    }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredX, ds * 4.5);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredY, ds * 4.5);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredZ, ds * 4.5);

    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }

    lookAt.current.set(lookX, lookY, lookZ);
    camera.lookAt(lookAt.current);
  });

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SCENE LOGIC
 * ────────────────────────────────────────────────────────────────────────────*/

interface SceneProps {
  audioRef: React.MutableRefObject<AudioHandles | null>;
  onGameOver: (phase: GamePhase, score: number) => void;
  onHudUpdate: (data: {
    timeLeft: number;
    aliveCount: number;
    lightPhase: LightPhase;
    score: number;
    playerProgressPct: number;
  }) => void;
  pausedRef: React.MutableRefObject<boolean>;
  inputRef: React.MutableRefObject<{ forward: boolean; sprint: boolean }>;
  resetSignal: number;
}

function Scene({ audioRef, onGameOver, onHudUpdate, pausedRef, inputRef, resetSignal }: SceneProps) {
  const playersRef    = useRef<PlayerEntity[]>([]);
  const lightPhaseRef = useRef<LightPhase>(LightPhase.GREEN);
  const turnTRef      = useRef(0);     
  const redTimerRef   = useRef(0);     
  // Initialize gamePhaseRef at Reset equivalent for boot
  const gamePhaseRef  = useRef<GamePhase>(GamePhase.COUNTDOWN); 
  const countdownRef  = useRef(3);
  const timeLeftRef   = useRef(ROUND_TIMER);
  const scoreRef      = useRef(0);
  const shakeRef      = useRef(0);
  const dollSongIdRef = useRef<number | null>(null);
  const lastStepRef   = useRef(0);
  const fakeOutChanceRef = useRef(0);
  const aliveCountRef    = useRef(NPC_COUNT + 1);
  const hudThrottleRef   = useRef(0);
  const turnDirRef    = useRef<"to_red" | "to_green">("to_red");
  const guardFlashRef = useRef(0);

  // Lightweight Gunshot Tracer references
  const shotLineRef = useRef<THREE.Line>(null);
  const shotTimerRef = useRef<number>(0);

  useEffect(() => {
    const arr: PlayerEntity[] = [];
    arr.push({
      id: 0,
      x: 0,
      z: START_Z - 1.0,
      vx: 0,
      vz: 0,
      alive: true,
      finished: false,
      isHuman: true,
      number: 456,
      npcStopOffsetMs: 0,
      npcResumeOffsetMs: 0,
      npcStopTimer: 0,
      npcResumeTimer: 0,
      npcMoving: false,
      fallProgress: 0,
      fallAxis: [1, 0, 0],
    });
    for (let i = 1; i <= NPC_COUNT; i++) {
      const lane = ((i - 1) % 7) - 3; 
      const row  = Math.floor((i - 1) / 7);
      arr.push({
        id: i,
        x: lane * 2.6 + (Math.random() - 0.5) * 0.4,
        z: START_Z - 1.0 - row * 1.4,
        vx: 0,
        vz: 0,
        alive: true,
        finished: false,
        isHuman: false,
        number: 100 + i * 7,
        npcStopOffsetMs: 80 + Math.random() * 320,
        npcResumeOffsetMs: 120 + Math.random() * 280,
        npcStopTimer: 0,
        npcResumeTimer: 0,
        npcMoving: false,
        fallProgress: 0,
        fallAxis: [
          Math.random() > 0.5 ? 1 : -1,
          0,
          Math.random() > 0.5 ? 1 : -1,
        ],
      });
    }
    playersRef.current    = arr;
    lightPhaseRef.current = LightPhase.GREEN;
    turnTRef.current      = 0;
    redTimerRef.current   = 0;
    
    // Reset sync state
    gamePhaseRef.current  = GamePhase.COUNTDOWN; 
    
    countdownRef.current  = 3;
    timeLeftRef.current   = ROUND_TIMER;
    scoreRef.current      = 0;
    shakeRef.current      = 0;
    fakeOutChanceRef.current = 0;
    aliveCountRef.current = NPC_COUNT + 1;
    shotTimerRef.current  = 0;
    guardFlashRef.current = 0;

    if (shotLineRef.current) {
      shotLineRef.current.visible = false;
    }

    const a = audioRef.current;
    if (a) {
      if (dollSongIdRef.current !== null) a.dollSong.stop(dollSongIdRef.current);
      dollSongIdRef.current = null;
      a.heartbeat.stop();
    }
  }, [resetSignal, audioRef]);

  const startDollSong = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (dollSongIdRef.current !== null) {
      a.dollSong.stop(dollSongIdRef.current);
    }
    const id = a.dollSong.play();
    dollSongIdRef.current = typeof id === "number" ? id : null;
  }, [audioRef]);

  const stopDollSong = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (dollSongIdRef.current !== null) {
      a.dollSong.fade(a.dollSong.volume(dollSongIdRef.current) as number, 0, 200, dollSongIdRef.current);
      const id = dollSongIdRef.current;
      setTimeout(() => a.dollSong.stop(id), 220);
      dollSongIdRef.current = null;
    }
  }, [audioRef]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => {
      // Ensure song end trigger is mapped correctly to our LightPhase and GamePhase state architecture
      if (lightPhaseRef.current === LightPhase.GREEN && gamePhaseRef.current === GamePhase.PLAYING) {
        lightPhaseRef.current = LightPhase.TURNING_RED;
        turnDirRef.current    = "to_red";
        turnTRef.current      = 0;
        dollSongIdRef.current = null;
        a.beep.play();
      }
    };
    a.dollSong.on("end", onEnd);
    return () => {
      a.dollSong.off("end", onEnd);
    };
  }, [audioRef]);

  const countdownLastIntRef = useRef(3);

  useFrame((_, rawDt) => {
    if (pausedRef.current) return;
    const dt = Math.min(rawDt, 0.05);
    
    // Capture input framework snapshot and update buffer cleanly
    const snap = inputManager.snapshot();

    const a = audioRef.current;
    if (!a) {
      inputManager.endFrame();
      return;
    }

    const players = playersRef.current;
    const human   = players[0];
    if (!human) {
      inputManager.endFrame();
      return;
    }

    // Animate structural bullet tracer line fading
    if (shotTimerRef.current > 0 && shotLineRef.current) {
      shotTimerRef.current -= dt;
      const mat = shotLineRef.current.material as THREE.LineBasicMaterial;
      if (mat) mat.opacity = Math.max(0, shotTimerRef.current / 0.25);
      if (shotTimerRef.current <= 0) {
        shotLineRef.current.visible = false;
      }
    }

    if (gamePhaseRef.current === GamePhase.COUNTDOWN) {
      countdownRef.current -= dt;
      const intNow = Math.ceil(countdownRef.current);
      if (intNow !== countdownLastIntRef.current) {
        countdownLastIntRef.current = intNow;
        if (intNow > 0) a.beep.play();
      }
      if (countdownRef.current <= 0) {
        // Countdown -> Playing
        gamePhaseRef.current = GamePhase.PLAYING;
        useGameStore.getState().setRuntimePhase("playing");
        a.go.play();
        startDollSong();
        lightPhaseRef.current = LightPhase.GREEN;
      }
      inputManager.endFrame();
      return;
    }

    // Prevents code execution loop for game-over and victory conditions safely
    if (gamePhaseRef.current !== GamePhase.PLAYING) {
      for (const p of players) {
        if (!p.alive && p.fallProgress < 1) p.fallProgress = Math.min(1, p.fallProgress + dt * 2);
      }
      inputManager.endFrame();
      return;
    }

    timeLeftRef.current -= dt;
    if (timeLeftRef.current <= 0) {
      gamePhaseRef.current = GamePhase.TIMEOUT;
      stopDollSong();
      a.heartbeat.stop();
      onGameOver(GamePhase.TIMEOUT, Math.floor(scoreRef.current));
      inputManager.endFrame();
      return;
    }

    const lp = lightPhaseRef.current;

    if (lp === LightPhase.TURNING_RED) {
      turnTRef.current += dt / TURN_DURATION;
      if (turnTRef.current >= 1) {
        turnTRef.current = 1;
        lightPhaseRef.current = LightPhase.RED;
        redTimerRef.current = 0;
        a.redLight.play();
        if (!a.heartbeat.playing()) a.heartbeat.play();
      }
    } else if (lp === LightPhase.RED) {
      redTimerRef.current += dt;
      const redDur = Math.max(RED_DURATION_MIN, RED_DURATION_BASE - timeLeftRef.current / ROUND_TIMER * 0.5);
      if (redTimerRef.current >= redDur) {
        lightPhaseRef.current = LightPhase.TURNING_GREEN;
        turnDirRef.current    = "to_green";
        turnTRef.current      = 0;
      }
    } else if (lp === LightPhase.TURNING_GREEN) {
      turnTRef.current += dt / TURN_DURATION;
      if (turnTRef.current >= 1) {
        turnTRef.current = 0;
        lightPhaseRef.current = LightPhase.GREEN;
        a.greenLight.play();
        a.heartbeat.stop();
        startDollSong();
      }
    }

    if (human.alive && !human.finished && gamePhaseRef.current === GamePhase.PLAYING) {
      const input = inputRef.current;
      // Pull clean movement intent from specialized InputManager architecture
      const wantMove = snap.up || snap.action;
      const speed = PLAYER_SPEED * (input.sprint ? PLAYER_SPRINT_MULT : 1);
      const targetVz = wantMove ? -speed : 0;
      const accel = wantMove ? 14 : 26;
      human.vz = THREE.MathUtils.lerp(human.vz, targetVz, Math.min(1, dt * accel));
      human.vx = 0;
      human.z += human.vz * dt;

      if (wantMove) {
        lastStepRef.current += dt;
        if (lastStepRef.current > 0.32) {
          lastStepRef.current = 0;
          a.step.play();
        }
      }

      if (human.z <= FINISH_Z) {
        human.finished = true;
        human.z = FINISH_Z;
        human.vz = 0;
        
        // Victory state mapped correctly to halt processing
        gamePhaseRef.current = GamePhase.VICTORY; 
        
        stopDollSong();
        a.heartbeat.stop();
        a.victory.play();
        a.cheer.play();
        
        // Victory score bonus
        const timeBonus = Math.floor(timeLeftRef.current * 50);
        const speedBonus = timeLeftRef.current > 60 ? 2000 : timeLeftRef.current > 45 ? 1000 : 0;
        scoreRef.current += 5000 + timeBonus + speedBonus;
        
        // Victory camera shake (positive)
        shakeRef.current = 0.15;
        
        onGameOver(GamePhase.VICTORY, Math.floor(scoreRef.current));
      }
    }

    const isGreenForNPC = lp === LightPhase.GREEN || (lp === LightPhase.TURNING_RED && turnTRef.current < 0.45);
    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      if (!p.alive || p.finished) {
        if (!p.alive && p.fallProgress < 1) p.fallProgress = Math.min(1, p.fallProgress + dt * 2);
        continue;
      }

      if (isGreenForNPC) {
        p.npcResumeTimer += dt * 1000;
        if (!p.npcMoving && p.npcResumeTimer >= p.npcResumeOffsetMs) {
          p.npcMoving = true;
          p.npcStopTimer = 0;
        }
      } else {
        p.npcStopTimer += dt * 1000;
        if (p.npcMoving && p.npcStopTimer >= p.npcStopOffsetMs) {
          p.npcMoving = false;
          p.npcResumeTimer = 0;
        }
      }

      // Velocity with variation
      const baseSpeed = 5 + (p.id % 5) * 0.5;
      const speedVariation = Math.sin(performance.now() * 0.001 + p.id) * 0.3;
      const npcSpeed = baseSpeed + speedVariation;
      const targetVz = p.npcMoving ? -npcSpeed : 0;
      const accel = p.npcMoving ? 8 + (p.id % 3) * 2 : 18;
      p.vz = THREE.MathUtils.lerp(p.vz, targetVz, Math.min(1, dt * accel));

      // Slight lateral drift for realism
      if (p.npcMoving) {
        const drift = Math.sin(performance.now() * 0.003 + p.id * 0.7) * 0.015;
        p.x += drift;
        p.x = Math.max(-FIELD_WIDTH / 2 + 1, Math.min(FIELD_WIDTH / 2 - 1, p.x));
      }

      p.z += p.vz * dt;

      if (p.z <= FINISH_Z) {
        p.finished = true;
        p.z = FINISH_Z;
        p.vz = 0;
      }
    }

    if (lp === LightPhase.RED) {
      // Intensify heartbeat as player moves during red
      if (human.alive && !human.finished && Math.abs(human.vz) > 0.01) {
        const dangerLevel = Math.min(1, Math.abs(human.vz) / MOVE_THRESHOLD);
        a.heartbeat.volume(0.55 + dangerLevel * 0.35);
      } else {
        a.heartbeat.volume(0.55);
      }

      if (human.alive && !human.finished && gamePhaseRef.current === GamePhase.PLAYING) {
        const hasMovement = Math.abs(human.vz) > MOVE_THRESHOLD;
        
        if (hasMovement) {
          human.alive = false;
          human.fallProgress = 0;
          
          // Elimination state mapped correctly to halt processing
          gamePhaseRef.current = GamePhase.ELIMINATED; 
          
          shakeRef.current = 0.45; // Stronger shake
          stopDollSong();
          a.heartbeat.stop();
          
          // Guard shoot effect - store flash state for rendering directly
          guardFlashRef.current = performance.now();
          
          a.shatter.play();
          a.elimination.play();
          a.gasp.play();

          // Calculate dynamic 3D tracer coordinates from Left Finish Guard coordinates
          if (shotLineRef.current) {
            const guardX = -FIELD_WIDTH / 2 + 2;
            const guardY = 1.92; // Guard chest height
            const guardZ = FINISH_Z + 1.5;

            const points = [
              new THREE.Vector3(guardX, guardY, guardZ),
              new THREE.Vector3(human.x, 0.95, human.z) // Target player torso
            ];
            
            shotLineRef.current.geometry.setFromPoints(points);
            shotLineRef.current.visible = true;
            shotTimerRef.current = 0.25; // Render tracer burst for 250ms
          }

          onGameOver(GamePhase.ELIMINATED, Math.floor(scoreRef.current));
        }
      }
      
      // NPCs
      for (let i = 1; i < players.length; i++) {
        const p = players[i];
        if (!p.alive || p.finished) continue;
        if (Math.abs(p.vz) > MOVE_THRESHOLD) {
          p.alive = false;
          p.fallProgress = 0;
          a.shatter.play();
        }
      }
    }

    shakeRef.current = Math.max(0, shakeRef.current - dt * 1.5);
    if (human.alive) scoreRef.current += dt * 25;

    let alive = 0;
    for (const p of players) if (p.alive) alive++;
    aliveCountRef.current = alive;

    hudThrottleRef.current += dt;
    if (hudThrottleRef.current > 0.08) {
      hudThrottleRef.current = 0;
      const dist = START_Z - human.z;
      const progress = Math.max(0, Math.min(1, dist / (START_Z - FINISH_Z)));
      onHudUpdate({
        timeLeft: Math.max(0, timeLeftRef.current),
        aliveCount: alive,
        lightPhase: lightPhaseRef.current,
        score: Math.floor(scoreRef.current),
        playerProgressPct: progress,
      });
    }

    inputManager.endFrame();
  });

  const isRed = lightPhaseRef.current === LightPhase.RED;
  const turnProg =
    lightPhaseRef.current === LightPhase.TURNING_RED ? turnTRef.current :
    lightPhaseRef.current === LightPhase.TURNING_GREEN ? turnTRef.current :
    lightPhaseRef.current === LightPhase.RED ? 1 : 0;
  
  const facing: "away" | "players" = (lightPhaseRef.current === LightPhase.GREEN || lightPhaseRef.current === LightPhase.TURNING_RED)
    ? (turnTRef.current < 0.5 ? "away" : "players")
    : (lightPhaseRef.current === LightPhase.TURNING_GREEN
        ? (turnTRef.current < 0.5 ? "players" : "away")
        : "players");

  // Allocate safe geometric structures for gunshot visual line tracers
  const lineGeometry = useMemo(() => new THREE.BufferGeometry(), []);
  
  // Bypass the SVG vs R3F type collision
  const R3FLine = 'line' as any;
  return (
    <>
      <FollowCamera
        targetX={playersRef.current[0]?.x ?? 0}
        targetZ={playersRef.current[0]?.z ?? START_Z}
        phase={gamePhaseRef.current}
        shake={shakeRef.current}
      />
      
      {/* Lighting - Dramatic Green/Red Transition */}
      <ambientLight 
        intensity={isRed ? 0.25 : 0.65} 
        color={isRed ? "#4a0808" : "#ffe8c4"} 
      />
      <directionalLight
        position={[15, 20, 20]}
        intensity={isRed ? 0.5 : 1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0001}
        color={isRed ? "#ff4444" : "#fff4d6"}
      />
      <hemisphereLight 
        args={[
          isRed ? "#330000" : "#b8d4ff", 
          isRed ? "#0a0000" : "#4a3a2d", 
          isRed ? 0.15 : 0.5
        ]} 
      />

      {/* Dramatic overhead red wash during red light */}
      {isRed && (
        <>
          <directionalLight
            position={[0, 25, -15]}
            intensity={1.5}
            color="#ff2020"
            target-position={[0, 0, 40]}
          />
          <pointLight
            position={[0, 8, -12]}
            intensity={3}
            distance={80}
            decay={1.5}
            color="#ff3333"
          />
        </>
      )}

      {/* Guard muzzle flash on elimination */}
      {performance.now() - guardFlashRef.current < 100 && (
        <>
          <pointLight
            position={[-FIELD_WIDTH / 2 + 2, 2.2, FINISH_Z + 1.5]}
            intensity={15}
            distance={35}
            color="#ffaa44"
            decay={2}
            castShadow
          />
          <pointLight
            position={[FIELD_WIDTH / 2 - 2, 2.2, FINISH_Z + 1.5]}
            intensity={15}
            distance={35}
            color="#ffaa44"
            decay={2}
            castShadow
          />
        </>
      )}

      {/* Sky/Background - Sharp color shift */}
      <color attach="background" args={[isRed ? "#1a0505" : "#a7c3df"]} />

      {/* Volumetric fog feel - single instance shifts by state */}
      <fog 
        attach="fog" 
        args={[
          isRed ? "#2a0808" : "#98b8d8", 
          isRed ? 18 : 40, 
          isRed ? 95 : 150
        ]} 
      />

      <Arena isRed={isRed} />
      <Doll
        position={[0, 0, -12.5]}
        facing={facing}
        turnProgress={turnProg < 0.5 ? turnProg * 2 : (turnProg - 0.5) * 2}
        isRed={isRed}
        scanIntensity={Math.min(1, redTimerRef.current * 1.2)}
      />
      {playersRef.current.map((p) => (
        <PlayerMesh key={p.id} player={p} isMoving={Math.abs(p.vz) > 0.2} />
      ))}

      {/* Gunshot tracer element injection */}
      <R3FLine ref={shotLineRef} geometry={lineGeometry}>
        <lineBasicMaterial color="#ff1133" linewidth={3} transparent opacity={1} depthWrite={false} />
      </R3FLine>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * MAIN COMPONENT
 * ────────────────────────────────────────────────────────────────────────────*/

interface RLGLProps {
  onExit?: () => void;
  onComplete?: (score: number, outcome: "victory" | "eliminated") => void;
}

export default function RedLightGreenLight3D({ onExit, onComplete }: RLGLProps) {
  const settings = useGameStore((s) => s.settings);
  const setRuntimePhase = useGameStore((s) => s.setRuntimePhase);

  useEffect(() => {
    setRuntimePhase("countdown");
  }, [setRuntimePhase]);

  const audioRef = useRef<AudioHandles | null>(null);
  useEffect(() => {
    audioRef.current = buildAudio({
      master: settings.masterVolume,
      sfx:    settings.sfxVolume,
      music:  settings.musicVolume,
    });
    return () => {
      const a = audioRef.current;
      if (!a) return;
      Object.values(a).forEach((h) => h.unload());
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const m = settings.masterVolume;
    a.dollSong.volume(1.0 * settings.musicVolume * m);
    a.redLight.volume(0.85 * settings.sfxVolume * m);
    a.greenLight.volume(0.6 * settings.sfxVolume * m);
    a.elimination.volume(0.9 * settings.sfxVolume * m);
    a.victory.volume(0.9 * settings.sfxVolume * m);
    a.gasp.volume(0.7 * settings.sfxVolume * m);
    a.heartbeat.volume(0.55 * settings.sfxVolume * m);
    a.alarm.volume(0.5 * settings.sfxVolume * m);
    a.beep.volume(0.6 * settings.sfxVolume * m);
    a.go.volume(0.8 * settings.sfxVolume * m);
    a.cheer.volume(0.7 * settings.sfxVolume * m);
    a.step.volume(0.25 * settings.sfxVolume * m);
    a.shatter.volume(0.7 * settings.sfxVolume * m);
  }, [settings.masterVolume, settings.sfxVolume, settings.musicVolume]);

  const inputRef = useRef({ forward: false, sprint: false });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        if (audioRef.current) {
          Object.values(audioRef.current).forEach((h) => h.stop());
        }
        onExit?.();
        return;
      }
      // Stripped structural directional running keys to protect singleton mapping
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        inputRef.current.sprint = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        inputRef.current.sprint = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const onBlur = () => { inputRef.current.forward = false; inputRef.current.sprint = false; };
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [onExit]);

  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const togglePause = useCallback(() => {
    setPaused((p) => {
      pausedRef.current = !p;
      const a = audioRef.current;
      if (a) {
        if (!p) {
          a.heartbeat.pause();
          if (a.dollSong.playing()) a.dollSong.pause();
        } else {
          a.heartbeat.play();
          if (!a.dollSong.playing() && (a.dollSong as unknown as { _state?: string })._state === "paused") {
            a.dollSong.play();
          }
        }
      }
      return !p;
    });
  }, []);

  const [hud, setHud] = useState({
    timeLeft: ROUND_TIMER,
    aliveCount: NPC_COUNT + 1,
    lightPhase: LightPhase.GREEN,
    score: 0,
    playerProgressPct: 0,
  });
  const handleHudUpdate = useCallback((d: typeof hud) => setHud(d), []);

  const [endState, setEndState] = useState<{ phase: GamePhase; score: number } | null>(null);
  
  // Centralized store synchronization cleanly capturing all game-over states including timeout
  const handleGameOver = useCallback((phase: GamePhase, score: number) => {
    setEndState({ phase, score });
    
    // GameStore integration via explicit state capture
    const state = useGameStore.getState();
    state.addScore(score);
    state.updateBestScore("red-light-green-light", score);
    
    if (phase === GamePhase.VICTORY) {
      state.setRuntimePhase("victory");
      onComplete?.(score, "victory");
    } else if (phase === GamePhase.ELIMINATED || phase === GamePhase.TIMEOUT) {
      state.setRuntimePhase("eliminated");
      onComplete?.(score, "eliminated");
    }
  }, [onComplete]);

  const [resetSignal, setResetSignal] = useState(0);
  const handleRestart = useCallback(() => {
    setEndState(null);
    setRuntimePhase("countdown");
    setHud({ timeLeft: ROUND_TIMER, aliveCount: NPC_COUNT + 1, lightPhase: LightPhase.GREEN, score: 0, playerProgressPct: 0 });
    setResetSignal((n) => n + 1);
  }, [setRuntimePhase]);

  const moveHoldHandlers = useMemo(() => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); inputRef.current.forward = true; },
    onPointerUp:   () => { inputRef.current.forward = false; },
    onPointerLeave:() => { inputRef.current.forward = false; },
    onPointerCancel:() => { inputRef.current.forward = false; },
  }), []);

  return (
    <div
      data-testid="rlgl3d-root"
      style={{
        position: "fixed", inset: 0, width: "100vw", height: "100dvh",
        background: "#000", overflow: "hidden",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        userSelect: "none",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 55, near: 0.1, far: 250, position: [0, 6, 95] }}
        onPointerMissed={() => { /* noop */ }}
      >
        <Suspense fallback={null}>
          <Scene
            audioRef={audioRef}
            onGameOver={handleGameOver}
            onHudUpdate={handleHudUpdate}
            pausedRef={pausedRef}
            inputRef={inputRef}
            resetSignal={resetSignal}
          />
        </Suspense>
      </Canvas>

      <HUDOverlay
        hud={hud}
        onExit={onExit}
        onPause={togglePause}
        paused={paused}
      />

      {hud.lightPhase === LightPhase.RED && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
            boxShadow: "inset 0 0 220px 60px rgba(220,20,20,0.55)",
            animation: "rlgl3d-pulse 1.4s ease-in-out infinite alternate",
          }}
        />
      )}

      {paused && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 30,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
          }}
        >
          <div style={{ fontFamily: "var(--font-bebas)", fontSize: 64, letterSpacing: "0.2em", color: "#ff0066" }}>
            PAUSED
          </div>
          <button onClick={togglePause} data-testid="rlgl3d-resume" style={btnStyle("#00ffb2")}>
            RESUME
          </button>
          {onExit && (
            <button onClick={onExit} data-testid="rlgl3d-pause-exit" style={btnStyle("#ff0066")}>
              EXIT TO MENU
            </button>
          )}
        </div>
      )}

      {endState && (
        <EndScreen
          phase={endState.phase}
          score={endState.score}
          aliveCount={hud.aliveCount}
          onRestart={handleRestart}
          onExit={onExit}
        />
      )}

      <div
        data-testid="rlgl3d-mobile-controls"
        style={{
          position: "absolute", bottom: 28, left: 0, right: 0, zIndex: 25,
          display: "flex", justifyContent: "center", gap: 24, pointerEvents: "none",
        }}
        className="rlgl3d-touch-only"
      >
        <button
          {...moveHoldHandlers}
          data-testid="rlgl3d-move-btn"
          style={{
            pointerEvents: "auto",
            width: 110, height: 110, borderRadius: 60,
            background: "rgba(15,160,125,0.75)",
            border: "3px solid rgba(255,255,255,0.6)",
            color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: "0.18em",
            backdropFilter: "blur(6px)",
            boxShadow: "0 0 32px rgba(15,160,125,0.5)",
            touchAction: "none",
          }}
        >
          HOLD<br/>TO RUN
        </button>
      </div>

      <style>{`
        @keyframes rlgl3d-pulse {
          from { box-shadow: inset 0 0 180px 50px rgba(220,20,20,0.45); }
          to   { box-shadow: inset 0 0 260px 80px rgba(255,40,40,0.7);  }
        }
        @media (pointer: fine) {
          .rlgl3d-touch-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * HUD OVERLAY
 * ────────────────────────────────────────────────────────────────────────────*/

function HUDOverlay({
  hud, onExit, onPause, paused,
}: {
  hud: { timeLeft: number; aliveCount: number; lightPhase: LightPhase; score: number; playerProgressPct: number };
  onExit?: () => void;
  onPause: () => void;
  paused: boolean;
}) {
  const isRed = hud.lightPhase === LightPhase.RED;
  const isTurning = hud.lightPhase === LightPhase.TURNING_RED || hud.lightPhase === LightPhase.TURNING_GREEN;
  const lightCol = isRed ? "#ff2640" : isTurning ? "#ffae2a" : "#00ffb2";
  
  const lightLabel = hud.lightPhase === LightPhase.GREEN ? "GREEN LIGHT"
    : hud.lightPhase === LightPhase.RED ? "RED LIGHT"
    : hud.lightPhase === LightPhase.TURNING_RED ? "WARNING"
    : "RESUMING";

  const tMin = Math.floor(hud.timeLeft / 60);
  const tSec = Math.floor(hud.timeLeft % 60);
  const lowTime = hud.timeLeft < 15;

  return (
    <>
      <div
        data-testid="rlgl3d-hud-top"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          padding: "16px 22px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", gap: 12, pointerEvents: "auto" }}>
          {onExit && (
            <button
              onClick={onExit}
              data-testid="rlgl3d-exit-btn"
              style={{
                padding: "8px 14px",
                background: "rgba(8,8,14,0.78)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 4,
                color: "rgba(245,245,245,0.85)",
                fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
                textTransform: "uppercase", cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              ← MENU
            </button>
          )}
          <div style={panelStyle()}>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: "0.2em" }}>ALIVE</span>
            <span style={{ color: "#fff", fontWeight: 800, marginLeft: 8, fontSize: 16 }}>
              {hud.aliveCount.toString().padStart(2, "0")}<span style={{ color: "rgba(255,255,255,0.3)" }}>/{NPC_COUNT + 1}</span>
            </span>
          </div>
        </div>

        <div
          data-testid="rlgl3d-hud-light"
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            pointerEvents: "none",
          }}
        >
          <div style={{
            padding: "10px 26px",
            border: `1.5px solid ${lightCol}`,
            background: `${lightCol}18`,
            borderRadius: 4,
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "var(--font-bebas)",
            fontSize: 24, letterSpacing: "0.32em", color: lightCol,
            backdropFilter: "blur(10px)",
            boxShadow: `0 0 38px ${lightCol}50`,
            textShadow: `0 0 16px ${lightCol}`,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: 10, background: lightCol,
              boxShadow: `0 0 12px ${lightCol}`,
              animation: isRed ? "rlgl3d-blink 0.7s linear infinite" : "none",
            }} />
            {lightLabel}
          </div>
          <div style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 28, fontWeight: 700, color: lowTime ? "#ff2640" : "#fff",
            textShadow: lowTime ? "0 0 18px rgba(255,38,64,0.7)" : "none",
            letterSpacing: "0.06em",
          }}>
            {tMin.toString().padStart(2, "0")}:{tSec.toString().padStart(2, "0")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, pointerEvents: "auto" }}>
          <div style={panelStyle()}>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: "0.2em" }}>SCORE</span>
            <span style={{ color: "#00ffb2", fontWeight: 800, marginLeft: 8, fontSize: 16, textShadow: "0 0 10px rgba(0,255,178,0.55)" }}>
              {hud.score.toLocaleString("en-US").padStart(6, "0")}
            </span>
          </div>
          <button
            onClick={onPause}
            data-testid="rlgl3d-pause-btn"
            aria-label={paused ? "Resume" : "Pause"}
            style={{
              padding: "8px 14px",
              background: "rgba(8,8,14,0.78)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 4,
              color: "rgba(245,245,245,0.85)",
              fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
              textTransform: "uppercase", cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            {paused ? "▶ PLAY" : "❚❚ PAUSE"}
          </button>
        </div>
      </div>

      <div
        data-testid="rlgl3d-progress"
        style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          bottom: 18, width: "min(640px, 80%)", zIndex: 10,
          padding: "8px 14px",
          background: "rgba(8,8,14,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 4,
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 9, letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)" }}>
          <span>START</span>
          <span>{Math.round(hud.playerProgressPct * 100)}%</span>
          <span>FINISH</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${hud.playerProgressPct * 100}%`,
              background: "linear-gradient(90deg, #00ffb2 0%, #ffd83d 60%, #ff0066 100%)",
              transition: "width 0.18s linear",
              boxShadow: "0 0 12px rgba(0,255,178,0.6)",
            }}
          />
        </div>
      </div>

      <div style={{
        position: "absolute", left: 22, bottom: 76, zIndex: 10,
        padding: "8px 12px",
        background: "rgba(8,8,14,0.6)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 4,
        fontSize: 10, letterSpacing: "0.16em", color: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(6px)",
        pointerEvents: "none",
      }}
        className="rlgl3d-desktop-only"
      >
        HOLD <b style={{ color: "#00ffb2" }}>W</b> / <b style={{ color: "#00ffb2" }}>↑</b> / <b style={{ color: "#00ffb2" }}>SPACE</b> TO RUN · <b>SHIFT</b> SPRINT · <b>ESC</b> EXIT
      </div>
      <style>{`
        @keyframes rlgl3d-blink {
          50% { opacity: 0.25; }
        }
        @media (pointer: coarse) {
          .rlgl3d-desktop-only { display: none !important; }
        }
      `}</style>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * END SCREEN
 * ────────────────────────────────────────────────────────────────────────────*/

function EndScreen({
  phase, score, aliveCount, onRestart, onExit,
}: {
  phase: GamePhase; score: number; aliveCount: number;
  onRestart: () => void; onExit?: () => void;
}) {
  const isWin = phase === GamePhase.VICTORY;
  const title = isWin ? "YOU SURVIVED" : phase === GamePhase.TIMEOUT ? "TIME'S UP" : "ELIMINATED";
  const sub   = isWin ? "ROUND CLEARED" : phase === GamePhase.TIMEOUT ? "FAILED TO REACH FINISH" : "MOVED DURING RED LIGHT";
  const color = isWin ? "#00ffb2" : "#ff2640";

  return (
    <div
      data-testid="rlgl3d-endscreen"
      style={{
        position: "absolute", inset: 0, zIndex: 40,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(14px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22,
        animation: "rlgl3d-fadein 0.5s ease",
      }}
    >
      <div style={{
        fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)",
        fontSize: "clamp(48px, 11vw, 110px)", letterSpacing: "0.15em",
        color, textShadow: `0 0 50px ${color}`,
      }}>
        {title}
      </div>
      <div style={{ fontSize: 12, letterSpacing: "0.32em", color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>
        {sub}
      </div>
      <div style={{ display: "flex", gap: 32, marginTop: 10 }}>
        <Stat label="SCORE" value={score.toLocaleString("en-US")} accent="#ffd83d" />
        <Stat label="SURVIVORS" value={`${aliveCount}/${NPC_COUNT + 1}`} accent="#00ffb2" />
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
        <button data-testid="rlgl3d-restart" onClick={onRestart} style={btnStyle("#00ffb2")}>
          PLAY AGAIN
        </button>
        {onExit && (
          <button data-testid="rlgl3d-end-exit" onClick={onExit} style={btnStyle("#ff0066")}>
            ← MENU
          </button>
        )}
      </div>
      <style>{`
        @keyframes rlgl3d-fadein {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(255,255,255,0.4)" }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: accent, textShadow: `0 0 16px ${accent}88`, fontFamily: "var(--font-mono)" }}>
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STYLE HELPERS
 * ────────────────────────────────────────────────────────────────────────────*/

function panelStyle(): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: "rgba(8,8,14,0.78)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 4,
    backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center",
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  };
}

function btnStyle(accent: string): React.CSSProperties {
  return {
    padding: "12px 30px",
    background: "transparent",
    border: `1.5px solid ${accent}`,
    borderRadius: 4,
    color: accent,
    fontSize: 13, letterSpacing: "0.22em", fontWeight: 800,
    fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)",
    cursor: "pointer",
    textTransform: "uppercase",
    transition: "all 140ms",
  };
}
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line, RoundedBox, Sparkles } from "@react-three/drei";
import { MathUtils, type Group } from "three";
import { useRef, type MutableRefObject } from "react";

function DocumentLines({ compact = false }: { compact?: boolean }) {
  const widths = compact ? [1.25, 0.9, 1.1, 0.7] : [2.45, 1.75, 2.1, 1.35, 2.25];
  return <>{widths.map((width, index) => <mesh key={width + index} position={[-0.5 + width / 2, 0.58 - index * 0.31, 0.13]}><boxGeometry args={[width, index === 0 ? 0.105 : 0.065, 0.025]} /><meshStandardMaterial color={index === 0 ? "#f1f5f9" : "#94a3b8"} emissive={index === 0 ? "#4dc9c0" : "#182235"} emissiveIntensity={0.2} /></mesh>)}</>;
}

function MainDocument() {
  return (
    <group>
      <RoundedBox args={[4.45, 2.9, 0.18]} radius={0.18} smoothness={5}>
        <meshPhysicalMaterial color="#182235" roughness={0.24} metalness={0.08} transmission={0.08} transparent opacity={0.97} clearcoat={0.7} clearcoatRoughness={0.22} />
      </RoundedBox>
      <mesh position={[0, 1.08, 0.125]}><boxGeometry args={[4.05, 0.02, 0.02]} /><meshBasicMaterial color="#26374b" transparent opacity={0.9} /></mesh>
      <mesh position={[-1.65, 1.22, 0.16]}><sphereGeometry args={[0.08, 18, 18]} /><meshStandardMaterial color="#7dd3c7" emissive="#4dc9c0" emissiveIntensity={1.4} /></mesh>
      <mesh position={[-1.4, 1.22, 0.16]}><sphereGeometry args={[0.08, 18, 18]} /><meshStandardMaterial color="#a5b4c1" emissive="#a5b4c1" emissiveIntensity={0.8} /></mesh>
      <mesh position={[-1.15, 1.22, 0.16]}><sphereGeometry args={[0.08, 18, 18]} /><meshStandardMaterial color="#4dc9c0" emissive="#4dc9c0" emissiveIntensity={1.2} /></mesh>
      <DocumentLines />
      {[0, 1, 2].map((index) => <group key={index} position={[-1.55, -0.65 - index * 0.28, 0.15]}><RoundedBox args={[0.16, 0.16, 0.035]} radius={0.035} smoothness={3}><meshStandardMaterial color={index === 0 ? "#7dd3c7" : "#111d2d"} emissive={index === 0 ? "#4dc9c0" : "#182235"} emissiveIntensity={index === 0 ? 0.9 : 0.1} /></RoundedBox><mesh position={[0.92, 0, 0]}><boxGeometry args={[1.45 + index * 0.22, 0.065, 0.025]} /><meshStandardMaterial color="#94a3b8" /></mesh></group>)}
    </group>
  );
}

function SidePanel({ position, rotation, accent }: { position: [number, number, number]; rotation: [number, number, number]; accent: string }) {
  return (
    <Float speed={1.35} rotationIntensity={0.12} floatIntensity={0.28}>
      <group position={position} rotation={rotation}>
        <RoundedBox args={[2.25, 1.7, 0.14]} radius={0.14} smoothness={4}>
          <meshPhysicalMaterial color="#111d2d" roughness={0.28} transmission={0.08} transparent opacity={0.96} clearcoat={0.65} />
        </RoundedBox>
        <mesh position={[-0.76, 0.56, 0.1]}><sphereGeometry args={[0.16, 22, 22]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} /></mesh>
        <DocumentLines compact />
      </group>
    </Float>
  );
}

function AvatarNode({ position, color }: { position: [number, number, number]; color: string }) {
  return <Float speed={1.8} rotationIntensity={0.15} floatIntensity={0.38}><group position={position}><mesh><sphereGeometry args={[0.27, 28, 28]} /><meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.65} roughness={0.2} clearcoat={1} /></mesh><mesh scale={1.5}><sphereGeometry args={[0.27, 22, 22]} /><meshBasicMaterial color={color} transparent opacity={0.08} /></mesh></group></Float>;
}

function WorkspaceScene({ progress }: { progress: MutableRefObject<number> }) {
  const root = useRef<Group>(null);
  useFrame(({ pointer, camera }, delta) => {
    const scroll = progress.current;
    camera.position.x = MathUtils.damp(camera.position.x, pointer.x * 0.38, 3, delta);
    camera.position.y = MathUtils.damp(camera.position.y, pointer.y * 0.28 - scroll * 0.35, 3, delta);
    camera.position.z = MathUtils.damp(camera.position.z, 7.6 - scroll * 0.9, 2.4, delta);
    camera.lookAt(0, 0, 0);
    if (root.current) {
      root.current.rotation.y = MathUtils.damp(root.current.rotation.y, pointer.x * 0.11 + scroll * 0.16, 2.6, delta);
      root.current.rotation.x = MathUtils.damp(root.current.rotation.x, -pointer.y * 0.07 - scroll * 0.05, 2.6, delta);
    }
  });

  return (
    <group ref={root} rotation={[-0.04, -0.08, 0]}>
      <Float speed={1.1} rotationIntensity={0.07} floatIntensity={0.24}><MainDocument /></Float>
      <SidePanel position={[-3.65, 0.25, -1.2]} rotation={[0.04, 0.4, -0.05]} accent="#7dd3c7" />
      <SidePanel position={[3.65, -0.05, -1.4]} rotation={[-0.02, -0.42, 0.05]} accent="#a5b4c1" />
      <AvatarNode position={[-2.62, 2.05, 0.35]} color="#7dd3c7" />
      <AvatarNode position={[2.55, 2.12, 0.15]} color="#a5b4c1" />
      <AvatarNode position={[3.05, -1.78, 0.4]} color="#4dc9c0" />
      <Line points={[[-2.45, 1.88, 0.2], [-1.45, 1.15, 0.05]]} color="#7dd3c7" transparent opacity={0.34} lineWidth={1} />
      <Line points={[[2.38, 1.92, 0.05], [1.42, 1.1, 0.05]]} color="#a5b4c1" transparent opacity={0.26} lineWidth={1} />
      <Line points={[[2.9, -1.58, 0.18], [1.65, -1.03, 0.05]]} color="#4dc9c0" transparent opacity={0.32} lineWidth={1} />
      <group position={[0.95, 0.2, 0.55]} rotation={[0, 0, -0.55]}><mesh><coneGeometry args={[0.15, 0.52, 3]} /><meshStandardMaterial color="#7dd3c7" emissive="#4dc9c0" emissiveIntensity={1.2} /></mesh><mesh position={[0.28, -0.14, 0]}><boxGeometry args={[0.58, 0.22, 0.08]} /><meshStandardMaterial color="#245e5b" emissive="#4dc9c0" emissiveIntensity={0.45} /></mesh></group>
      <group position={[0, -2.05, -1.2]} rotation={[Math.PI / 2, 0, 0]}><mesh><torusGeometry args={[2.5, 0.018, 8, 96]} /><meshBasicMaterial color="#4dc9c0" transparent opacity={0.32} /></mesh><mesh scale={1.35}><torusGeometry args={[2.5, 0.01, 8, 96]} /><meshBasicMaterial color="#a5b4c1" transparent opacity={0.16} /></mesh></group>
      <Sparkles count={42} scale={[10, 6, 4]} size={1.1} speed={0.2} color="#7dd3c7" opacity={0.34} />
    </group>
  );
}

export default function SpatialHeroScene({ progress }: { progress: MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.6], fov: 44 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop="always"
    >
      <ambientLight intensity={0.72} />
      <directionalLight position={[4, 6, 6]} intensity={2.05} color="#f1f5f9" />
      <pointLight position={[-4, 1, 3]} intensity={23} distance={9} color="#4dc9c0" />
      <pointLight position={[4, -1, 3]} intensity={14} distance={8} color="#a5b4c1" />
      <WorkspaceScene progress={progress} />
    </Canvas>
  );
}

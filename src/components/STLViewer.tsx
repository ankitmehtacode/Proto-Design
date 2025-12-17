import { useEffect, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stage } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

interface ModelStats {
    volume: number; // cm3
    dimensions: { x: number; y: number; z: number }; // cm
}

interface STLViewerProps {
    file: File | null;
    rotationX: number; // Degrees
    rotationY: number; // Degrees
    onStatsCalculated: (stats: ModelStats) => void;
}

const ModelRender = ({ geometry, rotationX, rotationY }: { geometry: THREE.BufferGeometry; rotationX: number; rotationY: number }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.rotation.x = (rotationX * Math.PI) / 180;
            meshRef.current.rotation.y = (rotationY * Math.PI) / 180;
        }
    }, [rotationX, rotationY]);

    return (
        <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial color="#3b82f6" roughness={0.5} metalness={0.1} />
        </mesh>
    );
};

export const STLViewer = ({ file, rotationX, rotationY, onStatsCalculated }: STLViewerProps) => {
    const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
    const [loading, setLoading] = useState(false);

    const calculateVolume = (geo: THREE.BufferGeometry) => {
        const position = geo.attributes.position;
        const faces = position.count / 3;
        let sum = 0;
        const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
        for (let i = 0; i < faces; i++) {
            p1.fromBufferAttribute(position, i * 3 + 0);
            p2.fromBufferAttribute(position, i * 3 + 1);
            p3.fromBufferAttribute(position, i * 3 + 2);
            sum += p1.dot(p2.cross(p3)) / 6.0;
        }
        return Math.abs(sum) / 1000; // mm3 to cm3
    };

    useEffect(() => {
        if (!file) {
            setGeometry(null);
            return;
        }

        setLoading(true);
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                const name = file.name.toLowerCase();
                let geo: THREE.BufferGeometry | null = null;

                if (name.endsWith(".stl")) {
                    const loader = new STLLoader();
                    geo = loader.parse(arrayBuffer);
                } else if (name.endsWith(".obj")) {
                    const text = new TextDecoder().decode(arrayBuffer);
                    const loader = new OBJLoader();
                    const obj = loader.parse(text);
                    obj.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh && !geo) {
                            geo = (child as THREE.Mesh).geometry.clone();
                        }
                    });
                }

                if (geo) {
                    geo.center();
                    geo.computeVertexNormals();
                    geo.computeBoundingBox();
                    const size = new THREE.Vector3();
                    geo.boundingBox!.getSize(size);

                    onStatsCalculated({
                        volume: parseFloat(calculateVolume(geo).toFixed(2)),
                        dimensions: {
                            x: parseFloat((size.x / 10).toFixed(2)),
                            y: parseFloat((size.y / 10).toFixed(2)),
                            z: parseFloat((size.z / 10).toFixed(2)),
                        }
                    });
                    setGeometry(geo);
                }
            } catch (err) {
                console.error("Error loading model:", err);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file]);

    return (
        <div className="w-full h-full rounded-lg overflow-hidden bg-slate-900 relative shadow-inner">
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white z-10">Loading...</div>}
            <Canvas shadows dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 0, 150]} fov={50} />
                <OrbitControls makeDefault enablePan enableZoom />
                <Stage environment="city" intensity={0.6} adjustCamera={true}>
                    {geometry && <ModelRender geometry={geometry} rotationX={rotationX} rotationY={rotationY} />}
                </Stage>
            </Canvas>
        </div>
    );
};
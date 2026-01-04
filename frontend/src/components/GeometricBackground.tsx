import { useEffect, useState } from 'react'

interface Shape {
  id: number
  type: 'circle' | 'square' | 'triangle' | 'hexagon'
  x: number
  y: number
  size: number
  rotation: number
  speed: number
}

export default function GeometricBackground() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Generate random shapes
    const generatedShapes: Shape[] = []
    const shapeTypes: Shape['type'][] = ['circle', 'square', 'triangle', 'hexagon']

    for (let i = 0; i < 20; i++) {
      generatedShapes.push({
        id: i,
        type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 100 + 50,
        rotation: Math.random() * 360,
        speed: Math.random() * 0.5 + 0.2
      })
    }

    setShapes(generatedShapes)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const getShapeElement = (shape: Shape) => {
    const distanceX = (mousePos.x - shape.x) * 0.05
    const distanceY = (mousePos.y - shape.y) * 0.05
    const mouseRotation = Math.atan2(mousePos.y - shape.y, mousePos.x - shape.x) * (180 / Math.PI)

    const baseStyle = {
      position: 'absolute' as const,
      left: `${shape.x}%`,
      top: `${shape.y}%`,
      width: `${shape.size}px`,
      height: `${shape.size}px`,
      transform: `translate(${distanceX}px, ${distanceY}px) rotate(${shape.rotation + mouseRotation * 0.1}deg)`,
      transition: 'transform 0.3s ease-out',
      opacity: 0.6,
    }

    switch (shape.type) {
      case 'circle':
        return (
          <div
            key={shape.id}
            style={{
              ...baseStyle,
              border: '2px solid rgba(59, 130, 246, 0.6)',
              borderRadius: '50%',
            }}
          />
        )
      case 'square':
        return (
          <div
            key={shape.id}
            style={{
              ...baseStyle,
              border: '2px solid rgba(139, 92, 246, 0.6)',
            }}
          />
        )
      case 'triangle':
        return (
          <div
            key={shape.id}
            style={{
              ...baseStyle,
              width: 0,
              height: 0,
              borderLeft: `${shape.size / 2}px solid transparent`,
              borderRight: `${shape.size / 2}px solid transparent`,
              borderBottom: `${shape.size}px solid rgba(6, 182, 212, 0.6)`,
            }}
          />
        )
      case 'hexagon':
        return (
          <div
            key={shape.id}
            style={{
              ...baseStyle,
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
              border: '2px solid rgba(16, 185, 129, 0.6)',
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{
        zIndex: 0,
        opacity: 0.5
      }}
    >
      {/* Animated gradient overlay for extra depth */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 60%)',
          animation: 'pulse 8s ease-in-out infinite',
        }}
      />

      {/* Geometric shapes */}
      {shapes.map(shape => getShapeElement(shape))}

      {/* Grid lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  )
}

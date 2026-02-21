"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";
import ShaderBackground from "@/components/ui/shader-background";
import { cn } from "@/lib/utils";

interface BackgroundCellsProps {
  children?: React.ReactNode;
  className?: string;
}

export const BackgroundCells = ({ children, className }: BackgroundCellsProps) => {
  return (
    <div className={cn("relative h-full w-full overflow-hidden overflow-x-hidden", className)}>
      <BackgroundCellCore />
      {children && (
        <div className="relative z-10 pointer-events-none select-none">
          {children}
        </div>
      )}
    </div>
  );
};

const BackgroundCellCore = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [maskSize, setMaskSize] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Calculate mask size based on viewport height
  const updateMaskSize = useCallback(() => {
    // Make mask size roughly 30% of viewport height
    const viewportHeight = window.innerHeight;
    setMaskSize(Math.round(viewportHeight * 0.55));
  }, []);

  // Update mouse position and account for scroll
  const handleMouseMove = (event: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      // Calculate position with scroll offset
      setMousePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    }
  };

  // Handle mouse enter/leave
  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  // Initialize and handle resize
  useEffect(() => {
    // Set initial size
    updateMaskSize();
    
    // Update on resize
    window.addEventListener('resize', updateMaskSize);
    return () => window.removeEventListener('resize', updateMaskSize);
  }, [updateMaskSize]);

  // Update on scroll to maintain correct highlight position
  useEffect(() => {
    const handleScroll = () => {
      // Force a re-render when scrolling to maintain position
      setMousePosition(prev => ({ ...prev }));
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="h-full w-full absolute inset-0 pointer-events-auto"
    >
      <div className="absolute h-full w-full inset-0 overflow-hidden">
        {isHovering && (
          <div
            className="absolute inset-0 z-20 bg-transparent w-full pointer-events-none"
            style={{
              maskImage: `radial-gradient(${maskSize / 4}px circle at center, white, transparent)`,
              WebkitMaskImage: `radial-gradient(${maskSize / 4}px circle at center, white, transparent)`,
              WebkitMaskPosition: `${mousePosition.x - maskSize / 2}px ${mousePosition.y - maskSize / 2}px`,
              WebkitMaskSize: `${maskSize}px`,
              maskSize: `${maskSize}px`,
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }}
          >
            <Pattern cellClassName="border-[var(--highlight-alpha)] relative z-[100]" />
          </div>
        )}
        <Pattern className="opacity-[0.15] pointer-events-auto" cellClassName="border-white/60" />
        {/* Circular gradient for curved corners */}
        <div 
          className="absolute pointer-events-none z-30"
          style={{
            bottom: '-250px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max(220vw, 150vh)',
            height: 'max(210vw, 200vh)',
            background: 'radial-gradient(circle, transparent 0%, transparent 35%, hsl(var(--background)) 60%, hsl(var(--background)) 100%)',
          }}
        />
        {/* Linear gradient safety net for bottom coverage */}
        <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none z-29" />
        <ShaderBackground />
      </div>
    </div>
  );
};

interface PatternProps {
  className?: string;
  cellClassName?: string;
}

const Cell = ({ 
  rowIdx, 
  colIdx, 
  clickedCell, 
  cellClassName 
}: { 
  rowIdx: number; 
  colIdx: number; 
  clickedCell: [number, number] | null;
  cellClassName?: string;
}) => {
  const controls = useAnimation();

  useEffect(() => {
    if (clickedCell) {
      const distance = Math.sqrt(
        Math.pow(clickedCell[0] - rowIdx, 2) +
          Math.pow(clickedCell[1] - colIdx, 2)
      );
      controls.start({
        opacity: [0, 1 - distance * 0.15, 0],
        transition: { duration: distance * 0.2 },
      });
    }
  }, [clickedCell, controls, rowIdx, colIdx]);

  return (
    <div
      className={cn(
        "bg-transparent border-l border-b border-border",
        cellClassName
      )}
    >
      <motion.div
        initial={{
          opacity: 0,
        }}
        whileHover={{
          opacity: [0, 1.0],
        }}
        transition={{
          duration: 0.75,
          ease: "backOut",
        }}
        animate={controls}
        className="h-10 w-10"
        style={{ backgroundColor: 'var(--highlight)' }}
      />
    </div>
  );
};

const Pattern = ({ className, cellClassName }: PatternProps) => {
  const [dimensions, setDimensions] = useState({ cols: 47, rows: 30 });

  useEffect(() => {
    const updateDimensions = () => {
      // Calculate columns based on viewport width to prevent overflow
      // Each cell is 40px (w-10), so we divide viewport width by 40 and add minimal buffer
      const viewportWidth = window.innerWidth;
      const cellWidth = 40; // w-10 = 40px
      const cols = Math.floor(viewportWidth / cellWidth);
      const rows = 30; // Keep rows constant
      
      setDimensions({ cols, rows });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const x = new Array(dimensions.cols).fill(0);
  const y = new Array(dimensions.rows).fill(0);
  const matrix = x.map((_, i) => y.map((_, j) => [i, j]));
  const [clickedCell, setClickedCell] = useState<[number, number] | null>(null);

  return (
    <div className={cn("flex flex-row relative z-30 overflow-hidden w-full", className)}>
      {matrix.map((row, rowIdx) => (
        <div
          key={`matrix-row-${rowIdx}`}
          className="flex flex-col relative z-20 border-b border-border"
        >
          {row.map((column, colIdx) => (
            <div 
              key={`matrix-col-${colIdx}`}
              onClick={() => setClickedCell([rowIdx, colIdx])}
            >
              <Cell 
                rowIdx={rowIdx} 
                colIdx={colIdx} 
                clickedCell={clickedCell}
                cellClassName={cellClassName}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
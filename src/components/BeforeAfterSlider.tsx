import { useState, useRef, useCallback } from "react";
import { Camera, CheckCircle } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
}

const BeforeAfterSlider = ({ beforeUrl, afterUrl, className = "" }: BeforeAfterSliderProps) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, []);

  const handleMouseDown = () => { isDragging.current = true; };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) updatePosition(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    updatePosition(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none cursor-col-resize overflow-hidden rounded-xl border border-border ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* After image (full background) */}
      <img src={afterUrl} alt="After" className="w-full h-full object-cover" draggable={false} />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={beforeUrl}
          alt="Before"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ width: `${containerRef.current ? containerRef.current.offsetWidth : 100}px`, maxWidth: "none" }}
          draggable={false}
        />
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 bg-muted-foreground rounded-full" />
            <div className="w-0.5 h-3 bg-muted-foreground rounded-full" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-destructive/80 text-destructive-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm">
        <Camera className="w-3 h-3" /> Before
      </div>
      <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-green-600/80 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm">
        <CheckCircle className="w-3 h-3" /> After
      </div>
    </div>
  );
};

export default BeforeAfterSlider;

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Circle, Rect, Line, Polygon, IText, Path } from "fabric";
import { AnnotationTool } from "./PDFAnnotationApp";
import { toast } from "sonner";

interface AnnotationCanvasProps {
  width: number;
  height: number;
  activeTool: AnnotationTool;
  annotations: any[];
  onAnnotationChange: (annotations: any[]) => void;
  scale: number;
  page: number;
}

export const AnnotationCanvas = ({
  width,
  height,
  activeTool,
  annotations,
  onAnnotationChange,
  scale,
  page
}: AnnotationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<any>(null);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
    });

    // Configure drawing brush
    canvas.freeDrawingBrush.width = activeTool.strokeWidth;
    canvas.freeDrawingBrush.color = activeTool.color;

    fabricCanvasRef.current = canvas;

    // Handle object modifications
    const handleObjectModified = () => {
      saveAnnotations();
    };

    const handlePathCreated = (e: any) => {
      if (activeTool.type === 'draw') {
        e.path.set({
          stroke: activeTool.color,
          strokeWidth: activeTool.strokeWidth,
          fill: '',
          selectable: true
        });
        saveAnnotations();
      }
    };

    canvas.on('object:modified', handleObjectModified);
    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.off('object:modified', handleObjectModified);
      canvas.off('path:created', handlePathCreated);
      canvas.dispose();
    };
  }, [width, height]);

  // Update canvas size when PDF scale changes
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setDimensions({ width, height });
      fabricCanvasRef.current.renderAll();
    }
  }, [width, height]);

  // Update tool behavior
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    
    // Reset canvas state
    canvas.isDrawingMode = activeTool.type === 'draw';
    canvas.selection = activeTool.type === 'select';
    
    // Update brush properties
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = activeTool.strokeWidth;
      canvas.freeDrawingBrush.color = activeTool.color;
    }

    // Set object selectability
    canvas.getObjects().forEach(obj => {
      obj.selectable = activeTool.type === 'select';
      obj.evented = activeTool.type === 'select';
    });

    canvas.renderAll();
  }, [activeTool]);

  // Handle mouse events for shape drawing
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    let startX = 0, startY = 0;
    let activeObject: any = null;

    const handleMouseDown = (e: any) => {
      if (activeTool.type === 'select' || activeTool.type === 'draw') return;

      const pointer = canvas.getPointer(e.e);
      startX = pointer.x;
      startY = pointer.y;
      setIsDrawing(true);

      // Create shape based on active tool
      switch (activeTool.type) {
        case 'rectangle':
          activeObject = new Rect({
            left: startX,
            top: startY,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: activeTool.color,
            strokeWidth: activeTool.strokeWidth,
            selectable: false
          });
          break;
        case 'circle':
          activeObject = new Circle({
            left: startX,
            top: startY,
            radius: 0,
            fill: 'transparent',
            stroke: activeTool.color,
            strokeWidth: activeTool.strokeWidth,
            selectable: false
          });
          break;
        case 'line':
          activeObject = new Line([startX, startY, startX, startY], {
            stroke: activeTool.color,
            strokeWidth: activeTool.strokeWidth,
            selectable: false
          });
          break;
        case 'text':
          activeObject = new IText('Click to edit text', {
            left: startX,
            top: startY,
            fill: activeTool.color,
            fontSize: 16,
            fontFamily: 'Arial',
            selectable: true
          });
          canvas.add(activeObject);
          canvas.setActiveObject(activeObject);
          activeObject.enterEditing();
          setIsDrawing(false);
          return;
      }

      if (activeObject) {
        canvas.add(activeObject);
      }
    };

    const handleMouseMove = (e: any) => {
      if (!isDrawing || !activeObject) return;

      const pointer = canvas.getPointer(e.e);
      const width = pointer.x - startX;
      const height = pointer.y - startY;

      switch (activeTool.type) {
        case 'rectangle':
          activeObject.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width < 0 ? pointer.x : startX,
            top: height < 0 ? pointer.y : startY
          });
          break;
        case 'circle':
          const radius = Math.abs(Math.sqrt(width * width + height * height) / 2);
          activeObject.set({
            radius,
            left: startX - radius,
            top: startY - radius
          });
          break;
        case 'line':
          activeObject.set({
            x2: pointer.x,
            y2: pointer.y
          });
          break;
      }

      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (isDrawing && activeObject) {
        activeObject.set({
          selectable: activeTool.type === 'select'
        });
        saveAnnotations();
      }
      setIsDrawing(false);
      activeObject = null;
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [activeTool, isDrawing]);

  const saveAnnotations = useCallback(() => {
    if (!fabricCanvasRef.current) return;

    const canvasObjects = fabricCanvasRef.current.getObjects();
    const annotationData = canvasObjects.map((obj, index) => ({
      id: `${page}-${index}`,
      type: obj.type,
      data: obj.toObject(),
      page
    }));

    onAnnotationChange(annotationData);
  }, [page, onAnnotationChange]);

  // Load annotations when page changes
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.clear();

    // Load annotations for current page
    annotations.forEach(annotation => {
      if (annotation.page === page) {
        let object: any;
        
        switch (annotation.type) {
          case 'rect':
            object = new Rect(annotation.data);
            break;
          case 'circle':
            object = new Circle(annotation.data);
            break;
          case 'line':
            object = new Line(
              [annotation.data.x1, annotation.data.y1, annotation.data.x2, annotation.data.y2],
              annotation.data
            );
            break;
          case 'i-text':
            object = new IText(annotation.data.text || '', annotation.data);
            break;
          case 'path':
            object = new Path(annotation.data.path, annotation.data);
            break;
        }

        if (object) {
          object.selectable = activeTool.type === 'select';
          object.evented = activeTool.type === 'select';
          canvas.add(object);
        }
      }
    });

    canvas.renderAll();
  }, [annotations, page, activeTool.type]);

  return (
    <div 
      className="absolute inset-0 pointer-events-auto"
      style={{ 
        cursor: activeTool.type === 'draw' ? 'crosshair' : 
               activeTool.type === 'text' ? 'text' :
               activeTool.type === 'select' ? 'default' : 'crosshair'
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          width: `${width}px`, 
          height: `${height}px`,
        }}
      />
    </div>
  );
};
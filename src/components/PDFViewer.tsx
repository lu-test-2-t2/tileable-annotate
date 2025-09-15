import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AnnotationTool, PDFFile } from "./PDFAnnotationApp";

// Set up PDF.js worker - using a more reliable CDN
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfFile: PDFFile;
  activeTool: AnnotationTool;
  annotations: any[];
  onAnnotationChange: (annotations: any[]) => void;
}

export const PDFViewer = ({ 
  pdfFile, 
  activeTool, 
  annotations,
  onAnnotationChange 
}: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageLoading(false);
    toast.success(`PDF loaded with ${numPages} pages`);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error);
    toast.error('Failed to load PDF file');
  }, []);

  const onPageLoadSuccess = useCallback((page: any) => {
    const viewport = page.getViewport({ scale: 1.0 });
    setPageWidth(viewport.width);
    setPageHeight(viewport.height);
  }, []);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(numPages, prev + 1));
  }, [numPages]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(3.0, prev + 0.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(0.25, prev - 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  }, [numPages]);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 text-center bg-background border border-border rounded"
              min={1}
              max={numPages}
            />
            <span className="text-muted-foreground">of {numPages}</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground min-w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button variant="ghost" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button variant="ghost" size="sm" onClick={handleRotate}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-pdf-background p-8"
      >
        <div className="flex justify-center">
          <div 
            ref={pageRef}
            className="relative bg-white shadow-strong rounded-sm"
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <Document
              file={pdfFile.url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="text-muted-foreground">Loading PDF...</div>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                rotate={rotation}
                onLoadSuccess={onPageLoadSuccess}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="text-muted-foreground">Loading page...</div>
                  </div>
                }
              />
            </Document>

            {/* Annotation Canvas Overlay */}
            {pageWidth > 0 && pageHeight > 0 && (
              <AnnotationCanvas
                width={pageWidth * scale}
                height={pageHeight * scale}
                activeTool={activeTool}
                annotations={annotations.filter(ann => ann.page === currentPage)}
                onAnnotationChange={(pageAnnotations) => {
                  const otherPageAnnotations = annotations.filter(ann => ann.page !== currentPage);
                  const updatedAnnotations = [
                    ...otherPageAnnotations,
                    ...pageAnnotations.map(ann => ({ ...ann, page: currentPage }))
                  ];
                  onAnnotationChange(updatedAnnotations);
                }}
                scale={scale}
                page={currentPage}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
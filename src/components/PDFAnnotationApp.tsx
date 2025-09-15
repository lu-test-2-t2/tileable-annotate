import { useState, useCallback } from "react";
import { FileUpload } from "./FileUpload";
import { PDFViewer } from "./PDFViewer";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { toast } from "sonner";

export interface AnnotationTool {
  id: string;
  name: string;
  type: 'select' | 'draw' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'polygon' | 'line';
  color: string;
  strokeWidth: number;
}

export interface PDFFile {
  file: File;
  url: string;
  name: string;
}

const PDFAnnotationApp = () => {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>({
    id: 'select',
    name: 'Select',
    type: 'select',
    color: '#3b82f6',
    strokeWidth: 2
  });
  const [annotations, setAnnotations] = useState<any[]>([]);

  const handleFileUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPdfFile({
      file,
      url,
      name: file.name
    });
    toast.success(`PDF loaded: ${file.name}`);
  }, []);

  const handleToolChange = useCallback((tool: AnnotationTool) => {
    setActiveTool(tool);
  }, []);

  const handleAnnotationChange = useCallback((newAnnotations: any[]) => {
    setAnnotations(newAnnotations);
  }, []);

  const handleSaveAnnotations = useCallback(() => {
    if (!pdfFile) return;
    
    const annotationData = {
      fileName: pdfFile.name,
      annotations,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(annotationData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pdfFile.name.replace('.pdf', '')}-annotations.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Annotations saved!');
  }, [pdfFile, annotations]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Sidebar with tools */}
        <div className="w-20 bg-card border-r border-border shadow-soft">
          <AnnotationToolbar
            activeTool={activeTool}
            onToolChange={handleToolChange}
            onSave={handleSaveAnnotations}
            disabled={!pdfFile}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {!pdfFile ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <FileUpload onFileUpload={handleFileUpload} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* PDF Header */}
              <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shadow-soft">
                <div className="flex items-center gap-4">
                  <h1 className="text-lg font-semibold text-foreground">
                    {pdfFile.name}
                  </h1>
                  <div className="text-sm text-muted-foreground">
                    {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Tool: {activeTool.name}
                  </span>
                  <div 
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: activeTool.color }}
                  />
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 bg-pdf-background">
                <PDFViewer
                  pdfFile={pdfFile}
                  activeTool={activeTool}
                  annotations={annotations}
                  onAnnotationChange={handleAnnotationChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFAnnotationApp;
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileText, Download, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
}

interface ParsedRow {
  phone: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  [key: string]: string | undefined;
}

export function BulkUploadDialog({ open, onOpenChange, agentName }: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = async (csvFile: File) => {
    const text = await csvFile.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: ParsedRow = { phone: '' };
      
      headers.forEach((header, index) => {
        if (header === 'phone' || header === 'phone_number' || header === 'phonenumber') {
          row.phone = values[index] || '';
        } else if (header === 'first_name' || header === 'firstname') {
          row.firstName = values[index];
        } else if (header === 'last_name' || header === 'lastname') {
          row.lastName = values[index];
        } else if (header === 'company') {
          row.company = values[index];
        } else {
          row[header] = values[index];
        }
      });
      
      if (row.phone) {
        rows.push(row);
      }
    }
    
    setParsedData(rows);
    toast.success(`Parsed ${rows.length} contacts from CSV`);
  };

  const downloadTemplate = () => {
    const template = 'phone,first_name,last_name,company\n+37256011298,John,Doe,Acme Corp\n+37256011299,Jane,Smith,Tech Inc';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast.error("No contacts to upload");
      return;
    }

    setIsUploading(true);
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setUploadProgress(i);
    }
    
    setIsUploading(false);
    toast.success(`Successfully uploaded ${parsedData.length} contacts`);
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setUploadProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetState();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Bulk Upload Contacts - {agentName}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with contacts for this campaign. Required column: phone number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Download Template */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">CSV Template</p>
                <p className="text-sm text-muted-foreground">Download a sample template</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload CSV File</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">
                {file ? file.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV files only
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Parsed Data Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Preview ({parsedData.length} contacts)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 text-muted-foreground font-medium">Phone</th>
                      <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                      <th className="text-left p-2 text-muted-foreground font-medium">Company</th>
                      <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, index) => (
                      <tr key={index} className="border-t border-border/50">
                        <td className="p-2 font-mono text-foreground">{row.phone}</td>
                        <td className="p-2 text-foreground">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="p-2 text-muted-foreground">{row.company || '-'}</td>
                        <td className="p-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground bg-secondary/30">
                    + {parsedData.length - 10} more contacts
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading contacts...</span>
                <span className="text-foreground font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={parsedData.length === 0 || isUploading} 
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload {parsedData.length > 0 ? `${parsedData.length} Contacts` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

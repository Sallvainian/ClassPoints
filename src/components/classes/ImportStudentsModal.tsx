import { useState, useRef } from 'react';
import { Button, Modal } from '../ui';
import { parseStudents, generateDisplayNames } from '../../utils/studentParser';

interface ImportStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (names: string[]) => void;
}

export function ImportStudentsModal({ isOpen, onClose, onImport }: ImportStudentsModalProps) {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = (text: string, name?: string) => {
    const result = parseStudents(text, name);
    setContent(text);
    setFilename(name || null);
    // Convert raw names to display names (first name, with disambiguation for duplicates)
    setPreview(generateDisplayNames(result.names));
    setErrors(result.errors);
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleParse(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleParse(e.target.value);
  };

  const handleImport = () => {
    if (preview.length > 0) {
      onImport(preview);
      handleClose();
    }
  };

  const handleClose = () => {
    setContent('');
    setFilename(null);
    setPreview([]);
    setErrors([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Students">
      <div className="space-y-4">
        {/* File drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.txt"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="text-gray-600">
            <p className="font-medium">Drop a file here or click to browse</p>
            <p className="text-sm text-gray-500 mt-1">Supports JSON and CSV files</p>
          </div>
          {filename && (
            <p className="text-sm text-blue-600 mt-2">Selected: {filename}</p>
          )}
        </div>

        {/* Format guide */}
        <details className="text-sm border border-blue-100 rounded-lg bg-blue-50/50">
          <summary className="px-3 py-2 cursor-pointer text-blue-700 font-medium hover:bg-blue-50">
            Supported formats
          </summary>
          <div className="px-3 pb-3 text-gray-600 space-y-2">
            <div>
              <span className="font-medium text-gray-700">Plain text</span> - one name per line:
              <pre className="mt-1 bg-white rounded px-2 py-1 text-xs border">Alice Johnson{'\n'}Bob Smith{'\n'}Carol Davis</pre>
            </div>
            <div>
              <span className="font-medium text-gray-700">JSON array</span> - simple list:
              <pre className="mt-1 bg-white rounded px-2 py-1 text-xs border">["Alice Johnson", "Bob Smith", "Carol Davis"]</pre>
            </div>
            <div>
              <span className="font-medium text-gray-700">JSON objects</span> - with name field:
              <pre className="mt-1 bg-white rounded px-2 py-1 text-xs border">[{`{"name": "Alice"}`}, {`{"name": "Bob"}`}]</pre>
            </div>
            <div>
              <span className="font-medium text-gray-700">CSV</span> - comma-separated:
              <pre className="mt-1 bg-white rounded px-2 py-1 text-xs border">name,email,grade{'\n'}Alice,alice@school.edu,5th{'\n'}Bob,bob@school.edu,5th</pre>
            </div>
          </div>
        </details>

        {/* Or paste content */}
        <div className="relative">
          <div className="absolute inset-x-0 top-0 flex justify-center -translate-y-1/2">
            <span className="bg-white px-2 text-xs text-gray-500">or paste content</span>
          </div>
          <textarea
            value={content}
            onChange={handleTextChange}
            placeholder="Paste student names here..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="border rounded-md p-3 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Preview ({preview.length} students)
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto">
              <ul className="text-sm text-gray-600 space-y-1">
                {preview.slice(0, 10).map((name, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 text-gray-400 text-right">{i + 1}.</span>
                    <span>{name}</span>
                  </li>
                ))}
                {preview.length > 10 && (
                  <li className="text-gray-400 pl-7">
                    ... and {preview.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="border border-amber-200 rounded-md p-3 bg-amber-50">
            <span className="text-sm font-medium text-amber-700">Warnings:</span>
            <ul className="text-sm text-amber-600 mt-1">
              {errors.slice(0, 5).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
              {errors.length > 5 && (
                <li className="text-amber-500">... and {errors.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={preview.length === 0}>
            Import {preview.length > 0 ? `${preview.length} Students` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

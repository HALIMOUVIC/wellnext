import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<Quill | null>(null);

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (editorRef.current && !quillInstance.current) {
      quillInstance.current = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['clean']
          ],
        }
      });

      quillInstance.current.on('text-change', () => {
        onChangeRef.current(quillInstance.current?.root.innerHTML || '');
      });
      
      // Set initial content
      if (value) {
        quillInstance.current.clipboard.dangerouslyPasteHTML(value);
      }
    }
  }, []);

  // Update content if value changes from outside
  useEffect(() => {
    if (quillInstance.current && value !== quillInstance.current.root.innerHTML) {
      const cursorPosition = quillInstance.current.getSelection()?.index;
      quillInstance.current.clipboard.dangerouslyPasteHTML(value);
      if (typeof cursorPosition === 'number') {
        quillInstance.current.setSelection(cursorPosition, 0);
      }
    }
  }, [value]);

  return <div ref={editorRef} />;
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { isEqual } from 'lodash';
import * as fuzz from 'fuzzball';
import { 
  Wrench, Search, Globe, Scissors, Scale, Eye, 
  Upload, Folder, Trash2, Download, FileText, 
  CheckCircle, AlertCircle, ChevronRight, Menu,
  Settings, ListCheck, ArrowLeft, Play, Undo2, Filter, Type, X,
  Bold, Italic, Underline, RefreshCw, AArrowUp, AArrowDown,
  Highlighter, ArrowLeftRight
} from 'lucide-react';
import { ProcessedFile, TabId, LogEntry, HierarchySkip } from './types';
import { EMBEDDED_SOURCES } from './embeddedSources';

const NavButton = ({ id, icon: Icon, label, onClick }: { id: TabId, icon: any, label: string, onClick: (id: TabId) => void }) => (
  <button
    onClick={() => onClick(id)}
    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-right text-slate-600 hover:bg-blue-50 hover:text-blue-600"
  >
    <Icon size={18} />
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

const Modal = ({ isOpen, onClose, title, icon: Icon, children }: { isOpen: boolean, onClose: () => void, title: string, icon: any, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Icon size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [loadedFiles, setLoadedFiles] = useState<ProcessedFile[]>([]);
  const [history, setHistory] = useState<ProcessedFile[][]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('preview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [previewIdx, setPreviewIdx] = useState(0);

  // Highlighting States
  const [sources, setSources] = useState<string[]>(Object.keys(EMBEDDED_SOURCES));
  const [selectedSource, setSelectedSource] = useState<string>(Object.keys(EMBEDDED_SOURCES)[0] || '');
  const [sourceContent, setSourceContent] = useState<string>(EMBEDDED_SOURCES[Object.keys(EMBEDDED_SOURCES)[0]] || '');
  const [localSource, setLocalSource] = useState<string>('');

  const activeSourceContent = localSource || sourceContent;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/sources')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setSources(prev => Array.from(new Set([...prev, ...data])));
        }
      })
      .catch(err => console.log('Standalone mode'));
  }, []);

  useEffect(() => {
    if (selectedSource && !localSource) {
      if (EMBEDDED_SOURCES[selectedSource]) {
        setSourceContent(EMBEDDED_SOURCES[selectedSource]);
      } else {
        fetch(`/api/sources/${selectedSource}`)
          .then(res => res.text())
          .then(data => setSourceContent(data))
          .catch(err => console.error('Error fetching source:', err));
      }
    }
  }, [selectedSource, localSource]);

  const currentFileContent = loadedFiles[previewIdx]?.content;

  const pushToHistory = useCallback(() => {
    setHistory(prev => {
      if (prev.length > 0 && isEqual(prev[0], loadedFiles)) {
        return prev;
      }
      return [loadedFiles, ...prev].slice(0, 20);
    });
  }, [loadedFiles]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev].slice(0, 50));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    pushToHistory();
    const newFiles: ProcessedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const content = await f.text();
      const cleanFileName = f.name.replace(/\.[^/.]+$/, "");
      newFiles.push({ 
        name: cleanFileName, 
        content: content,
        originalName: f.name
      });
    }
    setLoadedFiles(prev => [...prev, ...newFiles]);
    addLog(`נטענו ${files.length} קבצים`, 'success');
  };

  const handleContentChange = (newContent: string) => {
    const nextFiles = [...loadedFiles];
    if (nextFiles[previewIdx]) {
      nextFiles[previewIdx] = { ...nextFiles[previewIdx], content: newContent };
      setLoadedFiles(nextFiles);
    }
  };

  const handleNameChange = (newName: string) => {
    const nextFiles = [...loadedFiles];
    if (nextFiles[previewIdx]) {
      nextFiles[previewIdx] = { ...nextFiles[previewIdx], name: newName };
      setLoadedFiles(nextFiles);
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = history[0];
    setHistory(history.slice(1));
    setLoadedFiles(previousState);
    addLog("פעולה אחרונה בוטלה", 'info');
  };

  const insertTag = (openTag: string, closeTag: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    pushToHistory();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = `${openTag}${selectedText}${closeTag}`;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    handleContentChange(newContent);
  };

  const normalize = (text: string) => text.replace(/[.,:;?!\-()]/g, ' ').replace(/\s+/g, ' ').trim();

  const processWithRegex = () => {
    pushToHistory();
    const nextFiles = loadedFiles.map(f => {
      const paragraphs = f.content.split('\n');
      const newContent = paragraphs.map(p => {
        if (!p.trim()) return '';
        const match = p.match(/^([^.:-]*[.:-])/);
        if (match) {
          const dhm = match[1];
          const rest = p.substring(dhm.length);
          return `<b>${dhm}</b>${rest}`;
        }
        return p;
      }).join('\n');
      return { ...f, content: newContent };
    });
    setLoadedFiles(nextFiles);
    addLog("הדגשה באמצעות תוי סיום הושלמה", 'success');
    setIsModalOpen(false);
  };

  const processWithFuzzy = () => {
    if (!activeSourceContent) {
      addLog("יש לבחור מקור להשוואה", 'error');
      return;
    }
    pushToHistory();

    // 1. Pre-process source into sections based on headers
    const sourceSections: { header: string, words: string[] }[] = [];
    const headerRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
    
    // Initial section (before any header)
    let firstMatch = headerRegex.exec(activeSourceContent);
    headerRegex.lastIndex = 0; 
    
    const initialContent = firstMatch 
      ? activeSourceContent.substring(0, firstMatch.index)
      : activeSourceContent;
    
    sourceSections.push({ 
      header: "_initial_", 
      words: normalize(initialContent.replace(/<[^>]*>/g, '')).split(' ') 
    });

    let match;
    while ((match = headerRegex.exec(activeSourceContent)) !== null) {
      const headerText = normalize(match[1].replace(/<[^>]*>/g, ''));
      const start = headerRegex.lastIndex;
      
      // Peek for next header to define section end
      const currentPos = headerRegex.lastIndex;
      const nextMatch = headerRegex.exec(activeSourceContent);
      const end = nextMatch ? nextMatch.index : activeSourceContent.length;
      headerRegex.lastIndex = currentPos; // Reset regex state after peeking
      
      const sectionContent = activeSourceContent.substring(start, end);
      sourceSections.push({
        header: headerText,
        words: normalize(sectionContent.replace(/<[^>]*>/g, '')).split(' ')
      });
    }

    const nextFiles = loadedFiles.map(f => {
      const paragraphs = f.content.split('\n');
      let currentSourceWords = sourceSections[0].words;
      
      const newContent = paragraphs.map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';

        // Check if this paragraph is a header in the commentary
        const headerMatch = trimmed.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
        if (headerMatch) {
          const commentaryHeaderText = normalize(headerMatch[1].replace(/<[^>]*>/g, ''));
          // Find matching header in source (ignoring H-level)
          const matchingSection = sourceSections.find(s => s.header === commentaryHeaderText);
          if (matchingSection) {
            currentSourceWords = matchingSection.words;
          }
          return p; 
        }

        // Standard paragraph processing - strip tags for matching
        const cleanP = trimmed.replace(/<[^>]*>/g, '');
        const words = cleanP.split(/\s+/);
        const testLength = Math.min(words.length, 15);
        let bestMatchEndIndex = 0;
        
        for (let i = 1; i <= testLength; i++) {
          const prefix = normalize(words.slice(0, i).join(' '));
          let maxPrefixScore = 0;
          
          // Search ONLY in the current source section
          for (let j = 0; j <= currentSourceWords.length - i; j++) {
            const window = currentSourceWords.slice(j, j + i).join(' ');
            const score = fuzz.ratio(prefix, window);
            if (score > maxPrefixScore) maxPrefixScore = score;
            if (maxPrefixScore === 100) break; 
          }
          
          if (maxPrefixScore > 85) {
            bestMatchEndIndex = i;
          } else if (i > 3 && maxPrefixScore < 70) {
            break;
          }
        }
        
        if (bestMatchEndIndex > 0) {
          const dhmWords = words.slice(0, bestMatchEndIndex).join(' ');
          const dhmEndPos = p.indexOf(dhmWords) + dhmWords.length;
          let finalEndPos = dhmEndPos;
          if (p[dhmEndPos] && /[.:\-]/.test(p[dhmEndPos])) finalEndPos++;
          const dhm = p.substring(0, finalEndPos);
          const rest = p.substring(finalEndPos);
          return `<b>${dhm}</b>${rest}`;
        }
        return p;
      }).join('\n');
      return { ...f, content: newContent };
    });

    setLoadedFiles(nextFiles);
    addLog("הדגשה חכמה (מותאמת כותרות) הושלמה", 'success');
    setIsModalOpen(false);
  };

  const downloadAll = async () => {
    if (loadedFiles.length === 0) return;
    const zip = new JSZip();
    loadedFiles.forEach(f => zip.file(`${f.name}.txt`, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Output_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewHeaders = React.useMemo(() => {
    if (!currentFileContent) return [];
    const headers: { tagName: string; textContent: string; startIndex: number; length: number }[] = [];
    const regex = /<(h[1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    let match;
    while ((match = regex.exec(currentFileContent)) !== null) {
      headers.push({
        tagName: match[1].toUpperCase(),
        textContent: match[2].replace(/<[^>]*>/g, ''),
        startIndex: match.index,
        length: match[0].length
      });
    }
    return headers;
  }, [currentFileContent]);

  const scrollToHeader = useCallback((startIndex: number, length: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(startIndex, startIndex + length);

    setTimeout(() => {
      textarea.setSelectionRange(startIndex, startIndex);
      textarea.blur();
      textarea.focus();
    }, 0);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" dir="rtl">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <input 
        ref={folderInputRef} 
        type="file" 
        {...({ webkitdirectory: "", directory: "" } as any)} 
        multiple 
        className="hidden" 
        onChange={(e) => handleFiles(e.target.files)} 
      />

      <aside className={`bg-white border-l border-slate-200 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg text-white">
            <Highlighter size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">מעבד טקסט תורני</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavButton 
            id="highlight_regex" 
            icon={Highlighter} 
            label="הדגשה באמצעות תוי סיום" 
            onClick={() => { setActiveTab('highlight_regex'); setIsModalOpen(true); }} 
          />
          <NavButton 
            id="highlight_fuzzy" 
            icon={ArrowLeftRight} 
            label="הדגשה באמצעות השוואה" 
            onClick={() => { setActiveTab('highlight_fuzzy'); setIsModalOpen(true); }} 
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="text-xs text-slate-400 text-center">v4.0 - Highlighting Edition</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
              <FileText size={14} />
              <span>{loadedFiles.length} קבצים</span>
            </div>
          </div>
          
          <div className="flex gap-2">
             <button 
                onClick={undo}
                disabled={history.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-bold border text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-30"
              >
                <Undo2 size={16} />
                בטל
              </button>
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors text-sm font-bold"
              >
                <FileText size={16} />
                טען קבצים
              </button>
              <button 
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors text-sm font-bold"
              >
                <Folder size={16} />
                טען תיקייה
              </button>
             <button 
                onClick={() => {
                  if (loadedFiles.length === 0) return;
                  pushToHistory();
                  setLoadedFiles([]);
                  addLog("כל הקבצים נוקו", "info");
                }}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-bold mr-2"
              >
                <Trash2 size={16} />
                נקה הכל
              </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-8 pb-32 flex flex-col">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Eye className="text-blue-500" /> עורך טקסט
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-xs font-bold text-slate-500">שם קובץ:</span>
                  <input 
                    type="text"
                    value={loadedFiles[previewIdx]?.name || ''}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 w-48"
                  />
                </div>
                <select 
                  value={previewIdx} 
                  onChange={e => setPreviewIdx(Number(e.target.value))}
                  className="p-3 border border-slate-200 rounded-xl text-sm min-w-[200px] outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {loadedFiles.length === 0 ? (
                    <option>אין קבצים טעונים</option>
                  ) : (
                    loadedFiles.map((f, i) => <option key={i} value={i}>{f.name}</option>)
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
              <aside className="w-64 border border-slate-200 rounded-xl bg-slate-50 overflow-y-auto p-4 flex flex-col gap-1 shrink-0">
                <div className="text-xs font-bold text-slate-400 mb-2 border-b border-slate-200 pb-2">ניווט כותרות</div>
                {previewHeaders.length > 0 ? previewHeaders.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToHeader(h.startIndex, h.length)}
                    className={`text-right text-[11px] p-1.5 border-r-2 transition-colors hover:bg-white flex flex-col items-start w-full ${
                      h.tagName === 'H1' ? 'font-bold border-blue-500 bg-blue-50/50' : 'border-slate-200'
                    }`}
                  >
                    <span className="opacity-50 text-[9px] block mb-0.5">{h.tagName}</span>
                    <span className="line-clamp-2">{h.textContent}</span>
                  </button>
                )) : <div className="text-xs text-slate-400 italic">לא נמצאו כותרות</div>}
              </aside>

              <div className="flex-1 flex flex-col min-h-0 h-full gap-4">
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
                  <div className="flex items-center gap-1 px-2 border-l border-slate-200 ml-2">
                    {['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map(h => (
                      <button
                        key={h}
                        onClick={() => insertTag(`<${h.toLowerCase()}>`, `</${h.toLowerCase()}>`)}
                        className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 px-2 border-l border-slate-200 ml-2">
                    <button onClick={() => insertTag('<b>', '</b>')} className="p-1.5 bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors" title="מודגש">
                      <Bold size={14} />
                    </button>
                    <button onClick={() => insertTag('<i>', '</i>')} className="p-1.5 bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors" title="נטוי">
                      <Italic size={14} />
                    </button>
                    <button onClick={() => insertTag('<u>', '</u>')} className="p-1.5 bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors" title="קו תחתון">
                      <Underline size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative min-h-0">
                  <textarea
                    ref={textareaRef}
                    value={loadedFiles[previewIdx]?.content || ''}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="w-full h-full bg-white p-8 rounded-2xl border border-slate-200 font-sans text-lg leading-[1.6] text-slate-800 outline-none focus:ring-2 focus:ring-blue-400 resize-none overflow-auto shadow-inner"
                    dir="rtl"
                    placeholder="אין תוכן להצגה או עריכה"
                  />
                </div>
              </div>
            </div>
          </div>

          <Modal 
            isOpen={isModalOpen && activeTab === 'highlight_regex'} 
            onClose={() => setIsModalOpen(false)} 
            title="הדגשה באמצעות תוי סיום" 
            icon={Highlighter}
          >
            <div className="space-y-6">
              <p className="text-slate-600">פעולה זו תסרוק את כל הקבצים הטעונים ותדגיש (תגית b) את תחילת הפסקה עד לתו הסיום הראשון (נקודה, נקודתיים או מקף).</p>
              <button 
                onClick={processWithRegex} 
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
              >
                בצע הדגשה
              </button>
            </div>
          </Modal>

          <Modal 
            isOpen={isModalOpen && activeTab === 'highlight_fuzzy'} 
            onClose={() => setIsModalOpen(false)} 
            title="הדגשה באמצעות השוואה" 
            icon={ArrowLeftRight}
          >
            <div className="space-y-6">
              <p className="text-slate-600">פעולה זו תסרוק את כל הקבצים הטעונים ותדגיש את תחילת הפסקה על ידי השוואה למקור נבחר.</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">בחר מקור להשוואה:</label>
                  <label className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded cursor-pointer hover:bg-blue-100 transition-colors">
                    העלה קובץ מקור (TXT)
                    <input type="file" accept=".txt" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setLocalSource(event.target?.result as string);
                          setSelectedSource(file.name);
                        };
                        reader.readAsText(file);
                      }
                    }} className="hidden" />
                  </label>
                </div>
                <select
                  value={selectedSource}
                  onChange={(e) => {
                    setSelectedSource(e.target.value);
                    setLocalSource('');
                  }}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sources.map(s => <option key={s} value={s}>{s}</option>)}
                  {localSource && <option value={selectedSource}>{selectedSource} (מקומי)</option>}
                </select>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-32 overflow-y-auto text-xs opacity-60 italic">
                  {activeSourceContent || 'בחר מקור כדי לראות תצוגה מקדימה...'}
                </div>
              </div>

              <button 
                onClick={processWithFuzzy} 
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
              >
                בצע הדגשה באמצעות השוואה
              </button>
            </div>
          </Modal>
        </div>

        <footer className="bg-white border-t border-slate-200 px-8 py-6 flex items-center gap-8 fixed bottom-0 left-0 right-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]" style={{ right: isSidebarOpen ? '288px' : '0' }}>
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 h-20 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-slate-400 text-xs mt-2 italic">ממתין לפעולות...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`text-xs mb-1 flex items-center gap-2 ${
                  log.type === 'success' ? 'text-green-600' : 
                  log.type === 'error' ? 'text-red-600' : 'text-slate-500'
                }`}>
                  <span className="font-mono text-[10px] opacity-60">[{log.timestamp}]</span>
                  <span className="font-medium">{log.message}</span>
                </div>
              ))
            )}
          </div>
          
          <button 
            disabled={loadedFiles.length === 0}
            onClick={downloadAll}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white transition-all shadow-xl shadow-blue-200 ${
              loadedFiles.length === 0 ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'
            }`}
          >
            <Download size={22} />
            הורד הכל ב-ZIP
          </button>
        </footer>
      </main>
    </div>
  );
};

export default App;

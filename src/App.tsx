/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, FileText, Settings, Play, Check, AlertCircle, ChevronRight, BookOpen } from 'lucide-react';
import * as fuzz from 'fuzzball';
import { EMBEDDED_SOURCES } from './embeddedSources';

interface SourceFile {
  name: string;
  content: string;
}

export default function App() {
  const [commentary, setCommentary] = useState('');
  const [sources, setSources] = useState<string[]>(Object.keys(EMBEDDED_SOURCES));
  const [selectedSource, setSelectedSource] = useState<string>(Object.keys(EMBEDDED_SOURCES)[0] || '');
  const [sourceContent, setSourceContent] = useState<string>(EMBEDDED_SOURCES[Object.keys(EMBEDDED_SOURCES)[0]] || '');
  const [localSource, setLocalSource] = useState<string>('');
  const [mode, setMode] = useState<'regex' | 'fuzzy'>('regex');
  const [processedText, setProcessedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const activeSourceContent = localSource || sourceContent;

  useEffect(() => {
    fetch('/api/sources')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          // Merge server sources with embedded ones, avoiding duplicates
          setSources(prev => Array.from(new Set([...prev, ...data])));
        }
      })
      .catch(err => console.log('Running in standalone mode or server unavailable'));
  }, []);

  useEffect(() => {
    if (selectedSource && !localSource) {
      // Check if it's an embedded source first
      if (EMBEDDED_SOURCES[selectedSource]) {
        setSourceContent(EMBEDDED_SOURCES[selectedSource]);
      } else {
        fetch(`/api/sources/${selectedSource}`)
          .then(res => res.text())
          .then(data => setSourceContent(data))
          .catch(err => console.error('Error fetching source content:', err));
      }
    }
  }, [selectedSource, localSource]);

  const handleLocalSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLocalSource(event.target?.result as string);
        setSelectedSource(file.name);
      };
      reader.readAsText(file);
    }
  };

  const normalize = (text: string) => {
    return text.replace(/[.,:;?!\-()]/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const processWithRegex = (text: string) => {
    const paragraphs = text.split('\n');
    return paragraphs.map(p => {
      if (!p.trim()) return '';
      // Match up to the first . : or - at the beginning of the paragraph
      const match = p.match(/^([^.:-]*[.:-])/);
      if (match) {
        const dhm = match[1];
        const rest = p.substring(dhm.length);
        return `<b>${dhm}</b>${rest}`;
      }
      return p;
    }).join('\n');
  };

  const processWithFuzzy = (text: string, source: string) => {
    if (!source) return text;
    const paragraphs = text.split('\n');
    const normalizedSource = normalize(source);
    const sourceWords = normalizedSource.split(' ');

    return paragraphs.map(p => {
      if (!p.trim()) return '';
      
      const words = p.trim().split(/\s+/);
      const testLength = Math.min(words.length, 15);
      let bestMatchEndIndex = 0;
      let bestScore = 0;

      // We try to find how many words from the start of the paragraph form a "Dibbur HaMatchil"
      // that exists in the source.
      // We'll check prefixes of the paragraph (1 word, 2 words, ..., 15 words)
      for (let i = 1; i <= testLength; i++) {
        const prefix = normalize(words.slice(0, i).join(' '));
        
        // Use sliding window on source to find if this prefix exists
        let maxPrefixScore = 0;
        for (let j = 0; j <= sourceWords.length - i; j++) {
          const window = sourceWords.slice(j, j + i).join(' ');
          const score = fuzz.ratio(prefix, window);
          if (score > maxPrefixScore) maxPrefixScore = score;
        }

        // If the score is high enough, this might be our DHM
        if (maxPrefixScore > 85) {
          bestMatchEndIndex = i;
          bestScore = maxPrefixScore;
        } else if (i > 3 && maxPrefixScore < 70) {
          // If similarity drops significantly, we stop
          break;
        }
      }

      if (bestMatchEndIndex > 0) {
        const dhmWords = words.slice(0, bestMatchEndIndex).join(' ');
        // Find the actual end in the original string to preserve punctuation
        const dhmEndPos = p.indexOf(dhmWords) + dhmWords.length;
        // Check if there's a punctuation immediately after that we should include
        let finalEndPos = dhmEndPos;
        if (p[dhmEndPos] && /[.:\-]/.test(p[dhmEndPos])) {
          finalEndPos++;
        }
        
        const dhm = p.substring(0, finalEndPos);
        const rest = p.substring(finalEndPos);
        return `<b>${dhm}</b>${rest}`;
      }
      
      return p;
    }).join('\n');
  };

  const handleProcess = () => {
    setIsProcessing(true);
    // Small delay to show loading state
    setTimeout(() => {
      let result = '';
      if (mode === 'regex') {
        result = processWithRegex(commentary);
      } else {
        result = processWithFuzzy(commentary, activeSourceContent);
      }
      setProcessedText(result);
      setIsProcessing(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-serif p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-12 border-b border-[#5A5A40]/20 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-light tracking-tight text-[#5A5A40] mb-2">Commentary Processor</h1>
            <p className="text-sm italic opacity-70">Identify and highlight 'Dibbur HaMatchil' in your texts</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-white rounded-full p-1 shadow-sm border border-[#5A5A40]/10">
              <button 
                onClick={() => setMode('regex')}
                className={`px-4 py-1.5 rounded-full text-xs transition-all ${mode === 'regex' ? 'bg-[#5A5A40] text-white shadow-inner' : 'hover:bg-[#5A5A40]/5'}`}
              >
                Regex Mode
              </button>
              <button 
                onClick={() => setMode('fuzzy')}
                className={`px-4 py-1.5 rounded-full text-xs transition-all ${mode === 'fuzzy' ? 'bg-[#5A5A40] text-white shadow-inner' : 'hover:bg-[#5A5A40]/5'}`}
              >
                Fuzzy Mode
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#5A5A40]/5">
              <div className="flex items-center gap-2 mb-4 text-[#5A5A40]">
                <FileText size={18} />
                <h2 className="text-sm font-semibold uppercase tracking-wider">Commentary Input</h2>
              </div>
              <textarea
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder="Paste your commentary text here...&#10;Example: בראשית ברא. פירש רש''י..."
                className="w-full h-64 p-4 bg-[#F9F9F7] rounded-2xl border border-[#5A5A40]/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 resize-none font-sans text-sm leading-relaxed"
              />
            </div>

            {mode === 'fuzzy' && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#5A5A40]/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-4 text-[#5A5A40]">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} />
                    <h2 className="text-sm font-semibold uppercase tracking-wider">Source Reference</h2>
                  </div>
                  <label className="text-[10px] bg-[#5A5A40]/10 px-2 py-1 rounded cursor-pointer hover:bg-[#5A5A40]/20 transition-colors">
                    Upload TXT
                    <input type="file" accept=".txt" onChange={handleLocalSourceUpload} className="hidden" />
                  </label>
                </div>
                <select
                  value={selectedSource}
                  onChange={(e) => {
                    setSelectedSource(e.target.value);
                    setLocalSource(''); // Clear local source if switching to server source
                  }}
                  className="w-full p-3 bg-[#F9F9F7] rounded-xl border border-[#5A5A40]/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-sans text-sm"
                >
                  {sources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {localSource && <option value={selectedSource}>{selectedSource} (Local)</option>}
                </select>
                <div className="mt-4 p-3 bg-[#F9F9F7] rounded-xl border border-[#5A5A40]/5 max-h-32 overflow-y-auto text-xs opacity-60 font-sans italic">
                  {activeSourceContent || 'Select a source to see preview...'}
                </div>
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={!commentary || isProcessing}
              className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl shadow-lg shadow-[#5A5A40]/20 hover:bg-[#4A4A30] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Play size={18} className="group-hover:translate-x-0.5 transition-transform" />
                  <span>Process Text</span>
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#5A5A40]/5 min-h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-4 text-[#5A5A40]">
                <div className="flex items-center gap-2">
                  <Check size={18} />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">Processed Result</h2>
                </div>
                {processedText && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(processedText.replace(/<[^>]*>/g, ''));
                    }}
                    className="text-xs hover:underline opacity-60"
                  >
                    Copy Plain Text
                  </button>
                )}
              </div>
              
              <div className="flex-1 bg-[#F9F9F7] rounded-2xl border border-[#5A5A40]/10 p-6 overflow-y-auto">
                {processedText ? (
                  <div 
                    className="whitespace-pre-wrap leading-relaxed text-lg"
                    dangerouslySetInnerHTML={{ __html: processedText }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <Search size={48} className="mb-4" />
                    <p className="italic">Processed text will appear here...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Help/Info */}
            <div className="bg-[#5A5A40]/5 rounded-3xl p-6 border border-[#5A5A40]/10">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-[#5A5A40] mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed opacity-70">
                  <p className="font-bold mb-1">How it works:</p>
                  {mode === 'regex' ? (
                    <p>Regex mode identifies the quote by looking for punctuation (., :, -) at the start of each paragraph. Best for structured commentaries.</p>
                  ) : (
                    <p>Fuzzy mode compares the first 15 words of each paragraph against the selected source text using Levenshtein distance. Best for identifying quotes without clear punctuation markers.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

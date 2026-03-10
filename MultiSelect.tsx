import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  id: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function MultiSelect({ options, selected, onChange, placeholder = "Select strategies...", label }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.id.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (id: string) => {
    const newSelected = selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id];
    onChange(newSelected);
  };

  const removeOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(s => s !== id));
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full min-h-[46px] bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-sm cursor-pointer hover:bg-white/10 transition-all flex flex-wrap gap-2 items-center pr-10"
        >
          {selected.length === 0 ? (
            <span className="text-slate-500">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence mode="popLayout">
                {selected.map(id => {
                  const opt = options.find(o => o.id === id);
                  return (
                    <motion.span 
                      key={id} 
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="bg-indigo-500/10 text-indigo-300 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/20 transition-all group"
                    >
                      {opt?.label || id}
                      <X 
                        size={12} 
                        className="text-indigo-500 group-hover:text-indigo-300 cursor-pointer transition-colors" 
                        onClick={(e) => removeOption(id, e)}
                      />
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
          <ChevronDown 
            size={16} 
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute z-[100] left-0 right-0 mt-2 bg-card-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
            >
              <div className="p-3 border-b border-white/5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search strategies..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500/50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                {filteredOptions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic">No strategies found</div>
                ) : (
                  filteredOptions.map(opt => (
                    <div 
                      key={opt.id}
                      onClick={() => toggleOption(opt.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        selected.includes(opt.id) ? 'bg-indigo-500/10 text-white' : 'hover:bg-white/5 text-slate-400'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Strategy {opt.id}</span>
                      </div>
                      {selected.includes(opt.id) && <Check size={14} className="text-indigo-400" />}
                    </div>
                  ))
                )}
              </div>
              {selected.length > 0 && (
                <div className="p-2 border-t border-white/5 bg-white/5 flex justify-between">
                  <button 
                    onClick={() => onChange([])}
                    className="text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={() => onChange(options.map(o => o.id))}
                    className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 px-2 py-1"
                  >
                    Select All
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

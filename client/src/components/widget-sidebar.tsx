import { useState, useMemo } from 'react';
import { X, Search, Tv, Grid2X2, LayoutGrid, Grip, Newspaper, Rocket, Music, TrendingUp, Layers, Layout } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export interface TrendingChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'music' | 'finance';
  category: string;
}

export interface LayoutBlock {
  id: string;
  name: string;
  cols: number;
  rows: number;
  spanCols: number;
  spanRows: number;
  icon: 'small' | 'medium' | 'large';
}

const TRENDING_CHANNELS: TrendingChannel[] = [
  { id: 'sky-news', name: 'Sky News', url: 'https://www.youtube.com/embed/9Auq9mYxFEE?autoplay=1&mute=1', iconType: 'news', category: 'News' },
  { id: 'abc-news', name: 'ABC News', url: 'https://www.youtube.com/embed/vOTiJkg1voo?autoplay=1&mute=1', iconType: 'news', category: 'News' },
  { id: 'cnn', name: 'CNN', url: 'https://www.youtube.com/embed/KOY4Ka-GBus?autoplay=1&mute=1', iconType: 'news', category: 'News' },
  { id: 'bbc-news', name: 'BBC News', url: 'https://www.youtube.com/embed/dp8PhLsUcFE?autoplay=1&mute=1', iconType: 'news', category: 'News' },
  { id: 'al-jazeera', name: 'Al Jazeera', url: 'https://www.youtube.com/embed/F-POY4Q0QSI?autoplay=1&mute=1', iconType: 'news', category: 'News' },
  { id: 'france24', name: 'France 24', url: 'https://www.youtube.com/embed/LrXSfA4SoFE?autoplay=1&mute=1', iconType: 'news', category: 'News' },
  { id: 'dw-news', name: 'DW News', url: 'https://www.youtube.com/embed/V6YMvlmxvG8?autoplay=1&mute=1', iconType: 'news', category: 'News' },
  { id: 'nasa-live', name: 'NASA Live', url: 'https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1&mute=1', iconType: 'science', category: 'Science' },
  { id: 'lofi-radio', name: 'Lofi Radio', url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1', iconType: 'music', category: 'Music' },
  { id: 'bloomberg', name: 'Bloomberg', url: 'https://www.youtube.com/embed/Ga3maNZ0x0w?autoplay=1&mute=1', iconType: 'finance', category: 'Finance' },
];

export const LAYOUT_BLOCKS: LayoutBlock[] = [
  { id: 'block-1x1', name: 'Single (1x1)', cols: 1, rows: 1, spanCols: 1, spanRows: 1, icon: 'small' },
  { id: 'block-2x1', name: 'Wide (2x1)', cols: 2, rows: 1, spanCols: 2, spanRows: 1, icon: 'medium' },
  { id: 'block-2x2', name: 'Large (2x2)', cols: 2, rows: 2, spanCols: 2, spanRows: 2, icon: 'large' },
];

type SidebarTab = 'content' | 'layout';

interface DraggableChannelProps {
  channel: TrendingChannel;
}

function getChannelIcon(iconType: TrendingChannel['iconType']) {
  switch (iconType) {
    case 'news':
      return <Newspaper className="w-[1.6rem] h-[1.6rem] text-cyan-400" />;
    case 'science':
      return <Rocket className="w-[1.6rem] h-[1.6rem] text-purple-400" />;
    case 'music':
      return <Music className="w-[1.6rem] h-[1.6rem] text-pink-400" />;
    case 'finance':
      return <TrendingUp className="w-[1.6rem] h-[1.6rem] text-emerald-400" />;
    default:
      return <Tv className="w-[1.6rem] h-[1.6rem] text-slate-400" />;
  }
}

function DraggableChannel({ channel }: DraggableChannelProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `channel-${channel.id}`,
    data: { type: 'channel', channel }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-[1rem] p-[1rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border border-slate-700/50 hover:border-cyan-500/50"
      data-testid={`draggable-channel-${channel.id}`}
    >
      <div className="w-[3.2rem] h-[3.2rem] rounded-lg bg-slate-700 flex items-center justify-center">
        {getChannelIcon(channel.iconType)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[1.2rem] font-semibold text-slate-200 truncate">{channel.name}</p>
        <p className="text-[1rem] text-slate-400">{channel.category}</p>
      </div>
      <Grip className="w-[1.6rem] h-[1.6rem] text-slate-500" />
    </div>
  );
}

interface DraggableBlockProps {
  block: LayoutBlock;
}

function DraggableBlock({ block }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { type: 'block', block }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const getBlockPreview = () => {
    const gridCells = [];
    for (let r = 0; r < block.rows; r++) {
      for (let c = 0; c < block.cols; c++) {
        gridCells.push(
          <div 
            key={`${r}-${c}`} 
            className="bg-gradient-to-br from-cyan-500/40 to-purple-500/40 border border-cyan-400/50"
            style={{ borderRadius: '0.3rem' }}
          />
        );
      }
    }
    return (
      <div 
        className="grid gap-[0.3rem]"
        style={{ 
          gridTemplateColumns: `repeat(${block.cols}, 1fr)`,
          gridTemplateRows: `repeat(${block.rows}, 1fr)`,
          width: `${block.cols * 2}rem`,
          height: `${block.rows * 2}rem`
        }}
      >
        {gridCells}
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col items-center gap-[0.8rem] p-[1.2rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border border-slate-700/50 hover:border-purple-500/50"
      data-testid={`draggable-block-${block.id}`}
    >
      {getBlockPreview()}
      <span className="text-[1.1rem] font-medium text-slate-300">{block.name}</span>
      <span className="text-[0.9rem] text-slate-500">span {block.spanCols}x{block.spanRows}</span>
    </div>
  );
}

interface WidgetSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelClick?: (channel: TrendingChannel) => void;
}

export function WidgetSidebar({ isOpen, onClose, onChannelClick }: WidgetSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('content');

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return TRENDING_CHANNELS;
    const query = searchQuery.toLowerCase();
    return TRENDING_CHANNELS.filter(
      channel => 
        channel.name.toLowerCase().includes(query) ||
        channel.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        data-testid="sidebar-overlay"
      />
      
      <div
        className={`fixed top-0 left-0 h-full bg-slate-900 border-r border-slate-700 z-50 transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ 
          width: 'min(32rem, 100vw)',
          borderTopRightRadius: 'var(--outer-radius)',
          borderBottomRightRadius: 'var(--outer-radius)'
        }}
        data-testid="widget-sidebar"
      >
        <div className="p-[1.6rem] border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-[1.2rem]">
            <h2 className="text-[1.8rem] font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-[0.8rem]">
              <Tv className="w-[2rem] h-[2rem] text-cyan-400" />
              Widget Library
            </h2>
            <button
              onClick={onClose}
              className="p-[0.6rem] hover:bg-slate-800 slot-button transition-colors"
              data-testid="button-close-sidebar"
            >
              <X className="w-[1.8rem] h-[1.8rem] text-slate-400" />
            </button>
          </div>
          
          <div className="flex gap-[0.4rem] bg-slate-800 p-[0.4rem] rounded-lg">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 flex items-center justify-center gap-[0.6rem] py-[0.8rem] px-[1.2rem] rounded-md text-[1.2rem] font-medium transition-all duration-200 ${
                activeTab === 'content'
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              data-testid="tab-content"
            >
              <Layers className="w-[1.4rem] h-[1.4rem]" />
              Content
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex-1 flex items-center justify-center gap-[0.6rem] py-[0.8rem] px-[1.2rem] rounded-md text-[1.2rem] font-medium transition-all duration-200 ${
                activeTab === 'layout'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              data-testid="tab-layout"
            >
              <Layout className="w-[1.4rem] h-[1.4rem]" />
              Layout
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-[1.6rem]">
          {activeTab === 'content' && (
            <div className="space-y-[1.6rem]">
              <div className="relative">
                <Search className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels..."
                  className="w-full pl-[3.6rem] pr-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem]"
                  data-testid="input-search-channels"
                />
              </div>
              
              <div>
                <h3 className="text-[1.4rem] font-semibold text-cyan-400 mb-[1rem] flex items-center gap-[0.6rem]">
                  <Tv className="w-[1.6rem] h-[1.6rem]" />
                  Trending Channels
                </h3>
                <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                  Drag a channel to the grid or click to add
                </p>
                <div className="space-y-[0.8rem]">
                  {filteredChannels.map((channel) => (
                    <div key={channel.id} onClick={() => onChannelClick?.(channel)}>
                      <DraggableChannel channel={channel} />
                    </div>
                  ))}
                  {filteredChannels.length === 0 && (
                    <p className="text-[1.2rem] text-slate-500 text-center py-[2rem]">
                      No channels found
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'layout' && (
            <div className="space-y-[1.6rem]">
              <div>
                <h3 className="text-[1.4rem] font-semibold text-purple-400 mb-[1rem] flex items-center gap-[0.6rem]">
                  <LayoutGrid className="w-[1.6rem] h-[1.6rem]" />
                  Widget Sizes
                </h3>
                <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                  Drag to add spanning widgets
                </p>
                <div className="grid grid-cols-1 gap-[1rem]">
                  {LAYOUT_BLOCKS.map((block) => (
                    <DraggableBlock key={block.id} block={block} />
                  ))}
                </div>
              </div>
              
              <div className="bg-slate-800/50 p-[1.2rem] rounded-lg border border-slate-700/50">
                <h4 className="text-[1.2rem] font-semibold text-slate-300 mb-[0.8rem]">Spanning Guide</h4>
                <ul className="text-[1.1rem] text-slate-400 space-y-[0.4rem]">
                  <li className="flex items-center gap-[0.6rem]">
                    <div className="w-[0.8rem] h-[0.8rem] bg-cyan-400 rounded-sm"></div>
                    <span>1x1: Single slot</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <div className="w-[1.6rem] h-[0.8rem] bg-purple-400 rounded-sm"></div>
                    <span>2x1: Spans 2 columns</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <div className="w-[1.6rem] h-[1.6rem] bg-pink-400 rounded-sm"></div>
                    <span>2x2: Spans 2x2 grid area</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-[1.6rem] border-t border-slate-700 flex-shrink-0">
          <p className="text-[1rem] text-slate-500 text-center">
            {activeTab === 'content' 
              ? 'Drag channels to slots or click to add' 
              : 'Drag layout blocks to resize widgets'}
          </p>
        </div>
      </div>
    </>
  );
}

export { TRENDING_CHANNELS };

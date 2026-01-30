import { useState, useMemo, useRef } from 'react';
import { X, Search, Tv, LayoutGrid, Grip, Newspaper, Rocket, Music, TrendingUp, Layers, Layout, FileText, Square, Image as ImageIcon, Video, Upload } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { WidgetType } from '@/App';

export interface TrendingChannel {
  id: string;
  name: string;
  url: string;
  iconType: 'news' | 'science' | 'music' | 'finance';
  category: string;
}

export interface WidgetTemplate {
  id: string;
  name: string;
  widgetType: WidgetType;
  w: number;
  h: number;
  icon: 'video' | 'note' | 'spacer' | 'image';
  color: string;
}

const TRENDING_CHANNELS: TrendingChannel[] = [
  { id: 'nasa-live', name: 'NASA Live', url: 'https://www.youtube.com/embed/21X5lGlDOfg', iconType: 'science', category: 'Science' },
  { id: 'lofi-girl', name: 'Lofi Girl', url: 'https://www.youtube.com/embed/jfKfPfyJRdk', iconType: 'music', category: 'Music' },
  { id: 'sky-news', name: 'Sky News', url: 'https://www.youtube.com/embed/9Auqna63EFE', iconType: 'news', category: 'News' },
];

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  { id: 'template-video-3x2', name: 'Video (3x2)', widgetType: 'video', w: 3, h: 2, icon: 'video', color: 'cyan' },
  { id: 'template-video-6x3', name: 'Video (6x3)', widgetType: 'video', w: 6, h: 3, icon: 'video', color: 'cyan' },
  { id: 'template-note-3x2', name: 'Note (3x2)', widgetType: 'note', w: 3, h: 2, icon: 'note', color: 'yellow' },
  { id: 'template-note-4x1', name: 'Note (4x1)', widgetType: 'note', w: 4, h: 1, icon: 'note', color: 'yellow' },
  { id: 'template-spacer-2x1', name: 'Spacer (2x1)', widgetType: 'spacer', w: 2, h: 1, icon: 'spacer', color: 'slate' },
  { id: 'template-image-3x2', name: 'Image (3x2)', widgetType: 'image', w: 3, h: 2, icon: 'image', color: 'purple' },
  { id: 'template-image-4x3', name: 'Image (4x3)', widgetType: 'image', w: 4, h: 3, icon: 'image', color: 'purple' },
];

type SidebarTab = 'content' | 'widgets';

interface DraggableChannelProps {
  channel: TrendingChannel;
  onClick?: () => void;
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

function getTemplateIcon(icon: WidgetTemplate['icon'], color: string) {
  const colorClass = `text-${color}-400`;
  switch (icon) {
    case 'video':
      return <Video className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    case 'note':
      return <FileText className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    case 'spacer':
      return <Square className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    case 'image':
      return <ImageIcon className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
    default:
      return <Square className={`w-[1.8rem] h-[1.8rem] ${colorClass}`} />;
  }
}

function DraggableChannel({ channel, onClick }: DraggableChannelProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `channel-${channel.id}`,
    data: { type: 'channel', channel }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
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

interface DraggableTemplateProps {
  template: WidgetTemplate;
  onClick?: () => void;
}

function DraggableTemplate({ template, onClick }: DraggableTemplateProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: { type: 'widget-template', template }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && onClick) {
      onClick();
    }
  };

  const colorBorder = template.color === 'cyan' ? 'border-cyan-500/50 hover:border-cyan-400' 
    : template.color === 'yellow' ? 'border-yellow-500/50 hover:border-yellow-400'
    : template.color === 'purple' ? 'border-purple-500/50 hover:border-purple-400'
    : 'border-slate-500/50 hover:border-slate-400';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`flex items-center gap-[1rem] p-[1rem] bg-slate-800/50 hover:bg-slate-700/50 slot-button cursor-grab active:cursor-grabbing transition-all duration-200 border ${colorBorder}`}
      data-testid={`draggable-template-${template.id}`}
    >
      <div className="w-[3.2rem] h-[3.2rem] rounded-lg bg-slate-700 flex items-center justify-center">
        {getTemplateIcon(template.icon, template.color)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[1.2rem] font-semibold text-slate-200 truncate">{template.name}</p>
        <p className="text-[1rem] text-slate-400">
          {template.w}x{template.h} cols/rows
        </p>
      </div>
      <Grip className="w-[1.6rem] h-[1.6rem] text-slate-500" />
    </div>
  );
}

interface WidgetSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelClick?: (channel: TrendingChannel) => void;
  urlValue?: string;
  onUrlChange?: (value: string) => void;
  onUrlSubmit?: (url: string) => void;
  activeWidgetId?: string | null;
  onImageUpload?: (imageUrl: string) => void;
}

export function WidgetSidebar({ 
  isOpen, 
  onClose, 
  onChannelClick,
  urlValue = '',
  onUrlChange,
  onUrlSubmit,
  activeWidgetId,
  onImageUpload
}: WidgetSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('widgets');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      onImageUpload?.(imageUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="sidebar-overlay"
      />
      
      <div
        className="fixed top-0 left-0 h-full bg-slate-900 border-r border-slate-700 z-50 flex flex-col overflow-hidden"
        style={{ 
          width: isOpen ? 'min(32rem, 100vw)' : '0',
          display: isOpen ? 'flex' : 'none',
          borderTopRightRadius: 'var(--outer-radius)',
          borderBottomRightRadius: 'var(--outer-radius)'
        }}
        data-testid="widget-sidebar"
      >
        <div className="p-[1.6rem] border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-[1.2rem]">
            <h2 className="text-[1.8rem] font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-[0.8rem]">
              <LayoutGrid className="w-[2rem] h-[2rem] text-cyan-400" />
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
              onClick={() => setActiveTab('widgets')}
              className={`flex-1 flex items-center justify-center gap-[0.6rem] py-[0.8rem] px-[1.2rem] rounded-md text-[1.2rem] font-medium transition-all duration-200 ${
                activeTab === 'widgets'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              data-testid="tab-widgets"
            >
              <Layout className="w-[1.4rem] h-[1.4rem]" />
              Widgets
            </button>
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
              Streams
            </button>
          </div>
          
          <div className="mt-[1.2rem]">
            <label className="block text-[1rem] font-semibold mb-[0.4rem] text-cyan-400">
              {activeWidgetId ? 'UPDATE WIDGET URL' : 'ADD VIDEO BY URL'}
            </label>
            <div className="flex gap-[0.6rem]">
              <input
                type="text"
                value={urlValue}
                onChange={(e) => onUrlChange?.(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && urlValue.trim()) {
                    e.preventDefault();
                    onUrlSubmit?.(urlValue);
                  }
                }}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem]"
                data-testid="input-url-sidebar"
              />
              <button
                onClick={() => urlValue.trim() && onUrlSubmit?.(urlValue)}
                disabled={!urlValue.trim()}
                className="px-[1.2rem] py-[0.8rem] bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed slot-button font-semibold transition-colors text-[1.1rem]"
                data-testid="button-load-url"
              >
                ADD
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-[1.6rem]">
          {activeTab === 'widgets' && (
            <div className="space-y-[1.6rem]">
              <div>
                <h3 className="text-[1.4rem] font-semibold text-purple-400 mb-[1rem] flex items-center gap-[0.6rem]">
                  <LayoutGrid className="w-[1.6rem] h-[1.6rem]" />
                  Widget Types
                </h3>
                <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                  Drag or click to add widgets (12-column grid)
                </p>
                <div className="space-y-[0.8rem]">
                  {WIDGET_TEMPLATES.map((template) => (
                    <DraggableTemplate 
                      key={template.id} 
                      template={template}
                    />
                  ))}
                </div>
              </div>
              
              <div className="bg-purple-900/30 p-[1.2rem] rounded-lg border border-purple-500/50">
                <h4 className="text-[1.2rem] font-semibold text-purple-300 mb-[0.8rem] flex items-center gap-[0.6rem]">
                  <ImageIcon className="w-[1.4rem] h-[1.4rem]" />
                  Upload Image
                </h4>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-[0.8rem] px-[1.2rem] py-[1rem] bg-purple-600 hover:bg-purple-500 slot-button font-semibold transition-colors text-[1.2rem]"
                  data-testid="button-upload-image"
                >
                  <Upload className="w-[1.6rem] h-[1.6rem]" />
                  Upload from Computer
                </button>
                <p className="text-[1rem] text-purple-300/70 mt-[0.8rem] text-center">
                  {activeWidgetId ? 'Replace existing image' : 'Creates a new image widget'}
                </p>
              </div>

              <div className="bg-slate-800/50 p-[1.2rem] rounded-lg border border-slate-700/50">
                <h4 className="text-[1.2rem] font-semibold text-slate-300 mb-[0.8rem]">OpenBento Grid</h4>
                <ul className="text-[1.1rem] text-slate-400 space-y-[0.4rem]">
                  <li className="flex items-center gap-[0.6rem]">
                    <span className="text-cyan-400">12</span>
                    <span>column magnetic grid</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <Video className="w-[1.4rem] h-[1.4rem] text-cyan-400" />
                    <span>Video: Mute, Refresh, Delete</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <FileText className="w-[1.4rem] h-[1.4rem] text-yellow-400" />
                    <span>Note: Editable text</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <ImageIcon className="w-[1.4rem] h-[1.4rem] text-purple-400" />
                    <span>Photo: File upload</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem]">
                    <Square className="w-[1.4rem] h-[1.4rem] text-slate-400" />
                    <span>Spacer: Layout block</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
          
          {activeTab === 'content' && (
            <div className="space-y-[1.6rem]">
              <div className="relative">
                <Search className="absolute left-[1rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search streams..."
                  className="w-full pl-[3.6rem] pr-[1rem] py-[0.8rem] bg-slate-800 border border-slate-700 slot-button focus:border-cyan-500 focus:outline-none transition-colors text-[1.2rem]"
                  data-testid="input-search-channels"
                />
              </div>
              
              <div>
                <h3 className="text-[1.4rem] font-semibold text-cyan-400 mb-[1rem] flex items-center gap-[0.6rem]">
                  <Tv className="w-[1.6rem] h-[1.6rem]" />
                  Trending Streams
                </h3>
                <p className="text-[1.1rem] text-slate-400 mb-[1.2rem]">
                  Drag or click to add live streams
                </p>
                <div className="space-y-[0.8rem]">
                  {filteredChannels.map((channel) => (
                    <DraggableChannel 
                      key={channel.id} 
                      channel={channel} 
                      onClick={() => onChannelClick?.(channel)}
                    />
                  ))}
                  {filteredChannels.length === 0 && (
                    <p className="text-[1.2rem] text-slate-500 text-center py-[2rem]">
                      No streams found
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-[1.6rem] border-t border-slate-700 flex-shrink-0">
          <p className="text-[1rem] text-slate-500 text-center">
            {activeTab === 'widgets' 
              ? 'Drag widgets to add • Resize in Edit Mode' 
              : 'Click or drag streams to add'}
          </p>
        </div>
      </div>
    </>
  );
}

export { TRENDING_CHANNELS };

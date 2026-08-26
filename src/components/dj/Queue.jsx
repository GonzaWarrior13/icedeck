import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useDj } from '@/lib/DjContext';
import { formatTime } from '@/lib/audio';
import { Trash2, GripVertical, Play, ListMusic } from 'lucide-react';

export default function Queue() {
  const dj = useDj();

  const onDragEnd = (res) => {
    if (!res.destination) return;
    const newQ = Array.from(dj.queue);
    const [moved] = newQ.splice(res.source.index, 1);
    newQ.splice(res.destination.index, 0, moved);
    dj.reorderQueue(newQ);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListMusic className="w-4 h-4 text-cyan-400" /> Queue
          <span className="text-xs text-slate-500">({dj.queue.length})</span>
        </div>
        {dj.queue.length > 0 && (
          <button onClick={dj.clearQueue} className="text-xs text-slate-500 hover:text-rose-300">Clear</button>
        )}
      </div>
      {dj.queue.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl py-10 px-4">
          Drag songs here or tap <span className="text-cyan-300 mx-1">+</span> to build your set.
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="queue">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5 flex-1 overflow-y-auto">
                {dj.queue.map((song, i) => (
                  <Draggable key={song.id + '-' + i} draggableId={song.id + '-' + i} index={i}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border ${dj.currentIndex === i ? 'bg-cyan-400/10 border-cyan-400/40' : 'bg-slate-900/60 border-slate-800'}`}
                      >
                        <span {...p.dragHandleProps} className="text-slate-600 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <button
                          onClick={() => dj.playQueueFrom(dj.queue, i)}
                          className="shrink-0 w-7 h-7 rounded-full bg-slate-800 hover:bg-cyan-400 hover:text-slate-950 flex items-center justify-center transition"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{song.title}</p>
                          <p className="truncate text-[11px] text-slate-500">{song.artist || 'Unknown'} · {formatTime(song.duration)}</p>
                        </div>
                        <button onClick={() => dj.removeFromQueue(i)} className="p-1.5 rounded text-slate-600 hover:text-rose-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
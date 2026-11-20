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
    // Reorder applies to the queue immediately and is persisted by DjContext.
    dj.reorderQueue(newQ);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListMusic className="w-4 h-4 text-primary" aria-hidden="true" /> Queue
          <span className="text-xs text-muted-foreground">({dj.queue.length})</span>
        </div>
        {dj.queue.length > 0 && (
          <button onClick={dj.clearQueue} className="min-h-11 px-2 text-xs text-muted-foreground hover:text-destructive">Clear</button>
        )}
      </div>
      {dj.queue.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl py-10 px-4">
          Drag songs here or tap <span className="text-primary mx-1">+</span> to build your set.
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="queue">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5 flex-1 overflow-y-auto scroll-area">
                {dj.queue.map((song, i) => (
                  <Draggable key={song.id + '-' + i} draggableId={song.id + '-' + i} index={i}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border ${dj.currentIndex === i ? 'bg-primary/10 border-primary/40' : 'bg-card/60 border-border'}`}
                      >
                        <span {...p.dragHandleProps} className="min-h-11 min-w-6 flex items-center justify-center text-muted-foreground/60 cursor-grab active:cursor-grabbing" aria-label="Reorder track">
                          <GripVertical className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <button
                          onClick={() => dj.playQueueFrom(dj.queue, i)}
                          className="shrink-0 min-h-11 min-w-11 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition"
                          aria-label={`Play ${song.title} from queue`}
                        >
                          <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{song.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{song.artist || 'Unknown'} · {formatTime(song.duration)}</p>
                        </div>
                        <button
                          onClick={() => dj.removeFromQueue(i)}
                          className="min-h-11 min-w-11 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive"
                          aria-label={`Remove ${song.title} from queue`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
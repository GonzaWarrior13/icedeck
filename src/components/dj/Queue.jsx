import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useDj } from '@/lib/DjContext';
import { formatTime } from '@/lib/audio';
import { Trash2, GripVertical, Play } from 'lucide-react';

export default function Queue({ spotify } = {}) {
  const dj = useDj();
  const localCount = dj.queue.length;
  const tracks = [...dj.queue, ...(spotify?.tracks || [])];
  const activeIndex = spotify?.active ? -1 : dj.currentIndex;
  function clear() {
    dj.clearQueue();
    spotify?.clear();
  }

  const onDragEnd = (res) => {
    if (!res.destination) return;
    const from = res.source.index;
    const to = res.destination.index;
    if (from >= localCount || to >= localCount) {
      if (from >= localCount && to >= localCount) spotify.reorder(from - localCount, to - localCount);
      return;
    }
    const newQ = Array.from(dj.queue);
    const [moved] = newQ.splice(res.source.index, 1);
    newQ.splice(res.destination.index, 0, moved);
    // Reorder applies to the queue immediately and is persisted by DjContext.
    dj.reorderQueue(newQ);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-3 h-12 md:px-4 md:h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="section-label">Queue</span>
          <span className="type-data rounded-[6px] bg-secondary px-1.5 py-0.5 text-[14px] text-muted-foreground md:text-[11px]">
            {tracks.length}
          </span>
        </div>
        {tracks.length > 0 && (
          <button
            onClick={clear}
            className="min-h-11 px-2 text-[14px] text-muted-foreground hover:text-foreground transition-colors md:text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {tracks.length === 0 ? (
        <div className="flex-1 flex items-start justify-center px-6 pt-8 md:pt-12 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Drag songs here or tap <span className="text-primary">+</span> to build your set.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="queue">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-1 overflow-y-auto scroll-area divide-y divide-border"
              >
                {tracks.map((song, i) => (
                  <Draggable key={song.id + '-' + i} draggableId={song.id + '-' + i} index={i}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className={`flex items-center gap-2 px-2 min-h-14 transition-colors ${
                          activeIndex === i ? 'bg-primary/15' : 'hover:bg-secondary'
                        }`}
                      >
                        <span
                          {...p.dragHandleProps}
                          className="min-h-11 min-w-6 flex items-center justify-center text-muted-foreground/60 cursor-grab active:cursor-grabbing"
                          aria-label="Reorder track"
                        >
                          <GripVertical className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <button
                          onClick={() => i < localCount ? dj.playQueueFrom(dj.queue, i) : spotify.play(i - localCount)}
                          className="shrink-0 h-11 w-11 rounded-[8px] border border-border text-primary flex items-center justify-center hover:border-primary/60 hover:bg-primary/10 transition-colors md:h-9 md:w-9"
                          aria-label={`Play ${song.title} from queue`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`type-track truncate ${activeIndex === i ? 'text-primary' : ''}`}>{song.title}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <p className="type-meta truncate">{song.artist || 'Unknown'}{i >= localCount && ' · Spotify'}</p>
                            <span className="type-meta text-muted-foreground/50" aria-hidden="true">·</span>
                            <span className="type-data shrink-0 text-muted-foreground">{formatTime(song.duration)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => i < localCount ? dj.removeFromQueue(i) : spotify.remove(i - localCount)}
                          className="min-h-11 min-w-9 flex items-center justify-center rounded-[8px] text-muted-foreground/60 hover:text-destructive transition-colors"
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
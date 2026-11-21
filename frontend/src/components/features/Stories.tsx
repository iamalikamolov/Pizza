'use client';

// Story bloki (Instagram Stories kabi): doira shaklidagi storislar + to'liq ekranli ko'rish oynasi
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Story } from '@/lib/api';
import { bindBackButton, useTelegram } from '@/hooks/useTelegram';
import { cn, safeStorage, thumb } from '@/lib/utils';

const SEEN_KEY = 'pizza-stories-seen';
const DURATION = 5000;

type Props = { stories: Story[]; onAction: (action: string) => void };

export default function Stories({ stories, onAction }: Props) {
  const [seen, setSeen] = useState<string[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      setSeen(JSON.parse(safeStorage.get(SEEN_KEY) || '[]'));
    } catch {
      setSeen([]);
    }
  }, []);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      safeStorage.set(SEEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ko'rilmaganlar oldinda
  const ordered = [...stories].sort((a, b) => Number(seen.includes(a.id)) - Number(seen.includes(b.id)));

  return (
    <>
      <div className="stories" role="list">
        {ordered.map((s) => (
          <button
            key={s.id}
            role="listitem"
            className={cn('story', seen.includes(s.id) && 'story--seen')}
            onClick={() => setOpenIndex(ordered.indexOf(s))}
          >
            <span className="story__ring">
              <span className="story__circle" style={{ background: `linear-gradient(135deg, ${s.gradient[0]}, ${s.gradient[1]})` }}>
                {s.image ? <img src={thumb(s.image)} alt="" loading="lazy" /> : s.emoji}
              </span>
            </span>
            <span className="story__title">{s.title}</span>
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <StoryViewer
          stories={ordered}
          startIndex={openIndex}
          onSeen={markSeen}
          onClose={() => setOpenIndex(null)}
          onAction={(a) => {
            setOpenIndex(null);
            onAction(a);
          }}
        />
      )}
    </>
  );
}

type ViewerProps = {
  stories: Story[];
  startIndex: number;
  onSeen: (id: string) => void;
  onClose: () => void;
  onAction: (action: string) => void;
};

function StoryViewer({ stories, startIndex, onSeen, onClose, onAction }: ViewerProps) {
  const { webApp, haptic } = useTelegram();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const elapsed = useRef(0);
  const story = stories[index];

  const next = useCallback(() => {
    elapsed.current = 0;
    setProgress(0);
    setIndex((i) => {
      if (i >= stories.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [stories.length, onClose]);

  const prev = () => {
    elapsed.current = 0;
    setProgress(0);
    setIndex((i) => Math.max(0, i - 1));
  };

  useEffect(() => {
    if (story) onSeen(story.id);
  }, [story, onSeen]);

  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const p = Math.min(1, elapsed.current / DURATION);
      setProgress(p);
      if (p >= 1) next();
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, next]);

  useEffect(() => bindBackButton(webApp, onClose), [webApp, onClose]);

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  if (!story) return null;

  return createPortal(
    <div
      className="story-viewer"
      style={{ background: `linear-gradient(160deg, ${story.gradient[0]}, ${story.gradient[1]})` }}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {story.image && (
        <>
          <img className="story-viewer__img" src={story.image} alt="" key={`img-${story.id}`} />
          <div className="story-viewer__img-shade" />
        </>
      )}
      <div className="story-viewer__bars">
        {stories.map((s, i) => (
          <div className="story-viewer__bar" key={s.id}>
            <div
              className="story-viewer__fill"
              style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }}
            />
          </div>
        ))}
      </div>

      <div className="story-viewer__top">
        <span className="story-viewer__avatar">{story.emoji}</span>
        <span className="story-viewer__name">{story.title}</span>
        <button className="story-viewer__close" onClick={onClose} aria-label="Yopish">
          ✕
        </button>
      </div>

      <button className="story-viewer__tap story-viewer__tap--left" onClick={prev} aria-label="Oldingi" />
      <button className="story-viewer__tap story-viewer__tap--right" onClick={next} aria-label="Keyingi" />

      <div className="story-viewer__content" key={story.id}>
        {!story.image && <div className="story-viewer__emoji">{story.emoji}</div>}
        {story.type === 'review' && story.rating ? (
          <div className="story-viewer__stars">{'★'.repeat(story.rating)}</div>
        ) : null}
        <h2 className="story-viewer__heading">{story.heading}</h2>
        <p className="story-viewer__text">{story.text}</p>
      </div>

      {story.cta && (
        <button
          className="story-viewer__cta"
          onClick={(e) => {
            e.stopPropagation();
            haptic.impact('medium');
            onAction(story.cta!.action);
          }}
        >
          {story.cta.label} →
        </button>
      )}
    </div>,
    document.body
  );
}

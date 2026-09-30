import {
  BookOpenText,
  Camera,
  ClipboardList,
  FlaskConical,
  Frame,
  Gauge,
  HardDrive,
  Joystick,
  MessageCircle,
  Music,
  Puzzle,
  Server,
  type LucideIcon,
} from 'lucide-react';
import type { WorkEntry, WorkMark } from '@/lib/worksCatalog';
import styles from './page.module.css';

const MARK_ICON: Record<Exclude<WorkMark, 'crown'>, LucideIcon> = {
  board: ClipboardList,
  book: BookOpenText,
  camera: Camera,
  chat: MessageCircle,
  flask: FlaskConical,
  frame: Frame,
  gauge: Gauge,
  harddrive: HardDrive,
  joystick: Joystick,
  music: Music,
  puzzle: Puzzle,
  server: Server,
};

function WorkMarkGlyph({ mark }: { readonly mark: WorkMark }) {
  if (mark === 'crown') {
    // 게임이 실제로 쓰는 왕관 표식 파일 — BlogRail 의 표기와 같은 대상.
    return (
      <img src="/assets/projects/spellcrown-web-boardgame/crown.webp" alt="" loading="lazy" />
    );
  }
  const Icon = MARK_ICON[mark];
  return <Icon size={42} strokeWidth={1.4} aria-hidden />;
}

/** 썸네일과 제목·짧은 설명을 한눈에 훑는 작업물 색인 항목. */
export function WorkCard({ work }: { readonly work: WorkEntry }) {
  const contained = work.imageFit === 'contain';
  const visualClassName = [
    styles.visual,
    styles[`visual_${work.category}`],
    contained && styles.visualContained,
  ].filter(Boolean).join(' ');
  const imageClassName = [
    styles.image,
    contained && styles.imageContain,
    work.imageSquare && styles.imageSquare,
  ].filter(Boolean).join(' ');
  return (
    <article className={styles.card}>
      <div className={styles.cardInner}>
        <div className={visualClassName}>
          {work.image ? (
            <img
              className={imageClassName}
              src={work.image}
              alt={work.imageAlt ?? ''}
              loading="lazy"
              style={work.imagePosition ? { objectPosition: work.imagePosition } : undefined}
            />
          ) : (
            <div className={styles.placeholder}>
              <WorkMarkGlyph mark={work.mark} />
            </div>
          )}
        </div>
        <div className={styles.cardContent}>
          <div className={styles.cardLabels}>
            <span className={styles.kind}>{work.kind}</span>
            {work.feature && <span className={styles.feature}>{work.feature}</span>}
          </div>
          <h3>{work.title}</h3>
          <p className={styles.description}>{work.description}</p>
          <div className={styles.cardBottom}>
            {work.articleHref && (
              <a
                className={`${styles.action} ${styles.articleAction}`}
                href={work.articleHref}
                aria-label={`${work.title} 소개 글 보기`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpenText size={14} strokeWidth={1.8} aria-hidden />
                글 보기
              </a>
            )}
            {work.href && (
              <a
                className={`${styles.action} ${styles.workAction}`}
                href={work.href}
                aria-label={`${work.title} 작업물 보기 (${work.source})`}
                target="_blank"
                rel="noopener noreferrer"
              >
                작업물 보기 <span aria-hidden>→</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

import { useState, useRef, useEffect } from 'react';
import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
  groupCount: number;
  memberCount?: number;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CourseCard({ course, groupCount, memberCount, onClick, onEdit, onDelete }: CourseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-3.5 cursor-pointer hover:shadow-md transition-shadow shadow-sm"
    >
      <div className="w-10 h-10 rounded-xl bg-brand-light text-brand font-bold text-base flex items-center justify-center flex-shrink-0">
        {course.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[#0F172A] truncate">{course.name}</p>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          {course.subject} · {groupCount} {groupCount === 1 ? 'group' : 'groups'}
          {memberCount !== undefined && <> · {memberCount} {memberCount === 1 ? 'student' : 'students'}</>}
        </p>
      </div>
      {(onEdit || onDelete) ? (
        <div className="relative flex-shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/>
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-36 bg-white border border-[#E2E8F0] rounded-[8px] shadow-lg py-1 z-20"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,.10)' }}>
              {onEdit && (
                <button
                  onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9] transition-colors"
                >
                  Edit course
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete course
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#94A3B8] flex-shrink-0">
          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

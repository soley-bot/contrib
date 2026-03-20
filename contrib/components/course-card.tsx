import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
  groupCount: number;
  memberCount?: number;
  onClick: () => void;
}

export default function CourseCard({ course, groupCount, memberCount, onClick }: CourseCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E7E5E4] rounded-[10px] p-4 flex items-center gap-3.5 cursor-pointer hover:shadow-md transition-shadow"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}
    >
      <div className="w-11 h-11 rounded-[10px] bg-brand-light text-brand font-bold text-base flex items-center justify-center flex-shrink-0">
        {course.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[#1C1917] truncate">{course.name}</p>
        <p className="text-xs text-[#A8A29E] mt-0.5">
          {course.subject} · {groupCount} {groupCount === 1 ? 'group' : 'groups'}
          {memberCount !== undefined && <> · {memberCount} {memberCount === 1 ? 'student' : 'students'}</>}
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#A8A29E] flex-shrink-0">
        <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

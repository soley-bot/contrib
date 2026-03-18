import ProgressBar from '@/components/progress-bar';
import type { Group } from '@/types';

interface CourseGroupRowProps {
  group: Group;
  taskTotal: number;
  taskDone: number;
  memberCount: number;
  onDownloadPdf: () => void;
  downloading: boolean;
}

export default function CourseGroupRow({ group, taskTotal, taskDone, memberCount, onDownloadPdf, downloading }: CourseGroupRowProps) {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-[10px] p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-[8px] bg-[#FFF0EE] text-[#FF5841] font-bold text-sm flex items-center justify-center flex-shrink-0">
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#1C1917] truncate">{group.name}</p>
            <p className="text-[11px] text-[#A8A29E] mt-0.5">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {taskDone}/{taskTotal} tasks done
            </p>
          </div>
        </div>
        <button
          onClick={onDownloadPdf}
          disabled={downloading}
          className="flex-shrink-0 h-8 px-3 border border-[#E7E5E4] bg-white hover:bg-[#F5F5F4] text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {downloading ? 'Exporting…' : 'PDF'}
        </button>
      </div>
      <div className="mt-3">
        <ProgressBar value={taskDone} max={taskTotal} />
      </div>
    </div>
  );
}

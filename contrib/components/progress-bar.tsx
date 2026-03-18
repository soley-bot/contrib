interface ProgressBarProps {
  value: number;
  max: number;
}

export default function ProgressBar({ value, max }: ProgressBarProps) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF5841] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-[#A8A29E] w-8 text-right">{pct}%</span>
    </div>
  );
}

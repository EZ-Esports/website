import { SECTIONS, type SectionId } from '../form-config';

// The "Step X of N" header repeated at the top of each of the 4 form
// sections.
export default function SectionHeader({ sectionId }: { sectionId: SectionId }) {
  const section = SECTIONS.find((s) => s.id === sectionId)!;
  return (
    <div className="border-b border-line/50 pb-4 mb-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-1">
        Step {section.num} of {SECTIONS.length}
      </p>
      <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight">{section.title}</h3>
      <p className="text-xs text-foreground-secondary mt-1">{section.desc}</p>
    </div>
  );
}

import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';

export default function MigrationNotice() {
  return (
    <Card
      variant="tinted"
      padding="sm"
      className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 bg-accent/5 border-accent/20"
    >
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="warning" size="sm" className="font-black">
          System Notice
        </Badge>
      </div>
      <p className="text-xs text-foreground-secondary font-semibold leading-relaxed">
        The <span className="text-foreground font-black">EZ Esports Software Engineering Division</span> is still migrating data, so some items or records may be incomplete during this transition.
      </p>
    </Card>
  );
}

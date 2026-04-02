import { Clock, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Filters } from "@/lib/types";

interface FilterSidebarProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
}

const durationOptions = [
  { value: "all", label: "Any duration" },
  { value: "short", label: "Under 5 hrs" },
  { value: "medium", label: "5–15 hrs" },
  { value: "long", label: "15+ hrs" },
] as const;

export function FilterSidebar({ filters, onFiltersChange }: FilterSidebarProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">Filters</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({ duration: "all" })}
          className="text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      <Separator className="bg-border" />

      {/* Duration */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Clock className="h-3.5 w-3.5" />
          Duration
        </Label>
        <div className="space-y-1">
          {durationOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFiltersChange({ ...filters, duration: opt.value })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                filters.duration === opt.value
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

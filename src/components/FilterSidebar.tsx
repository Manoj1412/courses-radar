import { Clock, ThumbsUp, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
          onClick={() => onFiltersChange({ duration: "all", minLikeRatio: 0 })}
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

      <Separator className="bg-border" />

      {/* Min Like Ratio */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <ThumbsUp className="h-3.5 w-3.5" />
          Min Like Ratio
        </Label>
        <div className="px-1">
          <Slider
            value={[filters.minLikeRatio]}
            onValueChange={([v]) => onFiltersChange({ ...filters, minLikeRatio: v })}
            min={0}
            max={8}
            step={0.5}
            className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">0%</span>
            <span className="text-xs font-semibold text-primary">{filters.minLikeRatio}%+</span>
            <span className="text-xs text-muted-foreground">8%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

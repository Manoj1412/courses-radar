import { SlidersHorizontal } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { Weights } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface WeightSlidersProps {
  weights: Weights;
  onWeightsChange: (w: Weights) => void;
}

const weightLabels: { key: keyof Weights; label: string; icon: string }[] = [
  { key: "likeRatio", label: "Like Ratio", icon: "👍" },
  { key: "sentiment", label: "Comment Sentiment", icon: "💬" },
  { key: "views", label: "View Count", icon: "👁" },
  { key: "recency", label: "Recency", icon: "🕐" },
];

export function WeightSliders({ weights, onWeightsChange }: WeightSlidersProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50 bg-input">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Adjust Weights
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border-border" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-sm font-bold text-foreground">Ranking Weights</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onWeightsChange(DEFAULT_WEIGHTS)}
              className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
            >
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Adjust how much each factor matters in ranking.</p>
          <Separator className="bg-border" />
          {weightLabels.map(({ key, label, icon }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  {icon} {label}
                </Label>
                <span className="text-xs font-bold text-primary">
                  {Math.round(weights[key] * 100)}%
                </span>
              </div>
              <Slider
                value={[weights[key]]}
                onValueChange={([v]) => onWeightsChange({ ...weights, [key]: v })}
                min={0}
                max={1}
                step={0.05}
                className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

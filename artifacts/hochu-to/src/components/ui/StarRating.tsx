import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: false;
}

interface StarRatingInputProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive: true;
  onChange: (rating: number) => void;
  hovered?: number;
  onHover?: (rating: number) => void;
  onLeave?: () => void;
}

type Props = StarRatingProps | StarRatingInputProps;

const SIZE_MAP = {
  sm: "w-3.5 h-3.5",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export function StarRating(props: Props) {
  const { value, max = 5, size = "md" } = props;
  const interactive = "interactive" in props && props.interactive;
  const hovered = interactive && "hovered" in props ? props.hovered : undefined;

  const displayValue = hovered ?? value;
  const starClass = SIZE_MAP[size];

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < displayValue;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            className={`${interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}`}
            onClick={interactive ? () => (props as StarRatingInputProps).onChange(i + 1) : undefined}
            onMouseEnter={interactive ? () => (props as StarRatingInputProps).onHover?.(i + 1) : undefined}
            onMouseLeave={interactive ? () => (props as StarRatingInputProps).onLeave?.() : undefined}
          >
            <Star
              className={`${starClass} transition-colors ${
                filled
                  ? "text-amber-400 fill-amber-400"
                  : "text-gray-200 fill-gray-200"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function RatingDisplay({ rating, count, size = "sm" }: { rating: number; count?: number; size?: "sm" | "md" | "lg" }) {
  if (!rating || rating === 0) return null;
  const starClass = SIZE_MAP[size];
  return (
    <div className="flex items-center gap-1">
      <Star className={`${starClass} text-amber-400 fill-amber-400`} />
      <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-muted-foreground text-xs">({count})</span>
      )}
    </div>
  );
}

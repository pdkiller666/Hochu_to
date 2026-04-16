import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MessageSquare, User, CornerDownRight, ChevronDown, ChevronUp } from "lucide-react";
import { StarRating } from "./StarRating";

export interface ReviewData {
  id: number;
  reviewType: string;
  reviewerRole: string;
  listingId?: number;
  listingTitle?: string;
  bookingId?: number;
  bookingNumber?: string;
  authorId: number;
  authorName: string;
  authorAvatar?: string;
  revieweeId?: number;
  revieweeName?: string;
  revieweeAvatar?: string;
  rating: number;
  text?: string;
  responseText?: string;
  responseAt?: string;
  createdAt: string;
}

interface ReviewCardProps {
  review: ReviewData;
  showListing?: boolean;
  currentUserId?: number;
  onRespond?: (reviewId: number, text: string) => Promise<void>;
  apiBase?: string;
}

export function ReviewCard({ review, showListing, currentUserId, onRespond, apiBase = "" }: ReviewCardProps) {
  const [responding, setResponding] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localResponse, setLocalResponse] = useState<string | undefined>(review.responseText);
  const [localResponseAt, setLocalResponseAt] = useState<string | undefined>(review.responseAt);
  const [showFull, setShowFull] = useState(false);

  const canRespond = onRespond && !localResponse && currentUserId === review.revieweeId;

  const avatarSrc = (url?: string) => !url ? null : url.startsWith("http") ? url : `${apiBase}${url}`;

  const handleSubmitResponse = async () => {
    if (!responseText.trim() || !onRespond) return;
    setSubmitting(true);
    try {
      await onRespond(review.id, responseText.trim());
      setLocalResponse(responseText.trim());
      setLocalResponseAt(new Date().toISOString());
      setResponding(false);
      setResponseText("");
    } finally {
      setSubmitting(false);
    }
  };

  const MAX_TEXT = 280;
  const textLong = (review.text?.length ?? 0) > MAX_TEXT;
  const displayText = textLong && !showFull ? review.text!.slice(0, MAX_TEXT) + "…" : review.text;

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-secondary-foreground overflow-hidden shrink-0">
            {avatarSrc(review.authorAvatar) ? (
              <img src={avatarSrc(review.authorAvatar)!} alt={review.authorName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight">{review.authorName}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {format(new Date(review.createdAt), "d MMMM yyyy", { locale: ru })}
              </span>
              {review.bookingNumber && (
                <span className="text-[10px] text-muted-foreground/70 font-mono bg-muted/60 border border-border/40 px-1.5 py-0.5 rounded-md">
                  {review.bookingNumber}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <StarRating value={review.rating} size="sm" />
        </div>
      </div>

      {/* Listing reference */}
      {showListing && review.listingTitle && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-foreground font-medium">Объявление:</span>
          <span>{review.listingTitle}</span>
        </div>
      )}

      {/* Text */}
      {review.text && (
        <div>
          <p className="text-sm text-foreground leading-relaxed">{displayText}</p>
          {textLong && (
            <button
              onClick={() => setShowFull(!showFull)}
              className="flex items-center gap-0.5 text-xs text-primary mt-1 hover:underline"
            >
              {showFull ? <><ChevronUp className="w-3 h-3" /> Свернуть</> : <><ChevronDown className="w-3 h-3" /> Читать полностью</>}
            </button>
          )}
        </div>
      )}

      {/* Response from reviewee */}
      {localResponse && (
        <div className="bg-muted/50 border border-border/50 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <CornerDownRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-foreground">
                  {review.revieweeName ?? "Владелец"}
                </span>
                {localResponseAt && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(localResponseAt), "d MMMM yyyy", { locale: ru })}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{localResponse}</p>
            </div>
          </div>
        </div>
      )}

      {/* Respond button + form */}
      {canRespond && !responding && (
        <button
          onClick={() => setResponding(true)}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <MessageSquare className="w-3.5 h-3.5" /> Ответить на отзыв
        </button>
      )}
      {responding && (
        <div className="space-y-2">
          <textarea
            className="input-field text-sm min-h-[80px] resize-none"
            placeholder="Напишите ваш ответ на отзыв..."
            value={responseText}
            onChange={e => setResponseText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitResponse}
              disabled={submitting || !responseText.trim()}
              className="btn-primary text-sm px-4 py-2"
            >
              {submitting ? "Отправка…" : "Опубликовать ответ"}
            </button>
            <button
              onClick={() => { setResponding(false); setResponseText(""); }}
              className="btn-secondary text-sm px-4 py-2"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

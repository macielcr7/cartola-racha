import { motion } from "framer-motion";
import { type Player } from "@/lib/models";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { Trophy } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  rank: number;
  total: number;
  scoreValue?: number;
  showStatusLabels?: boolean;
  onClick?: () => void;
}

export function PlayerCard({
  player,
  rank,
  total,
  scoreValue,
  showStatusLabels = true,
  onClick,
}: PlayerCardProps) {
  const isTop3 = rank <= 3;
  const isLast = total > 1 && rank === total;
  const initials = getInitials(player.name);
  const points = scoreValue ?? player.score;
  const isClickable = Boolean(onClick);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.05 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={cn(
        "relative flex items-center p-4 mb-3 rounded-xl border transition-all duration-200",
        "bg-card hover:shadow-lg shadow-sm",
        isTop3 ? "border-primary/20 bg-gradient-to-r from-card to-primary/5" : "border-border/50",
        isClickable && "cursor-pointer"
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!isClickable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Rank Badge */}
      <div className="flex-shrink-0 w-12 flex justify-center">
        <div className={cn(
          "w-8 h-8 flex items-center justify-center rounded-full font-bold font-display text-sm",
          rank === 1 && "bg-yellow-400 text-yellow-900 shadow-yellow-200 shadow-md",
          rank === 2 && "bg-slate-300 text-slate-800 shadow-slate-200 shadow-md",
          rank === 3 && "bg-amber-700 text-amber-100 shadow-amber-900/20 shadow-md",
          rank > 3 && "bg-muted text-muted-foreground"
        )}>
          {rank}
        </div>
      </div>

      {/* Avatar */}
      <div className="flex-shrink-0 mr-4">
        <Avatar className={cn(
          "w-12 h-12 border-2",
          rank === 1 ? "border-yellow-400" : "border-border"
        )}>
          <AvatarFallback className="bg-muted text-muted-foreground font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Name */}
      <div className="flex-grow min-w-0">
        <h3 className="text-lg font-bold truncate leading-tight text-foreground">
          {player.name}
        </h3>
        {showStatusLabels && rank === 1 && (
          <p className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
            <Trophy className="w-3 h-3" />
            Líder Atual
          </p>
        )}
        {showStatusLabels && isLast && (
          <p className="text-xs text-destructive font-medium mt-0.5">
            pancada no ovo
          </p>
        )}
      </div>

      {/* Score */}
      <div className="flex-shrink-0 text-right pl-4">
        <div className="text-2xl font-display font-bold text-primary tabular-nums tracking-tight">
          {points}
        </div>
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          PTS
        </div>
      </div>
    </motion.div>
  );
}

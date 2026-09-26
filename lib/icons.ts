/**
 * The icons the app uses (lucide), by sprite id. public/icons.svg holds one
 * <symbol> per entry (npm run sprites); <Icon name="…"> draws it with <use>,
 * so each page carries a short reference instead of the paths.
 */
export const ICONS = {
  activity: "Activity",
  "arrow-down": "ArrowDown",
  "arrow-left": "ArrowLeft",
  "arrow-right": "ArrowRight",
  "arrow-up-down": "ArrowUpDown",
  check: "Check",
  "check-circle": "CheckCircle2",
  "chevron-down": "ChevronDown",
  compass: "Compass",
  download: "Download",
  ellipsis: "Ellipsis",
  heart: "Heart",
  info: "Info",
  layers: "Layers",
  leaf: "Leaf",
  "link-2": "Link2",
  loader: "Loader2",
  lock: "Lock",
  mail: "Mail",
  "message-square": "MessageSquare",
  minus: "Minus",
  plus: "Plus",
  "refresh-cw": "RefreshCw",
  repeat: "Repeat",
  "rotate-ccw": "RotateCcw",
  ruler: "Ruler",
  send: "Send",
  "share-2": "Share2",
  "shopping-bag": "ShoppingBag",
  sparkles: "Sparkles",
  "trash-2": "Trash2",
  truck: "Truck",
  "undo-2": "Undo2",
  x: "X",
  "zoom-in": "ZoomIn",
} as const;

export type IconName = keyof typeof ICONS;

import { createElement } from "react";
import { Copy, Download, FolderInput, FolderPlus, Heart, Link2, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GlassMenuGroup } from "./glass-menu";

/** Every icon in the menu is 16px at 1.75, hidden from the accessible name. */
export const iconProps = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const glyph = (Icon: LucideIcon) => createElement(Icon, iconProps);

/** Albums offered by "Move to"; the last submenu row always creates a new one. */
export const albums = ["Lisbon trip", "Architecture", "Summer 2026"];

export interface GlassMenuDemoState {
  favorite: boolean;
  deleted: boolean;
}

/** The photo's action menu: three groups, one in-place submenu, a checkable row, a destructive row. */
export const createGroups = ({ favorite, deleted }: GlassMenuDemoState): GlassMenuGroup[] => [
  {
    id: "quick",
    items: [
      { id: "favorite", label: "Favorite", icon: glyph(Heart), shortcut: "F", checked: favorite, keepOpen: true },
      { id: "link", label: "Copy link", icon: glyph(Link2), shortcut: "⌘L" },
      { id: "duplicate", label: "Duplicate", icon: glyph(Copy), shortcut: "⌘D" },
    ],
  },
  {
    id: "organize",
    items: [
      {
        id: "move",
        label: "Move to",
        icon: glyph(FolderInput),
        items: [...albums.map(album => ({ id: `album:${album}`, label: album })), { id: "album:new", label: "New album", icon: glyph(FolderPlus) }],
      },
      { id: "download", label: "Download", icon: glyph(Download), shortcut: "⇧⌘S" },
    ],
  },
  {
    id: "danger",
    items: [{ id: "delete", label: "Delete", icon: glyph(Trash2), shortcut: "⌫", danger: true, disabled: deleted }],
  },
];

export interface GlassMenuNote {
  id: number;
  text: string;
  undo: boolean;
}

/** The copy announced in the frame's polite live region for each chosen row. */
export const noteFor = (id: string, favorite: boolean): string | null => {
  switch (id) {
    case "favorite":
      return favorite ? "Removed from favorites" : "Added to favorites";
    case "link":
      return "Link copied";
    case "duplicate":
      return "Duplicated to Recents";
    case "download":
      return "Saved to Downloads";
    case "delete":
      return "Moved to trash";
    case "album:new":
      return "Added to a new album";
    default:
      return id.startsWith("album:") ? `Moved to ${id.slice(6)}` : null;
  }
};

import { 
  Gamepad2, 
  Palette, 
  Camera, 
  Image, 
  PenTool, 
  Target,
  Sparkles,
  Shirt,
  BookOpen,
  LucideIcon,
  Library,
  PenLine,
  Ruler,
  Book
} from 'lucide-react'

export const categoryIcons: Record<string, LucideIcon> = {
  gaming: Gamepad2,
  art: Palette,
  photography: Camera,
  collections: Library,
  writing: PenLine,
  design: Ruler,
  lifestyle: Sparkles,
  fashion: Shirt,
  comics: BookOpen,
  personal: Book,
}

export function getCategoryIcon(slug: string): LucideIcon {
  return categoryIcons[slug] || Image // fallback to Image icon
}

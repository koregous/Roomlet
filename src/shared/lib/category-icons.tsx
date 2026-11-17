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

// Map category slugs to Lucide icons
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

// Get icon component for a category
export function getCategoryIcon(slug: string): LucideIcon {
  return categoryIcons[slug] || Image // fallback to Image icon
}

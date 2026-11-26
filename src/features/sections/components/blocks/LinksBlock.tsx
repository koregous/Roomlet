import { Block } from '@/shared/lib/types'
import { ExternalLink, Github, Linkedin, Twitter, Mail, Globe, Instagram, Facebook, Youtube } from 'lucide-react'
import { sanitizeUrl } from '@/shared/lib/sanitize'

interface Props {
  block: Block
}

function getBrandIcon(url: string, customIcon?: string, iconUrl?: string) {
  // If custom icon image uploaded, use it
  if (iconUrl && iconUrl.trim()) {
    return (
      <img 
        src={iconUrl} 
        alt="Link icon" 
        className="w-8 h-8 object-cover rounded"
      />
    )
  }

  // If custom icon (emoji) provided, use it
  if (customIcon && customIcon.trim()) {
    return <span className="text-xl">{customIcon}</span>
  }

  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('github.com')) {
    return <Github size={20} />
  }
  if (lowerUrl.includes('linkedin.com')) {
    return <Linkedin size={20} />
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return <Twitter size={20} />
  }
  if (lowerUrl.includes('instagram.com')) {
    return <Instagram size={20} />
  }
  if (lowerUrl.includes('facebook.com')) {
    return <Facebook size={20} />
  }
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return <Youtube size={20} />
  }
  if (lowerUrl.startsWith('mailto:')) {
    return <Mail size={20} />
  }

  // Default: globe for external links
  return <Globe size={20} />
}

export default function LinksBlock({ block }: Props) {
  const links = block.content.links || []

  if (links.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {links.map((link, index) => (
        <a
          key={index}
          href={sanitizeUrl(link.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 border border-gray-800 hover:border-white transition group"
        >
          <div className="text-gray-500 group-hover:text-white transition shrink-0">
            {getBrandIcon(link.url, link.icon, link.iconUrl)}
          </div>
          
          <span className="font-medium text-white group-hover:text-gray-300 flex-1 min-w-0 truncate">
            {link.title}
          </span>
          
          <ExternalLink size={14} className="text-gray-600 group-hover:text-gray-400 transition shrink-0" />
        </a>
      ))}
    </div>
  )
}

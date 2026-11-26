import React from 'react'
import { Block } from '@/shared/lib/types'
import { sanitizeUrl } from '@/shared/lib/sanitize'

interface Props {
  block: Block
}

// Enhanced markdown parser with hyperlink support
// Supports: **bold**, *italic*, ~~strike~~, `code`, [text](url)
function parseMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Added link pattern: \[([^\]]+)\]\(([^)]+)\)
  // Groups: [1]=bold [2]=italic* [3]=italic_ [4]=strike [5]=code [6]=link text [7]=link url
  const regex = /\*\*(.*?)\*\*|\*(.*?)\*|_(.*?)_|~~(.*?)~~|`(.*?)`|\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const key = match.index

    if (match[1] !== undefined) {
      nodes.push(<strong key={key}>{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      nodes.push(<em key={key}>{match[2]}</em>)
    } else if (match[3] !== undefined) {
      nodes.push(<em key={key}>{match[3]}</em>)
    } else if (match[4] !== undefined) {
      nodes.push(<s key={key}>{match[4]}</s>)
    } else if (match[5] !== undefined) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs font-mono text-gray-200"
        >
          {match[5]}
        </code>
      )
    } else if (match[6] !== undefined && match[7] !== undefined) {
      // Hyperlink: [text](url)
      nodes.push(
        <a
          key={key}
          href={sanitizeUrl(match[7])}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/50 hover:decoration-blue-300 transition"
        >
          {match[6]}
        </a>
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

// Parse line and detect if it's a heading
function parseLine(line: string, index: number) {
  if (line.startsWith('### ')) {
    return (
      <h3 key={index} className="text-xl font-semibold text-white mt-6 mb-3">
        {parseMarkdown(line.slice(4))}
      </h3>
    )
  }
  
  if (line.startsWith('## ')) {
    return (
      <h2 key={index} className="text-2xl font-bold text-white mt-8 mb-4">
        {parseMarkdown(line.slice(3))}
      </h2>
    )
  }
  
  if (line.startsWith('# ')) {
    return (
      <h1 key={index} className="text-3xl font-bold text-white mt-8 mb-4">
        {parseMarkdown(line.slice(2))}
      </h1>
    )
  }

  // Check for unordered list (- item)
  if (line.startsWith('- ')) {
    return (
      <li key={index} className="text-gray-300 leading-relaxed ml-4">
        {parseMarkdown(line.slice(2))}
      </li>
    )
  }

  // Check for ordered list (1. item)
  if (/^\d+\.\s/.test(line)) {
    const content = line.replace(/^\d+\.\s/, '')
    return (
      <li key={index} className="text-gray-300 leading-relaxed ml-4">
        {parseMarkdown(content)}
      </li>
    )
  }

  if (line.trim() === '') {
    return <div key={index} className="h-2" />
  }

  // Regular paragraph
  return (
    <p key={index} className="text-gray-300 leading-relaxed mb-3">
      {parseMarkdown(line)}
    </p>
  )
}

export default function TextBlock({ block }: Props) {
  const text = block.content.text || ''

  if (!text) {
    return null
  }

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let inList = false
  let listItems: React.ReactNode[] = []
  let isOrderedList = false

  lines.forEach((line, index) => {
    const isListItem = line.startsWith('- ') || /^\d+\.\s/.test(line)
    const currentIsOrdered = /^\d+\.\s/.test(line)

    // If we're in a list and this isn't a list item, close the list
    if (inList && !isListItem) {
      elements.push(
        isOrderedList ? (
          <ol key={`list-${index}`} className="list-decimal list-inside space-y-1 mb-4">
            {listItems}
          </ol>
        ) : (
          <ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">
            {listItems}
          </ul>
        )
      )
      listItems = []
      inList = false
    }

    if (isListItem) {
      if (!inList) {
        inList = true
        isOrderedList = currentIsOrdered
      }
      listItems.push(parseLine(line, index))
    } else {
      // Regular line (heading, paragraph, etc.)
      elements.push(parseLine(line, index))
    }
  })

  // Close any remaining list
  if (inList && listItems.length > 0) {
    elements.push(
      isOrderedList ? (
        <ol key="list-final" className="list-decimal list-inside space-y-1 mb-4">
          {listItems}
        </ol>
      ) : (
        <ul key="list-final" className="list-disc list-inside space-y-1 mb-4">
          {listItems}
        </ul>
      )
    )
  }

  return <div className="prose prose-invert max-w-none">{elements}</div>
}

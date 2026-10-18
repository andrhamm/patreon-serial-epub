/**
 * Patreon serves post bodies as a ProseMirror document in
 * `content_json_string` (the older `content` HTML field is now null).
 * Node types seen so far: doc, paragraph, text, hardBreak,
 * with marks bold / italic / underline.
 */

const ESCAPE = /([\\`*_[\]#])/g

const escapeMd = (s) => s.replace(ESCAPE, '\\$1')

function inline(node) {
  if (node.type === 'hardBreak') return '  \n'
  if (node.type !== 'text') return (node.content ?? []).map(inline).join('')

  let text = escapeMd(node.text ?? '')
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') text = `**${text}**`
    else if (mark.type === 'italic') text = `*${text}*`
    else if (mark.type === 'underline') text = `<u>${text}</u>`
  }
  return text
}

function block(node) {
  switch (node.type) {
    case 'paragraph':
      return (node.content ?? []).map(inline).join('')
    case 'heading': {
      const level = node.attrs?.level ?? 2
      // The post title is the H1, so author headings nest one level below it.
      return `${'#'.repeat(Math.min(level + 1, 6))} ${(node.content ?? []).map(inline).join('')}`
    }
    case 'blockquote':
      return (node.content ?? [])
        .map(block)
        .join('\n\n')
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')
    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList'
      return (node.content ?? [])
        .map((li, i) => `${ordered ? `${i + 1}.` : '-'} ${(li.content ?? []).map(block).join(' ')}`)
        .join('\n')
    }
    case 'horizontalRule':
      return '---'
    case 'image':
      return node.attrs?.src ? `![](${node.attrs.src})` : ''
    default:
      return (node.content ?? []).map(block).join('\n\n')
  }
}

/** ProseMirror doc -> markdown. */
export function docToMarkdown(doc) {
  return (doc.content ?? [])
    .map(block)
    .join('\n\n')
    .replace(/[ \t]+$/gm, (m) => (m === '  ' ? m : '')) // keep hard-break spaces only
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

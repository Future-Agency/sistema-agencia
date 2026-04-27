'use client'
import { useEffect } from 'react'

type EmbedType = 'youtube' | 'vimeo' | 'drive' | 'mp4' | 'unknown'

function detectEmbed(url: string): { type: EmbedType; src: string } {
  if (!url) return { type: 'unknown', src: '' }
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/)
  if (yt) return { type: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1` }
  // Vimeo
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return { type: 'vimeo', src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1` }
  // Google Drive
  const gd = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || url.match(/drive\.google\.com\/open\?id=([\w-]+)/)
  if (gd) return { type: 'drive', src: `https://drive.google.com/file/d/${gd[1]}/preview` }
  // Direct video
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return { type: 'mp4', src: url }
  return { type: 'unknown', src: url }
}

type Props = {
  url: string
  titulo?: string
  onClose: () => void
}

export default function VideoPreview({ url, titulo, onClose }: Props) {
  const { type, src } = detectEmbed(url)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', width: '100%', maxWidth: type === 'mp4' || type === 'youtube' || type === 'vimeo' ? 900 : 720,
        background: 'var(--card)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden',
        maxHeight: '95vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titulo || 'Material'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {url && type === 'unknown' && (
              <a href={url} target="_blank" rel="noreferrer" className="fa-btn fa-btn-ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
                <i className="fas fa-external-link-alt" /> Abrir externo
              </a>
            )}
            <button onClick={onClose} className="fa-header-btn" title="Cerrar"><i className="fas fa-xmark" /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, background: '#000', minHeight: 300 }}>
          {type === 'mp4' && (
            <video src={src} controls autoPlay style={{ width: '100%', display: 'block', maxHeight: '80vh' }} />
          )}
          {(type === 'youtube' || type === 'vimeo') && (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe src={src} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
            </div>
          )}
          {type === 'drive' && (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe src={src} allow="autoplay; fullscreen" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
            </div>
          )}
          {type === 'unknown' && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card)' }}>
              <i className="fas fa-link" style={{ fontSize: 32, marginBottom: 12, color: 'var(--text-dim)' }} />
              <div style={{ fontSize: 13, marginBottom: 16 }}>No se puede previsualizar este formato dentro del portal.</div>
              <a href={url} target="_blank" rel="noreferrer" className="fa-btn fa-btn-primary" style={{ textDecoration: 'none' }}>
                <i className="fas fa-external-link-alt" /> Abrir material
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function GuionPreview({ titulo, texto, onClose }: { titulo?: string; texto: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', width: '100%', maxWidth: 720,
        background: 'var(--card)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-scroll" style={{ color: 'var(--brand-cyan)', fontSize: 16 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{titulo || 'Guion'}</div>
          </div>
          <button onClick={onClose} className="fa-header-btn" title="Cerrar"><i className="fas fa-xmark" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {texto}
          </div>
        </div>
      </div>
    </div>
  )
}

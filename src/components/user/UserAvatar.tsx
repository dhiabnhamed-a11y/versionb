import Image from 'next/image'

type UserAvatarProps = {
  name?: string | null
  avatar?: string | null
  size?: number
  radius?: number
  className?: string
}

function initialsFor(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0]?.slice(0, 2) || '?').toUpperCase()
}

export default function UserAvatar({ name, avatar, size = 36, radius = 10, className }: UserAvatarProps) {
  const style = {
    width: size,
    height: size,
    borderRadius: radius,
  }

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[var(--accent)] text-xs font-bold text-white ${className ?? ''}`}
      style={style}
      aria-label={name ? `${name} avatar` : 'User avatar'}
    >
      {avatar ? (
        <Image
          src={avatar}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span>{initialsFor(name)}</span>
      )}
    </div>
  )
}

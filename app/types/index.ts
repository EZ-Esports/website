export interface Image {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface SocialLink {
  platform: 'discord' | 'instagram' | 'twitter' | 'facebook' | 'youtube' | 'twitch' | 'messenger';
  url: string;
  label: string;
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface School {
  id: string;
  name: string;
  logoUrl: string;
}

export interface Game {
  id: string;
  title: string;
  imageUrl: string;
}

export interface VideoItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
}



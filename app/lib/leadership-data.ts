// app/lib/leadership-data.ts

import type { Leader } from '@/app/types';

export const leadershipByYear: Record<string, Leader[]> = {
    '2023': [
      {
        name: 'John Doe',
        role: 'President',
        bio: 'Leading the organization with vision and dedication.',
        // image: '/images/leadership/2023/john-doe.jpg',
      },
      {
        name: 'Jane Smith',
        role: 'Vice President',
        bio: 'Driving innovation and strategic growth.',
        // image: '/images/leadership/2023/jane-smith.jpg',
      },
      {
        name: 'Bob Johnson',
        role: 'Secretary',
        bio: 'Ensuring organizational excellence and communication.',
        // image: '/images/leadership/2023/bob-johnson.jpg',
      },
    ],
    '2024': [
      {
        name: 'Jane Smith',
        role: 'President',
        bio: 'Continuing our mission with renewed energy.',
        // image: '/images/leadership/2024/jane-smith.jpg',
      },
      {
        name: 'Alice Williams',
        role: 'Vice President',
        bio: 'Championing member engagement and community building.',
        // image: '/images/leadership/2024/alice-williams.jpg',
      },
      {
        name: 'Charlie Brown',
        role: 'Secretary',
        bio: 'Managing operations and member relations.',
        // image: '/images/leadership/2024/charlie-brown.jpg',
      },
    ],
    '2025': [
      {
        name: 'Alice Williams',
        role: 'President',
        bio: 'Leading us into an exciting new chapter.',
        // image: '/images/leadership/2025/alice-williams.jpg',
      },
      {
        name: 'David Lee',
        role: 'Vice President',
        bio: 'Fostering partnerships and expanding our reach.',
        // image: '/images/leadership/2025/david-lee.jpg',
      },
      {
        name: 'Emma Davis',
        role: 'Secretary',
        bio: 'Streamlining processes and enhancing efficiency.',
        // image: '/images/leadership/2025/emma-davis.jpg',
      },
    ],
  };
  
  // Helper function to get available years
  export const getAvailableYears = () => Object.keys(leadershipByYear).sort().reverse();
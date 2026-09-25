const siteConfig = {
  siteName: "UTSA Cyber Jedis",
  siteTagline: "Innovation & Collaboration",
  copyrightYear: "2026",
  copyrightOwner: "The UTSA Cyber Jedis",

  socialLinks: {
    rowdylink: "https://rowdylink.utsa.edu/organization/cyberjedis",
    discord: "https://discord.gg/B5vuHqQBFe",
    twitch: "https://twitch.tv/UTSACyberJedis",
    youtube: "https://youtube.com/@UTSACyberJedis",
    instagram: "https://instagram.com/utsacyberjedis",
    linkedin: "https://linkedin.com/company/cyberjedis"
  },

  socialMeta: {
    rowdylink: { label: "RowdyLink", icon: "link", color: "#f15a29" },
    discord: { label: "Discord", icon: "chat", color: "#5865F2" },
    twitch: { label: "Twitch", icon: "tv", color: "#9146FF" },
    youtube: { label: "YouTube", icon: "play", color: "#FF0000" },
    instagram: { label: "Instagram", icon: "camera", color: "#E4405F" },
    linkedin: { label: "LinkedIn", icon: "case", color: "#0A66C2" }
  },

  contact: {
    defaultLocation: "NPB 1.226",
    defaultMeetingTime: "6:00 PM",
    meetingDay: "Friday"
  },

  theme: {
    chrome: "#c0c0c0",
    ink: "#000000",
    paper: "#ffffff",
    accents: ["#ffbe0b", "#fb5607", "#ff006e", "#8338ec", "#3a86ff"]
  },

  particles: {
    count: 48,
    trailFadeSpeed: 0.15,
    mouseRadius: 200,
    driftSpeed: 0.02
  }
};

if (typeof window !== "undefined") window.siteConfig = siteConfig;

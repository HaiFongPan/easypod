// Test RSS feed fixtures for various formats and standards

export const basicRssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Podcast</title>
    <description>A test podcast for unit testing</description>
    <link>https://example.com</link>
    <language>en-us</language>
    <copyright>© 2024 Test Podcast</copyright>
    <lastBuildDate>Mon, 01 Jan 2024 12:00:00 GMT</lastBuildDate>
    <image>
      <url>https://example.com/cover.jpg</url>
      <title>Test Podcast</title>
      <link>https://example.com</link>
    </image>

    <item>
      <title>Episode 1: Introduction</title>
      <description>Welcome to our test podcast</description>
      <link>https://example.com/episode1</link>
      <guid>episode-1</guid>
      <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
      <enclosure url="https://example.com/episode1.mp3" length="12345678" type="audio/mpeg"/>
    </item>

    <item>
      <title>Episode 2: Getting Started</title>
      <description>How to get started with podcasting</description>
      <link>https://example.com/episode2</link>
      <guid>episode-2</guid>
      <pubDate>Sun, 31 Dec 2023 10:00:00 GMT</pubDate>
      <enclosure url="https://example.com/episode2.mp3" length="23456789" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

export const itunesExtendedFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>iTunes Enhanced Podcast</title>
    <description>A podcast with iTunes extensions</description>
    <link>https://example.com</link>
    <language>en-us</language>
    <itunes:author>John Doe</itunes:author>
    <itunes:summary>This is a comprehensive podcast summary with iTunes extensions</itunes:summary>
    <itunes:category text="Technology"/>
    <itunes:image href="https://example.com/itunes-cover.jpg"/>
    <itunes:explicit>false</itunes:explicit>

    <item>
      <title>Tech Talk Episode 1</title>
      <description>Discussing the latest in technology</description>
      <link>https://example.com/tech1</link>
      <guid>tech-1</guid>
      <pubDate>Mon, 01 Jan 2024 15:00:00 GMT</pubDate>
      <enclosure url="https://example.com/tech1.mp3" length="45678901" type="audio/mpeg"/>
      <itunes:duration>01:15:30</itunes:duration>
      <itunes:image href="https://example.com/tech1-cover.jpg"/>
      <itunes:summary>In-depth discussion about AI and machine learning</itunes:summary>
      <itunes:season>1</itunes:season>
      <itunes:episode>1</itunes:episode>
      <itunes:keywords>AI, technology, machine learning, innovation</itunes:keywords>
      <itunes:explicit>false</itunes:explicit>
    </item>
  </channel>
</rss>`;

export const podcast20Feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Podcast 2.0 Enhanced Show</title>
    <description>A modern podcast using Podcast 2.0 features</description>
    <link>https://example.com</link>
    <language>en-us</language>
    <itunes:author>Jane Smith</itunes:author>
    <itunes:image href="https://example.com/podcast20-cover.jpg"/>
    <podcast:funding url="https://example.com/support">Support the show!</podcast:funding>

    <item>
      <title>Modern Podcasting with Chapters</title>
      <description>
        Welcome to our show! Here are the timestamps:

        00:00 Introduction
        05:30 Main topic discussion
        25:15 Q&amp;A session
        45:00 Conclusion and credits
      </description>
      <link>https://example.com/modern1</link>
      <guid>modern-1</guid>
      <pubDate>Mon, 01 Jan 2024 18:00:00 GMT</pubDate>
      <enclosure url="https://example.com/modern1.mp3" length="67890123" type="audio/mpeg"/>
      <itunes:duration>50:00</itunes:duration>
      <podcast:chapters url="https://example.com/modern1-chapters.json" type="application/json"/>
      <podcast:transcript url="https://example.com/modern1-transcript.vtt" type="text/vtt"/>
      <podcast:person role="host" img="https://example.com/jane.jpg">Jane Smith</podcast:person>
      <podcast:person role="guest" img="https://example.com/guest1.jpg">Alex Johnson</podcast:person>
      <podcast:funding url="https://example.com/episode-support">Episode-specific funding</podcast:funding>
    </item>
  </channel>
</rss>`;

export const chaptersJson = {
  version: "1.2.0",
  author: "Jane Smith",
  title: "Modern Podcasting with Chapters",
  podcastName: "Podcast 2.0 Enhanced Show",
  chapters: [
    {
      startTime: 0,
      title: "Introduction",
      img: "https://example.com/intro.jpg",
      url: "https://example.com/intro-notes"
    },
    {
      startTime: 330,
      title: "Main topic discussion",
      img: "https://example.com/main.jpg",
      url: "https://example.com/main-notes"
    },
    {
      startTime: 1515,
      title: "Q&A session",
      img: "https://example.com/qa.jpg"
    },
    {
      startTime: 2700,
      title: "Conclusion and credits",
      img: "https://example.com/credits.jpg"
    }
  ]
};

export const invalidRssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Invalid Feed</title>
    <!-- Missing required description -->
    <link>not-a-valid-url</link>

    <item>
      <title>Episode without audio</title>
      <description>This episode has no enclosure</description>
      <guid>no-audio</guid>
    </item>

    <item>
      <!-- Missing title and GUID -->
      <description>Episode without title</description>
      <enclosure url="https://example.com/no-title.mp3" length="12345" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

export const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Malformed Feed</title>
    <description>This XML has syntax errors</description>
    <item>
      <title>Unclosed tag
      <description>Missing closing title tag</description>
    </item>
  </channel>
</rss>`;
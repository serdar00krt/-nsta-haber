const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files from 'public' first, then root folder (fallback if uploaded directly to root)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Explicit route handler for root to prevent 'Cannot GET /' if path mapping behaves unexpectedly
app.get('/', (req, res) => {
  const fs = require('fs');
  const publicPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicPath)) {
    return res.sendFile(publicPath);
  }
  
  const rootPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(rootPath)) {
    return res.sendFile(rootPath);
  }
  
  res.status(404).send('Hata: index.html dosyası bulunamadı. Lütfen dosyalarınızı doğru yüklediğinizden emin olun.');
});

// Helper: Get local IP addresses of the machine
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

// Scraper Endpoint: Fetches news headlines from batmansonsoz.net
app.get('/api/headlines', async (req, res) => {
  try {
    const targetUrl = 'https://www.batmansonsoz.net';
    
    // Fetch HTML with Multi-Proxy Fallback (Bypasses 403 blocks on cloud hosts like Render)
    let html = '';
    let fetched = false;
    
    // Attempt 1: Direct Fetch
    try {
      console.log('Attempting direct fetch...');
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'tr,en-US;q=0.7,en;q=0.3'
        },
        timeout: 4000
      });
      html = response.data;
      fetched = true;
      console.log('Direct fetch successful!');
    } catch (err) {
      console.log(`Direct fetch failed (${err.message}). Trying Allorigins...`);
    }

    // Attempt 2: Allorigins Proxy
    if (!fetched) {
      try {
        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(targetUrl);
        console.log('Fetching via proxy:', proxyUrl);
        const response = await axios.get(proxyUrl, { timeout: 6000 });
        if (response.data && response.data.contents) {
          html = response.data.contents;
          fetched = true;
          console.log('Allorigins proxy fetch successful!');
        }
      } catch (err) {
        console.log(`Allorigins proxy failed: ${err.message}. Trying Corsproxy.io...`);
      }
    }

    // Attempt 3: Corsproxy.io
    if (!fetched) {
      try {
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
        console.log('Fetching via proxy:', proxyUrl);
        const response = await axios.get(proxyUrl, { timeout: 6000 });
        html = response.data;
        fetched = true;
        console.log('Corsproxy.io proxy fetch successful!');
      } catch (err) {
        console.log(`Corsproxy.io proxy failed: ${err.message}. Trying Codetabs...`);
      }
    }

    // Attempt 4: Codetabs Proxy
    if (!fetched) {
      try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(targetUrl);
        console.log('Fetching via proxy:', proxyUrl);
        const response = await axios.get(proxyUrl, { timeout: 6000 });
        html = response.data;
        fetched = true;
        console.log('Codetabs proxy fetch successful!');
      } catch (err) {
        console.log(`Codetabs proxy failed: ${err.message}`);
      }
    }

    if (!fetched) {
      throw new Error('Haber sitesine doğrudan veya vekil sunucular (proxy) üzerinden bağlanılamadı. Lütfen daha sonra tekrar deneyin.');
    }

    const $ = cheerio.load(html);
    const headlines = [];
    const seenLinks = new Set();

    // Scan for img elements whose src or data-src contains /news/headline/
    // This is the slider where the main 15 headlines reside.
    $('img').each((index, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src') || '';
      
      if (src.includes('/news/headline/')) {
        // Find parent link tag <a>
        const parentLink = $(el).closest('a');
        let href = parentLink.attr('href') || '';
        
        if (!href) {
          // Check sibling or nearby links if not directly wrapped
          const slide = $(el).closest('.swiper-slide');
          if (slide.length) {
            href = slide.find('a').first().attr('href') || '';
          }
        }
        
        if (!href || href === 'javascript:void(0)') return;
        
        // Make URL absolute
        if (href.startsWith('/')) {
          href = targetUrl + href;
        }
        
        // Prevent duplicate entries
        if (seenLinks.has(href)) return;
        
        // Find title. Order of preference:
        // 1. Heading tag (h3, h5, etc.) in the same swiper-slide
        // 2. Link title attribute
        // 3. Img alt attribute
        let title = '';
        const slide = $(el).closest('.swiper-slide');
        if (slide.length) {
          const heading = slide.find('h1, h2, h3, h4, h5, h6');
          if (heading.length) {
            title = heading.text().trim();
          }
        }
        
        if (!title) {
          title = parentLink.attr('title') || '';
        }
        if (!title) {
          title = $(el).attr('alt') || '';
        }
        
        // Clean title
        title = title.replace(/\s+/g, ' ').trim();
        
        // Clean HTML Entities if any
        title = cheerio.load(`<div id="t">${title}</div>`)('#t').text();

        let fullImgUrl = src;
        if (src.startsWith('/')) {
          fullImgUrl = targetUrl + src;
        }

        if (title && href && fullImgUrl) {
          seenLinks.add(href);
          headlines.push({
            title,
            link: href,
            image: fullImgUrl
          });
        }
      }
    });

    // Fallback: If we couldn't parse headlines (for example, if class structure changed),
    // let's grab the first 15 links under /haber/ with images.
    if (headlines.length === 0) {
      $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        if (href.includes('/haber/') && !href.includes('/haberler/')) {
          const img = $(el).find('img').first();
          if (img.length) {
            const src = img.attr('data-src') || img.attr('src') || '';
            let fullHref = href.startsWith('/') ? targetUrl + href : href;
            let fullImg = src.startsWith('/') ? targetUrl + src : src;
            let title = $(el).attr('title') || img.attr('alt') || $(el).text().trim();
            
            if (fullHref && fullImg && title && !seenLinks.has(fullHref)) {
              seenLinks.add(fullHref);
              headlines.push({
                title: title.replace(/\s+/g, ' ').trim(),
                link: fullHref,
                image: fullImg
              });
            }
          }
        }
      });
    }

    // Slice to top 15 latest headlines
    const result = headlines.slice(0, 15);
    res.json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('Error fetching headlines:', error.message);
    res.status(500).json({ success: false, error: 'Haberler çekilemedi: ' + error.message });
  }
});

// Image Proxy Endpoint: Pipes external images with CORS headers
// This is critical to avoid Canvas security warnings when generating story cards on iOS Safari
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    // Copy Content-Type header from target image
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    response.data.pipe(res);
  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.status(500).send('Image could not be loaded: ' + error.message);
  }
});

// Local database matching Turkish/local figures in news to verified Instagram accounts
const LOCAL_INSTAGRAM_MAP = {
  // Local politicians / officials
  'ekrem canalp': 'ekremcanalp',      // Governor of Batman
  'gulistan sonuk': 'gulistansonuk',    // Mayor of Batman
  'gülistan sönük': 'gulistansonuk',
  'serkan ramanli': 'serkanramanli',    // Batman Deputy
  'serkan ramanlı': 'serkanramanli',
  'zeynep oduncu': 'zeynepoduncu72',    // Batman Deputy
  'ahmet baran': 'ahmetbaran',
  
  // National figures
  'mehmet simsek': 'memetsimsek_official',
  'mehmet şimşek': 'memetsimsek_official',
  'ekrem imamoglu': 'ekremimamoglu',
  'ekrem imamoğlu': 'ekremimamoglu',
  'selahattin demirtas': 'selahattindemirtas',
  'selahattin demirtaş': 'selahattindemirtas',
  'recep tayyip erdogan': 'rterdogan',
  'recep tayyip erdoğan': 'rterdogan',
  'ozgur ozel': 'ozguropel',
  'özgür özel': 'ozguropel',
  'mansur yavas': 'mansuryavas',
  'mansur yavaş': 'mansuryavas',

  // Batman Petrolspor
  'omurcan artan': 'omurcanartan',
  'ömürcan artan': 'omurcanartan',
  'mansur obut': 'mansurobut',

  // Batman Sonsöz / Local Journalists
  'hatice turkan': 'haticeturkan',
  'hatice türkan': 'haticeturkan',
  'ercan atay': 'ercanatay',
  'mehmet celik': 'mehmetcelik_72',
  'mehmet çelik': 'mehmetcelik_72',
  'mustafa arslan': 'mustafaarslan72',

  // Political Parties
  'ak parti': 'akparti',
  'akparti': 'akparti',
  'chp': 'chp',
  'dem parti': 'demparti',
  'demparti': 'demparti',
  'huda par': 'hudapar',
  'hudapar': 'hudapar',
  'mhp': 'mhp',
  'yeniden refah': 'yenidenrefahpartisi',
  'saadet partisi': 'saadetpartisi',
  'iyi parti': 'iyiparti',
  'deva partisi': 'devapartisi',
  'gelecek partisi': 'gelecekpartisi',

  // Venues / Places / Places of interest in Batman
  'zez lounge': 'zezlounge',
  'batman park': 'batmanparkavm',
  'real konak': 'realkonak',
  'petrol city': 'petrolcityavm',
  'petrolcity': 'petrolcityavm'
};

// Helper: Normalize string by stripping Turkish accents and special chars
function normalizeString(str) {
  return str.toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Helper: Clean and filter raw extracted capitalized words
function cleanAndFilterNames(namesArray) {
  const stopWords = new Set([
    'batman', 'batmana', 'batmanin', 'batmandaki', 'batmanli', 'turkiye', 'turkiyenin', 'ankara',
    'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar',
    'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik',
    'haber', 'haberler', 'sondakika', 'gazetesi', 'sozcu', 'valilik', 'valiligi', 'belediye', 'belediyesi',
    'emniyet', 'dolar', 'lira', 'faiz', 'merkez', 'bankasi', 'avrupa', 'amerikan', 'yuksek', 'yayin', 'yonetim', 'kurulu'
  ]);
  
  const entityKeywords = [
    'mahallesi', 'mah.', 'caddesi', 'sokak', 'bulvarı', 'müdürlüğü', 'müdürü', 'ekipleri',
    'kurumu', 'bakanlığı', 'derneği', 'cemiyeti', 'odası', 'vakfı', 'partisi', 'sendikası',
    'kulübü', 'federasyonu', 'valiliği', 'belediyesi', 'komisyonu', 'şubesi', 'şube',
    'grubu', 'grup', 'projesi', 'okulu', 'okulları', 'lisesi', 'üniversitesi', 'hastanesi',
    'merkezi', 'sınavı', 'adayları', 'başkanlığı', 'müdürlüğünce', 'gazeteciler', 'gazetecilik',
    'basın', 'medya', 'ticaret', 'sanayi', 'esnaf', 'kamu', 'kuruluşları', 'kooperatifi',
    'adliye', 'sarayı', 'tso', 'vakıf', 'dernek', 'hizmetleri', 'emlak', 'müdür',
    // City & Region keywords to filter corporate/regional entities
    'mardin', 'gaziantep', 'siirt', 'kilis', 'sirnak', 'mus', 'van', 'diyarbakir', 'urfa', 'sanliurfa',
    'elazig', 'adana', 'istanbul', 'ankara', 'izmir', 'anadolu', 'guneydogu', 'yerel', 'birlik',
    'federasyon', 'komite', 'ziyaret', 'ziyarete', 'toplantı', 'toplantıya', 'karar', 'genel',
    'petrolspor', 'ajans', 'gazete', 'medya', 'özel'
  ];

  const prefixes = [
    'federasyon başkanı', 'dernek başkanı', 'genel kurul üyesi', 'başkan yardımcısı',
    'başkan vekili', 'başkan adayı', 'genel başkanı', 'genel sekreteri', 'milletvekili',
    'başkanı', 'başkan', 'müdürü', 'müdür', 'bakanı', 'bakan', 'valisi', 'vali', 'vekili', 'vekil'
  ];

  return namesArray
    .map(name => {
      // Strip prefix titles
      let cleanName = name.trim();
      const lowerClean = cleanName.toLowerCase();
      
      for (const prefix of prefixes) {
        if (lowerClean.startsWith(prefix + ' ')) {
          cleanName = cleanName.substring(prefix.length + 1).trim();
          break;
        }
      }
      return cleanName;
    })
    .filter(name => {
      const lowerName = name.toLowerCase();
      const norm = normalizeString(name);
      
      // Exception: If this entity is in our verified database, ALWAYS keep it!
      if (LOCAL_INSTAGRAM_MAP.hasOwnProperty(norm)) return true;

      // Check if name has at least 2 words and is not too long
      const parts = name.split(/\s+/);
      if (parts.length < 2 || parts.length > 4) return false;
      
      // Check if any part is a stopword
      if (parts.some(part => stopWords.has(normalizeString(part)))) return false;
      
      // Check if the name contains any entity keywords
      const containsEntityKeyword = entityKeywords.some(keyword => lowerName.includes(keyword));
      if (containsEntityKeyword) return false;
      
      // Ensure all parts start with capital letter in Turkish
      const allCapitalized = parts.every(part => {
        if (part.length === 0) return false;
        const firstChar = part[0];
        return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
      });
      if (!allCapitalized) return false;
      
      return true;
    });
}

// Helper: Convert name to guessed Instagram handle slug
function generateGuessHandle(name) {
  const normalized = normalizeString(name).replace(/\s+/g, '');
  return `@${normalized}`;
}

// Helper: Convert string to Turkish Title Case
function toTitleCase(str) {
  return str.toLowerCase().split(/\s+/).map(word => {
    if (word.length === 0) return '';
    let firstChar = word[0];
    if (firstChar === 'i') firstChar = 'İ';
    else if (firstChar === 'ı') firstChar = 'I';
    else firstChar = firstChar.toUpperCase();
    return firstChar + word.slice(1);
  }).join(' ');
}

// Helper: Scan article text for specific well-known figures, parties, and places
function scanHeuristicNames(articleText, namesSet) {
  const normText = normalizeString(articleText);
  
  const heuristics = [
    // People
    { key: 'canalp', name: 'Ekrem Canalp' },
    { key: 'ramanli', name: 'Serkan Ramanlı' },
    { key: 'ramanlı', name: 'Serkan Ramanlı' },
    { key: 'oduncu', name: 'Zeynep Oduncu' },
    { key: 'simsek', name: 'Mehmet Şimşek' },
    { key: 'şimşek', name: 'Mehmet Şimşek' },
    { key: 'imamoglu', name: 'Ekrem İmamoğlu' },
    { key: 'imamoğlu', name: 'Ekrem İmamoğlu' },
    { key: 'demirtas', name: 'Selahattin Demirtaş' },
    { key: 'demirtaş', name: 'Selahattin Demirtaş' },
    { key: 'erdogan', name: 'Recep Tayyip Erdoğan' },
    { key: 'erdoğan', name: 'Recep Tayyip Erdoğan' },
    { key: 'sonuk', name: 'Gülistan Sönük' },
    { key: 'sönük', name: 'Gülistan Sönük' },
    
    // Parties
    { key: 'ak parti', name: 'AK Parti' },
    { key: 'akparti', name: 'AK Parti' },
    { key: 'dem parti', name: 'DEM Parti' },
    { key: 'demparti', name: 'DEM Parti' },
    { key: 'huda par', name: 'HÜDA PAR' },
    { key: 'hudapar', name: 'HÜDA PAR' },
    
    // Venues
    { key: 'zez lounge', name: 'Zez Lounge' },
    { key: 'batman park', name: 'Batman Park' },
    { key: 'real konak', name: 'Real Konak' },
    { key: 'petrol city', name: 'Petrol City' },
    { key: 'petrolcity', name: 'Petrol City' }
  ];

  heuristics.forEach(item => {
    if (normText.includes(item.key)) {
      namesSet.add(item.name);
    }
  });
}

// Endpoint to extract tags (people mentioned) from full news article text
app.get('/api/extract-tags', async (req, res) => {
  const articleUrl = req.query.url;
  if (!articleUrl) {
    return res.status(400).json({ success: false, error: 'URL parameter is required' });
  }

  console.log(`\n--- Tag Extraction Request received ---`);
  console.log(`Link: ${articleUrl}`);

  try {
    // Fetch full article HTML
    const articleRes = await axios.get(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(articleRes.data);

    // Extract clean article text content
    let articleText = '';
    const containers = ['.news-text', '.detail-content', '.article-text', '.entry-content', '.news-detail-content', 'article', '.content'];
    for (const container of containers) {
      const el = $(container);
      if (el.length > 0) {
        articleText = el.text().trim();
        break;
      }
    }

    if (!articleText) {
      const paragraphs = [];
      $('p').each((i, el) => {
        const txt = $(el).text().trim();
        if (txt.length > 30) {
          paragraphs.push(txt);
        }
      });
      articleText = paragraphs.join('\n');
    }

    const namesFound = new Set();

    // 1. Heuristic Scan (highest priority for well-known local/national figures)
    scanHeuristicNames(articleText, namesFound);

    // 2. Title Case Regex: e.g. "Ekrem Canalp"
    const titleCaseRegex = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)\b/g;
    let match;
    while ((match = titleCaseRegex.exec(articleText)) !== null) {
      namesFound.add(match[0].trim());
    }

    // 3. Uppercase Regex: e.g. "EKREM CANALP", "MEHMET ŞİMŞEK"
    const uppercaseRegex = /\b([A-ZÇĞİÖŞÜ]{2,})\s+([A-ZÇĞİÖŞÜ]{2,}(?:\s+[A-ZÇĞİÖŞÜ]{2,})?)\b/g;
    while ((match = uppercaseRegex.exec(articleText)) !== null) {
      // Convert to Title Case before adding
      namesFound.add(toTitleCase(match[0].trim()));
    }

    // 4. Clean, strip prefixes, and filter names
    const cleanedNames = cleanAndFilterNames(Array.from(namesFound));

    // Deduplicate array after cleaning prefixes
    const uniqueCleanedNames = Array.from(new Set(cleanedNames));

    // 5. Match with verified local database, and keep only verified accounts
    const tags = uniqueCleanedNames.map(name => {
      const norm = normalizeString(name);
      const isVerified = LOCAL_INSTAGRAM_MAP.hasOwnProperty(norm);
      const handle = isVerified ? `@${LOCAL_INSTAGRAM_MAP[norm]}` : null;
      
      return {
        name,
        handle,
        isVerified
      };
    }).filter(t => t.isVerified);

    console.log(`Extraction successful. Extracted ${tags.length} tags:`);
    tags.forEach(t => console.log(`  - ${t.name} -> ${t.handle} (${t.isVerified ? 'Verified' : 'Guess'})`));
    console.log(`--------------------------------------\n`);

    res.json({ success: true, count: tags.length, data: tags });
  } catch (error) {
    console.error('Error extracting tags:', error.message);
    res.status(500).json({ success: false, error: 'Etiketler çıkartılamadı: ' + error.message });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 Batman Sonsöz Instagram Paylaşım Yardımcısı Başladı!`);
  console.log(`💻 Bilgisayarınızdan erişim: http://localhost:${PORT}`);
  
  const ips = getLocalIPs();
  if (ips.length > 0) {
    console.log(`📱 iOS Cihazınızdan (iPhone/iPad) erişim için:`);
    ips.forEach(ip => {
      console.log(`   👉 http://${ip}:${PORT}`);
    });
    console.log('\n* Not: Telefonunuz ve bilgisayarınız aynı Wi-Fi ağına bağlı olmalıdır.');
  }
  console.log('====================================================');
});

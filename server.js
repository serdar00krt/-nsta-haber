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
app.use(express.static(path.join(__dirname, 'public')));

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
    
    // Fetch HTML
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr,en-US;q=0.7,en;q=0.3'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
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

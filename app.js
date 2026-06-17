// Global State
let newsItems = [];
const canvas = document.getElementById('story-canvas');
const ctx = canvas.getContext('2d');

// Device Detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (isIOS) {
  document.body.classList.add('is-ios');
}

// Set up connection info with current address
document.addEventListener('DOMContentLoaded', () => {
  const currentHost = window.location.host;
  const ipPlaceholder = document.getElementById('ip-placeholder');
  if (ipPlaceholder && currentHost) {
    ipPlaceholder.textContent = `http://${currentHost}`;
  }
  
  // Load news on start
  loadNews();
});

// Event Listeners
document.getElementById('btn-refresh').addEventListener('click', loadNews);
document.getElementById('btn-retry').addEventListener('click', loadNews);
document.getElementById('btn-close-modal').addEventListener('click', closeModal);
document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

// Fetch News from Backend Scraper API
async function loadNews() {
  const loader = document.getElementById('loader');
  const newsGrid = document.getElementById('news-grid');
  const errorView = document.getElementById('error-view');
  
  loader.classList.remove('d-none');
  newsGrid.classList.add('d-none');
  errorView.classList.add('d-none');
  
  try {
    const response = await fetch('/api/headlines');
    const result = await response.json();
    
    if (result.success && result.data.length > 0) {
      newsItems = result.data;
      renderNews(newsItems);
      
      loader.classList.add('d-none');
      newsGrid.classList.remove('d-none');
      showToast('<i class="fa-solid fa-circle-check"></i> Haberler başarıyla güncellendi!');
    } else {
      throw new Error(result.error || 'Haber bulunamadı');
    }
  } catch (err) {
    console.error(err);
    document.getElementById('error-message').textContent = err.message || 'Haberler çekilirken bağlantı hatası oluştu.';
    loader.classList.add('d-none');
    errorView.classList.remove('d-none');
  }
}

// Render news cards inside grid
function renderNews(items) {
  const grid = document.getElementById('news-grid');
  grid.innerHTML = '';
  
  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'news-card';
    
    // Format Caption text for Instagram copy
    const captionText = `📰 ${item.title}\n\n🔗 Haber detayları ve çok daha fazlası profilimizdeki linkte! Batman ve gündeme dair en güncel haberler için bizi takip edin.\n\n#batman #sondakika #haber #batmanhaberleri #batmansonsoz @batmansonsozgazetesi`;
    
    card.innerHTML = `
      <div class="news-img-container">
        <img src="${item.image}" alt="${item.title}" loading="lazy">
        <span class="news-badge">Haber ${index + 1}</span>
      </div>
      <div class="news-content">
        <h4 class="news-title" title="${item.title}">${item.title}</h4>
        
        <div class="news-actions">
          <button class="btn-action btn-action-story" onclick="openStoryModal(${index})">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Story Kartı
          </button>
          <a class="btn-action btn-action-img" href="/api/proxy-image?url=${encodeURIComponent(item.image)}" download="batmansonsoz_haber_${index+1}.webp" target="_blank">
            <i class="fa-solid fa-download"></i> Resmi İndir
          </a>
          <button class="btn-action btn-action-text" onclick="copyCaption('${encodeURIComponent(captionText)}')">
            <i class="fa-solid fa-copy"></i> Açıklama Kopyala
          </button>
          <button class="btn-action btn-action-link" onclick="copyLink('${item.link}')">
            <i class="fa-solid fa-link"></i> Link Kopyala
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Copy caption helper
function copyCaption(encodedText) {
  const text = decodeURIComponent(encodedText);
  copyToClipboard(text, 'Instagram gönderi açıklaması kopyalandı! Instagram\'da yapıştırabilirsiniz.');
}

// Copy link helper
function copyLink(link) {
  copyToClipboard(link, 'Haber detay linki kopyalandı! Instagram Story Link stickerına yapıştırabilirsiniz.');
}

// Copy to Clipboard Utility
function copyToClipboard(text, successMessage) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMessage))
      .catch(err => {
        console.error('Kopyalama hatası:', err);
        fallbackCopyText(text, successMessage);
      });
  } else {
    fallbackCopyText(text, successMessage);
  }
}

// Fallback copy for older/strict iOS webviews
function fallbackCopyText(text, successMessage) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, 99999); // iOS support
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast(successMessage);
    } else {
      showToast('Kopyalanamadı, lütfen manuel kopyalayın.');
    }
  } catch (err) {
    console.error('Fallback kopyalama hatası:', err);
    showToast('Kopyalama başarısız oldu.');
  }
  
  document.body.removeChild(textArea);
}

// Toast Notification
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  // Slide out and remove toast after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'toast-fade-in-up 0.35s reverse ease';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 2700);
}

// Open Story Creator Modal
function openStoryModal(index) {
  const item = newsItems[index];
  const modal = document.getElementById('story-modal');
  const previewImg = document.getElementById('story-image-preview');
  const loadingIndicator = document.querySelector('.canvas-loading');
  const downloadBtn = document.getElementById('btn-download-story');
  const shareBtn = document.getElementById('btn-share-story');
  const copyImageBtn = document.getElementById('btn-copy-image');
  
  // Show Modal & Loader
  modal.classList.remove('d-none');
  previewImg.classList.add('d-none');
  loadingIndicator.classList.remove('d-none');
  
  // Show/Hide native share button based on browser capability
  const canShareFiles = navigator.share && navigator.canShare;
  if (canShareFiles) {
    shareBtn.classList.remove('d-none');
  } else {
    shareBtn.classList.add('d-none');
  }
  
  // Load and Draw Image on Canvas via Scraper Proxy (CORS Bypass)
  const img = new Image();
  img.crossOrigin = 'anonymous'; // Enable CORS
  img.src = `/api/proxy-image?url=${encodeURIComponent(item.image)}`;
  
  img.onload = () => {
    try {
      generateStoryCanvas(img, item.title);
      
      // Convert canvas to base64 JPG
      const dataURL = canvas.toDataURL('image/jpeg', 0.92);
      
      // Update Preview Image
      previewImg.src = dataURL;
      previewImg.classList.remove('d-none');
      loadingIndicator.classList.add('d-none');
      
      // Set up download button behavior
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `batmansonsoz_story_${index + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Story görseli indirmesi başlatıldı!');
      };

      // Set up copy image to clipboard behavior (No gallery clutter!)
      copyImageBtn.onclick = () => {
        try {
          showToast('Görsel kopyalanıyor...');
          canvas.toBlob(async (blob) => {
            try {
              if (navigator.clipboard && window.ClipboardItem) {
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                showToast('Görsel panoya kopyalandı! Instagram hikayenize doğrudan yapıştırabilirsiniz.');
              } else {
                throw new Error('Clipboard API not fully supported');
              }
            } catch (err) {
              console.error('Panoya kopyalama başarısız:', err);
              showToast('Otomatik kopyalanamadı. Lütfen üstteki görsele BASILI TUTUP "Kopyala" deyin.');
            }
          }, 'image/png'); // PNG is standard for clipboard images
        } catch (e) {
          console.error(e);
          showToast('Lütfen üstteki görsele BASILI TUTUP "Kopyala" deyin.');
        }
      };
      
      // Set up native sharing button behavior (Instagram, WhatsApp, etc.)
      if (canShareFiles) {
        shareBtn.onclick = async () => {
          try {
            showToast('Paylaşım penceresi hazırlanıyor...');
            const resBlob = await fetch(dataURL);
            const blob = await resBlob.blob();
            const file = new File([blob], `batmansonsoz_story_${index + 1}.jpg`, { type: 'image/jpeg' });
            
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Batman Sonsöz Haber Kartı',
                text: 'Instagram Story Paylaşımı'
              });
              showToast('Paylaşım paneli açıldı!');
            } else {
              showToast('Bu cihaz dosya paylaşımını desteklemiyor.');
            }
          } catch (err) {
            console.error('Paylaşım hatası:', err);
            // Ignore AbortError when user cancels sharing
            if (err.name !== 'AbortError') {
              showToast('Paylaşılırken bir hata oluştu.');
            }
          }
        };
      }
    } catch (err) {
      console.error('Canvas generate error:', err);
      showToast('Görsel tasarlanırken bir hata oluştu.');
      closeModal();
    }
  };
  
  img.onerror = () => {
    showToast('Haber görseli yüklenemedi. Proxy hatası.');
    closeModal();
  };
}

// Generate Instagram Story Card on Canvas
function generateStoryCanvas(newsImg, title) {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 1. Draw Blurred Background ( spotify style depth )
  ctx.save();
  // We draw the news image scaled up to cover the canvas
  const scale = Math.max(canvas.width / newsImg.width, canvas.height / newsImg.height);
  const x = (canvas.width / 2) - (newsImg.width / 2) * scale;
  const y = (canvas.height / 2) - (newsImg.height / 2) * scale;
  
  ctx.drawImage(newsImg, x, y, newsImg.width * scale, newsImg.height * scale);
  ctx.restore();
  
  // Draw semi-transparent dark overlay to ensure readability & blur effect fallback
  ctx.fillStyle = 'rgba(10, 11, 16, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 2. Brand Header (Top Area)
  ctx.fillStyle = '#E30000'; // Batman Sonsöz Brand Red
  ctx.fillRect(80, 100, 16, 45); // Vertical Accent bar
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.fillText('BATMAN SONSÖZ', 115, 134);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '500 24px "Outfit", sans-serif';
  ctx.fillText('GÜNLÜK MANŞET HABER', 115, 172);

  // 3. Draw Main News Image (Centered Card)
  const margin = 80;
  const imgW = canvas.width - (margin * 2); // 920px
  const imgH = imgW * (9 / 16); // 517.5px (standard 16:9 aspect ratio)
  const imgX = margin;
  const imgY = 280;
  const imgRadius = 24;
  
  // Draw news image with rounded corners
  ctx.save();
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, imgRadius);
  ctx.clip();
  ctx.drawImage(newsImg, imgX, imgY, imgW, imgH);
  ctx.restore();
  
  // Subtle border around news image
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, imgRadius);
  ctx.stroke();

  // 4. Draw Glassmorphism Title Card (Bottom Area)
  const cardX = margin;
  const cardY = 920; // Moved down from 880 to increase gap from main image slightly
  const cardW = canvas.width - (margin * 2); // 920px
  const cardH = 520; // Reduced from 680
  const cardRadius = 32;
  
  // Card base fill (Dark premium glass overlay)
  ctx.fillStyle = 'rgba(18, 20, 32, 0.9)';
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  // Add premium shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 15;
  ctx.fill();
  ctx.restore();
  
  // Card border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();
  ctx.restore();
  
  // Badge inside card: "SON DAKİKA" or "ÖNE ÇIKAN"
  const badgeX = cardX + 50;
  const badgeY = cardY + 50; // Tighter vertical padding
  const badgeW = 180;
  const badgeH = 50;
  
  ctx.fillStyle = 'rgba(227, 0, 0, 0.15)'; // Semi-transparent brand red
  ctx.save();
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fill();
  ctx.restore();
  
  ctx.strokeStyle = '#E30000'; // Brand red
  ctx.lineWidth = 1.5;
  ctx.save();
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.stroke();
  ctx.restore();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YENİ HABER 🚨', badgeX + (badgeW / 2), badgeY + 33);
  ctx.textAlign = 'left'; // Reset alignment
  
  // News Title text wrap & draw
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px "Outfit", sans-serif'; // Readable size
  const textX = cardX + 50;
  const textY = cardY + 160; // Positioned perfectly below badge
  const maxTextW = cardW - 100;
  const lineHeight = 52;
  
  wrapText(ctx, title, textX, textY, maxTextW, lineHeight);

  // 5. Draw Call To Action Button Placeholder (For Instagram Link Sticker)
  const ctaW = 500;
  const ctaH = 80;
  const ctaX = cardX + (cardW / 2) - (ctaW / 2); // Center horizontally inside card
  const ctaY = cardY + 380; // Moved up significantly to close the blank gap
  
  // CTA Fill: Translucent background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.save();
  drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 40); // 40px radius makes it a perfect capsule
  ctx.fill();
  ctx.restore();
  
  // Dashed border for sticker placement guide
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.save();
  ctx.setLineDash([8, 6]); // Set dash pattern
  drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 40);
  ctx.stroke();
  ctx.restore();
  
  // CTA Text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '500 22px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔗 Link Çıkartmasını Buraya Koyun', ctaX + (ctaW / 2), ctaY + 48);
  ctx.textAlign = 'left'; // Reset
  ctx.setLineDash([]); // Reset line dash for other drawings
  
  // 6. Draw Footer Branding
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '500 20px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('batmansonsoz.net', canvas.width / 2, 1780);
}

// Helper: Wrap text inside canvas context
function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  let linesCount = 0;
  
  for (let n = 0; n < words.length; n++) {
    // If we've reached 5 lines, cut and add ellipsis
    if (linesCount >= 4) {
      context.fillText(line.trim() + '...', x, currentY);
      return;
    }
    
    let testLine = line + words[n] + ' ';
    let metrics = context.measureText(testLine);
    let testWidth = metrics.width;
    
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
      linesCount++;
    } else {
      line = testLine;
    }
  }
  context.fillText(line.trim(), x, currentY);
}

// Helper: Draw rounded rectangle path
function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

// Close Modal helper
function closeModal() {
  document.getElementById('story-modal').classList.add('d-none');
}

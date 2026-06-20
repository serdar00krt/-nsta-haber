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
          <button class="btn-action btn-action-story" style="grid-column: span 2;" onclick="openStoryModal(${index})">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Story Kartı
          </button>
          <button class="btn-action btn-action-img" onclick="downloadMainImage(event, ${index})">
            <i class="fa-solid fa-download"></i> Resmi İndir
          </button>
          <button class="btn-action btn-action-tags" onclick="copyTagsFromCard(event, ${index})">
            <i class="fa-brands fa-instagram"></i> Etiketleri Kopyala
          </button>
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

// Copy tags directly from a news card
async function copyTagsFromCard(event, index) {
  if (event) event.preventDefault();
  const item = newsItems[index];
  if (!item) return;

  // Find the button to show a loading state
  const btn = event.currentTarget || event.target;
  const originalHtml = btn.innerHTML;
  
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
  btn.disabled = true;

  try {
    const response = await fetch(`/api/extract-tags?url=${encodeURIComponent(item.link)}`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      const selectedHandles = result.data
        .filter(tag => tag.isVerified && tag.handle)
        .map(tag => {
          let handle = tag.handle.trim();
          if (!handle.startsWith('@')) {
            handle = '@' + handle;
          }
          return handle;
        });

      if (selectedHandles.length > 0) {
        const tagsText = selectedHandles.join(' ');
        copyToClipboard(tagsText, `Etiketler kopyalandı: ${tagsText}`);
      } else {
        showToast('Haberde kayıtlı/onaylı instagram hesabı bulunamadı.');
      }
    } else {
      showToast('Haberde etiketlenecek onaylı hesap bulunamadı.');
    }
  } catch (err) {
    console.error('Etiket kopyalama hatası:', err);
    showToast('Etiketler alınırken bir hata oluştu.');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
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

// Share or Download Image Helper (optimised for iOS gallery saving)
async function shareOrDownloadImage(imageUrl, fileName) {
  // If iOS and navigator.share is available
  if (isIOS && navigator.share && navigator.canShare) {
    try {
      showToast('Galeri için paylaşım paneli açılıyor...');
      
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Haber Görseli',
          text: 'Görseli Galeriye Kaydetmek için "Görseli Kaydet" seçeneğini seçin.'
        });
        showToast('Paylaşım paneli açıldı!');
        return;
      }
    } catch (err) {
      console.error('iOS Paylaşım/Kaydetme Hatası:', err);
      if (err.name === 'AbortError') {
        // User closed the share sheet, do nothing
        return;
      }
    }
  }
  
  // Fallback for iOS without share API (like non-HTTPS)
  if (isIOS) {
    showToast('iOS Galeri Kısıtlaması: Görsel açılıyor. Kaydetmek için üzerine BASILI TUTUP "Fotoğraflara Ekle" seçeneğini seçin.');
    setTimeout(() => {
      // Open in new window/tab so they can long-press save
      window.open(imageUrl, '_blank');
    }, 2500);
    return;
  }
  
  // Standard download for Android / Desktop
  try {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Görsel indirme başlatıldı!');
  } catch (err) {
    console.error('İndirme hatası:', err);
    window.open(imageUrl, '_blank');
  }
}

// Download/Share main headline image
async function downloadMainImage(event, index) {
  if (event) event.preventDefault();
  const item = newsItems[index];
  if (!item) return;
  
  // Auto-copy the news link to clipboard so the user has it ready
  copyToClipboard(item.link, 'Haber linki otomatik kopyalandı! Instagram\'da doğrudan yapıştırabilirsiniz.');
  
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(item.image)}`;
  await shareOrDownloadImage(proxyUrl, `batmansonsoz_haber_${index + 1}.jpg`);
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

// Load and Render Instagram Tags for the article
async function loadInstagramTags(articleUrl) {
  const copyTagsBtn = document.getElementById('btn-copy-tags');
  const tagsLoader = document.getElementById('tags-loader');
  const tagsContainer = document.getElementById('tags-container');
  const tagsEmpty = document.getElementById('tags-empty');

  // Reset UI states
  tagsLoader.classList.remove('d-none');
  tagsContainer.classList.add('d-none');
  tagsEmpty.classList.add('d-none');
  copyTagsBtn.classList.add('d-none');
  tagsContainer.innerHTML = '';

  try {
    const response = await fetch(`/api/extract-tags?url=${encodeURIComponent(articleUrl)}`);
    const result = await response.json();

    tagsLoader.classList.add('d-none');

    if (result.success && result.data.length > 0) {
      tagsContainer.classList.remove('d-none');
      copyTagsBtn.classList.remove('d-none');
      
      result.data.forEach((tag, idx) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tag-item';
        
        const isChecked = tag.isVerified ? 'checked' : '';
        const verifiedBadge = tag.isVerified ? '<span class="tag-badge-verified" title="Kayıtlı hesap"><i class="fa-solid fa-circle-check"></i></span>' : '';
        const searchKeyword = encodeURIComponent(tag.name);
        
        itemDiv.innerHTML = `
          <div class="tag-checkbox-container">
            <input type="checkbox" id="tag-check-${idx}" class="tag-checkbox" ${isChecked}>
          </div>
          <span class="tag-name-label" title="${tag.name}">${tag.name}</span>
          <div class="tag-input-wrapper">
            <input type="text" id="tag-input-${idx}" class="tag-input" value="${tag.handle}">
            ${verifiedBadge}
          </div>
          <a class="tag-search-btn" href="https://www.instagram.com/search/top/?q=${searchKeyword}" target="_blank" title="Instagram'da ara">
            <i class="fa-solid fa-magnifying-glass"></i>
          </a>
        `;
        tagsContainer.appendChild(itemDiv);
      });
      
      // Bind copy tags click event
      copyTagsBtn.onclick = () => {
        const selectedHandles = [];
        tagsContainer.querySelectorAll('.tag-item').forEach((item) => {
          const checkbox = item.querySelector('.tag-checkbox');
          const input = item.querySelector('.tag-input');
          if (checkbox.checked && input.value.trim()) {
            let handle = input.value.trim();
            // Ensure starts with @
            if (!handle.startsWith('@')) {
              handle = '@' + handle;
            }
            selectedHandles.push(handle);
          }
        });
        
        if (selectedHandles.length > 0) {
          const tagsText = selectedHandles.join(' ');
          copyToClipboard(tagsText, 'Seçili Instagram etiketleri kopyalandı! Paylaşırken yapıştırabilirsiniz.');
        } else {
          showToast('Lütfen en az bir etiket seçin.');
        }
      };

    } else {
      tagsEmpty.classList.remove('d-none');
    }
  } catch (err) {
    console.error('Tags load error:', err);
    tagsLoader.classList.add('d-none');
    tagsEmpty.classList.remove('d-none');
    const emptySpan = tagsEmpty.querySelector('span');
    if (emptySpan) {
      emptySpan.textContent = 'Etiketler yüklenirken hata oluştu.';
    }
  }
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
  const copyLinkBtn = document.getElementById('btn-modal-copy-link');
  
  // Show Modal & Loader
  modal.classList.remove('d-none');
  previewImg.classList.add('d-none');
  loadingIndicator.classList.remove('d-none');
  
  // Load Instagram Tags in background
  loadInstagramTags(item.link);
  
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
      downloadBtn.onclick = async () => {
        // Auto-copy the news link to clipboard so the user has it ready
        copyToClipboard(item.link, 'Haber linki otomatik kopyalandı! Instagram\'da doğrudan yapıştırabilirsiniz.');
        
        await shareOrDownloadImage(dataURL, `batmansonsoz_story_${index + 1}.jpg`);
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

      // Set up copy link behavior inside modal
      copyLinkBtn.onclick = () => {
        copyLink(item.link);
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
  
  // 1. Draw Solid Dark Gradient Background (Clean and premium dark layout)
  ctx.fillStyle = '#0a0b10'; // Fallback solid dark
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Premium subtle dark gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#12131a');
  grad.addColorStop(1, '#050608');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 1.5 Soft brand red glow behind the news image to fill empty space elegantly
  const glow = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 100,
    canvas.width / 2, canvas.height / 2, 700
  );
  glow.addColorStop(0, 'rgba(227, 0, 0, 0.14)'); // Soft red glow
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');      // Fades out
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1.8 Thin elegant card outer border frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 40, 40, canvas.width - 80, canvas.height - 80, 40);
  ctx.stroke();
  
  // 2. Brand Header (Top Area)
  ctx.fillStyle = '#E30000'; // Batman Sonsöz Brand Red
  ctx.fillRect(80, 110, 16, 45); // Vertical Accent bar
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.fillText('BATMAN SONSÖZ', 115, 144);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '500 24px "Outfit", sans-serif';
  ctx.fillText('GÜNLÜK MANŞET HABER', 115, 182);

  // 3. Draw Main News Image (Larger & Centered)
  const margin = 50;
  const imgW = canvas.width - (margin * 2); // 980px
  const imgH = imgW * (9 / 16); // 551px (standard 16:9 aspect ratio)
  const imgX = margin;
  const imgY = 360; // Perfectly positioned below header
  const imgRadius = 28;
  
  // Draw news image with rounded corners
  ctx.save();
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, imgRadius);
  ctx.clip();
  ctx.drawImage(newsImg, imgX, imgY, imgW, imgH);
  ctx.restore();
  
  // Subtle border around news image
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, imgRadius);
  ctx.stroke();

  // 4. Draw Call To Action Button Placeholder (Directly on blurred background)
  const ctaW = 560;
  const ctaH = 90;
  const ctaX = (canvas.width - ctaW) / 2; // Center horizontally
  const ctaY = 1180; // Positioned beautifully below the main image
  
  // Capsule Fill: Dark semi-transparent pill shape
  ctx.fillStyle = 'rgba(18, 20, 32, 0.9)';
  ctx.save();
  drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 45); // 45px radius makes it a perfect capsule
  // Subtle drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.restore();
  
  // Dashed border for sticker placement guide
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2.5;
  ctx.save();
  ctx.setLineDash([8, 6]); // Set dash pattern
  drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 45);
  ctx.stroke();
  ctx.restore();
  
  // CTA Text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = 'bold 24px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔗 Link Çıkartmasını Buraya Koyun', ctaX + (ctaW / 2), ctaY + 54);
  ctx.textAlign = 'left'; // Reset
  ctx.setLineDash([]); // Reset line dash
  
  // 5. Draw Click Animation Cursor (Mouse pointer with click ripples)
  const cursorX = ctaX + ctaW - 60;
  const cursorY = ctaY + ctaH / 2 + 10;
  
  // Concentric click waves
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cursorX, cursorY, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.arc(cursorX, cursorY, 25, 0, Math.PI * 2);
  ctx.stroke();
  
  // Mouse cursor arrow path
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#14151c';
  ctx.lineWidth = 3.5;
  ctx.save();
  ctx.translate(cursorX, cursorY);
  ctx.rotate(-Math.PI / 8); // rotated slightly to the left
  ctx.beginPath();
  ctx.moveTo(0, 0); // Tip of pointer is at translation origin (cursorX, cursorY)
  ctx.lineTo(0, 30);
  ctx.lineTo(8, 22);
  ctx.lineTo(16, 38);
  ctx.lineTo(21, 35);
  ctx.lineTo(13, 19);
  ctx.lineTo(22, 19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  
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

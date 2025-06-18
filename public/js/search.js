document.addEventListener('DOMContentLoaded', () => {
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
  });
  
  // Set initial theme
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }
  
  // Search functionality
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const searchResults = document.getElementById('search-results');
  
  function performSearch() {
    const query = searchInput.value.trim();
    if (query === '') return;
    
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(pictures => {
        if (pictures.length === 0) {
          searchResults.innerHTML = '<p>You are offically BLIND, try again</p>';
        } else {
          searchResults.innerHTML = pictures.map(pic => createPicCard(pic)).join('');
          
          // Add event listeners to like buttons
          document.querySelectorAll('.like-button').forEach(button => {
            button.addEventListener('click', handleLike);
          });
        }
      });
  }
  
  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
});

// Update the createPicCard function in all files
function createPicCard(pic) {
  return `
    <div class="pic-card ${pic.has_golden_sparkle ? 'golden-sparkle' : ''}">
      <img src="${pic.image_path}" alt="${pic.title}">
      <div class="pic-info">
        <h4 style="color: ${pic.title_color || '#ff6b9d'}">${pic.title}</h4>
        <span class="category">${pic.category}</span>
        <p class="tags">${pic.tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}</p>
        <button class="like-button ${isLiked(pic.id) ? 'liked' : ''}" data-id="${pic.id}">
          ❤️ <span class="like-count">${pic.likes}</span>
        </button>
      </div>
    </div>
  `;
}

// Add this helper function to track likes
function isLiked(picId) {
  const likedPics = JSON.parse(localStorage.getItem('likedPics') || '[]');
  return likedPics.includes(picId);
}

// Update the handleLike function
async function handleLike(e) {
  const button = e.currentTarget;
  const picId = button.getAttribute('data-id');
  
  if (button.classList.contains('liked')) {
    alert('You already liked this picture!');
    return;
  }
  
  try {
    const response = await fetch(`/api/like/${picId}`, { method: 'POST' });
    const data = await response.json();
    
    if (data.success) {
      // Update like count display
      const likeCount = button.querySelector('.like-count');
      likeCount.textContent = data.newLikeCount;
      
      // Mark as liked
      button.classList.add('liked');
      
      // Store in localStorage
      const likedPics = JSON.parse(localStorage.getItem('likedPics') || '[]');
      likedPics.push(picId);
      localStorage.setItem('likedPics', JSON.stringify(likedPics));
      
      // Add golden sparkle if applicable
      if (data.hasGoldenSparkle) {
        const card = button.closest('.pic-card');
        card.classList.add('golden-sparkle');
      }
    } else {
      alert(data.message || 'Could not like the picture');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to like the picture');
  }
}
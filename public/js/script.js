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
  
  // Load featured pictures
  fetch('/api/pictures?limit=6')
    .then(response => response.json())
    .then(pictures => {
      const featuredPics = document.getElementById('featured-pics');
      featuredPics.innerHTML = pictures.slice(0, 6).map(pic => createPicCard(pic)).join('');
      
      // Add event listeners to like buttons
      document.querySelectorAll('.like-button').forEach(button => {
        button.addEventListener('click', handleLike);
      });
    });
});

function createPicCard(pic) {
  return `
    <div class="pic-card">
      <img src="${pic.image_path}" alt="${pic.title}">
      <div class="pic-info">
        <h4>${pic.title}</h4>
        <span class="category">${pic.category}</span>
        <p class="tags">${pic.tags.split(',').map(tag => `#${tag.trim()}`).join(' ')}</p>
        <button class="like-button" data-id="${pic.id}">
          ❤️ <span class="like-count">${pic.likes}</span>
        </button>
      </div>
    </div>
  `;
}

function handleLike(e) {
  const button = e.currentTarget;
  const picId = button.getAttribute('data-id');
  
  fetch(`/api/like/${picId}`, { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const likeCount = button.querySelector('.like-count');
        likeCount.textContent = parseInt(likeCount.textContent) + 1;
        button.disabled = true;
        button.style.opacity = '0.7';
      } else {
        alert('You already liked this picture!');
      }
    });
}
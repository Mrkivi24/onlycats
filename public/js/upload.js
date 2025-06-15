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
  
  // Upload form
  const uploadForm = document.getElementById('upload-form');
  const uploadStatus = document.getElementById('upload-status');
  
  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(uploadForm);
    
    uploadStatus.textContent = 'Uploading...';
    uploadStatus.style.color = 'var(--primary-color)';
    
    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        uploadStatus.textContent = 'Upload successful!';
        uploadStatus.style.color = 'green';
        uploadForm.reset();
      } else {
        uploadStatus.textContent = `Error: ${data.error || 'Unknown error'}`;
        uploadStatus.style.color = 'red';
      }
    })
    .catch(error => {
      uploadStatus.textContent = `Error: ${error.message}`;
      uploadStatus.style.color = 'red';
    });
  });
});
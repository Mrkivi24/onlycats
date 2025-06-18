document.addEventListener('DOMContentLoaded', () => {
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
    
    // Set initial theme
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-mode');
    }
  }

  // Upload form handling
  const uploadForm = document.getElementById('upload-form');
  const uploadStatus = document.getElementById('upload-status');
  const colorInput = document.getElementById('title-color');
  const colorValue = document.getElementById('color-value');
  const imageInput = document.getElementById('image-upload');

  // Initialize color picker display
  if (colorInput && colorValue) {
    colorInput.addEventListener('input', () => {
      colorValue.textContent = colorInput.value;
    });
  }

  // Check file size before upload
  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];
      if (file && file.size > 10 * 1024 * 1024) { // 10MB limit
        showError('File size exceeds 10MB limit. Please choose a smaller file.');
        imageInput.value = ''; // Clear the file input
      }
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Basic form validation
      const titleInput = document.getElementById('title');
      const categorySelect = document.getElementById('category');
      const selectedCategory = categorySelect.value;
      const file = imageInput.files[0];
      
      // Check file size again (in case JavaScript was disabled)
      if (file && file.size > 10 * 1024 * 1024) {
        showError('File size exceeds 10MB limit. Please choose a smaller file.');
        return;
      }
      
      if (!file) {
        showError('Please select an image to upload');
        return;
      }
      
      if (!titleInput.value.trim()) {
        showError('Please enter a title for your cat picture');
        return;
      }
      
      if (!selectedCategory) {
        showError('Please select a category');
        return;
      }
      
      // Prepare form data
      const formData = new FormData(uploadForm);
      
      // Show uploading status
      showStatus('Uploading your cat...', 'var(--primary-color)');
      
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        // Handle non-JSON responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned an invalid response');
        }

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Upload failed with status ' + response.status);
        }
        
        if (data.success) {
          showStatus('Cat successfully uploaded! 😻', 'green');
          uploadForm.reset();
          
          // Reset color picker if exists
          if (colorInput) colorInput.value = '#ff6b9d';
          if (colorValue) colorValue.textContent = '#ff6b9d';
        } else {
          throw new Error(data.message || 'Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        showError(error.message || 'Failed to upload. Please try again.');
      }
    });
  }

  function showStatus(message, color) {
    if (uploadStatus) {
      uploadStatus.textContent = message;
      uploadStatus.style.color = color;
      uploadStatus.style.display = 'block';
    }
  }

  function showError(message) {
    showStatus(message, 'red');
  }
});
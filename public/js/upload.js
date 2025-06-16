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

  // Initialize color picker display
  if (colorInput && colorValue) {
    colorInput.addEventListener('input', () => {
      colorValue.textContent = colorInput.value;
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Basic form validation
      const imageInput = document.getElementById('image-upload');
      const titleInput = document.getElementById('title');
      const categorySelect = document.getElementById('category');
      const selectedCategory = categorySelect.value;
      
      if (!imageInput.files || imageInput.files.length === 0) {
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
      
      // Add title color if available
      if (colorInput) {
        formData.append('title_color', colorInput.value);
      }
      
      // Show uploading status
      showStatus('Uploading your cat...', 'var(--primary-color)');
      
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }
        
        if (data.success) {
          showStatus('Cat successfully uploaded! ', 'green');
          uploadForm.reset();
          
          // Reset color picker if exists
          if (colorInput) {
            colorInput.value = '#ff6b9d';
          }
          if (colorValue) {
            colorValue.textContent = '#ff6b9d';
          }
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
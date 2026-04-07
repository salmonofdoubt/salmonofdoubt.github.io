const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.16,
  rootMargin: '0px 0px -40px 0px'
});

revealEls.forEach((el) => observer.observe(el));

const dialog = document.getElementById('lightbox');
const dialogImg = document.getElementById('lightboxImage');
const dialogClose = document.getElementById('lightboxClose');
const galleryImgs = document.querySelectorAll('.gallery-card img');

if (dialog && dialogImg && dialogClose && galleryImgs.length) {
  galleryImgs.forEach((img) => {
    img.addEventListener('click', () => {
      dialogImg.src = img.dataset.full || img.src;
      dialogImg.alt = img.alt;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
  });

  const closeLightbox = () => {
    dialog.close();
    dialogImg.src = '';
    document.body.style.overflow = '';
  };

  dialogClose.addEventListener('click', closeLightbox);

  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    const clickedOutside = (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );

    if (clickedOutside) {
      closeLightbox();
    }
  });

  dialog.addEventListener('cancel', () => {
    dialogImg.src = '';
    document.body.style.overflow = '';
  });
}

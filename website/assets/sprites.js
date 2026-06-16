(function () {
  function injectSprite() {
    if (document.getElementById("logo-sprite")) {
      return;
    }

    const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sprite.setAttribute("id", "logo-sprite");
    sprite.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    sprite.setAttribute("aria-hidden", "true");
    sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    sprite.innerHTML = `
      <symbol id="logo-mark" viewBox="0 0 32 32">
        <g stroke="currentColor" stroke-linecap="square" stroke-width="2.15" fill="none">
          <path d="M3 28V15.5C3 15.5 6.5 8.5 16 8.5C25.5 8.5 29 15.5 29 15.5V28"/>
          <path d="M7.5 28V18.5C7.5 18.5 10.2 12.8 16 12.8C21.8 12.8 24.5 18.5 24.5 18.5V28"/>
          <path d="M12 28V21.2C12 21.2 13.8 17.5 16 17.5C18.2 17.5 20 21.2 20 21.2V28"/>
        </g>
        <path d="M3 29.5H29" stroke="url(#mark-accent)" stroke-width="1.5" stroke-linecap="square"/>
        <defs>
          <linearGradient id="mark-accent" x1="3" y1="0" x2="29" y2="0" gradientUnits="userSpaceOnUse">
            <stop stop-color="#4285F4"/>
            <stop offset="0.33" stop-color="#34A853"/>
            <stop offset="0.66" stop-color="#FBBC04"/>
            <stop offset="1" stop-color="#EA4335"/>
          </linearGradient>
        </defs>
      </symbol>
      <symbol id="logo-notebooktools" viewBox="0 0 380 32">
        <g stroke="currentColor" stroke-linecap="square" stroke-width="2.15" fill="none">
          <path d="M3 28V15.5C3 15.5 6.5 8.5 16 8.5C25.5 8.5 29 15.5 29 15.5V28"/>
          <path d="M7.5 28V18.5C7.5 18.5 10.2 12.8 16 12.8C21.8 12.8 24.5 18.5 24.5 18.5V28"/>
          <path d="M12 28V21.2C12 21.2 13.8 17.5 16 17.5C18.2 17.5 20 21.2 20 21.2V28"/>
        </g>
        <path d="M3 29.5H29" stroke="url(#mark-accent-wordmark)" stroke-width="1.5" stroke-linecap="square"/>
        <text
          x="42"
          y="24"
          fill="currentColor"
          font-family="'Google Sans', 'Product Sans', Roboto, Arial, sans-serif"
          font-size="22"
          font-weight="500"
          letter-spacing="-0.4"
        >NotebookTools</text>
        <defs>
          <linearGradient id="mark-accent-wordmark" x1="3" y1="0" x2="29" y2="0" gradientUnits="userSpaceOnUse">
            <stop stop-color="#4285F4"/>
            <stop offset="0.33" stop-color="#34A853"/>
            <stop offset="0.66" stop-color="#FBBC04"/>
            <stop offset="1" stop-color="#EA4335"/>
          </linearGradient>
        </defs>
      </symbol>
      <symbol id="logo-youtube" viewBox="0 0 24 24">
        <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
        <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </symbol>
    `;

    document.body.insertBefore(sprite, document.body.firstChild);
  }

  if (document.body) {
    injectSprite();
  } else {
    document.addEventListener("DOMContentLoaded", injectSprite);
  }
})();

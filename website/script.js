// Update this URL after Chrome Web Store approval (see version 0.1/CHROME_STORE_LISTING.md)
const CHROME_STORE_URL = "https://chromewebstore.google.com/";

const storeLink = document.getElementById("chrome-store-link");
if (storeLink && CHROME_STORE_URL) {
  storeLink.href = CHROME_STORE_URL;
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

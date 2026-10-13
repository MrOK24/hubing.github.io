(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav__link[href*="#"]'));
    if (!links.length) return;

    var items = links.map(function (link) {
      var href = link.getAttribute('href') || '';
      var hash = href.split('#')[1];
      if (!hash) return null;
      var target = document.getElementById(hash);
      if (!target) return null;
      return { link: link, target: target };
    }).filter(Boolean);

    if (!items.length) return;

    function setActive(activeLink) {
      links.forEach(function (link) {
        link.classList.toggle('nav-active', link === activeLink);
        if (link === activeLink) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function updateActiveLink() {
      var scrollY = window.scrollY + 120;
      var active = items[0].link;

      items.forEach(function (item) {
        if (item.target.getBoundingClientRect().top + window.scrollY <= scrollY) {
          active = item.link;
        }
      });

      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        active = items[items.length - 1].link;
      }

      setActive(active);
    }

    // Replace the legacy smooth-scroll offset so headings clear the sticky menu.
    if (window.jQuery) window.jQuery(links).off('click.smoothscroll');
    items.forEach(function (item) {
      item.link.addEventListener('click', function (event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var top = item.target.getBoundingClientRect().top + window.scrollY - 90;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
        window.history.replaceState(null, '', item.link.getAttribute('href'));
        setActive(item.link);
      });
    });

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    window.addEventListener('resize', updateActiveLink);
    updateActiveLink();
  });
})();

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var socialLinks = Array.prototype.slice.call(document.querySelectorAll('.author__social-link'));
    if (!socialLinks.length) return;

    socialLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        socialLinks.forEach(function (item) {
          item.classList.remove('is-selected');
        });
        link.classList.add('is-selected');
      });
    });
  });
})();

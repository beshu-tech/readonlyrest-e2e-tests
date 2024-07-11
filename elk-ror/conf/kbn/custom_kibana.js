console.log('ROR_METADATA', window.ROR_METADATA);

const logoHeader = document.querySelector('.euiHeaderLogo');

if (window.ROR_METADATA.newLogo) {
  Array.from(logoHeader.childNodes).forEach(node => {
    node.style.display = 'none';
  });

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        const customLogo = document.querySelector('#customLogo');

        const createCustomLogo = () => {
          const img = document.createElement('img');
          img.src = `data:image/svg+xml;base64,${window.ROR_METADATA.newLogo}`;
          img.style.width = '32px';
          img.style.height = '32px';
          img.id = 'customLogo';
          logoHeader.appendChild(img);
        };

        const hideAllLogoElements = () => {
          Array.from(logoHeader.childNodes).forEach(node => {
            node.style.display = 'none';
          });
        };

        const handleInit = () => {
          hideAllLogoElements();
          createCustomLogo();
        };

        if (customLogo) {
          const displayCustomLogo = () => {
            customLogo.style.display = 'block';
          };
          const hideCustomLogo = () => {
            customLogo.style.display = 'none';
          };
          if (node.role === 'progressbar') {
            hideCustomLogo();
          }

          if (node.role === 'img') {
            const hideDefaultLogo = () => {
              node.style.display = 'none';
            };

            hideDefaultLogo();
            displayCustomLogo();
          }
        }

        if (node.dataset.type === 'logoElastic' && !customLogo) {
          handleInit();
        }
      });
    });
  });

  observer.observe(logoHeader, { childList: true });
}

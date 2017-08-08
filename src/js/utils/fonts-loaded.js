import FontFaceObserver from 'fontfaceobserver';

var fontNormal = new FontFaceObserver('Stem Text');
var fontBold = new FontFaceObserver('Stem Text', {
  weight: 700
});
var fontCode = new FontFaceObserver('Fira Code');

Promise.all([fontNormal.load(), fontBold.load(), fontCode.load()]).then(function () {
  document.documentElement.classList.add('fonts-loaded');

  // Optimization for Repeat Views
  sessionStorage.fontsLoaded = true;
});

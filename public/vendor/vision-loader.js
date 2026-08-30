import * as vision from './vision_bundle.js';

window.FilesetResolver = vision.FilesetResolver;
window.FaceDetector = vision.FaceDetector;

window.dispatchEvent(new CustomEvent('vision-bundle-ready'));
